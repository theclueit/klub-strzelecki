import { supabase } from '@/lib/supabase'
import { Calendar } from 'lucide-react'
import CalendarGroups from '@/components/CalendarGroups'

export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const [eventsRes, memberRegsRes, guestRegsRes, eventDiscsRes, slotsRes, regDiscsRes] = await Promise.all([
    supabase
      .from('events')
      .select('*, discipline:disciplines(name)')
      .eq('is_published', true)
      .order('start_date', { ascending: false }),
    supabase
      .from('event_registrations')
      .select('event_id'),
    supabase
      .from('guest_registrations')
      .select('event_id')
      .neq('status', 'cancelled'),
    supabase
      .from('event_disciplines')
      .select('*, discipline:disciplines(name, stations_count, judges_per_station)')
      .order('price_pln'),
    supabase
      .from('event_discipline_slots')
      .select('*')
      .order('start_time'),
    supabase
      .from('registration_disciplines')
      .select('event_discipline_slot_id'),
  ])

  const events = eventsRes.data ?? []
  const allEventDiscs = (eventDiscsRes.data ?? []) as {
    id: string; event_id: string; discipline_id: string; price_pln: number;
    discipline?: { name: string; stations_count?: number; judges_per_station?: number } | null
  }[]
  const allSlots = (slotsRes.data ?? []) as {
    id: string; event_discipline_id: string; start_time: string; end_time: string; max_participants: number
  }[]
  const allRegDiscs = (regDiscsRes.data ?? []) as { event_discipline_slot_id: string | null }[]

  // Count registrations per slot
  const slotCounts: Record<string, number> = {}
  for (const rd of allRegDiscs) {
    if (rd.event_discipline_slot_id) {
      slotCounts[rd.event_discipline_slot_id] = (slotCounts[rd.event_discipline_slot_id] || 0) + 1
    }
  }

  // Count both member and guest registrations per event
  const regCounts: Record<string, number> = {}
  for (const r of (memberRegsRes.data ?? []) as { event_id: string }[]) {
    regCounts[r.event_id] = (regCounts[r.event_id] || 0) + 1
  }
  for (const r of (guestRegsRes.data ?? []) as { event_id: string }[]) {
    regCounts[r.event_id] = (regCounts[r.event_id] || 0) + 1
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Calendar className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">Kalendarz wydarzeń</h1>
      </div>

      {!events.length ? (
        <p className="text-muted">Brak nadchodzących wydarzeń.</p>
      ) : (
        <CalendarGroups
          events={events}
          allEventDiscs={allEventDiscs}
          allSlots={allSlots}
          slotCounts={slotCounts}
          regCounts={regCounts}
        />
      )}
    </div>
  )
}
