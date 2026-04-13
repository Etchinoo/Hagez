// ============================================================
// SUPER RESERVATION PLATFORM — Manual Booking Modal
// MB-SHARED-01 through MB-CW-01: shared field set + all 5
// category-specific field sets (Restaurant, Salon, Court,
// Gaming Cafe, Car Wash). Fully RTL, Arabic labels.
// ============================================================

'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  bookingsApi, staffApi, servicesApi, sectionsApi,
  courtsApi, stationsApi, gamingConfigApi,
  baysApi, carWashConfigApi,
} from '@/services/api';
import { useDashboardAuth } from '@/store/auth';
import { format } from 'date-fns';

// ── Types ──────────────────────────────────────────────────────

type BookingSource   = 'walk_in' | 'phone_call' | 'whatsapp' | 'referral' | 'other';
type PaymentMethod   = 'cash' | 'paid_externally';
type SessionType     = 'solo' | 'duo' | 'group_room';
type DropOffOrWait   = 'customer_waiting' | 'drop_off';

// ── Static data ───────────────────────────────────────────────

const SOURCES: { value: BookingSource; label: string }[] = [
  { value: 'walk_in',    label: 'حضور مباشر'      },
  { value: 'phone_call', label: 'مكالمة هاتفية'   },
  { value: 'whatsapp',   label: 'واتساب'           },
  { value: 'referral',   label: 'إحالة'            },
  { value: 'other',      label: 'أخرى'             },
];

const OCCASIONS = [
  { value: '',            label: 'لا يوجد'        },
  { value: 'birthday',    label: '🎂 عيد ميلاد'   },
  { value: 'anniversary', label: '💑 ذكرى سنوية'  },
  { value: 'business',    label: '💼 اجتماع عمل'  },
  { value: 'graduation',  label: '🎓 تخرج'        },
  { value: 'engagement',  label: '💍 خطوبة'        },
  { value: 'other',       label: 'أخرى'           },
];

const SPORT_TYPES = [
  { value: 'padel',      label: 'بادل'         },
  { value: 'football_5', label: 'كرة قدم 5'    },
  { value: 'football_7', label: 'كرة قدم 7'    },
  { value: 'basketball', label: 'كرة سلة'      },
  { value: 'tennis',     label: 'تنس'           },
  { value: 'squash',     label: 'سكواش'         },
];

const SPORT_PLAYER_RANGE: Record<string, { min: number; max: number }> = {
  padel:       { min: 2, max: 4  },
  football_5:  { min: 2, max: 10 },
  football_7:  { min: 2, max: 14 },
  basketball:  { min: 2, max: 10 },
  tennis:      { min: 2, max: 4  },
  squash:      { min: 2, max: 2  },
};

const GAME_GENRES = [
  { value: '',           label: 'بلا تفضيل'   },
  { value: 'fps',        label: 'FPS'          },
  { value: 'racing',     label: 'سباق'         },
  { value: 'sports',     label: 'رياضة'        },
  { value: 'fighting',   label: 'قتال'         },
  { value: 'open_world', label: 'عالم مفتوح'  },
];

const VEHICLE_TYPES = [
  { value: 'sedan',      label: 'سيدان'            },
  { value: 'suv',        label: 'SUV / كروس أوفر'  },
  { value: 'pickup',     label: 'بيك أب'            },
  { value: 'van',        label: 'فان / ميني باص'    },
  { value: 'motorcycle', label: 'موتوسيكل'          },
];

const CW_SERVICE_PACKAGES = [
  { value: 'exterior_wash',  label: 'غسيل خارجي',         duration: 30  },
  { value: 'full_interior',  label: 'غسيل داخلي وخارجي',  duration: 60  },
  { value: 'deep_clean',     label: 'تنظيف عميق',         duration: 90  },
  { value: 'polish_wax',     label: 'تلميع وشمع',         duration: 120 },
  { value: 'engine_clean',   label: 'تنظيف المحرك',       duration: 60  },
  { value: 'full_detailing', label: 'تلميع شامل',         duration: 180 },
];

const CW_ADDONS = [
  { value: 'air_freshener',    label: 'معطر هواء',        duration: 0  },
  { value: 'tyre_shine',       label: 'تلميع الإطارات',   duration: 5  },
  { value: 'seat_protection',  label: 'حماية الكراسي',    duration: 10 },
  { value: 'dashboard_polish', label: 'تلميع التابلوه',   duration: 10 },
];

