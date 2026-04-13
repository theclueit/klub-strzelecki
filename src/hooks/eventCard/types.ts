export interface EventDisc {
  id: string
  discipline_id: string
  price_pln: number
  own_weapon_price_pln?: number
  discipline?: { name: string; stations_count?: number; judges_per_station?: number } | null
}

export interface EventSlot {
  id: string
  event_discipline_id: string
  start_time: string
  end_time: string
  max_participants: number
  current_count: number
}

export interface EventCardEvent {
  id: string
  title: string
  description: string | null
  event_type: string
  start_date: string
  end_date: string | null
  location: string | null
  address: string | null
  max_participants: number | null
  price_pln: number
  discipline?: { name: string } | null
}

export type RegMode = null | 'choose' | 'member' | 'guest' | 'confirm_data'
