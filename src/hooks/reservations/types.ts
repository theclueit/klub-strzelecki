export interface Lane {
  id: string
  name: string
  length_m: number
  stations_count: number
  description: string | null
  price_per_hour_pln: number
  open_time: string
  close_time: string
  min_advance_minutes: number
}

export interface Reservation {
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
  hold_token: string | null
  hold_expires_at: string | null
  event?: { title: string } | null
  member?: { full_name: string } | null
}

export interface RangeWeapon {
  id: string
  name: string
  type: string
  caliber: string
  status: string
}

export interface ShootingPackage {
  id: string
  name: string
  weapon_id: string
  ammo_count: number
  duration_minutes: number
  price_pln: number
}

export interface Instructor {
  id: string
  full_name: string
}

// Generate 30-min slots between open and close
export function getLaneSlots(lane: Lane | null): string[] {
  if (!lane) return []
  const openH = parseInt(lane.open_time?.split(':')[0] || '8')
  const openM = parseInt(lane.open_time?.split(':')[1] || '0')
  const closeH = parseInt(lane.close_time?.split(':')[0] || '20')
  const closeM = parseInt(lane.close_time?.split(':')[1] || '0')
  const startMin = openH * 60 + openM
  const endMin = closeH * 60 + closeM
  const slots: string[] = []
  for (let m = startMin; m < endMin; m += 30) {
    const h = Math.floor(m / 60)
    const mm = m % 60
    slots.push(`${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`)
  }
  return slots
}
