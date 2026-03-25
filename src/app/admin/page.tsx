'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { Shield, Calendar, Target, Users, Plus, Trash2, Pencil, Save, X, UserPlus, ChevronDown, ChevronUp, ClipboardList, Check, Ban, Tag, Clock, Printer, MapPin, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Discipline, Member, EventDiscipline, EventDisciplineSlot } from '@/types/database'

interface EventRow {
  id: string
  title: string
  description: string | null
  event_type: string
  discipline_id: string | null
  start_date: string
  end_date: string | null
  location: string | null
  address: string | null
  stations_count: number | null
  max_participants: number | null
  price_pln: number
  is_published: boolean
}

interface EventJudge {
  id: string
  event_id: string
  judge_id: string
  status: string | null
  notified_at: string | null
  confirmed_at: string | null
}

interface GuestReg {
  id: string
  event_id: string
  full_name: string
  email: string
  phone: string | null
  experience: string | null
  has_license: boolean
  license_number: string | null
  message: string | null
  registered_at: string
  status: string
}

interface RegDiscipline {
  id: string
  event_discipline_id: string
  member_registration_id: string | null
  guest_registration_id: string | null
  event_discipline_slot_id: string | null
}

type Tab = 'events' | 'disciplines' | 'judges' | 'registrations'

