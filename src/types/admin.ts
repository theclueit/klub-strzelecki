import type { Discipline, Member, EventDiscipline, EventDisciplineSlot } from './database'

export interface EventRow {
  id: string
  title: string
  description: string | null
  event_type: string
  discipline_id: string | null
  start_date: string
  end_date: string | null
  location: string | null
  address: string | null
  max_participants: number | null
  price_pln: number
  is_published: boolean
  allow_target_photos: boolean
}

export interface EventJudge {
  id: string
  event_id: string
  judge_id: string
  status: string | null
  notified_at: string | null
  confirmed_at: string | null
  discipline_ids?: string[]
}

export interface GuestReg {
  id: string
  event_id: string
  full_name: string
  email: string
  phone: string | null
  experience: string | null
  has_license: boolean
  license_number: string | null
  message: string | null
  registered_at: string
  status: string
}

export interface RegDiscipline {
  id: string
  event_discipline_id: string
  member_registration_id: string | null
  guest_registration_id: string | null
  event_discipline_slot_id: string | null
  price_pln: number
  own_weapon: boolean
}

export interface InventoryItem {
  id: string
  name: string
  category: string
  description: string | null
  caliber: string | null
  quantity: number
  unit: string
  purchase_price_pln: number
  sell_price_pln: number | null
  purchase_date: string | null
  supplier: string | null
  min_stock_level: number
  location: string | null
  updated_at: string | null
}

export interface InventoryTransaction {
  id: string
  inventory_item_id: string
  type: 'in' | 'out' | 'event_out'
  quantity: number
  note: string | null
  event_id: string | null
  performed_by: string | null
  created_at: string
  performer?: { full_name: string }
  event?: { title: string }
}

export interface Regulation {
  id: string
  slug: string
  title: string
  content: string
  version: number
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ShootingLane {
  id: string
  name: string
  length_m: number
  stations_count: number
  description: string | null
  is_active: boolean
  price_per_hour_pln: number
}

export interface LaneReservation {
  id: string
  lane_id: string
  station_number: number
  member_id: string | null
  event_id: string | null
  reservation_date: string
  start_time: string
  end_time: string
  status: string
  paid: boolean
  guest_name: string | null
  notes: string | null
  member?: { full_name: string }
  event?: { title: string }
  lane?: { name: string }
}

export interface LoginEntry {
  id: string
  member_id: string | null
  auth_id: string | null
  email: string | null
  full_name: string | null
  ip_address: string | null
  user_agent: string | null
  event_type: string
  created_at: string
}

export type Tab = 'events' | 'disciplines' | 'judges' | 'registrations' | 'inventory' | 'regulations' | 'ranges' | 'instructors'

export type MemberReg = {
  id: string
  event_id: string
  member_id: string
  registered_at: string
  status: string
  paid?: boolean
  start_number?: number
  member?: Member
}

export type RangeWeapon = {
  id: string
  name: string
  type: string
  caliber: string
  status: string
  description: string | null
  inventory_ammo_id: string | null
  is_active: boolean
}

export type ShootingPackage = {
  id: string
  name: string
  description: string | null
  weapon_id: string
  ammo_count: number
  duration_minutes: number
  price_pln: number
  is_active: boolean
}

export type InstructorAvailability = {
  id: string
  instructor_id: string
  day_of_week: number
  start_time: string
  end_time: string
  is_active: boolean
  instructor?: { full_name: string }
}

export type OnlineUser = {
  id: string
  full_name: string
  role: string
  last_seen_at: string
}
