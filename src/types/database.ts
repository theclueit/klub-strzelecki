export interface Member {
  id: string
  email: string
  full_name: string
  phone: string | null
  license_number: string | null
  class: 'Mistrz' | 'I' | 'II' | 'III'
  joined_at: string
  avatar_url: string | null
  qr_code: string | null
  is_active: boolean
  role: 'member' | 'judge' | 'admin' | 'registrar'
  created_at: string
  judge_class: string | null
  judge_license_number: string | null
  is_range_officer: boolean
  has_weapons_permit: boolean
  is_sports_instructor: boolean
  club_name: string
  range_officer_number: string | null
  shooting_patent_number: string | null
  // Sign-in sheet fields
  pesel: string | null
  date_of_birth: string | null
  address: string | null
  id_document_number: string | null
  id_document_type: string | null
  weapon_permit_number: string | null
  weapon_permit_issuing_authority: string | null
  data_confirmed_at: string | null
}

export interface MemberWeapon {
  id: string
  member_id: string
  name: string
  type: string
  caliber: string
  serial_number: string
  permit_number: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Discipline {
  id: string
  name: string
  description: string | null
  target_type: string | null
  category: 'discipline' | 'service'
  default_price_pln: number
  own_weapon_price_pln: number
  stations_count: number
  judges_per_station: number
  participants_per_hour: number
  // Ammunition & materials
  caliber: string | null
  shots_count: number
  ammo_per_pack: number
  targets_per_competitor: number
  distance_m: number | null
  target_name: string | null
}

export interface Event {
  id: string
  title: string
  description: string | null
  event_type: 'competition' | 'training' | 'course' | 'other'
  discipline_id: string | null
  start_date: string
  end_date: string | null
  location: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  stations_count: number | null
  max_participants: number | null
  price_pln: number
  is_published: boolean
  allow_target_photos: boolean
  created_at: string
  discipline?: Discipline
}

export interface EventRegistration {
  id: string
  event_id: string
  member_id: string
  registered_at: string
  status: 'registered' | 'confirmed' | 'cancelled'
  paid: boolean
  start_number: number | null
  member?: Member
}

export interface Result {
  id: string
  member_id: string
  event_id: string | null
  discipline_id: string | null
  judge_id: string | null
  total_score: number
  max_score: number | null
  shots: number[] | null
  tens_count: number
  xs_count: number
  misses: number
  grouping_mm: number | null
  target_image_url: string | null
  ai_analysis: string | null
  judge_comment: string | null
  shot_at: string
  created_at: string
  member?: Member
  discipline?: Discipline
  event?: Event
  judge?: Member
}

export interface Ranking {
  id: string
  member_id: string
  discipline_id: string | null
  total_points: number
  competitions_count: number
  best_score: number
  average_score: number
  rank_position: number | null
  season: string
  updated_at: string
  member?: Member
  discipline?: Discipline
}

export interface EventDiscipline {
  id: string
  event_id: string
  discipline_id: string
  price_pln: number
  own_weapon_price_pln: number
  discipline?: Discipline
}

export interface EventDisciplineSlot {
  id: string
  event_discipline_id: string
  start_time: string
  end_time: string
  max_participants: number
  created_at: string
}

export interface RegistrationDiscipline {
  id: string
  event_discipline_id: string
  member_registration_id: string | null
  guest_registration_id: string | null
  event_discipline_slot_id: string | null
  price_pln: number
  own_weapon: boolean
  event_discipline?: EventDiscipline
}

export interface Database {
  public: {
    Tables: {
      members: { Row: Member }
      disciplines: { Row: Discipline }
      events: { Row: Event }
      event_registrations: { Row: EventRegistration }
      event_disciplines: { Row: EventDiscipline }
      event_discipline_slots: { Row: EventDisciplineSlot }
      registration_disciplines: { Row: RegistrationDiscipline }
      results: { Row: Result }
      rankings: { Row: Ranking }
    }
  }
}
