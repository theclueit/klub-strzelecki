'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { UserPlus, Users, Zap, Search, Check, ClipboardList, DoorOpen, Target, Clock, Loader2, Printer } from 'lucide-react'
import type { Member, Discipline, EventDiscipline, EventDisciplineSlot } from '@/types/database'

interface EventRow {
  id: string
  title: string
  start_date: string
  end_date: string | null
  location: string | null
  is_published: boolean
}

export default function RegistrarPage() {
  const { member, loading } = useAuth()
  const supabase = createSupabaseBrowser()

  const [events, setEvents] = useState<EventRow[]>([])
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [eventDisciplines, setEventDisciplines] = useState<(EventDiscipline & { discipline?: Discipline })[]>([])
  const [eventSlots, setEventSlots] = useState<EventDisciplineSlot[]>([])
  const [regDisciplines, setRegDisciplines] = useState<{ event_discipline_slot_id: string | null }[]>([])

  const [mode, setMode] = useState<'member' | 'guest'>('member')
  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedDiscId, setSelectedDiscId] = useState('')
  const [selectedSlotId, setSelectedSlotId] = useState('')
  const [memberId, setMemberId] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [guestForm, setGuestForm] = useState({
    full_name: '', email: '', phone: '', has_license: false, license_number: '', club_name: '',
  })

  // Tabs: 'events' (rejestracja na zawody) | 'range' (wejście na strzelnicę)
  const [tab, setTab] = useState<'events' | 'range'>('events')

  // Range entry log
  interface RangeEntry {
    id: string
    member_id: string | null
    guest_name: string | null
    start_time: string
    end_time: string
    station_number: number
    paid: boolean
    status: string
    lane: { name: string } | null
    member: { full_name: string } | null
  }
  const [rangeEntries, setRangeEntries] = useState<RangeEntry[]>([])
  const [rangeLoading, setRangeLoading] = useState(false)

  const loadRangeEntries = useCallback(async () => {
    setRangeLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('lane_reservations')
      .select('id, member_id, guest_name, start_time, end_time, station_number, paid, status, lane:shooting_lanes(name), member:members!lane_reservations_member_id_fkey(full_name)')
      .eq('reservation_date', today)
      .neq('status', 'cancelled')
      .order('start_time')
    setRangeEntries((data ?? []) as any[])
    setRangeLoading(false)
  }, [supabase])

  useEffect(() => {
    if (tab === 'range' && member) loadRangeEntries()
  }, [tab, member])

  const loadData = useCallback(async () => {
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const [evRes, memRes, edRes, slotRes, rdRes] = await Promise.all([
      supabase.from('events').select('id, title, start_date, end_date, location, is_published').eq('is_published', true),
      supabase.from('members').select('*').order('full_name'),
      supabase.from('event_disciplines').select('*, discipline:disciplines(*)').order('price_pln'),
      supabase.from('event_discipline_slots').select('*').order('start_time'),
      supabase.from('registration_disciplines').select('event_discipline_slot_id'),
    ])

    // Filter to today's events
    const todayEvents = ((evRes.data ?? []) as EventRow[]).filter(ev => {
      const startStr = ev.start_date.slice(0, 10)
      const endStr = ev.end_date ? ev.end_date.slice(0, 10) : startStr
      return todayStr >= startStr && todayStr <= endStr
    })

    setEvents(todayEvents)
    setAllMembers((memRes.data ?? []) as Member[])
    setEventDisciplines((edRes.data ?? []) as any[])
    setEventSlots((slotRes.data ?? []) as EventDisciplineSlot[])
    setRegDisciplines((rdRes.data ?? []) as any[])

    if (todayEvents.length === 1) {
      setSelectedEventId(todayEvents[0].id)
    }
  }, [supabase])

  useEffect(() => {
    if (member && ['registrar', 'range_registrar', 'admin'].includes(member.role)) loadData()
  }, [member, loadData])

  if (loading) return <div className="p-16 text-center text-muted">Ładowanie...</div>
  if (!member || !['registrar', 'range_registrar', 'admin'].includes(member.role)) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-card border border-border rounded-xl p-8">
          <UserPlus className="w-12 h-12 text-primary mx-auto mb-3" />
          <h1 className="text-2xl font-bold mb-2">Panel rejestracji</h1>
          <p className="text-muted">Brak uprawnień. Dostęp mają tylko osoby z rolą rejestratora lub administratora.</p>
        </div>
      </div>
    )
  }

  const getEventDiscs = (eventId: string) => eventDisciplines.filter(ed => ed.event_id === eventId)
  const getSlotsForDisc = (edId: string) => eventSlots.filter(s => s.event_discipline_id === edId)
  const getSlotCount = (slotId: string) => regDisciplines.filter(rd => rd.event_discipline_slot_id === slotId).length

  const filteredMembers = memberSearch.length >= 2
    ? allMembers.filter(m =>
        m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        (m.license_number && m.license_number.toLowerCase().includes(memberSearch.toLowerCase()))
      ).slice(0, 10)
    : []

  const inputClass = 'w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-primary'

  async function registerMember() {
    if (!memberId || !selectedEventId || !selectedDiscId) {
      setMessage('Wybierz członka, wydarzenie i dyscyplinę.')
      return
    }
    setSaving(true)
    setMessage('')

    const { data: existingReg } = await supabase
      .from('event_registrations')
      .select('id')
      .eq('event_id', selectedEventId)
      .eq('member_id', memberId)
      .single()

    let regId: string
    if (existingReg) {
      regId = existingReg.id
    } else {
      const { data: newReg, error: regErr } = await supabase
        .from('event_registrations')
        .insert({ event_id: selectedEventId, member_id: memberId, status: 'confirmed', paid: false })
        .select('id')
        .single()
      if (regErr || !newReg) {
        setMessage('Błąd rejestracji: ' + (regErr?.message ?? ''))
        setSaving(false)
        return
      }
      regId = newReg.id
    }

    const rdPayload: any = { event_discipline_id: selectedDiscId, member_registration_id: regId }
    if (selectedSlotId) rdPayload.event_discipline_slot_id = selectedSlotId

    const { error: rdErr } = await supabase.from('registration_disciplines').insert(rdPayload)
    if (rdErr) {
      setMessage('Błąd dyscypliny: ' + rdErr.message)
      setSaving(false)
      loadData()
      return
    }

    setMessage('Zarejestrowano pomyślnie!')
    setMemberId('')
    setMemberSearch('')
    setSelectedDiscId('')
    setSelectedSlotId('')
    setSaving(false)
    loadData()
  }

  async function registerGuest() {
    if (!guestForm.full_name || !selectedEventId || !selectedDiscId) {
      setMessage('Podaj imię i nazwisko, wydarzenie i dyscyplinę.')
      return
    }
    setSaving(true)
    setMessage('')

    if (guestForm.email) {
      const { data: existing } = await supabase
        .from('guest_registrations')
        .select('id')
        .eq('event_id', selectedEventId)
        .eq('email', guestForm.email)
        .maybeSingle()
      if (existing) {
        setMessage('Gość z tym emailem jest już zapisany.')
        setSaving(false)
        return
      }
    }

    const { data: guestReg, error: guestErr } = await supabase
      .from('guest_registrations')
      .insert({
        event_id: selectedEventId,
        full_name: guestForm.full_name,
        email: guestForm.email || `walk-in-${Date.now()}@brak.pl`,
        phone: guestForm.phone || null,
        has_license: guestForm.has_license,
        license_number: guestForm.has_license ? guestForm.license_number || null : null,
        club_name: guestForm.club_name || null,
        experience: 'walk-in',
        status: 'confirmed',
      })
      .select('id')
      .single()

    if (guestErr || !guestReg) {
      setMessage('Błąd: ' + (guestErr?.message ?? ''))
      setSaving(false)
      return
    }

    const rdPayload: any = { event_discipline_id: selectedDiscId, guest_registration_id: guestReg.id }
    if (selectedSlotId) rdPayload.event_discipline_slot_id = selectedSlotId

    const { error: rdErr } = await supabase.from('registration_disciplines').insert(rdPayload)
    if (rdErr) {
      setMessage('Gość zarejestrowany, ale błąd dyscypliny: ' + rdErr.message)
      setSaving(false)
      loadData()
      return
    }

    setMessage('Gość zarejestrowany pomyślnie!')
    setGuestForm({ full_name: '', email: '', phone: '', has_license: false, license_number: '', club_name: '' })
    setSelectedDiscId('')
    setSelectedSlotId('')
    setSaving(false)
    loadData()
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <UserPlus className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Rejestracja na miejscu</h1>
            <p className="text-sm text-muted">Zalogowany: {member.full_name}</p>
          </div>
        </div>
      </div>

      {/* Tabs: Zawody / Strzelnica */}
      <div className="flex bg-card rounded-lg p-1 border border-border w-fit mb-6">
        <button
          onClick={() => setTab('events')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm rounded-md transition-colors font-medium ${tab === 'events' ? 'bg-primary text-background' : 'text-muted hover:text-foreground'}`}
        >
          <ClipboardList className="w-4 h-4" />
          Zawody
        </button>
        <button
          onClick={() => setTab('range')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm rounded-md transition-colors font-medium ${tab === 'range' ? 'bg-primary text-background' : 'text-muted hover:text-foreground'}`}
        >
          <DoorOpen className="w-4 h-4" />
          Wejście na strzelnicę
        </button>
      </div>

      {/* === TAB: STRZELNICA === */}
      {tab === 'range' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Dzisiejsze wejścia na strzelnicę</h2>
            <div className="flex gap-2">
              <button onClick={loadRangeEntries} className="px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-card transition-colors">
                Odśwież
              </button>
              <a href="/rezerwacje" className="px-3 py-1.5 bg-primary text-background text-xs font-semibold rounded-lg hover:bg-primary-dark transition-colors">
                + Nowa rezerwacja
              </a>
              <a href="/strzelanie-rekreacyjne" className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition-colors">
                + Zestaw strzelecki
              </a>
            </div>
          </div>

          {rangeLoading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-muted">
              <Loader2 className="w-5 h-5 animate-spin" />
              Ładowanie...
            </div>
          ) : rangeEntries.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted">
              <DoorOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Brak wejść na strzelnicę dzisiaj.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="text-left px-4 py-3">Osoba</th>
                    <th className="text-left px-4 py-3">Tor / Stanowisko</th>
                    <th className="text-left px-4 py-3">Godziny</th>
                    <th className="text-center px-4 py-3">Opłacone</th>
                    <th className="text-center px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rangeEntries.map(entry => (
                    <tr key={entry.id} className="border-b border-border/30 hover:bg-card-hover">
                      <td className="px-4 py-3 font-medium">
                        {entry.member?.full_name || entry.guest_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {(entry.lane as any)?.name || '—'} / St. {entry.station_number}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {entry.start_time?.slice(0, 5)} – {entry.end_time?.slice(0, 5)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {entry.paid
                          ? <span className="text-green-500 text-xs font-semibold">✓ Tak</span>
                          : <span className="text-red-400 text-xs font-semibold">✗ Nie</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          entry.status === 'reserved' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
                        }`}>
                          {entry.status === 'reserved' ? 'Zarezerwowane' : entry.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* === TAB: ZAWODY === */}
      {tab === 'events' && events.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted">Brak wydarzeń odbywających się dzisiaj.</p>
        </div>
      ) : tab === 'events' && (
        <div className="space-y-4">
          {/* Mode toggle */}
          <div className="flex bg-card rounded-lg p-1 border border-border w-fit">
            <button
              onClick={() => { setMode('member'); setMessage('') }}
              className={`px-5 py-2 text-sm rounded-md transition-colors font-medium ${mode === 'member' ? 'bg-primary text-background' : 'text-muted hover:text-foreground'}`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Członek
            </button>
            <button
              onClick={() => { setMode('guest'); setMessage('') }}
              className={`px-5 py-2 text-sm rounded-md transition-colors font-medium ${mode === 'guest' ? 'bg-primary text-background' : 'text-muted hover:text-foreground'}`}
            >
              <UserPlus className="w-4 h-4 inline mr-2" />
              Gość
            </button>
          </div>

          {/* Event */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-muted block mb-1.5 font-medium">Wydarzenie</label>
                <select
                  value={selectedEventId}
                  onChange={e => { setSelectedEventId(e.target.value); setSelectedDiscId(''); setSelectedSlotId('') }}
                  className={inputClass + ' text-sm'}
                >
                  <option value="">Wybierz...</option>
                  {events.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1.5 font-medium">Dyscyplina</label>
                <select
                  value={selectedDiscId}
                  onChange={e => { setSelectedDiscId(e.target.value); setSelectedSlotId('') }}
                  className={inputClass + ' text-sm'}
                  disabled={!selectedEventId}
                >
                  <option value="">Wybierz...</option>
                  {selectedEventId && getEventDiscs(selectedEventId).map(ed => (
                    <option key={ed.id} value={ed.id}>{ed.discipline?.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1.5 font-medium">Slot (opcjonalnie)</label>
                <select
                  value={selectedSlotId}
                  onChange={e => setSelectedSlotId(e.target.value)}
                  className={inputClass + ' text-sm'}
                  disabled={!selectedDiscId}
                >
                  <option value="">Bez slotu</option>
                  {selectedDiscId && getSlotsForDisc(selectedDiscId).map(slot => {
                    const count = getSlotCount(slot.id)
                    return (
                      <option key={slot.id} value={slot.id} disabled={count >= slot.max_participants}>
                        {new Date(slot.start_time).toLocaleTimeString('pl', { hour: '2-digit', minute: '2-digit' })}
                        -{new Date(slot.end_time).toLocaleTimeString('pl', { hour: '2-digit', minute: '2-digit' })}
                        {' '}({count}/{slot.max_participants})
                      </option>
                    )
                  })}
                </select>
              </div>
            </div>

            {/* Member mode */}
            {mode === 'member' && (
              <div className="relative">
                <label className="text-xs text-muted block mb-1.5 font-medium">Wyszukaj członka</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={e => { setMemberSearch(e.target.value); setMemberId('') }}
                    className={inputClass + ' text-sm pl-10'}
                    placeholder="Nazwisko lub numer licencji..."
                  />
                </div>
                {memberId && (
                  <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    {allMembers.find(m => m.id === memberId)?.full_name}
                  </p>
                )}
                {filteredMembers.length > 0 && !memberId && (
                  <div className="absolute z-10 left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {filteredMembers.map(m => (
                      <button
                        key={m.id}
                        onClick={() => { setMemberId(m.id); setMemberSearch(m.full_name) }}
                        className="w-full text-left px-4 py-3 hover:bg-card-hover text-sm border-b border-border/30 last:border-b-0"
                      >
                        <span className="font-medium">{m.full_name}</span>
                        {m.license_number && <span className="text-muted ml-2">({m.license_number})</span>}
                        {m.club_name && <span className="text-muted ml-2">· {m.club_name}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Guest mode */}
            {mode === 'guest' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted block mb-1.5 font-medium">Imię i nazwisko *</label>
                  <input
                    type="text"
                    value={guestForm.full_name}
                    onChange={e => setGuestForm(f => ({ ...f, full_name: e.target.value }))}
                    className={inputClass + ' text-sm'}
                    placeholder="Jan Kowalski"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5 font-medium">Klub (opcjonalnie)</label>
                  <input
                    type="text"
                    value={guestForm.club_name}
                    onChange={e => setGuestForm(f => ({ ...f, club_name: e.target.value }))}
                    className={inputClass + ' text-sm'}
                    placeholder="Nazwa klubu"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5 font-medium">Email (opcjonalnie)</label>
                  <input
                    type="email"
                    value={guestForm.email}
                    onChange={e => setGuestForm(f => ({ ...f, email: e.target.value }))}
                    className={inputClass + ' text-sm'}
                    placeholder="jan@example.com"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1.5 font-medium">Telefon (opcjonalnie)</label>
                  <input
                    type="tel"
                    value={guestForm.phone}
                    onChange={e => setGuestForm(f => ({ ...f, phone: e.target.value }))}
                    className={inputClass + ' text-sm'}
                    placeholder="+48 123 456 789"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={guestForm.has_license}
                      onChange={e => setGuestForm(f => ({ ...f, has_license: e.target.checked }))}
                      className="rounded border-border"
                    />
                    Posiada pozwolenie na broń
                  </label>
                  {guestForm.has_license && (
                    <input
                      type="text"
                      value={guestForm.license_number}
                      onChange={e => setGuestForm(f => ({ ...f, license_number: e.target.value }))}
                      className={inputClass + ' text-sm mt-2'}
                      placeholder="Numer pozwolenia"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Submit */}
            <div className="flex items-center gap-4 pt-2">
              <button
                onClick={mode === 'member' ? registerMember : registerGuest}
                disabled={saving || !selectedEventId || !selectedDiscId || (mode === 'member' ? !memberId : !guestForm.full_name)}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
              >
                <Zap className="w-4 h-4" />
                {saving ? 'Rejestrowanie...' : mode === 'member' ? 'Zarejestruj członka' : 'Zarejestruj gościa'}
              </button>
              {message && (
                <p className={`text-sm ${message.includes('pomyślnie') ? 'text-green-400' : 'text-danger'}`}>
                  {message}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
