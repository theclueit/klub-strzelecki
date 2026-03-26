'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import EventCard from '@/components/EventCard'

interface EventDisc {
  id: string
  event_id: string
  discipline_id: string
  price_pln: number
  discipline?: { name: string; stations_count?: number; judges_per_station?: number } | null
}

interface EventSlotRaw {
  id: string
  event_discipline_id: string
  start_time: string
  end_time: string
  max_participants: number
}

interface CalendarGroupsProps {
  events: any[]
  allEventDiscs: EventDisc[]
  allSlots: EventSlotRaw[]
  slotCounts: Record<string, number>
  regCounts: Record<string, number>
}

const monthNames = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień']

export default function CalendarGroups({ events, allEventDiscs, allSlots, slotCounts, regCounts }: CalendarGroupsProps) {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`

  // Group events by month
  const grouped: Record<string, typeof events> = {}
  for (const event of events) {
    const d = new Date(event.start_date)
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(event)
  }

  // Past months start collapsed
  const initialCollapsed = new Set(
    Object.keys(grouped).filter(key => key < currentMonth)
  )
  const [collapsed, setCollapsed] = useState<Set<string>>(initialCollapsed)

  function toggleMonth(key: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([monthKey, monthEvents]) => {
        const [year, month] = monthKey.split('-').map(Number)
        const isPast = monthKey < currentMonth
        const isCurrent = monthKey === currentMonth
        const isCollapsed = collapsed.has(monthKey)
        const label = `${monthNames[month]} ${year}`

        return (
          <div key={monthKey}>
            <button
              onClick={() => toggleMonth(monthKey)}
              className="flex items-center gap-3 mb-4 w-full text-left group"
            >
              {isCollapsed
                ? <ChevronRight className="w-4 h-4 text-muted group-hover:text-foreground transition-colors flex-shrink-0" />
                : <ChevronDown className="w-4 h-4 text-muted group-hover:text-foreground transition-colors flex-shrink-0" />
              }
              <h2 className={`text-lg font-semibold ${isPast ? 'text-muted group-hover:text-foreground transition-colors' : 'text-foreground'}`}>
                {label}
              </h2>
              {isCurrent && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                  Bieżący miesiąc
                </span>
              )}
              {isPast && !isCurrent && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted/20 text-muted font-medium">
                  Zakończone
                </span>
              )}
              <span className="text-xs text-muted">
                {monthEvents.length} {monthEvents.length === 1 ? 'wydarzenie' : monthEvents.length < 5 ? 'wydarzenia' : 'wydarzeń'}
              </span>
              <div className="flex-1 border-t border-border" />
            </button>

            {!isCollapsed && (
              <div className={`space-y-4 ${isPast ? 'opacity-60' : ''}`}>
                {monthEvents.map((event: any) => {
                  const eventDiscs = allEventDiscs.filter(ed => ed.event_id === event.id)
                  const eventDiscIds = new Set(eventDiscs.map(ed => ed.id))
                  const eventSlots = allSlots
                    .filter(s => eventDiscIds.has(s.event_discipline_id))
                    .map(s => ({
                      ...s,
                      current_count: slotCounts[s.id] || 0,
                    }))

                  return (
                    <EventCard
                      key={event.id}
                      event={event}
                      regCount={regCounts[event.id] ?? 0}
                      eventDisciplines={eventDiscs}
                      slots={eventSlots}
                    />
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
