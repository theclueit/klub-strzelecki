'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { MapPin, Users, Clock, Tag, UserPlus, Check, X, User, Mail, Phone, ExternalLink, Target, Shield, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

const typeLabels: Record<string, { label: string; color: string }> = {
  competition: { label: 'Zawody', color: 'bg-primary/20 text-primary' },
  training: { label: 'Trening', color: 'bg-success/20 text-success' },
  course: { label: 'Kurs', color: 'bg-blue-500/20 text-blue-400' },
  other: { label: 'Inne', color: 'bg-muted/20 text-muted' },
}

interface EventDisc {
  id: string
  discipline_id: string
  price_pln: number
  own_weapon_price_pln?: number
  discipline?: { name: string; stations_count?: number; judges_per_station?: number } | null
}

interface EventSlot {
  id: string
  event_discipline_id: string
  start_time: string
  end_time: string
  max_participants: number
  current_count: number
}

interface EventCardProps {
  event: {
    id: string
    title: string
    description: string | null
    event_type: string
    start_date: string
    end_date: string | null
    location: string | null
    address: string | null
    max_participants: number | null
    price_pln: number
    discipline?: { name: string } | null
  }
  regCount: number
  eventDisciplines: EventDisc[]
  slots?: EventSlot[]
}

type RegMode = null | 'choose' | 'member' | 'guest' | 'confirm_data'

