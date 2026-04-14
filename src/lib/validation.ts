/**
 * Zod validation schemas for API routes.
 * Centralised so frontend can reuse the same schemas if needed.
 */
import { z } from 'zod'

// ── Shared primitives ────────────────────────────────────────────────
const uuid = z.string().uuid()
const time24 = z.string().regex(/^\d{2}:\d{2}$/, 'Format HH:MM')
const dateISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format YYYY-MM-DD')
const safeStr = z.string().max(500)
const email = z.string().email().max(254)
const phone = z.string().max(30).optional()

// ── Feedback ─────────────────────────────────────────────────────────
export const feedbackSchema = z.object({
  type: z.enum(['bug', 'feature', 'feedback']).optional().default('feedback'),
  title: safeStr.min(1, 'Tytuł jest wymagany'),
  description: z.string().min(1, 'Opis jest wymagany').max(5000),
  email: email.optional(),
})

// ── Reservation Hold ─────────────────────────────────────────────────
export const holdCreateSchema = z.object({
  lane_id: uuid,
  station_number: z.number().int().min(1).max(50),
  stations_count: z.number().int().min(1).max(10).optional().default(1),
  reservation_date: dateISO,
  start_time: time24,
  end_time: time24,
})

export const holdExtendSchema = z.object({
  hold_token: uuid,
})

export const holdDeleteSchema = holdExtendSchema

// ── Reservation Confirm ──────────────────────────────────────────────
export const confirmSchema = z.object({
  hold_token: uuid,
  guest_name: safeStr.optional(),
  guest_email: email.optional(),
  guest_phone: phone,
  guest_address: safeStr.optional(),
  guest_document: safeStr.optional(),
  notes: safeStr.optional(),
  paid: z.boolean().optional(),
  pay_now: z.boolean().optional(),
})

// ── Guest Reservation ────────────────────────────────────────────────
export const guestReservationSchema = z.object({
  lane_id: uuid,
  station_number: z.number().int().min(1).max(50),
  stations_count: z.number().int().min(1).max(10).optional().default(1),
  reservation_date: dateISO,
  start_time: time24,
  end_time: time24,
  notes: safeStr.optional(),
  guest_name: safeStr.min(1, 'Imię wymagane'),
  guest_email: email,
  guest_phone: phone,
  guest_address: safeStr.min(1, 'Adres wymagany'),
  guest_document: safeStr.min(1, 'Numer dokumentu wymagany'),
  pay_now: z.boolean().optional(),
})

// ── Reservation Pay / Mark Paid ──────────────────────────────────────
export const reservationIdSchema = z.object({
  reservation_id: uuid,
})

// ── Guest Registration (events) ──────────────────────────────────────
const disciplineEntry = z.object({
  event_discipline_id: uuid,
  event_discipline_slot_id: uuid.optional(),
  own_weapon: z.boolean(),
})

export const registrationSchema = z.object({
  event_id: uuid,
  full_name: safeStr.min(1),
  email: email,
  phone: phone,
  experience: safeStr.optional(),
  has_license: z.boolean(),
  license_number: safeStr.optional(),
  message: z.string().max(2000).optional(),
  disciplines: z.array(disciplineEntry).optional(),
})

// ── Recreational Booking ─────────────────────────────────────────────
const bookingItem = z.object({
  package_id: uuid,
  date: dateISO,
  start_time: time24,
  instructor_id: uuid,
})

const guestData = z.object({
  name: safeStr.min(1),
  email: email,
  phone: safeStr.optional(),
  address: safeStr.min(1),
  document: safeStr.min(1),
})

export const recreationalBookSchema = z.object({
  items: z.array(bookingItem).min(1).optional(),
  // Legacy single-item fields
  package_id: uuid.optional(),
  date: dateISO.optional(),
  start_time: time24.optional(),
  instructor_id: uuid.optional(),
  notes: z.string().max(2000).optional(),
  guests: z.array(guestData).optional(),
  guest_name: safeStr.optional(),
  guest_email: email.optional(),
  guest_phone: phone,
  guest_address: safeStr.optional(),
  guest_document: safeStr.optional(),
})

// ── Analyze Target ───────────────────────────────────────────────────
export const analyzeTargetSchema = z.object({
  image: z.string().min(1, 'Brak obrazu'),
  discipline_name: safeStr.optional(),
  shots_count: z.number().int().min(1).max(200).optional(),
})

// ── Event Registration (zapisy) ──────────────────────────────────────
export const zapisySchema = z.object({
  event_id: uuid,
  disciplines: z.array(disciplineEntry).optional(),
})

export const zapisyDyscyplinySchema = z.object({
  registration_id: uuid,
  disciplines: z.array(disciplineEntry).min(1),
})

// ── Results ──────────────────────────────────────────────────────────
export const resultSchema = z.object({
  member_id: uuid,
  event_id: uuid.optional(),
  discipline_id: uuid.optional(),
  total_score: z.number().min(0).max(99999),
  max_score: z.number().min(0).max(99999).optional(),
  tens_count: z.number().int().min(0).optional(),
  xs_count: z.number().int().min(0).optional(),
  misses: z.number().int().min(0).optional(),
  shots: z.any().optional(),
  judge_comment: z.string().max(2000).optional(),
  time_seconds: z.number().min(0).optional(),
})

// ── Ammo ─────────────────────────────────────────────────────────────
export const ammoCreateSchema = z.object({
  booking_id: uuid,
  inventory_item_id: uuid,
  quantity: z.number().int().min(1).max(10000),
})

// ── Email routes ─────────────────────────────────────────────────────
export const emailEventSchema = z.object({
  event_id: uuid,
  discipline_id: uuid.optional(),
})

export const emailRegistrationSchema = z.object({
  registration_id: uuid,
})

// ── Payments ─────────────────────────────────────────────────────────
export const paymentCreateSchema = z.object({
  registration_id: uuid,
})

export const paymentCallbackSchema = z.object({
  sessionId: z.string().min(1),
  amount: z.number().int().min(0),
  currency: z.string().optional(),
  orderId: z.number().int(),
})

// ── Recreational Onsite ──────────────────────────────────────────────
export const recreationalOnsiteSchema = z.object({
  weapon_id: uuid,
  instructor_id: uuid,
  date: dateISO,
  start_time: time24,
  duration_minutes: z.number().int().min(15).max(480),
  ammo_count: z.number().int().min(0).optional(),
  price_pln: z.number().min(0).optional(),
  guest_name: safeStr.optional(),
  guest_phone: phone,
  guest_address: safeStr.optional(),
  guest_document: safeStr.optional(),
  guest_email: email.optional(),
  notes: z.string().max(2000).optional(),
  member_id: uuid.optional(),
  package_id: uuid.optional(),
})

// ── Helper: parse body and return typed result or error Response ──────
export function parseBody<T>(schema: z.ZodSchema<T>, data: unknown):
  | { success: true; data: T }
  | { success: false; error: string } {
  const result = schema.safeParse(data)
  if (!result.success) {
    const firstIssue = result.error.issues[0]
    const path = firstIssue.path.join('.')
    return {
      success: false,
      error: path ? `${path}: ${firstIssue.message}` : firstIssue.message,
    }
  }
  return { success: true, data: result.data }
}