// ── Helpers ────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const p = raw.trim().replace(/\s+/g, '');
  if (p.startsWith('+'))  return p;
  if (p.startsWith('00')) return '+' + p.slice(2);
  if (p.startsWith('0'))  return '+2' + p;
  return '+20' + p;
}

function isValidEgyptPhone(phone: string): boolean {
  return /^\+20(10|11|12|15)\d{8}$/.test(normalizePhone(phone));
}

function addMinutesToTime(timeStr: string, minutes: number): string {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function toggleArr<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];
}

// ── Props ──────────────────────────────────────────────────────

interface ManualBookingModalProps {
  onClose: () => void;
  selectedDate?: Date;
}

// ── Component ─────────────────────────────────────────────────

export default function ManualBookingModal({ onClose, selectedDate }: ManualBookingModalProps) {
  const { user } = useDashboardAuth();
  const category = user?.business_category ?? 'restaurant';
  const qc = useQueryClient();

  const today = format(new Date(), 'yyyy-MM-dd');
  const defaultDate = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : today;

  // ── Shared state ───────────────────────────────────────────
  const [guestName, setGuestName]       = useState('');
  const [guestPhone, setGuestPhone]     = useState('+20');
  const [date, setDate]                 = useState(defaultDate);
  const [time, setTime]                 = useState('');
  const [source, setSource]             = useState<BookingSource>('walk_in');
  const [notes, setNotes]               = useState('');
  const [depositWaived, setDepositWaived] = useState(true);
  const [depositAmount, setDepositAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [sendWhatsapp, setSendWhatsapp] = useState(true);

  // ── Restaurant state ───────────────────────────────────────
  const [partySize, setPartySize]       = useState(2);
  const [sectionId, setSectionId]       = useState('');
  const [occasion, setOccasion]         = useState('');
  const [slotDuration, setSlotDuration] = useState(60);

  // ── Salon state ────────────────────────────────────────────
  const [stylistId, setStylistId]       = useState('');
  const [serviceIds, setServiceIds]     = useState<string[]>([]);

  // ── Sports Court state ─────────────────────────────────────
  const [sportType, setSportType]       = useState('');
  const [courtId, setCourtId]           = useState('');
  const [courtDuration, setCourtDuration] = useState(60);
  const [playerCount, setPlayerCount]   = useState(2);
  const [squadShare, setSquadShare]     = useState(false);

  // ── Gaming Cafe state ──────────────────────────────────────
  const [sessionType, setSessionType]   = useState<SessionType>('solo');
  const [stationType, setStationType]   = useState('');
  const [groupRoomId, setGroupRoomId]   = useState('');
  const [gamingDuration, setGamingDuration] = useState(60);
  const [numPlayers, setNumPlayers]     = useState(2);
  const [gameGenre, setGameGenre]       = useState('');

  // ── Car Wash state ─────────────────────────────────────────
  const [vehicleType, setVehicleType]   = useState('');
  const [servicePackage, setServicePackage] = useState('');
  const [cwAddonIds, setCwAddonIds]     = useState<string[]>([]);
  const [dropOffOrWait, setDropOffOrWait] = useState<DropOffOrWait>('customer_waiting');
  const [bayId, setBayId]               = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');

  // ── Submit state ───────────────────────────────────────────
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');
  const [conflictSuggestion, setConflictSuggestion] = useState('');

  // ── Data queries ───────────────────────────────────────────

  const { data: sectionsData } = useQuery({
    queryKey: ['sections'],
    queryFn: () => sectionsApi.list().then((r) => r.data),
    enabled: category === 'restaurant',
  });

  const { data: staffData } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list().then((r) => r.data),
    enabled: category === 'salon',
  });

  const { data: servicesData } = useQuery({
    queryKey: ['services'],
    queryFn: () => servicesApi.list().then((r) => r.data),
    enabled: category === 'salon',
  });

  const { data: courtsData } = useQuery({
    queryKey: ['courts'],
    queryFn: () => courtsApi.list().then((r) => r.data),
    enabled: category === 'court',
  });

  const { data: stationsData } = useQuery({
    queryKey: ['stations'],
    queryFn: () => stationsApi.list().then((r) => r.data),
    enabled: category === 'gaming_cafe',
  });

  const { data: gamingCfg } = useQuery({
    queryKey: ['gaming-config'],
    queryFn: () => gamingConfigApi.get().then((r) => r.data),
    enabled: category === 'gaming_cafe',
  });

  const { data: baysData } = useQuery({
    queryKey: ['bays'],
    queryFn: () => baysApi.list().then((r) => r.data),
    enabled: category === 'car_wash',
  });

  const { data: cwCfg } = useQuery({
    queryKey: ['car-wash-config'],
    queryFn: () => carWashConfigApi.get().then((r) => r.data),
    enabled: category === 'car_wash',
  });

  // ── Derived values ─────────────────────────────────────────

  const phoneValid = isValidEgyptPhone(guestPhone);

  const activeSections  = (sectionsData?.sections  ?? []).filter((s: any) => s.is_active !== false);
  const activeStaff     = (staffData?.staff         ?? []).filter((s: any) => s.is_active !== false);
  const activeServices  = (servicesData?.services   ?? []).filter((s: any) => s.is_active !== false);
  const activeCourts    = (courtsData?.courts        ?? []).filter((c: any) => c.is_active !== false);
  const allStations     = (stationsData?.stations    ?? []).filter((s: any) => s.is_active !== false);
  const activeBays      = (baysData?.bays            ?? []).filter((b: any) => b.is_active !== false);

  const groupRooms      = allStations.filter((s: any) => s.station_type === 'group_room');
  const regularStations = allStations.filter((s: any) => s.station_type !== 'group_room');

  // Salon: total duration from selected services
  const selectedServices = activeServices.filter((s: any) => serviceIds.includes(s.id));
  const totalSalonMin = selectedServices.reduce((sum: number, s: any) => sum + (s.duration_min ?? 0), 0);

  // Car Wash: estimated ready time
  const cwPkgDuration   = CW_SERVICE_PACKAGES.find((p) => p.value === servicePackage)?.duration ?? 0;
  const cwAddonDuration = cwAddonIds.reduce((sum, id) => sum + (CW_ADDONS.find((a) => a.value === id)?.duration ?? 0), 0);
  const cwBufferMin     = cwCfg?.buffer_minutes ?? 15;
  const cwTotalMin      = cwPkgDuration + cwAddonDuration + cwBufferMin;
  const estimatedReady  = time ? addMinutesToTime(time, cwTotalMin) : '';

  // Gaming config duration options (fallback to 1h/2h/3h)
  const gamingDurationOptions: number[] = gamingCfg?.slot_duration_options?.length
    ? gamingCfg.slot_duration_options
    : [60, 120, 180];

  // Court duration options
  const courtDurationOptions = [60, 90, 120];

  // ── Submit ─────────────────────────────────────────────────

  const handleSubmit = async () => {
    setError('');
    setConflictSuggestion('');

    // Shared validation
    if (guestName.trim().length < 2) { setError('اسم الضيف مطلوب (حرفان على الأقل)'); return; }
    if (!phoneValid)                  { setError('رقم الهاتف غير صحيح — أدخل رقم مصري صحيح'); return; }
    if (!date)                        { setError('التاريخ مطلوب'); return; }
    if (!time)                        { setError('الوقت مطلوب'); return; }
    if (!depositWaived && !depositAmount) { setError('أدخل مبلغ العربون أو فعّل خيار إلغاء العربون'); return; }

    // Category-specific validation
    if (category === 'restaurant' && partySize < 1)   { setError('عدد الأشخاص مطلوب'); return; }
    if (category === 'salon') {
      if (!stylistId)            { setError('اختر المصفف/ة'); return; }
      if (!serviceIds.length)    { setError('اختر خدمة واحدة على الأقل'); return; }
    }
    if (category === 'court') {
      if (!sportType)  { setError('اختر نوع الرياضة'); return; }
      if (!courtId)    { setError('اختر الملعب'); return; }
    }
    if (category === 'gaming_cafe') {
      if (sessionType !== 'group_room' && !stationType) { setError('اختر نوع المحطة'); return; }
      if (sessionType === 'group_room' && !groupRoomId) { setError('اختر غرفة المجموعة'); return; }
    }
    if (category === 'car_wash') {
      if (!vehicleType)    { setError('اختر نوع السيارة'); return; }
      if (!servicePackage) { setError('اختر باقة الخدمة'); return; }
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        guest_name:     guestName.trim(),
        guest_phone:    normalizePhone(guestPhone),
        date,
        time,
        source,
        notes:          notes.trim() || undefined,
        deposit_waived: depositWaived,
        deposit_amount: !depositWaived ? Number(depositAmount) : undefined,
        payment_method: !depositWaived ? paymentMethod : undefined,
        send_whatsapp:  phoneValid ? sendWhatsapp : false,
      };

      if (category === 'restaurant') {
        payload.party_size       = partySize;
        payload.section_id       = sectionId || undefined;
        payload.occasion         = occasion  || undefined;
        payload.slot_duration_min = slotDuration;
      } else if (category === 'salon') {
        payload.stylist_id  = stylistId;
        payload.service_ids = serviceIds;
      } else if (category === 'court') {
        payload.sport_type   = sportType;
        payload.court_id     = courtId;
        payload.duration_min = courtDuration;
        payload.player_count = playerCount;
        payload.squad_share  = squadShare;
      } else if (category === 'gaming_cafe') {
        payload.session_type = sessionType;
        payload.duration_min = gamingDuration;
        payload.game_genre   = gameGenre || undefined;
        if (sessionType === 'group_room') {
          payload.group_room_id = groupRoomId;
          payload.num_players   = numPlayers;
        } else {
          payload.station_type  = stationType;
        }
      } else if (category === 'car_wash') {
        payload.vehicle_type     = vehicleType;
        payload.service_package  = servicePackage;
        payload.cw_addon_ids     = cwAddonIds.length ? cwAddonIds : undefined;
        payload.drop_off_or_wait = dropOffOrWait;
        payload.bay_id           = bayId        || undefined;
        payload.vehicle_plate    = vehiclePlate.trim() || undefined;
      }

      await bookingsApi.createManual(payload);
      qc.invalidateQueries({ queryKey: ['business-bookings'] });
      onClose();
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      const msg  = err?.response?.data?.error?.message ?? 'فشل إنشاء الحجز. حاول مرة أخرى.';
      if (code === 'SLOT_UNAVAILABLE') {
        setError('هذا الوقت محجوز — اختر وقتاً آخر');
        const suggested = err?.response?.data?.suggested_time;
        if (suggested) setConflictSuggestion(suggested);
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <div style={ms.overlay} onClick={onClose}>
      <div style={ms.panel} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={ms.header}>
          <span style={ms.headerTitle}>+ إضافة حجز يدوي</span>
          <button style={ms.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={ms.body}>

          {/* ── Shared Fields ─────────────────────────────── */}
          <Section title="بيانات الضيف">
            <TwoCol>
              <Field label="اسم الضيف *">
                <input style={inp} value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="أدخل الاسم" maxLength={60} dir="rtl" />
              </Field>
              <Field label="رقم الهاتف *">
                <input style={inp} value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="+201XXXXXXXXX" dir="ltr" type="tel" />
              </Field>
            </TwoCol>
            <TwoCol>
              <Field label="التاريخ *">
                <input style={inp} type="date" value={date} min={today}
                  onChange={(e) => setDate(e.target.value)} dir="ltr" />
              </Field>
              <Field label="الوقت *">
                <input style={inp} type="time" value={time} dir="ltr"
                  onChange={(e) => { setTime(e.target.value); setConflictSuggestion(''); }} />
              </Field>
            </TwoCol>

            {/* Conflict banner (MB-SHARED-02) */}
            {conflictSuggestion && (
              <div style={ms.conflictBanner}>
                <span>هذا الوقت محجوز — اختر وقتاً آخر</span>
                <button style={ms.conflictChip}
                  onClick={() => { setTime(conflictSuggestion); setConflictSuggestion(''); setError(''); }}>
                  {conflictSuggestion} ‹
                </button>
              </div>
            )}

            <Field label="مصدر الحجز *">
              <select style={inp} value={source}
                onChange={(e) => setSource(e.target.value as BookingSource)}>
                {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="ملاحظات / طلبات خاصة">
              <textarea style={{ ...inp, height: 64, resize: 'vertical' as const }}
                value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="أي طلبات أو معلومات إضافية..." maxLength={200} dir="rtl" />
            </Field>
          </Section>

          {/* ── Restaurant Fields (MB-REST-01) ──────────── */}
          {category === 'restaurant' && (
            <Section title="تفاصيل الحجز — مطعم">
              <TwoCol>
                <Field label="عدد الأشخاص *">
                  <div style={ms.stepper}>
                    <button style={ms.stepBtn} type="button"
                      onClick={() => setPartySize(Math.max(1, partySize - 1))}>−</button>
                    <span style={ms.stepVal}>{partySize}</span>
                    <button style={ms.stepBtn} type="button"
                      onClick={() => setPartySize(Math.min(20, partySize + 1))}>+</button>
                  </div>
                </Field>
                <Field label="القسم">
                  <select style={inp} value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}>
                    <option value="">أي قسم</option>
                    {activeSections.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name_ar}</option>
                    ))}
                  </select>
                </Field>
              </TwoCol>
              <TwoCol>
                <Field label="المناسبة">
                  <select style={inp} value={occasion}
                    onChange={(e) => setOccasion(e.target.value)}>
                    {OCCASIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
                <Field label="مدة الجلسة">
                  <select style={inp} value={slotDuration}
                    onChange={(e) => setSlotDuration(Number(e.target.value))}>
                    {[30, 60, 90, 120].map((d) => (
                      <option key={d} value={d}>{d} دقيقة</option>
                    ))}
                  </select>
                </Field>
              </TwoCol>
            </Section>
          )}

          {/* ── Salon Fields (MB-SAL-01) ─────────────────── */}
          {category === 'salon' && (
            <Section title="تفاصيل الحجز — صالون">
              <Field label="المصفف/ة *">
                <select style={inp} value={stylistId}
                  onChange={(e) => { setStylistId(e.target.value); setServiceIds([]); }}>
                  <option value="">اختر المصفف/ة</option>
                  {activeStaff.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name_ar}</option>
                  ))}
                </select>
              </Field>
              <Field label="الخدمات *"
                hint={!stylistId ? 'اختر المصفف/ة أولاً لتفعيل هذا الحقل' : undefined}>
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4,
                  opacity: stylistId ? 1 : 0.4,
                  pointerEvents: stylistId ? 'auto' : 'none',
                }}>
                  {activeServices.map((svc: any) => (
                    <button key={svc.id} type="button"
                      style={{ ...chip, ...(serviceIds.includes(svc.id) ? chipActive : {}) }}
                      onClick={() => setServiceIds(toggleArr(serviceIds, svc.id))}>
                      {svc.name_ar}
                      <span style={{ marginRight: 4, opacity: 0.7, fontSize: 11 }}>
                        ({svc.duration_min} د)
                      </span>
                    </button>
                  ))}
                </div>
              </Field>
              {totalSalonMin > 0 && (
                <div style={ms.durationDisplay}>
                  المدة الإجمالية: <strong>{totalSalonMin} دقيقة</strong>
                  {time && (
                    <span style={{ marginRight: 8, opacity: 0.7 }}>
                      (تنتهي عند {addMinutesToTime(time, totalSalonMin)})
                    </span>
                  )}
                </div>
              )}
            </Section>
          )}

          {/* ── Sports Court Fields (MB-COURT-01) ────────── */}
          {category === 'court' && (
            <Section title="تفاصيل الحجز — ملعب">
              <TwoCol>
                <Field label="نوع الرياضة *">
                  <select style={inp} value={sportType}
                    onChange={(e) => { setSportType(e.target.value); setCourtId(''); setPlayerCount(2); }}>
                    <option value="">اختر الرياضة</option>
                    {SPORT_TYPES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="الملعب *">
                  <select style={inp} value={courtId}
                    onChange={(e) => setCourtId(e.target.value)}
                    disabled={!sportType}>
                    <option value="">اختر الملعب</option>
                    {activeCourts.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name_ar}</option>
                    ))}
                  </select>
                </Field>
              </TwoCol>
              <TwoCol>
                <Field label="المدة *">
                  <select style={inp} value={courtDuration}
                    onChange={(e) => setCourtDuration(Number(e.target.value))}>
                    {courtDurationOptions.map((d) => (
                      <option key={d} value={d}>{d} دقيقة</option>
                    ))}
                  </select>
                </Field>
                <Field label={`عدد اللاعبين${sportType ? ` (${SPORT_PLAYER_RANGE[sportType]?.min ?? 2}–${SPORT_PLAYER_RANGE[sportType]?.max ?? 14})` : ''}`}>
                  <div style={ms.stepper}>
                    <button style={ms.stepBtn} type="button"
                      onClick={() => setPlayerCount(Math.max(SPORT_PLAYER_RANGE[sportType]?.min ?? 2, playerCount - 1))}>−</button>
                    <span style={ms.stepVal}>{playerCount}</span>
                    <button style={ms.stepBtn} type="button"
                      onClick={() => setPlayerCount(Math.min(SPORT_PLAYER_RANGE[sportType]?.max ?? 14, playerCount + 1))}>+</button>
                  </div>
                </Field>
              </TwoCol>
              <label style={ms.toggleRow}>
                <span style={ms.toggleLabel}>إرسال بطاقة واتساب للمجموعة</span>
                <Toggle on={squadShare} onChange={setSquadShare} />
              </label>
            </Section>
          )}

          {/* ── Gaming Cafe Fields (MB-GAME-01) ─────────── */}
          {category === 'gaming_cafe' && (
            <Section title="تفاصيل الحجز — جيمينج كافيه">
              <Field label="نوع الجلسة *">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                  {([
                    { value: 'solo',       label: 'فردي'        },
                    { value: 'duo',        label: 'ثنائي'        },
                    { value: 'group_room', label: 'غرفة مجموعة' },
                  ] as { value: SessionType; label: string }[]).map((s) => (
                    <button key={s.value} type="button"
                      style={{ ...chip, ...(sessionType === s.value ? chipActive : {}) }}
                      onClick={() => { setSessionType(s.value); setStationType(''); setGroupRoomId(''); }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </Field>

              {sessionType !== 'group_room' ? (
                <Field label="نوع المحطة *">
                  <select style={inp} value={stationType}
                    onChange={(e) => setStationType(e.target.value)}>
                    <option value="">اختر النوع</option>
                    {/* Use configured station types from gaming config if available */}
                    {(gamingCfg?.station_types?.length
                      ? gamingCfg.station_types
                      : ['PC', 'console', 'VR']
                    ).map((t: string) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </Field>
              ) : (
                <>
                  <Field label="غرفة المجموعة *">
                    <select style={inp} value={groupRoomId}
                      onChange={(e) => setGroupRoomId(e.target.value)}>
                      <option value="">اختر الغرفة</option>
                      {groupRooms.map((r: any) => (
                        <option key={r.id} value={r.id}>{r.name_ar}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="عدد اللاعبين (2–8)">
                    <div style={ms.stepper}>
                      <button style={ms.stepBtn} type="button"
                        onClick={() => setNumPlayers(Math.max(2, numPlayers - 1))}>−</button>
                      <span style={ms.stepVal}>{numPlayers}</span>
                      <button style={ms.stepBtn} type="button"
                        onClick={() => setNumPlayers(Math.min(8, numPlayers + 1))}>+</button>
                    </div>
                  </Field>
                </>
              )}

              <TwoCol>
                <Field label="المدة *">
                  <select style={inp} value={gamingDuration}
                    onChange={(e) => setGamingDuration(Number(e.target.value))}>
                    {gamingDurationOptions.map((d) => (
                      <option key={d} value={d}>
                        {d >= 60 ? `${d / 60} ${d === 60 ? 'ساعة' : 'ساعات'}` : `${d} دقيقة`}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="تفضيل الألعاب">
                  <select style={inp} value={gameGenre}
                    onChange={(e) => setGameGenre(e.target.value)}>
                    {GAME_GENRES.map((g) => (
                      <option key={g.value} value={g.value}>{g.label}</option>
                    ))}
                  </select>
                </Field>
              </TwoCol>
            </Section>
          )}

          {/* ── Car Wash Fields (MB-CW-01) ─────────────── */}
          {category === 'car_wash' && (
            <Section title="تفاصيل الحجز — غسيل سيارات">
              <TwoCol>
                <Field label="نوع السيارة *">
                  <select style={inp} value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}>
                    <option value="">اختر النوع</option>
                    {VEHICLE_TYPES.map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="باقة الخدمة *">
                  <select style={inp} value={servicePackage}
                    onChange={(e) => setServicePackage(e.target.value)}>
                    <option value="">اختر الباقة</option>
                    {CW_SERVICE_PACKAGES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label} ({p.duration} د)
                      </option>
                    ))}
                  </select>
                </Field>
              </TwoCol>
              <Field label="إضافات (اختياري)">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {CW_ADDONS.map((a) => (
                    <button key={a.value} type="button"
                      style={{ ...chip, ...(cwAddonIds.includes(a.value) ? chipActive : {}) }}
                      onClick={() => setCwAddonIds(toggleArr(cwAddonIds, a.value))}>
                      {a.label}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="طريقة الاستلام *">
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  {([
                    { value: 'customer_waiting', label: 'سينتظر'         },
                    { value: 'drop_off',          label: 'سيسلم السيارة' },
                  ] as { value: DropOffOrWait; label: string }[]).map((o) => (
                    <button key={o.value} type="button"
                      style={{ ...chip, ...(dropOffOrWait === o.value ? chipActive : {}) }}
                      onClick={() => setDropOffOrWait(o.value)}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </Field>
              <TwoCol>
                <Field label="الكوبينة (اختياري)">
                  <select style={inp} value={bayId}
                    onChange={(e) => setBayId(e.target.value)}>
                    <option value="">تعيين لاحقاً (TBD)</option>
                    {activeBays.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name_ar}</option>
                    ))}
                  </select>
                </Field>
                <Field label="لوحة / وصف السيارة (اختياري)">
                  <input style={inp} value={vehiclePlate}
                    onChange={(e) => setVehiclePlate(e.target.value)}
                    placeholder="مثال: ABC 123 — يارس فضي"
                    maxLength={20} dir="ltr" />
                </Field>
              </TwoCol>
              {servicePackage && time && (
                <div style={ms.durationDisplay}>
                  تقدير الجاهزية: <strong>{estimatedReady}</strong>
                  <span style={{ marginRight: 6, fontSize: 11, opacity: 0.7 }}>
                    (شامل {cwBufferMin} د مرونة)
                  </span>
                </div>
              )}
            </Section>
          )}

          {/* ── Deposit & Payment (MB-SHARED-01 §4–5) ──── */}
          <Section title="العربون والدفع">
            <label style={ms.toggleRow}>
              <span style={ms.toggleLabel}>إلغاء العربون — مجاناً</span>
              <Toggle on={depositWaived} onChange={setDepositWaived} />
            </label>
            {!depositWaived && (
              <TwoCol>
                <Field label="مبلغ العربون (ج.م)">
                  <input style={inp} type="number" min="0" value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0" dir="ltr" />
                </Field>
                <Field label="طريقة الدفع">
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    {([
                      { value: 'cash',           label: 'كاش'        },
                      { value: 'paid_externally', label: 'دفع خارجي' },
                    ] as { value: PaymentMethod; label: string }[]).map((m) => (
                      <button key={m.value} type="button"
                        style={{ ...chip, ...(paymentMethod === m.value ? chipActive : {}) }}
                        onClick={() => setPaymentMethod(m.value)}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </TwoCol>
            )}
          </Section>

          {/* ── WhatsApp Toggle (MB-SHARED-04) ──────────── */}
          <Section title="إشعار واتساب">
            <label style={ms.toggleRow}>
              <span style={{ ...ms.toggleLabel, opacity: phoneValid ? 1 : 0.5 }}>
                {phoneValid
                  ? 'إرسال تأكيد واتساب للضيف'
                  : 'رقم الهاتف غير صحيح — لن يتم الإرسال'}
              </span>
              <Toggle
                on={sendWhatsapp && phoneValid}
                onChange={(v) => phoneValid && setSendWhatsapp(v)}
              />
            </label>
          </Section>

        </div>{/* /body */}

        {/* Error */}
        {error && <div style={ms.errBox}>{error}</div>}

        {/* Footer */}
        <div style={ms.footer}>
          <button style={ms.cancelBtn} type="button" onClick={onClose}>إلغاء</button>
          <button
            style={{ ...ms.saveBtn, opacity: saving ? 0.7 : 1 }}
            type="button"
            onClick={handleSubmit}
            disabled={saving}>
            {saving ? 'جاري الحفظ...' : 'حفظ الحجز'}
          </button>
        </div>

      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, color: '#6B7280',
        textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 12,
        fontFamily: 'Inter, sans-serif',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: 'block', fontSize: 12, fontWeight: 600,
        color: '#374151', marginBottom: 4, fontFamily: 'Cairo, sans-serif',
      }}>
        {label}
      </label>
      {hint && (
        <p style={{ fontSize: 11, color: '#9CA3AF', margin: '0 0 4px', fontFamily: 'Cairo, sans-serif' }}>
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      role="switch"
      aria-checked={on}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: on ? '#1B8A7A' : '#D1D5DB',
        position: 'relative', cursor: 'pointer',
        transition: 'background 0.2s', flexShrink: 0,
      }}
      onClick={() => onChange(!on)}
    >
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3,
        left: on ? 23 : 3,
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
      }} />
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  border: '1.5px solid #E5E7EB', borderRadius: 8,
  fontFamily: 'Cairo, sans-serif', fontSize: 14,
  color: '#0F2044', boxSizing: 'border-box',
  background: '#fff',
};

const chip: React.CSSProperties = {
  padding: '6px 14px', borderRadius: 20,
  border: '1.5px solid #E5E7EB',
  background: '#F9FAFB',
  fontFamily: 'Cairo, sans-serif', fontSize: 13, fontWeight: 600,
  color: '#6B7280', cursor: 'pointer',
};

const chipActive: React.CSSProperties = {
  background: '#0F2044', borderColor: '#0F2044', color: '#fff',
};

const ms: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1100, direction: 'rtl',
  },
  panel: {
    background: '#fff', borderRadius: 20,
    width: 560, maxWidth: '96vw',
    maxHeight: '92vh', display: 'flex', flexDirection: 'column',
    boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid #E5E7EB',
    flexShrink: 0,
  },
  headerTitle: {
    fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: 18,
    color: '#0F2044',
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 18,
    cursor: 'pointer', color: '#9CA3AF', padding: 4,
  },
  body: {
    flex: 1, overflowY: 'auto', padding: '24px',
  },
  conflictBanner: {
    background: '#FEF2F2', border: '1px solid #FECACA',
    borderRadius: 8, padding: '10px 14px',
    display: 'flex', alignItems: 'center', gap: 10,
    fontSize: 13, color: '#B91C1C',
    fontFamily: 'Cairo, sans-serif', marginBottom: 12,
  },
  conflictChip: {
    background: '#0F2044', color: '#fff', border: 'none',
    borderRadius: 6, padding: '4px 10px',
    fontFamily: 'Cairo, sans-serif', fontSize: 13, cursor: 'pointer',
  },
  stepper: {
    display: 'flex', alignItems: 'center', gap: 12,
  },
  stepBtn: {
    width: 36, height: 36, borderRadius: 8,
    border: '1.5px solid #E5E7EB', background: '#F9FAFB',
    fontSize: 18, cursor: 'pointer', color: '#374151',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  stepVal: {
    fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: 18, color: '#0F2044',
    minWidth: 28, textAlign: 'center',
  },
  durationDisplay: {
    background: '#F0FDF4', border: '1px solid #BBF7D0',
    borderRadius: 8, padding: '10px 14px',
    fontFamily: 'Cairo, sans-serif', fontSize: 13, color: '#166534',
    marginBottom: 12,
  },
  toggleRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, cursor: 'pointer', marginBottom: 12,
  },
  toggleLabel: {
    fontFamily: 'Cairo, sans-serif', fontSize: 14, color: '#374151', fontWeight: 600,
  },
  errBox: {
    background: '#FEE2E2', color: '#B91C1C',
    padding: '12px 24px', fontSize: 13,
    fontFamily: 'Cairo, sans-serif', flexShrink: 0,
  },
  footer: {
    display: 'flex', gap: 12, padding: '16px 24px',
    borderTop: '1px solid #E5E7EB', flexShrink: 0,
    justifyContent: 'flex-start',
  },
  cancelBtn: {
    padding: '10px 24px', background: '#F3F4F6', border: 'none',
    borderRadius: 8, fontFamily: 'Cairo, sans-serif', fontSize: 14,
    fontWeight: 600, color: '#374151', cursor: 'pointer',
  },
  saveBtn: {
    padding: '10px 28px', background: '#0F2044', border: 'none',
    borderRadius: 8, fontFamily: 'Cairo, sans-serif', fontSize: 14,
    fontWeight: 700, color: '#fff', cursor: 'pointer',
  },
};