export default function EventCard({ event, regCount, eventDisciplines, slots = [] }: EventCardProps) {
  const { member } = useAuth()
  const supabase = createSupabaseBrowser()

  const [mode, setMode] = useState<RegMode>(null)
  const [registering, setRegistering] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')
  const [count, setCount] = useState(regCount)

  // My registered disciplines (when already registered)
  const [myRegId, setMyRegId] = useState<string | null>(null)
  const [myDiscs, setMyDiscs] = useState<{ name: string; slot?: { start: string; end: string } }[]>([])
  const [addingDiscs, setAddingDiscs] = useState(false)

  // Check if already registered + load my disciplines
  useEffect(() => {
    if (!member) return
    supabase
      .from('event_registrations')
      .select('id')
      .eq('event_id', event.id)
      .eq('member_id', member.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setRegistered(true)
          setMyRegId(data.id)
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

  // Selected disciplines for registration
  const [selectedDiscs, setSelectedDiscs] = useState<Set<string>>(new Set())

  // Selected slots: event_discipline_id -> slot_id
  const [selectedSlots, setSelectedSlots] = useState<Map<string, string>>(new Map())

  // Own weapon: event_discipline_id -> true/false
  const [ownWeapon, setOwnWeapon] = useState<Set<string>>(new Set())

  // Guest form
  const [guestForm, setGuestForm] = useState({
    full_name: '', email: '', phone: '',
    experience: '' as string, has_license: false, license_number: '', message: '',
  })

  const type = typeLabels[event.event_type] ?? typeLabels.other
  const isFull = event.max_participants ? count >= event.max_participants : false
  const fillPercent = event.max_participants ? Math.min((count / event.max_participants) * 100, 100) : 0

  function getEdPrice(ed: EventDisc): number {
    if (ownWeapon.has(ed.id) && (ed.own_weapon_price_pln ?? 0) > 0) return Number(ed.own_weapon_price_pln)
    return Number(ed.price_pln)
  }

  const selectedTotal = eventDisciplines
    .filter(ed => selectedDiscs.has(ed.id))
    .reduce((sum, ed) => sum + getEdPrice(ed), 0)

  // When adding disciplines, show only the cost of NEW (not already registered) ones
  const alreadyEdIds = new Set(myDiscs.map((d: any) => d.edId))
  const newDiscsTotal = addingDiscs
    ? eventDisciplines
        .filter(ed => selectedDiscs.has(ed.id) && !alreadyEdIds.has(ed.id))
        .reduce((sum, ed) => sum + getEdPrice(ed), 0)
    : selectedTotal

  // Get slots for a specific event_discipline_id
  function getSlotsForDiscipline(edId: string): EventSlot[] {
    return slots.filter(s => s.event_discipline_id === edId)
  }

  // Check if a discipline has slots that require selection
  function disciplineHasSlots(edId: string): boolean {
    return getSlotsForDiscipline(edId).length > 0
  }

  const isCourse = event.event_type === 'course'

  // Check if all selected disciplines that have slots also have a slot selected
  function allSlotsSelected(): boolean {
    if (isCourse) return true
    for (const edId of selectedDiscs) {
      if (disciplineHasSlots(edId) && !selectedSlots.has(edId)) {
        return false
      }
    }
    return true
  }

  function toggleDisc(edId: string) {
    setSelectedDiscs(prev => {
      const next = new Set(prev)
      if (next.has(edId)) {
        next.delete(edId)
        // Also remove any selected slot for this discipline
        setSelectedSlots(prevSlots => {
          const nextSlots = new Map(prevSlots)
          nextSlots.delete(edId)
          return nextSlots
        })
      } else {
        next.add(edId)
        // Auto-suggest same time slot if another discipline already has one selected
        autoSuggestSlot(edId)
      }
      return next
    })
  }

  // When selecting a new discipline, match the time of an already-selected slot
  function autoSuggestSlot(newEdId: string) {
    const discSlots = getSlotsForDiscipline(newEdId)
    if (discSlots.length === 0) return

    // Find a slot time from any already-selected discipline
    let referenceSlot: EventSlot | null = null
    for (const [edId, slotId] of selectedSlots.entries()) {
      const found = slots.find(s => s.id === slotId)
      if (found) { referenceSlot = found; break }
    }
    if (!referenceSlot) return

    // Find a slot in the new discipline that starts at the same time and isn't full
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

  function selectSlot(edId: string, slotId: string) {
    setSelectedSlots(prev => {
      const next = new Map(prev)
      next.set(edId, slotId)

      // Auto-fill same time for other selected disciplines that don't have a slot yet
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

  // Data confirmation state
  const [dataConfirmed, setDataConfirmed] = useState(false)

  function openRegistration() {
    setError('')
    // Pre-select all disciplines if there's only one
    if (eventDisciplines.length === 1) {
      setSelectedDiscs(new Set([eventDisciplines[0].id]))
    } else {
      setSelectedDiscs(new Set())
    }
    setSelectedSlots(new Map())
    if (member) {
      // Courses don't require full sign-in sheet data
      if (isCourse) {
        setMode('member')
      } else {
        // Competitions/trainings: check required data for sign-in sheet
        const missingData = !member.pesel || !member.id_document_number || !member.address || !member.date_of_birth
        if (missingData && !addingDiscs) {
          // Hard block — must complete profile first
          setMode('confirm_data')
        } else {
          // Data complete — check if confirmation is recent
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
    // Update data_confirmed_at timestamp
    await supabase.from('members').update({ data_confirmed_at: new Date().toISOString() }).eq('id', member.id)
    setDataConfirmed(true)
    setMode('member')
  }

  // Member registration
  async function handleMemberRegister() {
    if (!member) return
    if (eventDisciplines.length > 0 && selectedDiscs.size === 0) {
      setError('Wybierz co najmniej jedną dyscyplinę.')
      return
    }
    if (!allSlotsSelected()) {
      setError('Wybierz termin dla każdej wybranej dyscypliny.')
      return
    }
    // Confirm dialog for adding disciplines
    if (addingDiscs && myRegId) {
      const existingEdIds = new Set(myDiscs.map((d: any) => d.edId))
      const newEdIds = Array.from(selectedDiscs).filter(edId => !existingEdIds.has(edId))
      if (newEdIds.length === 0) {
        setError('Nie wybrano nowych dyscyplin.')
        return
      }
      const addTotal = newEdIds.reduce((sum, edId) => {
        const ed = eventDisciplines.find(e => e.id === edId)
        if (!ed) return sum
        return sum + getEdPrice(ed)
      }, 0)
      const newNames = newEdIds.map(edId => eventDisciplines.find(e => e.id === edId)?.discipline?.name ?? '?').join(', ')
      const confirmMsg = addTotal > 0
        ? `Dopisać: ${newNames}?\nKwota: ${addTotal.toFixed(0)} zł`
        : `Dopisać: ${newNames}?`
      if (!window.confirm(confirmMsg)) return
    }

    setRegistering(true)
    setError('')

    // Adding disciplines to existing registration
    if (addingDiscs && myRegId) {
      const alreadyEdIds = new Set(myDiscs.map((d: any) => d.edId))
      const newEdIds = Array.from(selectedDiscs).filter(edId => !alreadyEdIds.has(edId))
      if (newEdIds.length === 0) {
        setError('Nie wybrano nowych dyscyplin.')
        setRegistering(false)
        return
      }
      const rows = newEdIds.map(edId => {
        const ed = eventDisciplines.find(e => e.id === edId)
        const isOwn = ownWeapon.has(edId)
        const price = ed ? (isOwn && (ed.own_weapon_price_pln ?? 0) > 0 ? Number(ed.own_weapon_price_pln) : Number(ed.price_pln)) : 0
        return {
          event_discipline_id: edId,
          member_registration_id: myRegId,
          price_pln: price,
          own_weapon: isOwn,
          ...(selectedSlots.has(edId) ? { event_discipline_slot_id: selectedSlots.get(edId) } : {}),
        }
      })
      const { error: rdErr } = await supabase.from('registration_disciplines').insert(rows)
      if (rdErr) {
        setError('Błąd dodawania dyscyplin: ' + rdErr.message)
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
    const { data: regData, error: dbError } = await supabase.from('event_registrations').insert({
      event_id: event.id,
      member_id: member.id,
      status: 'registered',
    }).select('id').single()

    if (dbError) {
      setRegistering(false)
      if (dbError.code === '23505') {
        setError('Jesteś już zapisany na to wydarzenie.')
        setRegistered(true)
      } else {
        setError('Błąd zapisu: ' + dbError.message)
      }
      return
    }

    // Save selected disciplines with slot IDs
    if (selectedDiscs.size > 0 && regData) {
      const rows = Array.from(selectedDiscs).map(edId => {
        const ed = eventDisciplines.find(e => e.id === edId)
        const isOwn = ownWeapon.has(edId)
        const price = ed ? (isOwn && (ed.own_weapon_price_pln ?? 0) > 0 ? Number(ed.own_weapon_price_pln) : Number(ed.price_pln)) : 0
        return {
          event_discipline_id: edId,
          member_registration_id: regData.id,
          price_pln: price,
          own_weapon: isOwn,
          ...(selectedSlots.has(edId) ? { event_discipline_slot_id: selectedSlots.get(edId) } : {}),
        }
      })
      await supabase.from('registration_disciplines').insert(rows)
      setMyRegId(regData.id)
      await loadMyDisciplines(regData.id)
    }

    setRegistering(false)
    setRegistered(true)
    setCount(prev => prev + 1)
    setMode(null)
  }

  // Member cancel
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

  // Guest registration
  async function handleGuestRegister(e: React.FormEvent) {
    e.preventDefault()
    if (eventDisciplines.length > 0 && selectedDiscs.size === 0) {
      setError('Wybierz co najmniej jedną dyscyplinę / opcję.')
      return
    }
    if (!allSlotsSelected()) {
      setError('Wybierz termin dla każdej wybranej dyscypliny.')
      return
    }
    setRegistering(true)
    setError('')

    const { data: regData, error: dbError } = await supabase.from('guest_registrations').insert({
      event_id: event.id,
      full_name: guestForm.full_name,
      email: guestForm.email,
      phone: guestForm.phone || null,
      experience: guestForm.experience || null,
      has_license: guestForm.has_license,
      license_number: guestForm.has_license && guestForm.license_number ? guestForm.license_number : null,
      message: guestForm.message || null,
    }).select('id').single()

    if (dbError) {
      setRegistering(false)
      if (dbError.code === '23505') {
        setError('Ten email jest już zapisany na to wydarzenie.')
      } else {
        setError('Błąd zapisu: ' + dbError.message)
      }
      return
    }

    // Save selected disciplines with slot IDs
    if (selectedDiscs.size > 0 && regData) {
      const rows = Array.from(selectedDiscs).map(edId => {
        const ed = eventDisciplines.find(e => e.id === edId)
        const isOwn = ownWeapon.has(edId)
        const price = ed ? (isOwn && (ed.own_weapon_price_pln ?? 0) > 0 ? Number(ed.own_weapon_price_pln) : Number(ed.price_pln)) : 0
        return {
          event_discipline_id: edId,
          guest_registration_id: regData.id,
          price_pln: price,
          own_weapon: isOwn,
          ...(selectedSlots.has(edId) ? { event_discipline_slot_id: selectedSlots.get(edId) } : {}),
        }
      })
      await supabase.from('registration_disciplines').insert(rows)
    }

    setRegistering(false)
    setRegistered(true)
    setCount(prev => prev + 1)
    setMode(null)
  }

  function closeForm() {
    setMode(null)
    setError('')
    setSelectedDiscs(new Set())
    setSelectedSlots(new Map())
    setAddingDiscs(false)
    setGuestForm({ full_name: '', email: '', phone: '', experience: '', has_license: false, license_number: '', message: '' })
  }

  const inputClass = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary"

  // Slot picker for a discipline (hidden for courses)
  function SlotPicker({ edId }: { edId: string }) {
    if (isCourse) return null
    const discSlots = getSlotsForDiscipline(edId)
    if (discSlots.length === 0) return null

    const currentSelected = selectedSlots.get(edId)

    return (
      <div className="ml-6 mt-2 mb-1 space-y-1">
        <p className="text-xs text-muted mb-1.5">Wybierz termin:</p>
        {discSlots.map(slot => {
          const isFull = slot.current_count >= slot.max_participants
          const isSelected = currentSelected === slot.id
          const startFormatted = format(new Date(slot.start_time), 'HH:mm')
          const endFormatted = format(new Date(slot.end_time), 'HH:mm')

          return (
            <button
              key={slot.id}
              type="button"
              disabled={isFull}
              onClick={() => selectSlot(edId, slot.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors text-left ${
                isFull
                  ? 'border-border bg-background/50 text-muted/50 cursor-not-allowed opacity-50'
                  : isSelected
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border hover:border-primary/30 text-muted hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'bg-primary border-primary' : 'border-border'
                }`}>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-background" />}
                </div>
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                <span className={isSelected ? 'font-medium' : ''}>{startFormatted} - {endFormatted}</span>
              </div>
              <span className={`text-xs flex-shrink-0 ${isFull ? 'text-danger/50' : isSelected ? 'text-primary' : ''}`}>
                {slot.current_count}/{slot.max_participants} miejsc
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  // Discipline picker component used in both member and guest flows
  function DisciplinePicker() {
    if (eventDisciplines.length === 0) return null
    return (
      <div className="mb-3">
        <p className="text-sm font-medium mb-2">Wybierz dyscypliny / opcje:</p>
        <div className="space-y-1.5">
          {eventDisciplines.map(ed => {
            const isSelected = selectedDiscs.has(ed.id)
            const alreadyRegistered = addingDiscs && myDiscs.some((d: any) => d.edId === ed.id)
            return (
              <div key={ed.id}>
                <button
                  type="button"
                  disabled={alreadyRegistered}
                  onClick={() => !alreadyRegistered && toggleDisc(ed.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors text-left ${
                    alreadyRegistered
                      ? 'border-border bg-success/5 text-muted cursor-default'
                      : isSelected
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border hover:border-primary/30 text-muted hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      alreadyRegistered ? 'bg-success/30 border-success/50' : isSelected ? 'bg-primary border-primary' : 'border-border'
                    }`}>
                      {(isSelected || alreadyRegistered) && <Check className={`w-3 h-3 ${alreadyRegistered ? 'text-success' : 'text-background'}`} />}
                    </div>
                    <span className={isSelected ? 'font-medium' : ''}>{ed.discipline?.name ?? 'Dyscyplina'}</span>
                    {alreadyRegistered && (() => {
                      const myDisc = myDiscs.find((d: any) => d.edId === ed.id) as any
                      return (
                        <span className="text-xs text-success ml-1 flex items-center gap-1">
                          (zapisano)
                          {!isCourse && myDisc?.slot && (
                            <span className="flex items-center gap-0.5 text-success/70">
                              <Clock className="w-3 h-3" />
                              {format(new Date(myDisc.slot.start), 'HH:mm')}-{format(new Date(myDisc.slot.end), 'HH:mm')}
                            </span>
                          )}
                        </span>
                      )
                    })()}
                  </div>
                  {(Number(ed.price_pln) > 0 || Number(ed.own_weapon_price_pln ?? 0) > 0) && (
                    <span className="text-xs font-semibold ml-2 flex-shrink-0">
                      {ownWeapon.has(ed.id) && (ed.own_weapon_price_pln ?? 0) > 0
                        ? `${Number(ed.own_weapon_price_pln).toFixed(0)} zł`
                        : `${Number(ed.price_pln).toFixed(0)} zł`}
                    </span>
                  )}
                </button>
                {isSelected && !alreadyRegistered && (ed.own_weapon_price_pln ?? 0) > 0 && (
                  <label className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ownWeapon.has(ed.id)}
                      onChange={() => {
                        setOwnWeapon(prev => {
                          const next = new Set(prev)
                          if (next.has(ed.id)) next.delete(ed.id)
                          else next.add(ed.id)
                          return next
                        })
                      }}
                      className="rounded border-border"
                    />
                    <span>Własna broń</span>
                    <span className="text-xs text-muted">({Number(ed.own_weapon_price_pln).toFixed(0)} zł zamiast {Number(ed.price_pln).toFixed(0)} zł)</span>
                  </label>
                )}
                {isSelected && !alreadyRegistered && <SlotPicker edId={ed.id} />}
              </div>
            )
          })}
        </div>
        {selectedDiscs.size > 0 && (
          <div className="flex items-center justify-between mt-2 px-1">
            {addingDiscs ? (
              <>
                <span className="text-xs text-muted">Nowe: {selectedDiscs.size - alreadyEdIds.size} {(selectedDiscs.size - alreadyEdIds.size) === 1 ? 'pozycja' : (selectedDiscs.size - alreadyEdIds.size) < 5 ? 'pozycje' : 'pozycji'}</span>
                <span className="text-sm font-semibold text-primary">{newDiscsTotal > 0 ? `+${newDiscsTotal.toFixed(0)} zł` : '0 zł'}</span>
              </>
            ) : (
              <>
                <span className="text-xs text-muted">Wybrano: {selectedDiscs.size} {selectedDiscs.size === 1 ? 'pozycja' : selectedDiscs.size < 5 ? 'pozycje' : 'pozycji'}</span>
                <span className="text-sm font-semibold text-primary">{selectedTotal.toFixed(0)} zł</span>
              </>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/30 transition-colors">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        {/* Date */}
        <div className="flex-shrink-0 text-center bg-background rounded-lg p-3 w-20">
          <div className="text-2xl font-bold text-primary">
            {format(new Date(event.start_date), 'd', { locale: pl })}
          </div>
          <div className="text-xs text-muted uppercase">
            {format(new Date(event.start_date), 'MMM', { locale: pl })}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${type.color}`}>
              {type.label}
            </span>
            {eventDisciplines.map(ed => (
              <span key={ed.id} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                {ed.discipline?.name}
              </span>
            ))}
            {/* Fallback for old events with single discipline */}
            {eventDisciplines.length === 0 && event.discipline?.name && (
              <span className="text-xs text-muted">{event.discipline.name}</span>
            )}
          </div>
          <h3 className="text-lg font-semibold mb-2">{event.title}</h3>
          {event.description && (
            <p className="text-sm text-muted mb-3">{event.description}</p>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-muted">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {format(new Date(event.start_date), 'HH:mm', { locale: pl })}
              {event.end_date && ` - ${format(new Date(event.end_date), 'HH:mm', { locale: pl })}`}
            </span>
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {event.location}
                {event.address && (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(event.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-primary hover:text-primary-dark transition-colors ml-1"
                    title="Otwórz w Google Maps"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </span>
            )}
            {eventDisciplines.length > 0 && (
              <span className="flex items-center gap-1">
                <Tag className="w-4 h-4" />
                {eventDisciplines.length === 1
                  ? `${Number(eventDisciplines[0].price_pln).toFixed(0)} zł`
                  : `od ${Math.min(...eventDisciplines.map(d => Number(d.price_pln))).toFixed(0)} zł`
                }
              </span>
            )}
            {/* Fallback for old events */}
            {eventDisciplines.length === 0 && event.price_pln > 0 && (
              <span className="flex items-center gap-1">
                <Tag className="w-4 h-4" />
                {Number(event.price_pln).toFixed(0)} zł
              </span>
            )}
            {/* Stations from disciplines - only for competitions */}
            {event.event_type === 'competition' && eventDisciplines.length > 0 && (() => {
              const totalStations = eventDisciplines.reduce((s, ed) => s + (ed.discipline?.stations_count ?? 1), 0)
              return (
                <span className="flex items-center gap-1">
                  <Target className="w-4 h-4" />
                  {totalStations} stanowisk
                </span>
              )
            })()}
          </div>
        </div>

        {/* Capacity + Action */}
        <div className="flex-shrink-0 w-44">
          {event.max_participants && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="flex items-center gap-1 text-muted">
                  <Users className="w-4 h-4" />
                  {count}/{event.max_participants}
                </span>
                {isFull && !registered && <span className="text-xs text-danger font-medium">Pełne</span>}
              </div>
              <div className="w-full bg-background rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${isFull && !registered ? 'bg-danger' : 'bg-primary'}`}
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Main button */}
          {!registered && !isFull && mode === null && (
            <button
              onClick={openRegistration}
              className="w-full text-sm px-4 py-2 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-1"
            >
              <UserPlus className="w-4 h-4" />
              Zapisz się
            </button>
          )}

          {/* Already registered */}
          {registered && mode === null && (
            <div className="space-y-2">
              <div className="w-full text-sm px-4 py-2 bg-success/20 text-success font-semibold rounded-lg flex items-center justify-center gap-1">
                <Check className="w-4 h-4" />
                Zapisano
              </div>
              {/* Show option to add more disciplines */}
              {member && eventDisciplines.length > 1 && myDiscs.length < eventDisciplines.length && (
                <button
                  onClick={() => {
                    // Pre-select already registered disciplines and their slots
                    const alreadyEdIds = new Set(myDiscs.map((d: any) => d.edId))
                    setSelectedDiscs(alreadyEdIds)
                    // Pre-fill selected slots from existing registrations
                    const existingSlots = new Map<string, string>()
                    for (const d of myDiscs as any[]) {
                      if (d.edId && d.slot) {
                        // Find the slot ID by matching edId and start time
                        const matchSlot = slots.find(s =>
                          s.event_discipline_id === d.edId && s.start_time === d.slot.start
                        )
                        if (matchSlot) existingSlots.set(d.edId, matchSlot.id)
                      }
                    }
                    setSelectedSlots(existingSlots)
                    setAddingDiscs(true)
                    setMode('member')
                  }}
                  className="w-full text-xs px-3 py-1.5 border border-primary/30 text-primary rounded-lg hover:bg-primary/10 transition-colors"
                >
                  Dodaj dyscyplinę
                </button>
              )}
              {member && (
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="w-full text-xs px-3 py-1.5 border border-border text-muted rounded-lg hover:bg-card-hover hover:text-danger transition-colors disabled:opacity-50"
                >
                  {cancelling ? 'Anulowanie...' : 'Anuluj zapis'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* My registered disciplines */}
      {registered && mode === null && myDiscs.length > 0 && (
        <div className="mx-6 mb-4 pb-0">
          <p className="text-xs text-muted mb-1.5">Twoje dyscypliny:</p>
          <div className="flex flex-wrap gap-2">
            {myDiscs.map((d: any, i: number) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
                {d.name}
                {!isCourse && d.slot && (
                  <span className="text-primary/70 flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    {format(new Date(d.slot.start), 'HH:mm')} - {format(new Date(d.slot.end), 'HH:mm')}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ---- DATA CONFIRMATION ---- */}
      {mode === 'confirm_data' && member && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Potwierdz aktualne dane przed zapisem
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
              <div>
                <span className="text-xs text-muted">Imie i nazwisko</span>
                <p className="font-medium">{member.full_name}</p>
              </div>
              <div>
                <span className="text-xs text-muted">PESEL</span>
                <p className={`font-medium ${!member.pesel ? 'text-warning italic' : ''}`}>{member.pesel || 'brak - uzupelnij w profilu'}</p>
              </div>
              <div>
                <span className="text-xs text-muted">Nr dokumentu</span>
                <p className={`font-medium ${!member.id_document_number ? 'text-warning italic' : ''}`}>{member.id_document_number || 'brak - uzupelnij w profilu'}</p>
              </div>
              <div>
                <span className="text-xs text-muted">Adres</span>
                <p className={`font-medium ${!member.address ? 'text-warning italic' : ''}`}>{member.address || 'brak - uzupelnij w profilu'}</p>
              </div>
              <div>
                <span className="text-xs text-muted">Telefon</span>
                <p className="font-medium">{member.phone || '-'}</p>
              </div>
              <div>
                <span className="text-xs text-muted">Klub</span>
                <p className="font-medium">{member.club_name}</p>
              </div>
              {member.has_weapons_permit && (
                <div>
                  <span className="text-xs text-muted">Nr pozwolenia na bron</span>
                  <p className={`font-medium ${!member.weapon_permit_number ? 'text-warning italic' : ''}`}>{member.weapon_permit_number || 'brak - uzupelnij w profilu'}</p>
                </div>
              )}
              {member.license_number && (
                <div>
                  <span className="text-xs text-muted">Nr licencji</span>
                  <p className="font-medium">{member.license_number}</p>
                </div>
              )}
            </div>

            {(() => {
              const missing: string[] = []
              if (!member.pesel) missing.push('PESEL')
              if (!member.date_of_birth) missing.push('data urodzenia')
              if (!member.id_document_number) missing.push('nr dokumentu tozsamosci')
              if (!member.address) missing.push('adres zamieszkania')
              const hasMissing = missing.length > 0

              return hasMissing ? (
                <>
                  <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 mb-3">
                    <p className="text-sm text-danger font-semibold mb-1">Nie mozna sie zapisac</p>
                    <p className="text-xs text-danger/80 mb-2">
                      Rejestracja na zawody wymaga kompletnych danych do listy wejscia na strzelnice. Brakuje: <strong>{missing.join(', ')}</strong>
                    </p>
                    <p className="text-xs text-danger/60">Uzupelnij dane w profilu, a nastepnie wroc i zapisz sie na zawody.</p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href="/profil"
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors"
                    >
                      Uzupelnij dane w profilu
                    </a>
                    <button onClick={closeForm} className="px-4 py-2.5 border border-border text-muted text-sm rounded-lg hover:bg-card-hover transition-colors">
                      Anuluj
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={confirmDataAndProceed}
                    className="flex-1 bg-primary text-background text-sm font-semibold py-2.5 rounded-lg hover:bg-primary-dark transition-colors"
                  >
                    Dane sa aktualne - kontynuuj
                  </button>
                  <a
                    href="/profil"
                    className="flex items-center gap-1 px-4 py-2.5 border border-border text-muted text-sm rounded-lg hover:bg-card-hover transition-colors"
                  >
                    Zaktualizuj dane
                  </a>
                </div>
              )
            })()}
            <button onClick={closeForm} className="mt-2 text-xs text-muted hover:text-foreground transition-colors block w-full text-center">
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* ---- CHOOSE PATH ---- */}
      {mode === 'choose' && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm font-medium mb-3">Jak chcesz się zapisać?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href="/logowanie"
              className="flex items-center gap-3 p-4 border border-border rounded-xl hover:border-primary/30 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-sm group-hover:text-primary transition-colors">Jestem członkiem klubu</div>
                <div className="text-xs text-muted">Zaloguj się i zapisz jednym kliknięciem</div>
              </div>
            </a>
            <button
              onClick={() => {
                if (eventDisciplines.length === 1) {
                  setSelectedDiscs(new Set([eventDisciplines[0].id]))
                }
                setMode('guest')
              }}
              className="flex items-center gap-3 p-4 border border-border rounded-xl hover:border-primary/30 transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="font-semibold text-sm group-hover:text-blue-400 transition-colors">Osoba z zewnątrz</div>
                <div className="text-xs text-muted">Wypełnij formularz zgłoszeniowy</div>
              </div>
            </button>
          </div>
          <button onClick={closeForm} className="mt-3 text-xs text-muted hover:text-foreground transition-colors">
            Anuluj
          </button>
        </div>
      )}

      {/* ---- MEMBER CONFIRM ---- */}
      {mode === 'member' && (!registered || addingDiscs) && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {member?.full_name.charAt(0)}
            </div>
            <div>
              <div className="font-medium text-sm">{member?.full_name}</div>
              <div className="text-xs text-muted">{member?.license_number ?? member?.email}</div>
            </div>
          </div>

          <DisciplinePicker />

          {error && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg p-2 mb-3">
              <p className="text-xs text-danger">{error}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleMemberRegister}
              disabled={registering}
              className="flex-1 text-sm px-4 py-2 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {registering ? 'Zapisuję...' : addingDiscs
                ? (newDiscsTotal > 0 ? `Potwierdź dopisanie · ${newDiscsTotal.toFixed(0)} zł` : 'Potwierdź dopisanie')
                : (selectedTotal > 0 ? `Potwierdź zapis · ${selectedTotal.toFixed(0)} zł` : 'Potwierdź zapis')}
            </button>
            <button onClick={closeForm} className="text-sm px-4 py-2 border border-border rounded-lg hover:bg-card-hover transition-colors">
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* ---- GUEST FORM ---- */}
      {mode === 'guest' && !registered && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-5 h-5 text-blue-400" />
            <h4 className="font-semibold text-sm">Zgłoszenie osoby z zewnątrz</h4>
          </div>
          <form onSubmit={handleGuestRegister} className="space-y-3">
            <DisciplinePicker />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted block mb-1">Imię i nazwisko *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-muted absolute left-3 top-2.5" />
                  <input
                    required
                    value={guestForm.full_name}
                    onChange={e => setGuestForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="Jan Kowalski"
                    className={inputClass + ' pl-9'}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Email *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-muted absolute left-3 top-2.5" />
                  <input
                    required
                    type="email"
                    value={guestForm.email}
                    onChange={e => setGuestForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="jan@example.com"
                    className={inputClass + ' pl-9'}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted block mb-1">Telefon</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-muted absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    value={guestForm.phone}
                    onChange={e => setGuestForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+48 123 456 789"
                    className={inputClass + ' pl-9'}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Doświadczenie</label>
                <select
                  value={guestForm.experience}
                  onChange={e => setGuestForm(f => ({ ...f, experience: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">Wybierz...</option>
                  <option value="none">Brak</option>
                  <option value="beginner">Początkujący (do 1 roku)</option>
                  <option value="intermediate">Średniozaawansowany</option>
                  <option value="advanced">Zaawansowany (3+ lat)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={guestForm.has_license}
                  onChange={e => setGuestForm(f => ({ ...f, has_license: e.target.checked }))}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm">Posiadam pozwolenie na broń</span>
              </label>
              {guestForm.has_license && (
                <input
                  value={guestForm.license_number}
                  onChange={e => setGuestForm(f => ({ ...f, license_number: e.target.value }))}
                  placeholder="Numer pozwolenia"
                  className={inputClass + ' mt-2'}
                />
              )}
            </div>

            <div>
              <label className="text-xs text-muted block mb-1">Wiadomość do organizatora</label>
              <textarea
                value={guestForm.message}
                onChange={e => setGuestForm(f => ({ ...f, message: e.target.value }))}
                rows={2}
                placeholder="Dodatkowe informacje, pytania..."
                className={inputClass + ' resize-none'}
              />
            </div>

            {selectedTotal > 0 && (
              <p className="text-xs text-muted">
                Do zapłaty: <span className="font-semibold text-foreground">{selectedTotal.toFixed(0)} zł</span> — szczegóły płatności zostaną przesłane na email.
              </p>
            )}

            {error && (
              <div className="bg-danger/10 border border-danger/30 rounded-lg p-2">
                <p className="text-xs text-danger">{error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={registering}
                className="flex-1 text-sm px-4 py-2 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {registering ? 'Wysyłanie...' : selectedTotal > 0 ? `Wyślij zgłoszenie · ${selectedTotal.toFixed(0)} zł` : 'Wyślij zgłoszenie'}
              </button>
              <button type="button" onClick={closeForm} className="text-sm px-4 py-2 border border-border rounded-lg hover:bg-card-hover transition-colors">
                Anuluj
              </button>
            </div>

            <p className="text-xs text-muted text-center">
              Wysyłając zgłoszenie wyrażasz zgodę na przetwarzanie danych w celu organizacji wydarzenia (RODO art. 6 ust. 1 lit. a).
            </p>
          </form>
        </div>
      )}

      {/* Global error outside forms */}
      {error && mode === null && (
        <div className="mt-3 bg-danger/10 border border-danger/30 rounded-lg p-2">
          <p className="text-xs text-danger">{error}</p>
        </div>
      )}
    </div>
  )
}
