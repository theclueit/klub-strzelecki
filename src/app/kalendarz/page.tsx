import { supabase } from '@/lib/supabase'
import { Calendar } from 'lucide-react'
import EventCard from '@/components/EventCard'

export const revalidate = 60

export default async function CalendarPage() {
  const [eventsRes, registrationsRes] = await Promise.all([
    supabase
      .from('events')
      .select('*, discipline:disciplines(name)')
      .eq('is_published', true)
      .order('start_date', { ascending: true }),
    supabase
      .from('event_registrations')
      .select('event_id, member_id'),
  ])

  const events = eventsRes.data ?? []
  const registrations = (registrationsRes.data ?? []) as { event_id: string; member_id: string }[]

  const regCounts = registrations.reduce<Record<string, number>>((acc, r) => {
    acc[r.event_id] = (acc[r.event_id] || 0) + 1
    return acc
  }, {})

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
