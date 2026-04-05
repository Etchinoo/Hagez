// ============================================================
// SUPER RESERVATION PLATFORM — Search & Discovery Routes
// GET /search/businesses
// GET /search/autocomplete
// GET /businesses/:id
// GET /businesses/:id/slots
// GET /businesses/:id/reviews
// ============================================================

import type { FastifyPluginAsync } from 'fastify';

// ── Haversine distance (km) ────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Ranking score (US-014) ─────────────────────────────────────
// base = (1 / max(distance_km, 0.1)) × (rating / 5) × (available / max(total, 1))
// featured boost: ×1.3
// new business (<5 reviews, joined ≤30 days ago): ×1.1
function rankScore(opts: {
  distanceKm: number | null;
  ratingAvg: number;
  availableSlots: number;
  totalSlots: number;
  isFeatured: boolean;
  reviewCount: number;
  createdAt: Date;
}): number {
  const proximity = opts.distanceKm !== null ? 1 / Math.max(opts.distanceKm, 0.1) : 1;
  const rating = opts.ratingAvg / 5;
  const availability = opts.availableSlots / Math.max(opts.totalSlots, 1);

  let score = proximity * rating * availability;

  if (opts.isFeatured) score *= 1.3;

  const isNew =
    opts.reviewCount < 5 &&
    Date.now() - opts.createdAt.getTime() <= 30 * 24 * 60 * 60 * 1000;
  if (isNew) score *= 1.1;

  return score;
}

