'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import type { EventRow } from '@/types/admin'
import type { Discipline, EventDiscipline, Member } from '@/types/database'

interface UseOnsiteRegistrationParams {
  events: EventRow[]
  allMembers: Member[]
  disciplines: Discipline[]
  eventDisciplines: (EventDiscipline & { discipline?: Discipline })[]
  loadAll: () => Promise<void>
  getEventDiscs: (eventId: string) => (EventDiscipline & { discipline?: Discipline })[]
}

export function useOnsiteRegistration({
  events,
  allMembers,
  disciplines,
  eventDisciplines,
  loadAll,
  getEventDiscs,
}: UseOnsiteRegistrationParams) {
  const supabase = createSupabaseBrowser()

  const [onsiteMode, setOnsiteMode] = useState<'member' | 'guest'>('member')
  const [onsiteMemberId, setOnsiteMemberId] = useState('')
  const [onsiteEventId, setOnsiteEventId] = useState('')
  const [onsiteDisciplineId, setOnsiteDisciplineId] = useState('')
  const [onsiteSlotId, setOnsiteSlotId] = useState('')
  const [onsiteSaving, setOnsiteSaving] = useState(false)
  const [onsiteMessage, setOnsiteMessage] = useState('')
  const [onsiteMemberSearch, setOnsiteMemberSearch] = useState('')
  const [lastOnsiteReg, setLastOnsiteReg] = useState<{
    memberId: string; memberName: string; eventId: string; eventTitle: string;
    discName: string; discScoringType: string; discShotsCount: number; regId: string;
  } | null>(null)
  const [onsiteGuestForm, setOnsiteGuestForm] = useState({
    full_name: '', email: '', phone: '', has_license: false, license_number: '', club_name: '',
  })

  function getEventsHappeningNow() {
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    return events.filter(ev => {
      const startStr = ev.start_date.slice(0, 10)
      const endStr = ev.end_date ? ev.end_date.slice(0, 10) : startStr
      const startDate = new Date(ev.start_date)
      const endDate = ev.end_date ? new Date(ev.end_date) : new Date(startDate.getTime() + 24 * 60 * 60 * 1000 - 1)
      // Event is happening if: today is between start and end dates (inclusive)
      return todayStr >= startStr && todayStr <= endStr
    })
  }

  async function quickRegisterOnsite() {
    if (!onsiteMemberId || !onsiteEventId || !onsiteDisciplineId) {
      setOnsiteMessage('Wybierz czlonka, wydarzenie i dyscypline.')
      return
    }
    setOnsiteSaving(true)
    setOnsiteMessage('')

    // Check if already registered
    const { data: existingReg } = await supabase
      .from('event_registrations')
      .select('id')
      .eq('event_id', onsiteEventId)
      .eq('member_id', onsiteMemberId)
      .single()

    let regId: string
    if (existingReg) {
      regId = existingReg.id
    } else {
      // Get next start number
      const { data: maxNumData } = await supabase
        .from('event_registrations')
        .select('start_number')
        .eq('event_id', onsiteEventId)
        .not('start_number', 'is', null)
        .order('start_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      const nextStartNumber = ((maxNumData as any)?.start_number ?? 0) + 1

      const { data: newReg, error: regErr } = await supabase
        .from('event_registrations')
        .insert({
          event_id: onsiteEventId,
          member_id: onsiteMemberId,
          status: 'confirmed',
          paid: false,
          start_number: nextStartNumber,
        })
        .select('id, start_number')
        .single()
      if (regErr || !newReg) {
        setOnsiteMessage('Blad rejestracji: ' + (regErr?.message ?? 'Nieznany blad'))
        setOnsiteSaving(false)
        return
      }
      regId = newReg.id
    }

    // Add registration discipline
    const rdPayload: { event_discipline_id: string; member_registration_id: string; event_discipline_slot_id?: string } = {
      event_discipline_id: onsiteDisciplineId,
      member_registration_id: regId,
    }
    if (onsiteSlotId) {
      rdPayload.event_discipline_slot_id = onsiteSlotId
    }

    const { error: rdErr } = await supabase.from('registration_disciplines').insert(rdPayload)
    if (rdErr) {
      setOnsiteMessage('Rejestracja utworzona, ale blad dyscypliny: ' + rdErr.message)
      setOnsiteSaving(false)
      loadAll()
      return
    }

    // Mark as paid (cash) and get start number
    await supabase.from('event_registrations').update({ paid: true }).eq('id', regId)

    // Get member info for metryczka
    const regMember = allMembers.find(m => m.id === onsiteMemberId)
    const regEvent = events.find(e => e.id === onsiteEventId)
    const regDisc = disciplines.find(d => {
      const ed = eventDisciplines.find(ed2 => ed2.id === onsiteDisciplineId)
      return ed && d.id === ed.discipline_id
    })

    setOnsiteMessage(`✅ Zarejestrowano i opłacono gotówką!`)
    setLastOnsiteReg({ memberId: onsiteMemberId, memberName: regMember?.full_name ?? '', eventId: onsiteEventId, eventTitle: regEvent?.title ?? '', discName: regDisc?.name ?? '', discScoringType: regDisc?.scoring_type ?? 'points', discShotsCount: regDisc?.shots_count ?? 10, regId })
    setOnsiteMemberId('')
    setOnsiteDisciplineId('')
    setOnsiteSlotId('')
    setOnsiteMemberSearch('')
    await loadAll()
    setOnsiteSaving(false)
  }

  async function quickRegisterGuestOnsite() {
    if (!onsiteGuestForm.full_name || !onsiteEventId || !onsiteDisciplineId) {
      setOnsiteMessage('Podaj imię i nazwisko gościa, wydarzenie i dyscyplinę.')
      return
    }
    setOnsiteSaving(true)
    setOnsiteMessage('')

    // Check duplicate by name+event
    if (onsiteGuestForm.email) {
      const { data: existing } = await supabase
        .from('guest_registrations')
        .select('id')
        .eq('event_id', onsiteEventId)
        .eq('email', onsiteGuestForm.email)
        .maybeSingle()
      if (existing) {
        setOnsiteMessage('Gość z tym emailem jest już zapisany na to wydarzenie.')
        setOnsiteSaving(false)
        return
      }
    }

    const { data: guestReg, error: guestErr } = await supabase
      .from('guest_registrations')
      .insert({
        event_id: onsiteEventId,
        full_name: onsiteGuestForm.full_name,
        email: onsiteGuestForm.email || `walk-in-${Date.now()}@brak.pl`,
        phone: onsiteGuestForm.phone || null,
        has_license: onsiteGuestForm.has_license,
        license_number: onsiteGuestForm.has_license ? onsiteGuestForm.license_number || null : null,
        club_name: onsiteGuestForm.club_name || null,
        experience: 'none',
        status: 'confirmed',
      })
      .select('id')
      .single()

    if (guestErr || !guestReg) {
      setOnsiteMessage('Błąd rejestracji gościa: ' + (guestErr?.message ?? 'Nieznany błąd'))
      setOnsiteSaving(false)
      return
    }

    // Add discipline
    const rdPayload: { event_discipline_id: string; guest_registration_id: string; event_discipline_slot_id?: string } = {
      event_discipline_id: onsiteDisciplineId,
      guest_registration_id: guestReg.id,
    }
    if (onsiteSlotId) {
      rdPayload.event_discipline_slot_id = onsiteSlotId
    }

    const { error: rdErr } = await supabase.from('registration_disciplines').insert(rdPayload)
    if (rdErr) {
      setOnsiteMessage('Gość zarejestrowany, ale błąd dyscypliny: ' + rdErr.message)
      setOnsiteSaving(false)
      loadAll()
      return
    }

    const regEvent = events.find(e => e.id === onsiteEventId)
    const regDisc = disciplines.find(d => {
      const ed = eventDisciplines.find(ed2 => ed2.id === onsiteDisciplineId)
      return ed && d.id === ed.discipline_id
    })

    setOnsiteMessage(`✅ Gość zarejestrowany!`)
    setLastOnsiteReg({ memberId: '', memberName: onsiteGuestForm.full_name, eventId: onsiteEventId, eventTitle: regEvent?.title ?? '', discName: regDisc?.name ?? '', discScoringType: regDisc?.scoring_type ?? 'points', discShotsCount: regDisc?.shots_count ?? 10, regId: guestReg.id })
    setOnsiteGuestForm({ full_name: '', email: '', phone: '', has_license: false, license_number: '', club_name: '' })
    setOnsiteDisciplineId('')
    setOnsiteSlotId('')
    await loadAll()
    setOnsiteSaving(false)
  }

  return {
    // State
    onsiteMode,
    setOnsiteMode,
    onsiteMemberId,
    setOnsiteMemberId,
    onsiteEventId,
    setOnsiteEventId,
    onsiteDisciplineId,
    setOnsiteDisciplineId,
    onsiteSlotId,
    setOnsiteSlotId,
    onsiteSaving,
    setOnsiteSaving,
    onsiteMessage,
    setOnsiteMessage,
    onsiteMemberSearch,
    setOnsiteMemberSearch,
    lastOnsiteReg,
    setLastOnsiteReg,
    onsiteGuestForm,
    setOnsiteGuestForm,

    // Functions
    getEventsHappeningNow,
    quickRegisterOnsite,
    quickRegisterGuestOnsite,
  }
}
