'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import type { EventRow } from '@/types/admin'
import type { Discipline, EventDiscipline, EventDisciplineSlot } from '@/types/database'

interface UseSlotManagementParams {
  events: EventRow[]
  eventSlots: EventDisciplineSlot[]
  disciplines: Discipline[]
  loadAll: () => Promise<void>
  getEventDiscs: (eventId: string) => (EventDiscipline & { discipline?: Discipline })[]
  getSlotsForEventDiscipline: (edId: string) => EventDisciplineSlot[]
}

export function useSlotManagement({ events, eventSlots, disciplines, loadAll, getEventDiscs, getSlotsForEventDiscipline }: UseSlotManagementParams) {
  const supabase = createSupabaseBrowser()

  const [slotManagedEvent, setSlotManagedEvent] = useState<string | null>(null)
  const [newSlotForm, setNewSlotForm] = useState<{ event_discipline_id: string; start_time: string; end_time: string; max_participants: string }>({
    event_discipline_id: '', start_time: '', end_time: '', max_participants: '10',
  })

  async function autoGenerateSlots(eventId: string) {
    const ev = events.find(e => e.id === eventId)
    if (!ev) return
    const evDiscs = getEventDiscs(eventId)
    if (evDiscs.length === 0) { alert('Brak dyscyplin przypisanych do wydarzenia. Najpierw edytuj wydarzenie i dodaj dyscypliny.'); return }

    const startDate = new Date(ev.start_date)
    const endDate = ev.end_date ? new Date(ev.end_date) : new Date(startDate.getTime() + 8 * 60 * 60 * 1000)

    if (endDate <= startDate) {
      alert('Data zakończenia musi być po dacie rozpoczęcia.')
      return
    }

    // Only generate for disciplines that don't have slots yet
    const discsWithoutSlots = evDiscs.filter(ed =>
      !eventSlots.some(s => s.event_discipline_id === ed.id)
    )
    if (discsWithoutSlots.length === 0) { alert('Wszystkie dyscypliny mają już sloty.'); return }

    const slotsToInsert: { event_discipline_id: string; start_time: string; end_time: string; max_participants: number }[] = []

    for (const ed of discsWithoutSlots) {
      const disc = ed.discipline ?? disciplines.find(d => d.id === ed.discipline_id)
      const maxPerSlot = disc?.participants_per_hour ?? disc?.stations_count ?? 10
      let current = new Date(startDate)
      while (current < endDate) {
        const slotEnd = new Date(current.getTime() + 60 * 60 * 1000)
        const actualEnd = slotEnd > endDate ? endDate : slotEnd
        slotsToInsert.push({
          event_discipline_id: ed.id,
          start_time: current.toISOString(),
          end_time: actualEnd.toISOString(),
          max_participants: maxPerSlot,
        })
        current = slotEnd
      }
    }

    if (slotsToInsert.length === 0) return

    const { error: err } = await supabase.from('event_discipline_slots').insert(slotsToInsert)
    if (err) { alert('Blad generowania slotow: ' + err.message); return }
    loadAll()
  }

  async function addSlotManual() {
    if (!newSlotForm.event_discipline_id || !newSlotForm.start_time || !newSlotForm.end_time) {
      alert('Wypelnij wszystkie pola slotu.')
      return
    }
    const { error: err } = await supabase.from('event_discipline_slots').insert({
      event_discipline_id: newSlotForm.event_discipline_id,
      start_time: new Date(newSlotForm.start_time).toISOString(),
      end_time: new Date(newSlotForm.end_time).toISOString(),
      max_participants: parseInt(newSlotForm.max_participants) || 10,
    })
    if (err) { alert('Blad dodawania slotu: ' + err.message); return }
    setNewSlotForm(f => ({ ...f, start_time: '', end_time: '' }))
    loadAll()
  }

  async function deleteSlot(slotId: string) {
    if (!confirm('Na pewno usunac ten slot?')) return
    await supabase.from('event_discipline_slots').delete().eq('id', slotId)
    loadAll()
  }

  return {
    slotManagedEvent,
    setSlotManagedEvent,
    newSlotForm,
    setNewSlotForm,
    autoGenerateSlots,
    addSlotManual,
    deleteSlot,
  }
}
