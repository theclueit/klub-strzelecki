import type { Member } from '@/types/database'

export type Step = 'login' | 'select-event' | 'select-member' | 'select-discipline' | 'photo' | 'review' | 'done'

export interface AssignedEvent {
  id: string
  event_id: string
  event: { id: string; title: string; start_date: string; end_date: string | null }
  memberCount?: number
  scoredCount?: number
}

export interface EventDisciplineRow {
  id: string
  discipline_id: string
  discipline: { id: string; name: string; scoring_type?: string } | null
}
