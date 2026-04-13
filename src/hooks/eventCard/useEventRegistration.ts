import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import type { EventDisc, EventSlot, EventCardEvent, RegMode } from './types'

export function useEventRegistration(
  event: EventCardEvent,
  eventDisciplines: EventDisc[],
  slots: EventSlot[],
  initialRegCount: number,
) {
  const { member } = useAuth()
  const supabase = createSupabaseBrowser()

  const [mode, setMode] = useState<RegMode>(null)
  const [registering, setRegistering] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [isPaid, setIsPaid] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')
  const [count, setCount] = useState(initialRegCount)

  const [myRegId, setMyRegId] = useState<string | null>(null)
  const [myDiscs, setMyDiscs] = useState<{ name: string; edId?: string; slot?: { start: string; end: string } }[]>([])
  const [addingDiscs, setAddingDiscs] = useState(false)
  const [dataConfirmed, setDataConfirmed] = useState(false)

  const isFull = event.max_participants ? count >= event.max_participants : false
  const fillPercent = event.max_participants ? Math.min((count / event.max_participants) * 100, 100) : 0
  const isCourse = event.event_type === 'course'

  useEffect(() => {
    if (!member) return
    supabase
      .from('event_registrations')
      .select('id, paid')
      .eq('event_id', event.id)
      .eq('member_id', member.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setRegistered(true)
          setMyRegId(data.id)
          setIsPaid(!!data.paid)
          loadMyDisciplines(data.id)
        }
      })
  }, [member, event.id])

  async function loadMyDisciplines(regId: string) {
    const { data: rds } = await supabase
      .from('registration_disciplines')
      .select('event_discipline_id, event_discipline_slot_id')
      .eq('member_registration_id', regId)
    if (!rds) return
    const enriched = rds.map((rd: any) => {
      const ed = eventDisciplines.find(e => e.id === rd.event_discipline_id)
      const slot = rd.event_discipline_slot_id ? slots.find(s => s.id === rd.event_discipline_slot_id) : null
      return {
        edId: rd.event_discipline_id,
        name: ed?.discipline?.name ?? '?',
        slot: slot ? { start: slot.start_time, end: slot.end_time } : undefined,
      }
    })
    setMyDiscs(enriched)
  }

  function getEdPrice(ed: EventDisc, ownWeapon: Set<string>): number {
    if (ownWeapon.has(ed.id) && (ed.own_weapon_price_pln ?? 0) > 0) return Number(ed.own_weapon_price_pln)
    return Number(ed.price_pln)
  }

  const alreadyEdIds = new Set(myDiscs.map((d: any) => d.edId))

  function totalCost(ownWeapon: Set<string>): number {
    if (myDiscs.length > 0) {
      return eventDisciplines
        .filter(ed => myDiscs.some((d: any) => d.edId === ed.id))
        .reduce((sum, ed) => sum + getEdPrice(ed, ownWeapon), 0)
    }
    return Number(event.price_pln) || 0
  }

  function newDiscsTotal(selectedDiscs: Set<string>, ownWeapon: Set<string>): number {
    return eventDisciplines
      .filter(ed => selectedDiscs.has(ed.id) && !alreadyEdIds.has(ed.id))
      .reduce((sum, ed) => sum + getEdPrice(ed, ownWeapon), 0)
  }

  function openRegistration(preselectFn: () => void) {
    setError('')
    preselectFn()
    if (member) {
      if (isCourse) {
        setMode('member')
      } else {
        const missingData = !member.pesel || !member.id_document_number || !member.address || !member.date_of_birth
        if (missingData && !addingDiscs) {
          setMode('confirm_data')
        } else {
          const lastConfirmed = member.data_confirmed_at ? new Date(member.data_confirmed_at) : null
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
          if ((!lastConfirmed || lastConfirmed < thirtyDaysAgo) && !addingDiscs) {
            setMode('confirm_data')
          } else {
            setMode('member')
          }
        }
      }
    } else {
      setMode('choose')
    }
  }

  async function confirmDataAndProceed() {
    if (!member) return
    await supabase.from('members').update({ data_confirmed_at: new Date().toISOString() }).eq('id', member.id)
    setDataConfirmed(true)
    setMode('member')
  }

  async function handleMemberRegister(
    selectedDiscs: Set<string>,
    selectedSlots: Map<string, string>,
    ownWeapon: Set<string>,
  ) {
    if (!member) return
    if (eventDisciplines.length > 0 && selectedDiscs.size === 0) {
      setError('Wybierz co najmniej jedną dyscyplinę.')
      return
    }

    // Adding disciplines to existing registration
    if (addingDiscs && myRegId) {
      const newEdIds = Array.from(selectedDiscs).filter(edId => !alreadyEdIds.has(edId))
      if (newEdIds.length === 0) {
        setError('Nie wybrano nowych dyscyplin.')
        return
      }
      const addTotal = newEdIds.reduce((sum, edId) => {
        const ed = eventDisciplines.find(e => e.id === edId)
        if (!ed) return sum
        return sum + getEdPrice(ed, ownWeapon)
      }, 0)
      const newNames = newEdIds.map(edId => eventDisciplines.find(e => e.id === edId)?.discipline?.name ?? '?').join(', ')
      const confirmMsg = addTotal > 0
        ? `Dopisać: ${newNames}?\nKwota: ${addTotal.toFixed(0)} zł`
        : `Dopisać: ${newNames}?`
      if (!window.confirm(confirmMsg)) return
    }

    setRegistering(true)
    setError('')

    if (addingDiscs && myRegId) {
      const newEdIds = Array.from(selectedDiscs).filter(edId => !alreadyEdIds.has(edId))
      if (newEdIds.length === 0) {
        setError('Nie wybrano nowych dyscyplin.')
        setRegistering(false)
        return
      }
      const discPayload = newEdIds.map(edId => {
        const ed = eventDisciplines.find(e => e.id === edId)
        const isOwn = ownWeapon.has(edId)
        const price = ed ? (isOwn && (ed.own_weapon_price_pln ?? 0) > 0 ? Number(ed.own_weapon_price_pln) : Number(ed.price_pln)) : 0
        return {
          event_discipline_id: edId,
          price_pln: price,
          own_weapon: isOwn,
          ...(selectedSlots.has(edId) ? { event_discipline_slot_id: selectedSlots.get(edId) } : {}),
        }
      })
      const res = await fetch('/api/zapisy/dyscypliny', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_id: myRegId, disciplines: discPayload }),
      })
      const result = await res.json()
      if (!res.ok) {
        setError(result.error || 'Błąd dodawania dyscyplin')
        setRegistering(false)
        return
      }
      await loadMyDisciplines(myRegId)
      setRegistering(false)
      setAddingDiscs(false)
      setMode(null)
      return
    }

    // New registration
    const discPayload = Array.from(selectedDiscs).map(edId => {
      const ed = eventDisciplines.find(e => e.id === edId)
      const isOwn = ownWeapon.has(edId)
      const price = ed ? (isOwn && (ed.own_weapon_price_pln ?? 0) > 0 ? Number(ed.own_weapon_price_pln) : Number(ed.price_pln)) : 0
      return {
        event_discipline_id: edId,
        price_pln: price,
        own_weapon: isOwn,
        ...(selectedSlots.has(edId) ? { event_discipline_slot_id: selectedSlots.get(edId) } : {}),
      }
    })

    const res = await fetch('/api/zapisy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: event.id,
        member_id: member.id,
        disciplines: discPayload,
      }),
    })
    const result = await res.json()

    if (!res.ok) {
      setRegistering(false)
      setError(result.error || 'Błąd zapisu')
      if (res.status === 409 && result.registration_id) {
        setRegistered(true)
      }
      return
    }

    if (result.registration_id) {
      setMyRegId(result.registration_id)
      await loadMyDisciplines(result.registration_id)
    }

    setRegistering(false)
    setRegistered(true)
    setCount(prev => prev + 1)
    setMode(null)
  }

  async function handleCancel() {
    if (!member) return
    setCancelling(true)
    setError('')

    const { error: dbError } = await supabase
      .from('event_registrations')
      .delete()
      .eq('event_id', event.id)
      .eq('member_id', member.id)

    setCancelling(false)
    if (dbError) { setError('Błąd anulowania: ' + dbError.message); return }

    setRegistered(false)
    setCount(prev => Math.max(0, prev - 1))
  }

  async function handlePayment(ownWeapon: Set<string>) {
    if (!myRegId) return
    setPaymentLoading(true)
    setError('')
    try {
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registration_id: myRegId }),
      })
      const data = await res.json()
      if (data.free) {
        setIsPaid(true)
        return
      }
      if (data.redirect_url) {
        window.location.href = data.redirect_url
      } else {
        setError(data.error || 'Błąd płatności')
      }
    } catch {
      setError('Nie udało się połączyć z systemem płatności')
    } finally {
      setPaymentLoading(false)
    }
  }

  async function handleGuestRegister(
    e: React.FormEvent,
    guestForm: { full_name: string; email: string; phone: string; experience: string; has_license: boolean; license_number: string; message: string },
    selectedDiscs: Set<string>,
    selectedSlots: Map<string, string>,
    ownWeapon: Set<string>,
  ) {
    e.preventDefault()
    if (eventDisciplines.length > 0 && selectedDiscs.size === 0) {
      setError('Wybierz co najmniej jedną dyscyplinę / opcję.')
      return
    }

    setRegistering(true)
    setError('')

    const discPayload = Array.from(selectedDiscs).map(edId => {
      const ed = eventDisciplines.find(e => e.id === edId)
      const isOwn = ownWeapon.has(edId)
      const price = ed ? (isOwn && (ed.own_weapon_price_pln ?? 0) > 0 ? Number(ed.own_weapon_price_pln) : Number(ed.price_pln)) : 0
      return {
        event_discipline_id: edId,
        price_pln: price,
        own_weapon: isOwn,
        ...(selectedSlots.has(edId) ? { event_discipline_slot_id: selectedSlots.get(edId) } : {}),
      }
    })

    const res = await fetch('/api/rejestracja', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_id: event.id,
        full_name: guestForm.full_name,
        email: guestForm.email,
        phone: guestForm.phone || undefined,
        experience: guestForm.experience || undefined,
        has_license: guestForm.has_license,
        license_number: guestForm.has_license && guestForm.license_number ? guestForm.license_number : undefined,
        message: guestForm.message || undefined,
        disciplines: discPayload,
      }),
    })

    const result = await res.json()

    if (!res.ok) {
      setRegistering(false)
      setError(result.error || 'Błąd zapisu')
      return
    }

    setRegistering(false)
    setRegistered(true)
    setCount(prev => prev + 1)
    setMode(null)
  }

  function closeForm(resetSelectionFn: () => void) {
    setMode(null)
    setError('')
    resetSelectionFn()
    setAddingDiscs(false)
  }

  function startAddingDiscs(setSelectedDiscsFn: (s: Set<string>) => void, setSelectedSlotsFn: (m: Map<string, string>) => void) {
    const alreadyIds = new Set(myDiscs.map((d: any) => d.edId))
    setSelectedDiscsFn(alreadyIds)
    const existingSlots = new Map<string, string>()
    for (const d of myDiscs as any[]) {
      if (d.edId && d.slot) {
        const matchSlot = slots.find(s =>
          s.event_discipline_id === d.edId && s.start_time === d.slot.start
        )
        if (matchSlot) existingSlots.set(d.edId, matchSlot.id)
      }
    }
    setSelectedSlotsFn(existingSlots)
    setAddingDiscs(true)
    setMode('member')
  }

  return {
    member,
    mode,
    setMode,
    registering,
    registered,
    isPaid,
    paymentLoading,
    cancelling,
    error,
    count,
    myRegId,
    myDiscs,
    addingDiscs,
    dataConfirmed,
    isFull,
    fillPercent,
    isCourse,
    alreadyEdIds,
    totalCost,
    newDiscsTotal,
    openRegistration,
    confirmDataAndProceed,
    handleMemberRegister,
    handleCancel,
    handlePayment,
    handleGuestRegister,
    closeForm,
    startAddingDiscs,
  }
}