export default function AdminPage() {
  const { member, loading } = useAuth()
  const router = useRouter()
  const supabase = createSupabaseBrowser()

  const [tab, setTab] = useState<Tab>('events')
  const [events, setEvents] = useState<EventRow[]>([])
  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [judges, setJudges] = useState<Member[]>([])
  const [eventJudges, setEventJudges] = useState<EventJudge[]>([])
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [guestRegs, setGuestRegs] = useState<GuestReg[]>([])
  const [memberRegs, setMemberRegs] = useState<{ id: string; event_id: string; member_id: string; registered_at: string; status: string; member?: Member }[]>([])
  const [eventDisciplines, setEventDisciplines] = useState<(EventDiscipline & { discipline?: Discipline })[]>([])
  const [regDisciplines, setRegDisciplines] = useState<RegDiscipline[]>([])
  const [eventSlots, setEventSlots] = useState<EventDisciplineSlot[]>([])

  // Modals
  const [showEventForm, setShowEventForm] = useState(false)
  const [showDisciplineForm, setShowDisciplineForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null)
  const [editingDiscipline, setEditingDiscipline] = useState<Discipline | null>(null)
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)

  // Slot management
  const [slotManagedEvent, setSlotManagedEvent] = useState<string | null>(null)
  const [newSlotForm, setNewSlotForm] = useState<{ event_discipline_id: string; start_time: string; end_time: string; max_participants: string }>({
    event_discipline_id: '', start_time: '', end_time: '', max_participants: '10',
  })

  // On-site registration
  const [onsiteMemberId, setOnsiteMemberId] = useState('')
  const [onsiteEventId, setOnsiteEventId] = useState('')
  const [onsiteDisciplineId, setOnsiteDisciplineId] = useState('')
  const [onsiteSlotId, setOnsiteSlotId] = useState('')
  const [onsiteSaving, setOnsiteSaving] = useState(false)
  const [onsiteMessage, setOnsiteMessage] = useState('')
  const [onsiteMemberSearch, setOnsiteMemberSearch] = useState('')

  // Form states
  const [eventForm, setEventForm] = useState({
    title: '', description: '', event_type: 'competition' as string,
    start_date: '', end_date: '', location: '', address: '', stations_count: '',
    max_participants: '', is_published: true,
  })
  const [disciplineForm, setDisciplineForm] = useState({
    name: '', description: '', target_type: '' as string, default_price_pln: '0',
  })
  // Event disciplines management
  const [editingEventDisciplines, setEditingEventDisciplines] = useState<{ discipline_id: string; price_pln: string }[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && (!member || member.role !== 'admin')) {
      router.push('/')
      return
    }
    if (member?.role === 'admin') loadAll()
  }, [member, loading])

  async function loadAll() {
    const [evRes, discRes, judgesRes, ejRes, membersRes, guestRes, memberRegsRes, edRes, rdRes, slotsRes] = await Promise.all([
      supabase.from('events').select('*').order('start_date', { ascending: false }),
      supabase.from('disciplines').select('*').order('name'),
      supabase.from('members').select('*').in('role', ['judge', 'admin']).order('full_name'),
      supabase.from('event_judges').select('*'),
      supabase.from('members').select('*').eq('is_active', true).order('full_name'),
      supabase.from('guest_registrations').select('*').order('registered_at', { ascending: false }),
      supabase.from('event_registrations').select('*, member:members(full_name, email, license_number)').order('registered_at', { ascending: false }),
      supabase.from('event_disciplines').select('*, discipline:disciplines(*)').order('price_pln'),
      supabase.from('registration_disciplines').select('*'),
      supabase.from('event_discipline_slots').select('*').order('start_time'),
    ])
    setEvents((evRes.data ?? []) as EventRow[])
    setDisciplines((discRes.data ?? []) as Discipline[])
    setJudges((judgesRes.data ?? []) as Member[])
    setEventJudges((ejRes.data ?? []) as EventJudge[])
    setAllMembers((membersRes.data ?? []) as Member[])
    setGuestRegs((guestRes.data ?? []) as GuestReg[])
    setMemberRegs((memberRegsRes.data ?? []) as any[])
    setEventDisciplines((edRes.data ?? []) as any[])
    setRegDisciplines((rdRes.data ?? []) as RegDiscipline[])
    setEventSlots((slotsRes.data ?? []) as EventDisciplineSlot[])
  }

  // ---- EVENTS ----
  function getEventDiscs(eventId: string) {
    return eventDisciplines.filter(ed => ed.event_id === eventId)
  }

  function openNewEvent() {
    setEditingEvent(null)
    setEventForm({
      title: '', description: '', event_type: 'competition',
      start_date: '', end_date: '',
      location: 'Strzelnica klubowa', address: '', stations_count: '',
      max_participants: '30', is_published: true,
    })
    setEditingEventDisciplines([])
    setShowEventForm(true)
    setError('')
  }

  function openEditEvent(ev: EventRow) {
    setEditingEvent(ev)
    setEventForm({
      title: ev.title,
      description: ev.description ?? '',
      event_type: ev.event_type,
      start_date: ev.start_date ? new Date(ev.start_date).toISOString().slice(0, 16) : '',
      end_date: ev.end_date ? new Date(ev.end_date).toISOString().slice(0, 16) : '',
      location: ev.location ?? '',
      address: ev.address ?? '',
      stations_count: ev.stations_count?.toString() ?? '',
      max_participants: ev.max_participants?.toString() ?? '',
      is_published: ev.is_published,
    })
    // Load existing event disciplines into form
    const existing = getEventDiscs(ev.id)
    setEditingEventDisciplines(existing.map(ed => ({
      discipline_id: ed.discipline_id,
      price_pln: ed.price_pln.toString(),
    })))
    setShowEventForm(true)
    setError('')
  }

  function addDisciplineToEvent() {
    // Find first discipline not yet added
    const used = new Set(editingEventDisciplines.map(d => d.discipline_id))
    const available = disciplines.filter(d => !used.has(d.id))
    if (available.length === 0) return
    const disc = available[0]
    setEditingEventDisciplines(prev => [...prev, { discipline_id: disc.id, price_pln: String(disc.default_price_pln ?? 0) }])
  }

  function removeDisciplineFromEvent(index: number) {
    setEditingEventDisciplines(prev => prev.filter((_, i) => i !== index))
  }

  function updateEventDiscipline(index: number, field: 'discipline_id' | 'price_pln', value: string) {
    setEditingEventDisciplines(prev => prev.map((d, i) => {
      if (i !== index) return d
      if (field === 'discipline_id') {
        // Auto-fill price from discipline defaults
        const disc = disciplines.find(dd => dd.id === value)
        return { ...d, discipline_id: value, price_pln: String(disc?.default_price_pln ?? d.price_pln) }
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
        start_date: new Date(eventForm.start_date).toISOString(),
        end_date: eventForm.end_date ? new Date(eventForm.end_date).toISOString() : null,
        location: eventForm.location || null,
        address: eventForm.address || null,
        stations_count: eventForm.stations_count ? parseInt(eventForm.stations_count) : null,
        max_participants: eventForm.max_participants ? parseInt(eventForm.max_participants) : null,
        price_pln: 0,
        is_published: eventForm.is_published,
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

      // Sync event_disciplines: delete old, insert new
      const { error: delErr } = await supabase.from('event_disciplines').delete().eq('event_id', eventId)
      if (delErr) { setError('Blad usuwania dyscyplin: ' + delErr.message); setSaving(false); loadAll(); return }

      if (editingEventDisciplines.length > 0) {
        const rows = editingEventDisciplines.map(d => ({
          event_id: eventId,
          discipline_id: d.discipline_id,
          price_pln: parseFloat(d.price_pln) || 0,
        }))
        const { error: edErr } = await supabase.from('event_disciplines').insert(rows)
        if (edErr) { setError('Wydarzenie zapisane, ale blad dyscyplin: ' + edErr.message); setSaving(false); loadAll(); return }
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
      loadAll()
    } catch (err: any) {
      setError('Blad zapisu: ' + (err?.message ?? 'Nieznany blad'))
      setSaving(false)
    }
  }

  async function deleteEvent(id: string) {
    if (!confirm('Na pewno usunac to wydarzenie?')) return
    await supabase.from('events').delete().eq('id', id)
    loadAll()
  }

  // ---- DISCIPLINES ----
  function openNewDiscipline() {
    setEditingDiscipline(null)
    setDisciplineForm({ name: '', description: '', target_type: '', default_price_pln: '0' })
    setShowDisciplineForm(true)
    setError('')
  }

  function openEditDiscipline(d: Discipline) {
    setEditingDiscipline(d)
    setDisciplineForm({
      name: d.name,
      description: d.description ?? '',
      target_type: d.target_type ?? '',
      default_price_pln: String(d.default_price_pln ?? 0),
    })
    setShowDisciplineForm(true)
    setError('')
  }

  async function saveDiscipline(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      name: disciplineForm.name,
      description: disciplineForm.description || null,
      target_type: disciplineForm.target_type || null,
      default_price_pln: parseFloat(disciplineForm.default_price_pln) || 0,
    }

    let err
    if (editingDiscipline) {
      ({ error: err } = await supabase.from('disciplines').update(payload).eq('id', editingDiscipline.id))
    } else {
      ({ error: err } = await supabase.from('disciplines').insert(payload))
    }

    setSaving(false)
    if (err) { setError(err.message); return }
    setShowDisciplineForm(false)
    loadAll()
  }

  async function deleteDiscipline(id: string) {
    if (!confirm('Na pewno usunac te dyscypline?')) return
    const { error: err } = await supabase.from('disciplines').delete().eq('id', id)
    if (err) { alert('Nie mozna usunac — dyscyplina jest przypisana do wydarzen lub wynikow.'); return }
    loadAll()
  }

  // ---- JUDGES ASSIGNMENT ----
  async function notifyJudge(eventJudgeId: string) {
    try {
      await fetch('/api/judge-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_judge_id: eventJudgeId }),
      })
    } catch {
      // Notification is best-effort; don't block the UI
    }
  }

  async function assignJudge(eventId: string, judgeId: string) {
    const { data } = await supabase.from('event_judges').insert({ event_id: eventId, judge_id: judgeId }).select('id').single()
    // If event is published, send email notification immediately
    const ev = events.find(e => e.id === eventId)
    if (data && ev?.is_published) {
      notifyJudge(data.id)
    }
    loadAll()
  }

  async function removeJudge(eventId: string, judgeId: string) {
    await supabase.from('event_judges').delete().eq('event_id', eventId).eq('judge_id', judgeId)
    loadAll()
  }

  async function promoteToJudge(memberId: string) {
    await supabase.from('members').update({ role: 'judge' }).eq('id', memberId)
    loadAll()
  }

  function getEventJudges(eventId: string) {
    return eventJudges
      .filter(ej => ej.event_id === eventId)
      .map(ej => judges.find(j => j.id === ej.judge_id))
      .filter(Boolean) as Member[]
  }

  function getAvailableJudges(eventId: string) {
    const assigned = new Set(eventJudges.filter(ej => ej.event_id === eventId).map(ej => ej.judge_id))
    return judges.filter(j => !assigned.has(j.id))
  }

  // ---- SLOT MANAGEMENT ----
  function getSlotsForEventDiscipline(edId: string) {
    return eventSlots.filter(s => s.event_discipline_id === edId)
  }

  function getSlotRegistrationCount(slotId: string) {
    return regDisciplines.filter(rd => rd.event_discipline_slot_id === slotId).length
  }

  async function autoGenerateSlots(eventId: string) {
    const ev = events.find(e => e.id === eventId)
    if (!ev) return
    const evDiscs = getEventDiscs(eventId)
    if (evDiscs.length === 0) { alert('Brak dyscyplin przypisanych do wydarzenia. Najpierw edytuj wydarzenie i dodaj dyscypliny.'); return }

    if (!ev.stations_count) {
      const input = prompt('Podaj liczbę stanowisk (max uczestników na slot):', '10')
      if (!input) return
      const count = parseInt(input)
      if (isNaN(count) || count < 1) { alert('Nieprawidłowa liczba.'); return }
      // Save stations_count to event
      await supabase.from('events').update({ stations_count: count }).eq('id', eventId)
      ev.stations_count = count
    }

    const startDate = new Date(ev.start_date)
    const endDate = ev.end_date ? new Date(ev.end_date) : new Date(startDate.getTime() + 8 * 60 * 60 * 1000)

    if (endDate <= startDate) {
      alert('Data zakończenia musi być po dacie rozpoczęcia.')
      return
    }

    // Delete existing slots for this event's disciplines first
    for (const ed of evDiscs) {
      await supabase.from('event_discipline_slots').delete().eq('event_discipline_id', ed.id)
    }

    const slotsToInsert: { event_discipline_id: string; start_time: string; end_time: string; max_participants: number }[] = []

    for (const ed of evDiscs) {
      let current = new Date(startDate)
      while (current < endDate) {
        const slotEnd = new Date(current.getTime() + 60 * 60 * 1000)
        const actualEnd = slotEnd > endDate ? endDate : slotEnd
        slotsToInsert.push({
          event_discipline_id: ed.id,
          start_time: current.toISOString(),
          end_time: actualEnd.toISOString(),
          max_participants: ev.stations_count!,
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

  // ---- STAFFING SUGGESTION ----
  function getStaffingSuggestion(eventId: string) {
    const ev = events.find(e => e.id === eventId)
    if (!ev || !ev.stations_count) return null
    const discsCount = getEventDiscs(eventId).length
    if (discsCount === 0) return null
    const minFromDiscs = Math.ceil(discsCount * 1.5)
    const recommended = Math.max(minFromDiscs, ev.stations_count)
    return { stations: ev.stations_count, disciplines: discsCount, recommended }
  }

  // ---- HELPERS for registrations tab ----
  function getRegDisciplineNames(regId: string, type: 'member' | 'guest') {
    const rds = regDisciplines.filter(rd =>
      type === 'member' ? rd.member_registration_id === regId : rd.guest_registration_id === regId
    )
    return rds.map(rd => {
      const ed = eventDisciplines.find(e => e.id === rd.event_discipline_id)
      return ed?.discipline?.name ?? '?'
    })
  }

  function getRegTotal(regId: string, type: 'member' | 'guest') {
    const rds = regDisciplines.filter(rd =>
      type === 'member' ? rd.member_registration_id === regId : rd.guest_registration_id === regId
    )
    return rds.reduce((sum, rd) => {
      const ed = eventDisciplines.find(e => e.id === rd.event_discipline_id)
      return sum + (ed ? Number(ed.price_pln) : 0)
    }, 0)
  }

  // ---- ON-SITE REGISTRATION ----
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
      const { data: newReg, error: regErr } = await supabase
        .from('event_registrations')
        .insert({
          event_id: onsiteEventId,
          member_id: onsiteMemberId,
          status: 'confirmed',
          paid: false,
        })
        .select('id')
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

    setOnsiteMessage('Zarejestrowano pomyslnie!')
    setOnsiteMemberId('')
    setOnsiteDisciplineId('')
    setOnsiteSlotId('')
    setOnsiteMemberSearch('')
    setOnsiteSaving(false)
    loadAll()
  }

  // ---- ATTENDANCE LIST ----
  function printAttendanceList(eventId: string) {
    const ev = events.find(e => e.id === eventId)
    if (!ev) return

    const evMemberRegs = memberRegs.filter(r => r.event_id === eventId)
    const evGuestRegs = guestRegs.filter(r => r.event_id === eventId)
    const evDiscs = getEventDiscs(eventId)

    let html = `<!DOCTYPE html><html><head><title>Lista obecnosci - ${ev.title}</title><style>
      body { font-family: Arial, sans-serif; margin: 20px; color: #000; }
      h1 { font-size: 18px; margin-bottom: 4px; }
      h2 { font-size: 14px; font-weight: normal; color: #555; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #333; padding: 6px 10px; text-align: left; font-size: 12px; }
      th { background: #eee; font-weight: bold; }
      .sig-col { width: 150px; }
      @media print { body { margin: 0; } }
    </style></head><body>`

    html += `<h1>${ev.title}</h1>`
    html += `<h2>${new Date(ev.start_date).toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`
    if (ev.location) html += ` &middot; ${ev.location}`
    html += `</h2>`

    html += `<table><thead><tr><th>Lp.</th><th>Imie i nazwisko</th><th>Nr licencji</th><th>Dyscypliny</th><th class="sig-col">Podpis</th></tr></thead><tbody>`

    let lp = 1
    for (const r of evMemberRegs) {
      const m = r.member as any
      const discNames = getRegDisciplineNames(r.id, 'member')
      html += `<tr><td>${lp++}</td><td>${m?.full_name ?? '-'}</td><td>${m?.license_number ?? '-'}</td><td>${discNames.join(', ') || '-'}</td><td></td></tr>`
    }
    for (const r of evGuestRegs) {
      const discNames = getRegDisciplineNames(r.id, 'guest')
      html += `<tr><td>${lp++}</td><td>${r.full_name} (gosc)</td><td>${r.license_number ?? '-'}</td><td>${discNames.join(', ') || '-'}</td><td></td></tr>`
    }

    // Add empty rows for walk-ins
    for (let i = 0; i < 10; i++) {
      html += `<tr><td>${lp++}</td><td></td><td></td><td></td><td></td></tr>`
    }

    html += `</tbody></table></body></html>`

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    }
  }

  if (loading) return <div className="p-8 text-center text-muted">Ladowanie...</div>
  if (!member || member.role !== 'admin') return null

  const eventTypeLabels: Record<string, string> = {
    competition: 'Zawody', training: 'Trening', course: 'Kurs', other: 'Inne',
  }

  const inputClass = "w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:border-primary text-sm"

  // Filter members for on-site search
  const filteredOnsiteMembers = onsiteMemberSearch.length >= 2
    ? allMembers.filter(m =>
        m.full_name.toLowerCase().includes(onsiteMemberSearch.toLowerCase()) ||
        (m.license_number && m.license_number.toLowerCase().includes(onsiteMemberSearch.toLowerCase()))
      ).slice(0, 20)
    : []

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">Panel administracyjny</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-border overflow-x-auto">
        {[
          { key: 'events' as Tab, label: 'Zawody / Wydarzenia', icon: Calendar },
          { key: 'disciplines' as Tab, label: 'Dyscypliny', icon: Target },
          { key: 'registrations' as Tab, label: 'Zgloszenia', icon: ClipboardList },
          { key: 'judges' as Tab, label: 'Sedziowie', icon: Users },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ============ EVENTS TAB ============ */}
      {tab === 'events' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Wszystkie wydarzenia ({events.length})</h2>
            <button onClick={openNewEvent} className="flex items-center gap-2 px-4 py-2 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors">
              <Plus className="w-4 h-4" />
              Nowe wydarzenie
            </button>
          </div>

          <div className="space-y-3">
            {events.map(ev => {
              const evDiscs = getEventDiscs(ev.id)
              const assigned = getEventJudges(ev.id)
              const available = getAvailableJudges(ev.id)
              const isExpanded = expandedEvent === ev.id
              const totalPrice = evDiscs.reduce((s, d) => s + Number(d.price_pln), 0)
              const staffSuggestion = getStaffingSuggestion(ev.id)
              const isSlotManaged = slotManagedEvent === ev.id

              return (
                <div key={ev.id} className="bg-card border border-border rounded-xl">
                  <div className="p-4 flex items-center gap-4">
                    {/* Published status dot */}
                    <div className="flex-shrink-0">
                      <span
                        className={`inline-block w-3 h-3 rounded-full ${ev.is_published ? 'bg-green-500' : 'bg-red-500'}`}
                        title={ev.is_published ? 'Opublikowane' : 'Ukryte'}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                          {eventTypeLabels[ev.event_type]}
                        </span>
                        {evDiscs.map(ed => (
                          <span key={ed.id} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium">
                            {ed.discipline?.name} — {Number(ed.price_pln).toFixed(0)} zl
                          </span>
                        ))}
                      </div>
                      <h3 className="font-semibold">{ev.title}</h3>
                      <p className="text-xs text-muted">
                        {new Date(ev.start_date).toLocaleDateString('pl')} &middot; {ev.location}
                        {ev.address && ` · ${ev.address}`}
                        {ev.stations_count && ` · ${ev.stations_count} stanowisk`}
                        {evDiscs.length > 0 && ` · ${evDiscs.length} dyscyplin`}
                        {totalPrice > 0 && ` · suma: ${totalPrice.toFixed(0)} zl`}
                        {ev.max_participants && ` · max ${ev.max_participants} os.`}
                      </p>
                      {assigned.length > 0 && (
                        <p className="text-xs text-muted mt-1">
                          Sedziowie: {assigned.map(j => j.full_name).join(', ')}
                        </p>
                      )}
                      {/* Staffing suggestion */}
                      {staffSuggestion && (
                        <p className="text-xs text-blue-400 mt-1">
                          Dla {staffSuggestion.stations} stanowisk i {staffSuggestion.disciplines} dyscyplin zalecamy minimum {staffSuggestion.recommended} sedziow/prowadzacych strzelanie
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {evDiscs.length > 0 && (
                        <button
                          onClick={() => setSlotManagedEvent(isSlotManaged ? null : ev.id)}
                          className="p-2 text-muted hover:text-primary rounded-lg hover:bg-card-hover"
                          title="Zarzadzaj slotami"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => setExpandedEvent(isExpanded ? null : ev.id)} className="p-2 text-muted hover:text-foreground rounded-lg hover:bg-card-hover" title="Sedziowie">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openEditEvent(ev)} className="p-2 text-muted hover:text-primary rounded-lg hover:bg-card-hover" title="Edytuj">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteEvent(ev.id)} className="p-2 text-muted hover:text-danger rounded-lg hover:bg-card-hover" title="Usun">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Slot management panel */}
                  {isSlotManaged && (
                    <div className="px-4 pb-4 pt-2 border-t border-border">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Clock className="w-4 h-4 text-primary" />
                          Zarzadzanie slotami
                        </p>
                        <button
                          onClick={() => autoGenerateSlots(ev.id)}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                        >
                          <Zap className="w-3 h-3" />
                          Auto-generuj sloty
                        </button>
                      </div>

                      {evDiscs.map(ed => {
                        const slots = getSlotsForEventDiscipline(ed.id)
                        return (
                          <div key={ed.id} className="mb-4">
                            <p className="text-xs font-medium text-blue-400 mb-2">
                              {ed.discipline?.name ?? 'Dyscyplina'}
                            </p>
                            {slots.length === 0 ? (
                              <p className="text-xs text-muted mb-2">Brak slotow dla tej dyscypliny.</p>
                            ) : (
                              <div className="space-y-1 mb-2">
                                {slots.map(slot => {
                                  const regCount = getSlotRegistrationCount(slot.id)
                                  return (
                                    <div key={slot.id} className="flex items-center justify-between bg-background/50 border border-border/50 rounded-lg px-3 py-2">
                                      <div className="text-xs">
                                        <span className="font-medium">
                                          {new Date(slot.start_time).toLocaleString('pl', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="text-muted mx-1">—</span>
                                        <span className="font-medium">
                                          {new Date(slot.end_time).toLocaleString('pl', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="text-muted ml-2">
                                          max: {slot.max_participants}
                                        </span>
                                        <span className={`ml-2 ${regCount >= slot.max_participants ? 'text-red-400' : 'text-green-400'}`}>
                                          ({regCount}/{slot.max_participants} zapisanych)
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => deleteSlot(slot.id)}
                                        className="p-1 text-muted hover:text-danger rounded hover:bg-card-hover"
                                        title="Usun slot"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* Manual slot add */}
                      <div className="border-t border-border/50 pt-3 mt-3">
                        <p className="text-xs font-medium mb-2">Dodaj slot recznie</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <select
                            value={newSlotForm.event_discipline_id}
                            onChange={e => setNewSlotForm(f => ({ ...f, event_discipline_id: e.target.value }))}
                            className={inputClass + ' text-xs'}
                          >
                            <option value="">Dyscyplina...</option>
                            {evDiscs.map(ed => (
                              <option key={ed.id} value={ed.id}>{ed.discipline?.name}</option>
                            ))}
                          </select>
                          <input
                            type="datetime-local"
                            value={newSlotForm.start_time}
                            onChange={e => setNewSlotForm(f => ({ ...f, start_time: e.target.value }))}
                            className={inputClass + ' text-xs'}
                            placeholder="Start"
                          />
                          <input
                            type="datetime-local"
                            value={newSlotForm.end_time}
                            onChange={e => setNewSlotForm(f => ({ ...f, end_time: e.target.value }))}
                            className={inputClass + ' text-xs'}
                            placeholder="Koniec"
                          />
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="1"
                              value={newSlotForm.max_participants}
                              onChange={e => setNewSlotForm(f => ({ ...f, max_participants: e.target.value }))}
                              className={inputClass + ' text-xs w-20'}
                              placeholder="Max"
                            />
                            <button
                              onClick={addSlotManual}
                              className="flex items-center gap-1 px-3 py-2 bg-primary text-background text-xs font-semibold rounded-lg hover:bg-primary-dark transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              Dodaj
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Judge assignment panel */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-border">
                      <p className="text-sm font-medium mb-2">Przypisani sedziowie:</p>
                      {assigned.length === 0 ? (
                        <p className="text-xs text-muted mb-2">Brak przypisanych sedziow.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {assigned.map(j => (
                            <span key={j.id} className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium">
                              {j.full_name}
                              <button onClick={() => removeJudge(ev.id, j.id)} className="hover:text-danger">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      {available.length > 0 && (
                        <div>
                          <p className="text-xs text-muted mb-1">Dodaj sedziego:</p>
                          <div className="flex flex-wrap gap-1">
                            {available.map(j => (
                              <button
                                key={j.id}
                                onClick={() => assignJudge(ev.id, j.id)}
                                className="inline-flex items-center gap-1 px-3 py-1 border border-border text-xs rounded-full hover:border-primary hover:text-primary transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                {j.full_name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Event Form Modal */}
          {showEventForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <h2 className="text-lg font-bold mb-4">{editingEvent ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'}</h2>
                <form onSubmit={saveEvent} className="space-y-4">
                  <div>
                    <label className="text-xs text-muted block mb-1">Nazwa *</label>
                    <input required value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Opis</label>
                    <textarea value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} rows={2} className={inputClass + ' resize-none'} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">Typ</label>
                      <select value={eventForm.event_type} onChange={e => setEventForm(f => ({ ...f, event_type: e.target.value }))} className={inputClass}>
                        <option value="competition">Zawody</option>
                        <option value="training">Trening</option>
                        <option value="course">Kurs</option>
                        <option value="other">Inne</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Max uczestnikow</label>
                      <input type="number" value={eventForm.max_participants} onChange={e => setEventForm(f => ({ ...f, max_participants: e.target.value }))} className={inputClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">Start *</label>
                      <input required type="datetime-local" value={eventForm.start_date} onChange={e => setEventForm(f => ({ ...f, start_date: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Koniec</label>
                      <input type="datetime-local" value={eventForm.end_date} onChange={e => setEventForm(f => ({ ...f, end_date: e.target.value }))} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Lokalizacja</label>
                    <input value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Adres</label>
                    <textarea
                      value={eventForm.address}
                      onChange={e => setEventForm(f => ({ ...f, address: e.target.value }))}
                      rows={2}
                      className={inputClass + ' resize-none'}
                      placeholder="ul. Strzelecka 1, 00-001 Warszawa"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Liczba stanowisk</label>
                    <input
                      type="number"
                      min="1"
                      value={eventForm.stations_count}
                      onChange={e => setEventForm(f => ({ ...f, stations_count: e.target.value }))}
                      className={inputClass}
                      placeholder="np. 10"
                    />
                  </div>

                  {/* Staffing suggestion in form */}
                  {eventForm.stations_count && editingEventDisciplines.length > 0 && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                      <p className="text-xs text-blue-400">
                        Dla {eventForm.stations_count} stanowisk i {editingEventDisciplines.length} dyscyplin zalecamy minimum{' '}
                        {Math.max(Math.ceil(editingEventDisciplines.length * 1.5), parseInt(eventForm.stations_count) || 0)} sedziow/prowadzacych strzelanie
                      </p>
                    </div>
                  )}

                  {/* ---- Disciplines with prices ---- */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium flex items-center gap-1">
                        <Target className="w-4 h-4 text-primary" />
                        Dyscypliny i ceny
                      </label>
                      <button
                        type="button"
                        onClick={addDisciplineToEvent}
                        disabled={editingEventDisciplines.length >= disciplines.length}
                        className="flex items-center gap-1 text-xs px-2 py-1 text-primary hover:bg-primary/10 rounded transition-colors disabled:opacity-30"
                      >
                        <Plus className="w-3 h-3" />
                        Dodaj dyscypline
                      </button>
                    </div>

                    {editingEventDisciplines.length === 0 ? (
                      <p className="text-xs text-muted py-2">Brak dyscyplin. Dodaj dyscypline, aby ustawic cene startu.</p>
                    ) : (
                      <div className="space-y-2">
                        {editingEventDisciplines.map((ed, idx) => {
                          const usedIds = editingEventDisciplines.filter((_, i) => i !== idx).map(d => d.discipline_id)
                          return (
                            <div key={idx} className="flex items-center gap-2">
                              <select
                                value={ed.discipline_id}
                                onChange={e => updateEventDiscipline(idx, 'discipline_id', e.target.value)}
                                className={inputClass + ' flex-1'}
                              >
                                {disciplines.filter(d => !usedIds.includes(d.id) || d.id === ed.discipline_id).map(d => (
                                  <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                              </select>
                              <div className="relative w-28 flex-shrink-0">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={ed.price_pln}
                                  onChange={e => updateEventDiscipline(idx, 'price_pln', e.target.value)}
                                  className={inputClass + ' pr-8'}
                                  placeholder="0"
                                />
                                <span className="absolute right-3 top-2.5 text-xs text-muted">zl</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeDisciplineFromEvent(idx)}
                                className="p-2 text-muted hover:text-danger rounded hover:bg-card-hover flex-shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )
                        })}
                        {editingEventDisciplines.length > 1 && (
                          <p className="text-xs text-muted text-right">
                            Suma za wszystkie dyscypliny: <span className="font-semibold text-foreground">
                              {editingEventDisciplines.reduce((s, d) => s + (parseFloat(d.price_pln) || 0), 0).toFixed(0)} zl
                            </span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={eventForm.is_published} onChange={e => setEventForm(f => ({ ...f, is_published: e.target.checked }))} className="w-4 h-4 accent-primary" />
                    <span className="text-sm">Opublikowane (widoczne w kalendarzu)</span>
                  </label>

                  {error && <p className="text-sm text-danger">{error}</p>}

                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark disabled:opacity-50">
                      <Save className="w-4 h-4" />
                      {saving ? 'Zapisywanie...' : 'Zapisz'}
                    </button>
                    <button type="button" onClick={() => setShowEventForm(false)} className="px-4 py-2.5 border border-border text-sm rounded-lg hover:bg-card-hover">
                      Anuluj
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ DISCIPLINES TAB ============ */}
      {tab === 'disciplines' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Dyscypliny ({disciplines.length})</h2>
            <button onClick={openNewDiscipline} className="flex items-center gap-2 px-4 py-2 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors">
              <Plus className="w-4 h-4" />
              Nowa dyscyplina
            </button>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-sm text-muted">
                  <th className="text-left px-4 py-3">Nazwa</th>
                  <th className="text-left px-4 py-3">Opis</th>
                  <th className="text-left px-4 py-3">Typ tarczy</th>
                  <th className="text-right px-4 py-3">Cena</th>
                  <th className="text-right px-4 py-3 w-24">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {disciplines.map(d => (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-card-hover">
                    <td className="px-4 py-3 font-medium text-sm">{d.name}</td>
                    <td className="px-4 py-3 text-sm text-muted">{d.description ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-muted">{d.target_type ?? '-'}</td>
                    <td className="px-4 py-3 text-right text-sm">{Number(d.default_price_pln).toFixed(0)} zł</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditDiscipline(d)} className="p-1.5 text-muted hover:text-primary rounded hover:bg-card-hover">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteDiscipline(d.id)} className="p-1.5 text-muted hover:text-danger rounded hover:bg-card-hover">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Discipline Form Modal */}
          {showDisciplineForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
                <h2 className="text-lg font-bold mb-4">{editingDiscipline ? 'Edytuj dyscypline' : 'Nowa dyscyplina'}</h2>
                <form onSubmit={saveDiscipline} className="space-y-4">
                  <div>
                    <label className="text-xs text-muted block mb-1">Nazwa *</label>
                    <input required value={disciplineForm.name} onChange={e => setDisciplineForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Opis</label>
                    <textarea value={disciplineForm.description} onChange={e => setDisciplineForm(f => ({ ...f, description: e.target.value }))} rows={2} className={inputClass + ' resize-none'} />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Typ tarczy</label>
                    <select value={disciplineForm.target_type} onChange={e => setDisciplineForm(f => ({ ...f, target_type: e.target.value }))} className={inputClass}>
                      <option value="">Brak</option>
                      <option value="pistol_10m">Pistolet 10m</option>
                      <option value="pistol_25m">Pistolet 25m</option>
                      <option value="pistol_50m">Pistolet 50m</option>
                      <option value="rifle">Karabin</option>
                      <option value="ipsc">IPSC</option>
                      <option value="benchrest">Benchrest</option>
                      <option value="other">Inne</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Domyślna cena (zł)</label>
                    <input type="number" step="0.01" min="0" value={disciplineForm.default_price_pln} onChange={e => setDisciplineForm(f => ({ ...f, default_price_pln: e.target.value }))} className={inputClass} placeholder="0" />
                    <p className="text-xs text-muted mt-1">Automatycznie wypełni cenę przy dodawaniu do wydarzenia.</p>
                  </div>

                  {error && <p className="text-sm text-danger">{error}</p>}

                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark disabled:opacity-50">
                      <Save className="w-4 h-4" />
                      {saving ? 'Zapisywanie...' : 'Zapisz'}
                    </button>
                    <button type="button" onClick={() => setShowDisciplineForm(false)} className="px-4 py-2.5 border border-border text-sm rounded-lg hover:bg-card-hover">
                      Anuluj
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ JUDGES TAB ============ */}
      {tab === 'judges' && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Sedziowie ({judges.length})</h2>

          <div className="bg-card border border-border rounded-xl overflow-hidden mb-8">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-sm text-muted">
                  <th className="text-left px-4 py-3">Nazwisko</th>
                  <th className="text-left px-4 py-3">Licencja</th>
                  <th className="text-left px-4 py-3">Rola</th>
                  <th className="text-left px-4 py-3">Przypisane zawody</th>
                </tr>
              </thead>
              <tbody>
                {judges.map(j => {
                  const assignedEvents = eventJudges
                    .filter(ej => ej.judge_id === j.id)
                    .map(ej => events.find(ev => ev.id === ej.event_id))
                    .filter(Boolean)
                  return (
                    <tr key={j.id} className="border-b border-border/50 hover:bg-card-hover">
                      <td className="px-4 py-3 font-medium text-sm">{j.full_name}</td>
                      <td className="px-4 py-3 text-sm text-muted">{j.license_number}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${j.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-blue-500/20 text-blue-400'}`}>
                          {j.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {assignedEvents.length === 0 ? '-' : assignedEvents.map(e => e!.title).join(', ')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <h3 className="text-md font-semibold mb-3">Awansuj czlonka na sedziego</h3>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
              {allMembers.filter(m => m.role === 'member').map(m => (
                <button
                  key={m.id}
                  onClick={() => promoteToJudge(m.id)}
                  className="flex items-center gap-3 px-3 py-2 border border-border rounded-lg hover:border-primary/30 transition-colors text-left text-sm"
                >
                  <UserPlus className="w-4 h-4 text-muted flex-shrink-0" />
                  <div>
                    <div className="font-medium">{m.full_name}</div>
                    <div className="text-xs text-muted">{m.license_number}</div>
                  </div>
                </button>
              ))}
            </div>
            {allMembers.filter(m => m.role === 'member').length === 0 && (
              <p className="text-sm text-muted">Wszyscy czlonkowie maja juz role sedziego lub admina.</p>
            )}
          </div>
        </div>
      )}

      {/* ============ REGISTRATIONS TAB ============ */}
      {tab === 'registrations' && (
        <div>
          <h2 className="text-lg font-semibold mb-4">
            Zgloszenia na wydarzenia
          </h2>

          {/* On-site registration section */}
          {(() => {
            const happeningNow = getEventsHappeningNow()
            if (happeningNow.length === 0) return null
            return (
              <div className="bg-card border border-primary/30 rounded-xl p-4 mb-6">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Rejestracja na miejscu
                </h3>
                <p className="text-xs text-muted mb-3">
                  Szybka rejestracja czlonka na wydarzenie odbywajace sie dzisiaj.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Event selection */}
                  <div>
                    <label className="text-xs text-muted block mb-1">Wydarzenie</label>
                    <select
                      value={onsiteEventId}
                      onChange={e => {
                        setOnsiteEventId(e.target.value)
                        setOnsiteDisciplineId('')
                        setOnsiteSlotId('')
                      }}
                      className={inputClass + ' text-xs'}
                    >
                      <option value="">Wybierz...</option>
                      {happeningNow.map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.title}</option>
                      ))}
                    </select>
                  </div>

                  {/* Member search */}
                  <div className="relative">
                    <label className="text-xs text-muted block mb-1">Czlonek</label>
                    <input
                      type="text"
                      value={onsiteMemberSearch}
                      onChange={e => {
                        setOnsiteMemberSearch(e.target.value)
                        setOnsiteMemberId('')
                      }}
                      className={inputClass + ' text-xs'}
                      placeholder="Wyszukaj po nazwisku lub licencji..."
                    />
                    {onsiteMemberId && (
                      <p className="text-xs text-green-400 mt-1">
                        Wybrano: {allMembers.find(m => m.id === onsiteMemberId)?.full_name}
                      </p>
                    )}
                    {filteredOnsiteMembers.length > 0 && !onsiteMemberId && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredOnsiteMembers.map(m => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setOnsiteMemberId(m.id)
                              setOnsiteMemberSearch(m.full_name)
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-card-hover text-xs border-b border-border/30 last:border-b-0"
                          >
                            <span className="font-medium">{m.full_name}</span>
                            {m.license_number && <span className="text-muted ml-2">({m.license_number})</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Discipline selection */}
                  <div>
                    <label className="text-xs text-muted block mb-1">Dyscyplina</label>
                    <select
                      value={onsiteDisciplineId}
                      onChange={e => {
                        setOnsiteDisciplineId(e.target.value)
                        setOnsiteSlotId('')
                      }}
                      className={inputClass + ' text-xs'}
                      disabled={!onsiteEventId}
                    >
                      <option value="">Wybierz...</option>
                      {onsiteEventId && getEventDiscs(onsiteEventId).map(ed => (
                        <option key={ed.id} value={ed.id}>{ed.discipline?.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Slot selection + register button */}
                  <div>
                    <label className="text-xs text-muted block mb-1">Slot (opcjonalnie)</label>
                    <div className="flex gap-2">
                      <select
                        value={onsiteSlotId}
                        onChange={e => setOnsiteSlotId(e.target.value)}
                        className={inputClass + ' text-xs flex-1'}
                        disabled={!onsiteDisciplineId}
                      >
                        <option value="">Bez slotu</option>
                        {onsiteDisciplineId && getSlotsForEventDiscipline(onsiteDisciplineId).map(slot => {
                          const regCount = getSlotRegistrationCount(slot.id)
                          return (
                            <option key={slot.id} value={slot.id} disabled={regCount >= slot.max_participants}>
                              {new Date(slot.start_time).toLocaleTimeString('pl', { hour: '2-digit', minute: '2-digit' })}
                              -{new Date(slot.end_time).toLocaleTimeString('pl', { hour: '2-digit', minute: '2-digit' })}
                              {' '}({regCount}/{slot.max_participants})
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    onClick={quickRegisterOnsite}
                    disabled={onsiteSaving || !onsiteMemberId || !onsiteEventId || !onsiteDisciplineId}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-background text-xs font-semibold rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {onsiteSaving ? 'Rejestrowanie...' : 'Zarejestruj'}
                  </button>
                  {onsiteMessage && (
                    <p className={`text-xs ${onsiteMessage.includes('pomyslnie') ? 'text-green-400' : 'text-danger'}`}>
                      {onsiteMessage}
                    </p>
                  )}
                </div>
              </div>
            )
          })()}

          {events.map(ev => {
            const evMemberRegs = memberRegs.filter(r => r.event_id === ev.id)
            const evGuestRegs = guestRegs.filter(r => r.event_id === ev.id)
            const total = evMemberRegs.length + evGuestRegs.length
            if (total === 0) return null

            return (
              <div key={ev.id} className="mb-6">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  {ev.title}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                    {total} {total === 1 ? 'zgloszenie' : total < 5 ? 'zgloszenia' : 'zgloszen'}
                  </span>
                  <button
                    onClick={() => printAttendanceList(ev.id)}
                    className="flex items-center gap-1 text-xs px-2 py-1 text-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors ml-2"
                    title="Lista obecnosci"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Lista obecnosci
                  </button>
                </h3>

                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted">
                        <th className="text-left px-4 py-2">Typ</th>
                        <th className="text-left px-4 py-2">Nazwisko</th>
                        <th className="text-left px-4 py-2">Dyscypliny</th>
                        <th className="text-left px-4 py-2">Kwota</th>
                        <th className="text-left px-4 py-2">Status</th>
                        <th className="text-right px-4 py-2">Akcje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evMemberRegs.map(r => {
                        const discNames = getRegDisciplineNames(r.id, 'member')
                        const total = getRegTotal(r.id, 'member')
                        return (
                          <tr key={r.id} className="border-b border-border/50 hover:bg-card-hover text-sm">
                            <td className="px-4 py-2">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">Czlonek</span>
                            </td>
                            <td className="px-4 py-2 font-medium">{(r.member as any)?.full_name ?? '-'}</td>
                            <td className="px-4 py-2 text-muted text-xs">{discNames.length > 0 ? discNames.join(', ') : '-'}</td>
                            <td className="px-4 py-2 text-muted">{total > 0 ? `${total.toFixed(0)} zl` : '-'}</td>
                            <td className="px-4 py-2">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-success/20 text-success">{r.status}</span>
                            </td>
                            <td className="px-4 py-2 text-right">-</td>
                          </tr>
                        )
                      })}
                      {evGuestRegs.map(r => {
                        const discNames = getRegDisciplineNames(r.id, 'guest')
                        const total = getRegTotal(r.id, 'guest')
                        return (
                          <tr key={r.id} className="border-b border-border/50 hover:bg-card-hover text-sm">
                            <td className="px-4 py-2">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">Gosc</span>
                            </td>
                            <td className="px-4 py-2 font-medium">
                              {r.full_name}
                              {r.has_license && <span className="text-xs text-muted ml-1">(lic: {r.license_number})</span>}
                            </td>
                            <td className="px-4 py-2 text-muted text-xs">{discNames.length > 0 ? discNames.join(', ') : '-'}</td>
                            <td className="px-4 py-2 text-muted">{total > 0 ? `${total.toFixed(0)} zl` : '-'}</td>
                            <td className="px-4 py-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                r.status === 'confirmed' ? 'bg-success/20 text-success' :
                                r.status === 'cancelled' ? 'bg-danger/20 text-danger' :
                                'bg-warning/20 text-warning'
                              }`}>{r.status === 'pending' ? 'oczekuje' : r.status === 'confirmed' ? 'potwierdzony' : 'anulowany'}</span>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {r.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={async () => { await supabase.from('guest_registrations').update({ status: 'confirmed' }).eq('id', r.id); loadAll() }}
                                      className="p-1.5 text-muted hover:text-success rounded hover:bg-card-hover" title="Potwierdz"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={async () => { await supabase.from('guest_registrations').update({ status: 'cancelled' }).eq('id', r.id); loadAll() }}
                                      className="p-1.5 text-muted hover:text-danger rounded hover:bg-card-hover" title="Odrzuc"
                                    >
                                      <Ban className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                                {r.status !== 'pending' && (
                                  <button
                                    onClick={async () => { await supabase.from('guest_registrations').update({ status: 'pending' }).eq('id', r.id); loadAll() }}
                                    className="p-1.5 text-xs text-muted hover:text-foreground rounded hover:bg-card-hover"
                                  >
                                    Cofnij
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {evGuestRegs.some(r => r.message) && (
                  <div className="mt-2 space-y-1">
                    {evGuestRegs.filter(r => r.message).map(r => (
                      <p key={r.id} className="text-xs text-muted italic px-2">
                        {r.full_name}: &ldquo;{r.message}&rdquo;
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {events.every(ev => {
            const total = memberRegs.filter(r => r.event_id === ev.id).length + guestRegs.filter(r => r.event_id === ev.id).length
            return total === 0
          }) && (
            <p className="text-muted">Brak zgloszen na zadne wydarzenie.</p>
          )}
        </div>
      )}
    </div>
  )
}
