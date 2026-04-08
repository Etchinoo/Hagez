-- ============================================================
-- Migration 016: Service Catalog
-- Admin-managed service templates per business category.
-- Business owners select from this catalog instead of creating
-- free-form services — ensures quality and category alignment.
-- ============================================================

CREATE TABLE service_catalog (
  id                   UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  category             TEXT           NOT NULL,
  name_ar              VARCHAR(200)   NOT NULL,
  name_en              VARCHAR(200),
  typical_duration_min SMALLINT       NOT NULL DEFAULT 30,
  is_active            BOOLEAN        NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ    NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ    NOT NULL DEFAULT now()
);

CREATE INDEX service_catalog_category_active_idx ON service_catalog (category, is_active);

-- Seed: common services per category so admins start with a baseline
-- No prices — each business owner sets their own pricing
INSERT INTO service_catalog (category, name_ar, name_en, typical_duration_min) VALUES
  -- Restaurant
  ('restaurant', 'حجز طاولة', 'Table Reservation', 90),
  ('restaurant', 'حفلة خاصة', 'Private Party', 180),
  ('restaurant', 'إفطار جماعي', 'Group Breakfast', 60),

  -- Salon
  ('salon', 'قص شعر رجالي', 'Men''s Haircut', 30),
  ('salon', 'قص شعر سيدات', 'Women''s Haircut', 60),
  ('salon', 'صبغة شعر', 'Hair Coloring', 120),
  ('salon', 'بلوايت', 'Highlights', 150),
  ('salon', 'كيراتين', 'Keratin Treatment', 180),
  ('salon', 'مانيكير', 'Manicure', 45),
  ('salon', 'باديكير', 'Pedicure', 60),

  -- Sports Court
  ('court', 'حجز ملعب', 'Court Booking', 60),
  ('court', 'دوري تنس', 'Tennis League', 90),
  ('court', 'تدريب شخصي', 'Personal Training', 60),

  -- Gaming Cafe
  ('gaming_cafe', 'جلسة ألعاب', 'Gaming Session', 60),
  ('gaming_cafe', 'جلسة جماعية', 'Group Session', 120),
  ('gaming_cafe', 'حجز غرفة', 'Room Booking', 60),

  -- Car Wash
  ('car_wash', 'غسيل عادي', 'Standard Wash', 30),
  ('car_wash', 'غسيل بريميوم', 'Premium Wash', 60),
  ('car_wash', 'تفصيل كامل', 'Full Detailing', 180),
  ('car_wash', 'تلميع', 'Polishing', 120),

  -- Medical
  ('medical', 'استشارة طبية', 'Medical Consultation', 30),
  ('medical', 'فحص دوري', 'Routine Check-up', 45),
  ('medical', 'اشعة', 'X-Ray', 30);
