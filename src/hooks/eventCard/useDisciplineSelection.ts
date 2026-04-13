import { useState } from 'react'
import type { EventDisc, EventSlot } from './types'

export function useDisciplineSelection(
  eventDisciplines: EventDisc[],
  slots: EventSlot[],
  isCourse: boolean,
) {
  const [selectedDiscs, setSelectedDiscs] = useState<Set<string>>(new Set())
  const [selectedSlots, setSelectedSlots] = useState<Map<string, string>>(new Map())
  const [ownWeapon, setOwnWeapon] = useState<Set<string>>(new Set())

  function getEdPrice(ed: EventDisc): number {
    if (ownWeapon.has(ed.id) && (ed.own_weapon_price_pln ?? 0) > 0) return Number(ed.own_weapon_price_pln)
    return Number(ed.price_pln)
  }

  const selectedTotal = eventDisciplines
    .filter(ed => selectedDiscs.has(ed.id))
    .reduce((sum, ed) => sum + getEdPrice(ed), 0)

  function getSlotsForDiscipline(edId: string): EventSlot[] {
    return slots.filter(s => s.event_discipline_id === edId)
  }

  function disciplineHasSlots(edId: string): boolean {
    return getSlotsForDiscipline(edId).length > 0
  }

  function allSlotsSelected(): boolean {
    if (isCourse) return true
    for (const edId of selectedDiscs) {
      if (disciplineHasSlots(edId) && !selectedSlots.has(edId)) {
        return false
      }
    }
    return true
  }

  function autoSuggestSlot(newEdId: string) {
    const discSlots = getSlotsForDiscipline(newEdId)
    if (discSlots.length === 0) return

    let referenceSlot: EventSlot | null = null
    for (const [, slotId] of selectedSlots.entries()) {
      const found = slots.find(s => s.id === slotId)
      if (found) { referenceSlot = found; break }
    }
    if (!referenceSlot) return

    const refStart = new Date(referenceSlot.start_time).getTime()
    const match = discSlots.find(s =>
      new Date(s.start_time).getTime() === refStart && s.current_count < s.max_participants
    )
    if (match) {
      setSelectedSlots(prev => {
        const next = new Map(prev)
        next.set(newEdId, match.id)
        return next
      })
    }
  }

  function toggleDisc(edId: string) {
    setSelectedDiscs(prev => {
      const next = new Set(prev)
      if (next.has(edId)) {
        next.delete(edId)
        setSelectedSlots(prevSlots => {
          const nextSlots = new Map(prevSlots)
          nextSlots.delete(edId)
          return nextSlots
        })
      } else {
        next.add(edId)
        autoSuggestSlot(edId)
      }
      return next
    })
  }

  function selectSlot(edId: string, slotId: string) {
    setSelectedSlots(prev => {
      const next = new Map(prev)
      next.set(edId, slotId)

      const selectedSlotObj = slots.find(s => s.id === slotId)
      if (selectedSlotObj) {
        const refStart = new Date(selectedSlotObj.start_time).getTime()
        for (const otherEdId of selectedDiscs) {
          if (otherEdId === edId || next.has(otherEdId)) continue
          const otherSlots = getSlotsForDiscipline(otherEdId)
          const match = otherSlots.find(s =>
            new Date(s.start_time).getTime() === refStart && s.current_count < s.max_participants
          )
          if (match) {
            next.set(otherEdId, match.id)
          }
        }
      }

      return next
    })
  }

  function toggleOwnWeapon(edId: string) {
    setOwnWeapon(prev => {
      const next = new Set(prev)
      if (next.has(edId)) next.delete(edId)
      else next.add(edId)
      return next
    })
  }

  function resetSelection() {
    setSelectedDiscs(new Set())
    setSelectedSlots(new Map())
  }

  function preselectSingle() {
    if (eventDisciplines.length === 1) {
      setSelectedDiscs(new Set([eventDisciplines[0].id]))
    } else {
      setSelectedDiscs(new Set())
    }
    setSelectedSlots(new Map())
  }

  return {
    selectedDiscs,
    setSelectedDiscs,
    selectedSlots,
    setSelectedSlots,
    ownWeapon,
    selectedTotal,
    getEdPrice,
    getSlotsForDiscipline,
    allSlotsSelected,
    toggleDisc,
    selectSlot,
    toggleOwnWeapon,
    resetSelection,
    preselectSingle,
  }
}
