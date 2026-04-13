'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import type { EventRow, ShootingLane } from '@/types/admin'
import type { Discipline, EventDiscipline, EventDisciplineSlot } from '@/types/database'

interface UseEventManagementParams {
  events: EventRow[]
  disciplines: Discipline[]
  eventDisciplines: (EventDiscipline & { discipline?: Discipline })[]
  eventSlots: EventDisciplineSlot[]
  shootingLanes: ShootingLane[]
  loadAll: () => Promise<void>
  getEventDiscs: (eventId: string) => (EventDiscipline & { discipline?: Discipline })[]
  getFilteredDisciplines: (eventType: string) => Discipline[]
  autoGenerateSlots: (eventId: string) => Promise<void>
  notifyJudge: (eventJudgeId: string) => Promise<void>
}

export function useEventManagement({ events, disciplines, eventDisciplines, eventSlots, shootingLanes, loadAll, getEventDiscs, getFilteredDisciplines, autoGenerateSlots, notifyJudge }: UseEventManagementParams) {
  const supabase = createSupabaseBrowser()

  const [showEventForm, setShowEventForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null)
  const [eventForm, setEventForm] = useState({
    title: '', description: '', event_type: 'competition' as string,
    start_day: '', start_time: '09:00', end_day: '', end_time: '17:00',
    location: '', address: '',
    max_participants: '', is_published: true, allow_target_photos: true,
  })
  const [editingEventDisciplines, setEditingEventDisciplines] = useState<{ discipline_id: string; price_pln: string; own_weapon_price_pln: string }[]>([])
  const [eventLaneIds, setEventLaneIds] = useState<string[]>([])
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function openNewEvent() {
    setEditingEvent(null)
    setEventForm({
      title: '', description: '', event_type: 'competition',
      start_day: '', start_time: '09:00', end_day: '', end_time: '17:00',
      location: 'Strzelnica klubowa', address: '',
      max_participants: '30', is_published: true, allow_target_photos: true,
    })
    setEditingEventDisciplines([])
    setEventLaneIds([])
    setShowEventForm(true)
    setError('')
  }

  function openEditEvent(ev: EventRow) {
    setEditingEvent(ev)
    const sd = ev.start_date ? new Date(ev.start_date) : null
    const ed2 = ev.end_date ? new Date(ev.end_date) : null
    setEventForm({
      title: ev.title,
      description: ev.description ?? '',
      event_type: ev.event_type,
      start_day: sd ? sd.toISOString().slice(0, 10) : '',
      start_time: sd ? sd.toTimeString().slice(0, 5) : '09:00',
      end_day: ed2 ? ed2.toISOString().slice(0, 10) : '',
      end_time: ed2 ? ed2.toTimeString().slice(0, 5) : '17:00',
      location: ev.location ?? '',
      address: ev.address ?? '',
      max_participants: ev.max_participants?.toString() ?? '',
      is_published: ev.is_published,
      allow_target_photos: ev.allow_target_photos ?? true,
    })
    // Load existing event disciplines into form
    const existing = getEventDiscs(ev.id)
    setEditingEventDisciplines(existing.map(ed => ({
      discipline_id: ed.discipline_id,
      price_pln: ed.price_pln.toString(),
      own_weapon_price_pln: ((ed as any).own_weapon_price_pln ?? 0).toString(),
    })))
    setEventLaneIds([]) // Will be loaded async
    // Load existing lane blocks for this event
    ;(async () => {
      const { data } = await supabase
        .from('lane_reservations')
        .select('lane_id')
        .eq('event_id', ev.id)
      const uniqueIds = [...new Set((data ?? []).map(r => r.lane_id))]
      setEventLaneIds(uniqueIds)
    })()
    setShowEventForm(true)
    setError('')
  }

  function addDisciplineToEvent() {
    const used = new Set(editingEventDisciplines.map(d => d.discipline_id))
    const available = getFilteredDisciplines(eventForm.event_type).filter(d => !used.has(d.id))
    if (available.length === 0) return
    const disc = available[0]
    setEditingEventDisciplines(prev => [...prev, { discipline_id: disc.id, price_pln: String(disc.default_price_pln ?? 0), own_weapon_price_pln: String((disc as any).own_weapon_price_pln ?? 0) }])
  }

  function removeDisciplineFromEvent(index: number) {
    setEditingEventDisciplines(prev => prev.filter((_, i) => i !== index))
  }

  function updateEventDiscipline(index: number, field: 'discipline_id' | 'price_pln' | 'own_weapon_price_pln', value: string) {
    setEditingEventDisciplines(prev => prev.map((d, i) => {
      if (i !== index) return d
      if (field === 'discipline_id') {
        // Auto-fill price from discipline defaults
        const disc = disciplines.find(dd => dd.id === value)
        return { ...d, discipline_id: value, price_pln: String(disc?.default_price_pln ?? d.price_pln), own_weapon_price_pln: String((disc as any)?.own_weapon_price_pln ?? d.own_weapon_price_pln) }
      }
      return { ...d, [field]: value }
    }))
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      const payload = {
        title: eventForm.title,
        description: eventForm.description || null,
        event_type: eventForm.event_type,
        discipline_id: null,
        start_date: new Date(`${eventForm.start_day}T${eventForm.start_time}`).toISOString(),
        end_date: eventForm.end_day ? new Date(`${eventForm.end_day}T${eventForm.end_time}`).toISOString() : null,
        location: eventForm.location || null,
        address: eventForm.address || null,
        max_participants: eventForm.max_participants ? parseInt(eventForm.max_participants) : null,
        price_pln: 0,
        is_published: eventForm.is_published,
        allow_target_photos: eventForm.allow_target_photos,
      }

      let eventId: string
      if (editingEvent) {
        const { error: err } = await supabase.from('events').update(payload).eq('id', editingEvent.id)
        if (err) { setError(err.message); setSaving(false); return }
        eventId = editingEvent.id
      } else {
        const { data, error: err } = await supabase.from('events').insert(payload).select('id').single()
        if (err || !data) { setError(err?.message ?? 'Blad tworzenia wydarzenia'); setSaving(false); return }
        eventId = data.id
      }

      // Sync event_disciplines: smart diff to preserve slots and registrations
      const existingEds = eventDisciplines.filter(ed => ed.event_id === eventId)
      const wantedDiscIds = new Set(editingEventDisciplines.map(d => d.discipline_id))
      const existingDiscMap = new Map(existingEds.map(ed => [ed.discipline_id, ed]))

      // Delete removed disciplines (CASCADE will clean up their slots & registration_disciplines)
      const toDelete = existingEds.filter(ed => !wantedDiscIds.has(ed.discipline_id))
      for (const ed of toDelete) {
        await supabase.from('event_disciplines').delete().eq('id', ed.id)
      }

      // Update existing disciplines (price changes) and insert new ones
      for (const d of editingEventDisciplines) {
        const existing = existingDiscMap.get(d.discipline_id)
        if (existing) {
          // Update price if changed
          const newPrice = parseFloat(d.price_pln) || 0
          const newOwpPrice = parseFloat(d.own_weapon_price_pln) || 0
          if (Number(existing.price_pln) !== newPrice || Number((existing as any).own_weapon_price_pln) !== newOwpPrice) {
            await supabase.from('event_disciplines').update({ price_pln: newPrice, own_weapon_price_pln: newOwpPrice }).eq('id', existing.id)
          }
        } else {
          // Insert new discipline
          await supabase.from('event_disciplines').insert({
            event_id: eventId,
            discipline_id: d.discipline_id,
            price_pln: parseFloat(d.price_pln) || 0,
            own_weapon_price_pln: parseFloat(d.own_weapon_price_pln) || 0,
          })
        }
      }

      // Sync lane reservations for event blocking
      if (eventLaneIds.length > 0 || editingEvent) {
        // Remove old event lane blocks
        await supabase.from('lane_reservations').delete().eq('event_id', eventId)

        // Create new lane blocks for selected lanes
        if (eventLaneIds.length > 0 && eventForm.start_day) {
          const eventDate = eventForm.start_day
          const startTime = eventForm.start_time || '08:00'
          const endTime = eventForm.end_time || '20:00'

          const laneInserts: any[] = []
          for (const laneId of eventLaneIds) {
            const lane = shootingLanes.find(l => l.id === laneId)
            if (!lane) continue
            // Block all stations on the lane
            for (let sn = 1; sn <= lane.stations_count; sn++) {
              laneInserts.push({
                lane_id: laneId,
                station_number: sn,
                event_id: eventId,
                reservation_date: eventDate,
                start_time: startTime,
                end_time: endTime,
                status: 'reserved',
                paid: true,
                notes: `Blokada na wydarzenie: ${eventForm.title}`,
              })
            }
          }
          if (laneInserts.length > 0) {
            await supabase.from('lane_reservations').insert(laneInserts)
          }
        }
      }

      // If event just got published, notify all unnotified judges (best-effort)
      const wasPublished = editingEvent ? !editingEvent.is_published && eventForm.is_published : false
      if (wasPublished || (!editingEvent && eventForm.is_published)) {
        try {
          const { data: ejRows } = await supabase
            .from('event_judges')
            .select('id')
            .eq('event_id', eventId)
            .is('notified_at', null)
          if (ejRows) {
            for (const ej of ejRows) {
              notifyJudge(ej.id)
            }
          }
        } catch {
          // Notification failure shouldn't block save
        }
      }

      setSaving(false)
      setShowEventForm(false)
      await loadAll()

      // Ask about auto-generating time slots only for new disciplines without slots (not for courses)
      if (eventForm.event_type !== 'course') {
        const newEds = eventDisciplines.filter(ed => ed.event_id === eventId)
        const edsWithoutSlots = newEds.filter(ed =>
          !eventSlots.some(s => s.event_discipline_id === ed.id)
        )
        if (edsWithoutSlots.length > 0 && eventForm.start_day) {
          if (confirm(`Wydarzenie zapisane. ${edsWithoutSlots.length} dyscyplin nie ma slotów czasowych. Wygenerować?`)) {
            await autoGenerateSlots(eventId)
          }
        }
      }
    } catch (err: any) {
      setError('Błąd zapisu: ' + (err?.message ?? 'Nieznany błąd'))
      setSaving(false)
    }
  }

  async function deleteEvent(id: string) {
    if (!confirm('Na pewno usunac to wydarzenie?')) return
    await supabase.from('events').delete().eq('id', id)
    loadAll()
  }

  return {
    showEventForm,
    setShowEventForm,
    editingEvent,
    setEditingEvent,
    eventForm,
    setEventForm,
    editingEventDisciplines,
    setEditingEventDisciplines,
    eventLaneIds,
    setEventLaneIds,
    expandedEvent,
    setExpandedEvent,
    saving,
    setSaving,
    error,
    setError,
    openNewEvent,
    openEditEvent,
    saveEvent,
    deleteEvent,
    addDisciplineToEvent,
    removeDisciplineFromEvent,
    updateEventDiscipline,
  }
}
