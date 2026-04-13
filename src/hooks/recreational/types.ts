export interface Weapon {
  id: string
  name: string
  type: string
  caliber: string
  description: string | null
}

export interface RecPackage {
  id: string
  name: string
  description: string | null
  weapon_id: string
  ammo_count: number
  duration_minutes: number
  price_pln: number
  weapon: Weapon
}

export interface Lane {
  id: string
  name: string
  length_m: number
  stations_count: number
  open_time: string
  close_time: string
}

export interface TimeSlot {
  time: string
  available: boolean
  instructorId: string | null
  instructorName: string | null
}

export interface CartItem {
  pkg: RecPackage
  date: string
  slot: TimeSlot
}

export interface GuestForm {
  name: string
  email: string
  phone: string
  address: string
  document: string
}