const searchRoutes: FastifyPluginAsync = async (fastify) => {
  // ── GET /search/businesses ─────────────────────────────────

  fastify.get<{
    Querystring: {
      category?: string;
      district?: string;
      date?: string;
      party_size?: string;
      min_rating?: string;
      cuisine_type?: string;
      service_type?: string;
      indoor_outdoor?: string;
      price_range?: string;
      lat?: string;
      lng?: string;
      page?: string;
      limit?: string;
    };
  }>(
    '/search/businesses',
    { preHandler: fastify.authenticateOptional },
    async (request, reply) => {
      const {
        category,
        district,
        date,
        party_size,
        min_rating,
        cuisine_type,
        service_type,
        indoor_outdoor,
        price_range,
        lat,
        lng,
        page = '1',
        limit = '20',
      } = request.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
      const offset = (pageNum - 1) * limitNum;
      const partySizeNum = party_size ? parseInt(party_size) : 1;
      const userLat = lat ? parseFloat(lat) : null;
      const userLng = lng ? parseFloat(lng) : null;

      const whereClause: any = { status: 'active' };
      if (category) whereClause.category = category;
      if (district) whereClause.district = { contains: district, mode: 'insensitive' };
      if (min_rating) whereClause.rating_avg = { gte: parseFloat(min_rating) };
      if (cuisine_type) whereClause.cuisine_type = cuisine_type;
      if (service_type) whereClause.service_type = service_type;
      if (indoor_outdoor) whereClause.indoor_outdoor = indoor_outdoor;
      if (price_range) whereClause.price_range = price_range;

      const now = new Date();
      const dateStart = date ? new Date(date) : now;
      const dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000);

      // Fetch a broader pool for ranking (3× page size, min 60)
      const fetchLimit = Math.max(limitNum * 3, 60);

      const businesses = await fastify.db.business.findMany({
        where: whereClause,
        include: {
          photos: { orderBy: { sort_order: 'asc' }, take: 3 },
          slots: {
            where: {
              start_time: { gte: dateStart, lt: dateEnd },
              capacity: { gte: partySizeNum },
            },
            select: { id: true, status: true, start_time: true, end_time: true, capacity: true, booked_count: true, deposit_amount: true },
            orderBy: { start_time: 'asc' },
          },
          _count: {
            select: {
              slots: {
                where: {
                  start_time: { gte: now },
                  status: 'available',
                },
              },
            },
          },
        },
        take: fetchLimit,
      });

      // Total upcoming slots per business (for availability density)
      const businessIds = businesses.map((b) => b.id);
      const totalSlotCounts =
        businessIds.length > 0
          ? await fastify.db.slot.groupBy({
              by: ['business_id'],
              where: {
                business_id: { in: businessIds },
                start_time: { gte: now },
              },
              _count: { id: true },
            })
          : [];
      const totalSlotsMap = new Map(
        totalSlotCounts.map((r) => [r.business_id, r._count.id])
      );

      // Score and sort
      const scored = businesses.map((b) => {
        const distanceKm =
          userLat !== null && userLng !== null && b.lat !== null && b.lng !== null
            ? haversineKm(userLat, userLng, Number(b.lat), Number(b.lng))
            : null;

        const availableSlots = b._count.slots;
        const totalSlots = totalSlotsMap.get(b.id) ?? 0;

        const score = rankScore({
          distanceKm,
          ratingAvg: Number(b.rating_avg),
          availableSlots,
          totalSlots,
          isFeatured: b.is_featured,
          reviewCount: b.review_count,
          createdAt: b.created_at,
        });

        return { b, distanceKm, score };
      });

      scored.sort((a, z) => z.score - a.score);

      const total = scored.length;
      const page_results = scored.slice(offset, offset + limitNum);

      return reply.send({
        businesses: page_results.map(({ b, distanceKm }) => ({
          id: b.id,
          name_ar: b.name_ar,
          name_en: b.name_en,
          category: b.category,
          district: b.district,
          rating_avg: Number(b.rating_avg),
          review_count: b.review_count,
          is_featured: b.is_featured,
          photos: b.photos.map((p) => p.url),
          distance_km: distanceKm !== null ? Math.round(distanceKm * 10) / 10 : null,
          next_available_slots: b.slots
            .filter((s) => s.status === 'available')
            .slice(0, 3)
            .map((s) => ({
              id: s.id,
              start_time: s.start_time.toISOString(),
              end_time: s.end_time.toISOString(),
              available_capacity: s.capacity - s.booked_count,
              deposit_amount: Number(s.deposit_amount),
            })),
        })),
        total,
        page: pageNum,
        has_more: offset + page_results.length < total,
      });
    }
  );

  // ── GET /search/autocomplete ───────────────────────────────

  fastify.get<{ Querystring: { q: string; category?: string } }>(
    '/search/autocomplete',
    { preHandler: fastify.authenticateOptional },
    async (request, reply) => {
      const { q, category } = request.query;
      if (!q || q.length < 2) return reply.send({ suggestions: [] });

      const whereClause: any = {
        status: 'active',
        OR: [
          { name_ar: { contains: q, mode: 'insensitive' } },
          { name_en: { contains: q, mode: 'insensitive' } },
          { district: { contains: q, mode: 'insensitive' } },
        ],
      };
      if (category) whereClause.category = category;

      const results = await fastify.db.business.findMany({
        where: whereClause,
        select: { id: true, name_ar: true, name_en: true, category: true, district: true },
        take: 8,
        orderBy: [{ is_featured: 'desc' }, { rating_avg: 'desc' }],
      });

      return reply.send({
        suggestions: results.map((r) => ({
          id: r.id,
          name_ar: r.name_ar,
          name_en: r.name_en,
          category: r.category,
          district: r.district,
        })),
      });
    }
  );

  // ── GET /businesses/:id ────────────────────────────────────

  fastify.get<{ Params: { id: string } }>(
    '/businesses/:id',
    { preHandler: fastify.authenticateOptional },
    async (request, reply) => {
      const business = await fastify.db.business.findUnique({
        where: { id: request.params.id, status: 'active' },
        include: {
          photos: { orderBy: { sort_order: 'asc' } },
          resources: { where: { is_active: true } },
          slots: {
            where: { start_time: { gte: new Date() }, status: 'available' },
            orderBy: { start_time: 'asc' },
            take: 3,
          },
        },
      });

      if (!business) {
        return reply.code(404).send({
          error: {
            code: 'BUSINESS_NOT_FOUND',
            message: 'Business not found.',
            message_ar: 'المكان غير موجود.',
          },
        });
      }

      const isNew = business.review_count < 5;

      return reply.send({
        id: business.id,
        name_ar: business.name_ar,
        name_en: business.name_en,
        category: business.category,
        district: business.district,
        description_ar: business.description_ar,
        description_en: business.description_en,
        rating_avg: isNew ? null : Number(business.rating_avg),
        review_count: business.review_count,
        is_new: isNew,
        location: { lat: Number(business.lat), lng: Number(business.lng) },
        photos: business.photos.map((p) => p.url),
        staff: business.category === 'salon' ? business.resources : [],
        next_available_slots: business.slots.map((s) => ({
          id: s.id,
          start_time: s.start_time.toISOString(),
          end_time: s.end_time.toISOString(),
          available_capacity: s.capacity - s.booked_count,
          deposit_amount: Number(s.deposit_amount),
        })),
      });
    }
  );

  // ── GET /businesses/:id/slots (US-016) ────────────────────
  // Real-time availability — Redis-cached for 60s per date+partySize+resource.
  // Cache invalidated on booking confirmation (in booking engine).

  fastify.get<{
    Params: { id: string };
    Querystring: { date?: string; party_size?: string; resource_id?: string };
  }>(
    '/businesses/:id/slots',
    { preHandler: fastify.authenticateOptional },
    async (request, reply) => {
      const { id } = request.params;
      const { date, party_size = '1', resource_id } = request.query;
      const partySizeNum = parseInt(party_size);

      const dateStart = date ? new Date(date) : new Date();
      const dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000);
      const dateKey = dateStart.toISOString().slice(0, 10);

      // Try Redis cache first (60-second TTL — real-time per US-016)
      const cacheKey = `SLOTS:${id}:${dateKey}:${partySizeNum}:${resource_id ?? 'any'}`;
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        return reply.send(JSON.parse(cached));
      }

      const whereClause: any = {
        business_id: id,
        start_time: { gte: dateStart, lt: dateEnd },
        status: 'available',
        capacity: { gte: partySizeNum },
      };
      if (resource_id) whereClause.resource_id = resource_id;

      const slots = await fastify.db.slot.findMany({
        where: whereClause,
        orderBy: { start_time: 'asc' },
      });

      const payload = {
        slots: slots.map((s) => ({
          id: s.id,
          start_time: s.start_time.toISOString(),
          end_time: s.end_time.toISOString(),
          duration_minutes: s.duration_minutes,
          available_capacity: s.capacity - s.booked_count,
          deposit_amount: Number(s.deposit_amount),
          cancellation_window_hours: s.cancellation_window_hours,
        })),
      };

      await fastify.redis.set(cacheKey, JSON.stringify(payload), 'EX', 60);
      return reply.send(payload);
    }
  );

  // ── GET /businesses/:id/reviews ────────────────────────────

  fastify.get<{
    Params: { id: string };
    Querystring: { page?: string; limit?: string };
  }>('/businesses/:id/reviews', async (request, reply) => {
    const { id } = request.params;
    const page = parseInt(request.query.page ?? '1');
    const limit = Math.min(20, parseInt(request.query.limit ?? '10'));
    const offset = (page - 1) * limit;

    const [reviews, total, business] = await Promise.all([
      fastify.db.review.findMany({
        where: { business_id: id, status: 'approved' },
        include: { consumer: { select: { full_name: true } } },
        orderBy: { created_at: 'desc' },
        skip: offset,
        take: limit,
      }),
      fastify.db.review.count({ where: { business_id: id, status: 'approved' } }),
      fastify.db.business.findUnique({ where: { id }, select: { rating_avg: true, review_count: true } }),
    ]);

    return reply.send({
      reviews: reviews.map((r) => ({
        rating: r.rating,
        body: r.body,
        consumer_name: r.consumer.full_name,
        created_at: r.created_at.toISOString(),
      })),
      avg_rating: business && business.review_count >= 5 ? Number(business.rating_avg) : null,
      total,
    });
  });
};

export default searchRoutes;
