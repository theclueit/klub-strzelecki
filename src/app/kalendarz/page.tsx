import { supabase } from '@/lib/supabase'
import { Calendar } from 'lucide-react'
import EventCard from '@/components/EventCard'

export const revalidate = 60

export default async function CalendarPage() {
  const [eventsRes, memberRegsRes, guestRegsRes] = await Promise.all([
    supabase
      .from('events')
      .select('*, discipline:disciplines(name)')
      .eq('is_published', true)
      .order('start_date', { ascending: true }),
    supabase
      .from('event_registrations')
      .select('event_id'),
    supabase
      .from('guest_registrations')
      .select('event_id')
      .neq('status', 'cancelled'),
  ])

  const events = eventsRes.data ?? []

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
        <div className="space-y-4">
          {events.map((event: any) => (
            <EventCard
              key={event.id}
              event={event}
              regCount={regCounts[event.id] ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}
