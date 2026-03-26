'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { Shield, Calendar, Target, Users, Plus, Trash2, Pencil, Save, X, UserPlus, ChevronDown, ChevronUp, ClipboardList, Check, Ban, Tag, Clock, Printer, MapPin, Zap, Package, AlertTriangle, DollarSign, Eye, Crosshair, Boxes, Wrench, CircleDot, Bell, Mail, Trophy } from 'lucide-react'
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
  price_pln: number
  own_weapon: boolean
}

interface InventoryItem {
  id: string
  name: string
  category: string
  description: string | null
  caliber: string | null
  quantity: number
  unit: string
  purchase_price_pln: number
  purchase_date: string | null
  supplier: string | null
  min_stock_level: number
}

type Tab = 'events' | 'disciplines' | 'judges' | 'registrations' | 'inventory'

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

  // Inventory
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [showInventoryForm, setShowInventoryForm] = useState(false)
  const [editingInventory, setEditingInventory] = useState<InventoryItem | null>(null)
  const [inventoryFilter, setInventoryFilter] = useState<string>('all')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [inventoryForm, setInventoryForm] = useState({
    name: '', category: 'ammunition', description: '', caliber: '', quantity: '0', unit: 'szt.',
    purchase_price_pln: '0', purchase_date: '', supplier: '', min_stock_level: '0',
  })

  // Attendance list preview
  const [attendancePreview, setAttendancePreview] = useState<{
    eventId: string
    eventTitle: string
    eventDate: string
    eventLocation: string
    isCourse: boolean
    rows: {
      lp: number
      name: string
      isGuest: boolean
      pesel: string
      document: string
      address: string
      club: string
      basis: string
      weapon: string
      permit: string
      disciplines: string
      missingData: boolean
    }[]
    htmlContent: string
  } | null>(null)
  const [attendanceLoading, setAttendanceLoading] = useState(false)

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
    start_day: '', start_time: '09:00', end_day: '', end_time: '17:00',
    location: '', address: '',
    max_participants: '', is_published: true,
  })
  const [disciplineForm, setDisciplineForm] = useState({
    name: '', description: '', target_type: '' as string, category: 'discipline' as string, default_price_pln: '0',
    own_weapon_price_pln: '0', stations_count: '0', judges_per_station: '0', participants_per_hour: '0',
    caliber: '', shots_count: '60', ammo_per_pack: '50', targets_per_competitor: '0', distance_m: '', target_name: '',
  })
  // Event disciplines management
  const [editingEventDisciplines, setEditingEventDisciplines] = useState<{ discipline_id: string; price_pln: string; own_weapon_price_pln: string }[]>([])

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
    const [evRes, discRes, judgesRes, ejRes, membersRes, guestRes, memberRegsRes, edRes, rdRes, slotsRes, invRes] = await Promise.all([
      supabase.from('events').select('*').order('start_date', { ascending: false }),
      supabase.from('disciplines').select('*').order('name'),
      supabase.from('members').select('*').in('role', ['judge', 'admin']).order('full_name'),
      supabase.from('event_judges').select('*'),
      supabase.from('members').select('*').eq('is_active', true).order('full_name'),
      supabase.from('guest_registrations').select('*').order('registered_at', { ascending: false }),
      supabase.from('event_registrations').select('*, member:members(id, full_name, email, license_number, pesel, address, id_document_number, has_weapons_permit, weapon_permit_number, club_name, phone)').order('registered_at', { ascending: false }),
      supabase.from('event_disciplines').select('*, discipline:disciplines(*)').order('price_pln'),
      supabase.from('registration_disciplines').select('*'),
      supabase.from('event_discipline_slots').select('*').order('start_time'),
      supabase.from('inventory_items').select('*').order('category').order('name'),
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
    setInventoryItems((invRes.data ?? []) as InventoryItem[])
  }

  // ---- EVENTS ----
  function getEventDiscs(eventId: string) {
    return eventDisciplines.filter(ed => ed.event_id === eventId)
  }

  function openNewEvent() {
    setEditingEvent(null)
    setEventForm({
      title: '', description: '', event_type: 'competition',
      start_day: '', start_time: '09:00', end_day: '', end_time: '17:00',
      location: 'Strzelnica klubowa', address: '',
      max_participants: '30', is_published: true,
    })
    setEditingEventDisciplines([])
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
    })
    // Load existing event disciplines into form
    const existing = getEventDiscs(ev.id)
    setEditingEventDisciplines(existing.map(ed => ({
      discipline_id: ed.discipline_id,
      price_pln: ed.price_pln.toString(),
      own_weapon_price_pln: ((ed as any).own_weapon_price_pln ?? 0).toString(),
    })))
    setShowEventForm(true)
    setError('')
  }

  function getFilteredDisciplines() {
    const cat = eventForm.event_type === 'competition' ? 'discipline' : eventForm.event_type === 'course' ? 'service' : null
    return cat ? disciplines.filter(d => d.category === cat) : disciplines
  }

  function addDisciplineToEvent() {
    const used = new Set(editingEventDisciplines.map(d => d.discipline_id))
    const available = getFilteredDisciplines().filter(d => !used.has(d.id))
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

  // ---- DISCIPLINES ----
  function openNewDiscipline() {
    setEditingDiscipline(null)
    setDisciplineForm({ name: '', description: '', target_type: '', category: 'discipline', default_price_pln: '0', own_weapon_price_pln: '0', stations_count: '0', judges_per_station: '0', participants_per_hour: '0', caliber: '', shots_count: '60', ammo_per_pack: '50', targets_per_competitor: '0', distance_m: '', target_name: '' })
    setShowDisciplineForm(true)
    setError('')
  }

  function openEditDiscipline(d: Discipline) {
    setEditingDiscipline(d)
    setDisciplineForm({
      name: d.name,
      description: d.description ?? '',
      target_type: d.target_type ?? '',
      category: d.category ?? 'discipline',
      default_price_pln: String(d.default_price_pln ?? 0),
      own_weapon_price_pln: String(d.own_weapon_price_pln ?? 0),
      stations_count: String(d.stations_count ?? 0),
      judges_per_station: String(d.judges_per_station ?? 0),
      participants_per_hour: String(d.participants_per_hour ?? 0),
      caliber: d.caliber ?? '',
      shots_count: String(d.shots_count ?? 60),
      ammo_per_pack: String(d.ammo_per_pack ?? 50),
      targets_per_competitor: String(d.targets_per_competitor ?? 0),
      distance_m: d.distance_m ? String(d.distance_m) : '',
      target_name: d.target_name ?? '',
    })
    setShowDisciplineForm(true)
    setError('')
  }

  async function saveDiscipline(e: React.FormEvent) {
    e.preventDefault()

    if ((parseFloat(disciplineForm.default_price_pln) || 0) === 0) {
      if (!confirm('Cena domyślna wynosi 0 zł. Czy na pewno chcesz zapisać?')) return
    }

    setSaving(true)
    setError('')

    const payload = {
      name: disciplineForm.name,
      description: disciplineForm.description || null,
      target_type: disciplineForm.target_type || null,
      category: disciplineForm.category || 'discipline',
      default_price_pln: parseFloat(disciplineForm.default_price_pln) || 0,
      own_weapon_price_pln: parseFloat(disciplineForm.own_weapon_price_pln) || 0,
      stations_count: parseInt(disciplineForm.stations_count) || 0,
      judges_per_station: parseInt(disciplineForm.judges_per_station) || 0,
      participants_per_hour: parseInt(disciplineForm.participants_per_hour) || 0,
      caliber: disciplineForm.caliber || null,
      shots_count: parseInt(disciplineForm.shots_count) || 60,
      ammo_per_pack: parseInt(disciplineForm.ammo_per_pack) || 50,
      targets_per_competitor: parseInt(disciplineForm.targets_per_competitor) || 0,
      distance_m: disciplineForm.distance_m ? parseInt(disciplineForm.distance_m) : null,
      target_name: disciplineForm.target_name || null,
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

  // ---- STAFFING SUGGESTIONS ----
  // 1. Based on discipline definitions (stations × judges_per_station)
  function getStaffingByDisciplines(eventId: string) {
    const evDiscs = getEventDiscs(eventId)
    if (evDiscs.length === 0) return null
    let totalRequired = 0
    let totalStations = 0
    for (const ed of evDiscs) {
      const disc = ed.discipline ?? disciplines.find(d => d.id === ed.discipline_id)
      const stations = disc?.stations_count ?? 1
      const judgesPerStation = disc?.judges_per_station ?? 1
      totalStations += stations
      totalRequired += stations * judgesPerStation
    }
    if (totalRequired === 0) return null
    const assigned = getEventJudges(eventId).length
    const missing = Math.max(0, totalRequired - assigned)
    return { recommended: totalRequired, assigned, missing, totalStations }
  }

  // 2. Based on registered participants (registered / participants_per_hour vs event duration)
  function getStaffingByRegistrations(eventId: string) {
    const ev = events.find(e => e.id === eventId)
    if (!ev) return null
    const evDiscs = getEventDiscs(eventId)
    if (evDiscs.length === 0) return null

    const startDate = new Date(ev.start_date)
    const endDate = ev.end_date ? new Date(ev.end_date) : new Date(startDate.getTime() + 8 * 60 * 60 * 1000)
    const durationHours = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60))

    let totalStationsNeeded = 0
    let totalJudgesNeeded = 0
    for (const ed of evDiscs) {
      const disc = ed.discipline ?? disciplines.find(d => d.id === ed.discipline_id)
      const participantsPerHour = disc?.participants_per_hour ?? 10
      const judgesPerStation = disc?.judges_per_station ?? 1
      const registeredCount = regDisciplines.filter(rd => rd.event_discipline_id === ed.id).length
      // How many participant-hours needed
      const hoursNeeded = registeredCount / participantsPerHour
      // How many stations needed to fit in event duration
      const stationsNeeded = Math.ceil(hoursNeeded / durationHours)
      totalStationsNeeded += stationsNeeded
      totalJudgesNeeded += stationsNeeded * judgesPerStation
    }
    const assigned = getEventJudges(eventId).length
    const missing = Math.max(0, totalJudgesNeeded - assigned)
    return { recommended: totalJudgesNeeded, assigned, missing, totalStations: totalStationsNeeded }
  }

  // Materials summary for an event
  interface MaterialLine {
    discipline: string
    participants: number
    caliber: string
    ammoTotal: number
    ammoPacks: number
    ammoPerPack: number
    targetsTotal: number
    targetName: string
    shotsCount: number
  }
  function getEventMaterials(eventId: string): { lines: MaterialLine[]; totals: { byCaliberAmmo: Map<string, { total: number; packs: number; perPack: number }>; byTargetTarcze: Map<string, number>; weaponsNeeded: Map<string, number> } } {
    const evDiscs = getEventDiscs(eventId)
    const lines: MaterialLine[] = []
    const byCaliberAmmo = new Map<string, { total: number; packs: number; perPack: number }>()
    const byTargetTarcze = new Map<string, number>()
    const weaponsNeeded = new Map<string, number>()

    for (const ed of evDiscs) {
      const d = ed.discipline as any
      if (!d || d.category !== 'discipline') continue
      const participants = regDisciplines.filter(rd => rd.event_discipline_id === ed.id).length
      if (participants === 0) continue

      const caliber = d.caliber || '?'
      const shotsCount = d.shots_count || 60
      const targetsPerComp = d.targets_per_competitor || 0
      const ammoPerPack = d.ammo_per_pack || 50
      const targetName = d.target_name || d.target_type || '?'

      const ammoTotal = participants * shotsCount
      const ammoPacks = Math.ceil(ammoTotal / ammoPerPack)
      const targetsTotal = participants * targetsPerComp

      lines.push({
        discipline: d.name,
        participants,
        caliber,
        ammoTotal,
        ammoPacks,
        ammoPerPack,
        targetsTotal,
        targetName,
        shotsCount,
      })

      // Aggregate by caliber
      const prev = byCaliberAmmo.get(caliber) || { total: 0, packs: 0, perPack: ammoPerPack }
      prev.total += ammoTotal
      prev.packs = Math.ceil(prev.total / prev.perPack)
      byCaliberAmmo.set(caliber, prev)

      // Aggregate targets
      byTargetTarcze.set(targetName, (byTargetTarcze.get(targetName) || 0) + targetsTotal)

      // Weapons needed (non-own-weapon participants need club weapons)
      weaponsNeeded.set(caliber, (weaponsNeeded.get(caliber) || 0) + participants)
    }

    return { lines, totals: { byCaliberAmmo, byTargetTarcze, weaponsNeeded } }
  }

  // Revenue summary for an event
  function getEventRevenue(eventId: string) {
    const evDiscs = getEventDiscs(eventId)
    let grandTotal = 0
    const lines = evDiscs.map(ed => {
      const rds = regDisciplines.filter(rd => rd.event_discipline_id === ed.id)
      const ownWeapon = rds.filter(r => r.own_weapon)
      const clubWeapon = rds.filter(r => !r.own_weapon)
      const d = ed.discipline as any
      const ownPrice = d?.own_weapon_price_pln ?? ed.price_pln ?? 0
      const clubPrice = d?.default_price_pln ?? ed.price_pln ?? 0
      const ownRev = ownWeapon.reduce((s, r) => s + (Number(r.price_pln) || Number(ownPrice)), 0)
      const clubRev = clubWeapon.reduce((s, r) => s + (Number(r.price_pln) || Number(clubPrice)), 0)
      const total = ownRev + clubRev
      grandTotal += total
      return { name: d?.name ?? '?', ownCount: ownWeapon.length, clubCount: clubWeapon.length, ownRev, clubRev, total }
    }).filter(l => l.ownCount + l.clubCount > 0)
    return { lines, grandTotal }
  }

  // ---- INVENTORY CRUD ----
  function openAddInventory() {
    setEditingInventory(null)
    setInventoryForm({ name: '', category: 'ammunition', description: '', caliber: '', quantity: '0', unit: 'szt.', purchase_price_pln: '0', purchase_date: '', supplier: '', min_stock_level: '0' })
    setShowInventoryForm(true)
  }
  function openEditInventory(item: InventoryItem) {
    setEditingInventory(item)
    setInventoryForm({
      name: item.name, category: item.category, description: item.description || '', caliber: item.caliber || '',
      quantity: String(item.quantity), unit: item.unit, purchase_price_pln: String(item.purchase_price_pln),
      purchase_date: item.purchase_date || '', supplier: item.supplier || '', min_stock_level: String(item.min_stock_level),
    })
    setShowInventoryForm(true)
  }
  async function saveInventory(e: React.FormEvent) {
    e.preventDefault()
    const payload = {
      name: inventoryForm.name,
      category: inventoryForm.category,
      description: inventoryForm.description || null,
      caliber: inventoryForm.caliber || null,
      quantity: parseInt(inventoryForm.quantity) || 0,
      unit: inventoryForm.unit,
      purchase_price_pln: parseFloat(inventoryForm.purchase_price_pln) || 0,
      purchase_date: inventoryForm.purchase_date || null,
      supplier: inventoryForm.supplier || null,
      min_stock_level: parseInt(inventoryForm.min_stock_level) || 0,
    }
    if (editingInventory) {
      await supabase.from('inventory_items').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingInventory.id)
    } else {
      await supabase.from('inventory_items').insert(payload)
    }
    setShowInventoryForm(false)
    loadAll()
  }
  async function deleteInventory(id: string) {
    if (!confirm('Usunąć pozycję z magazynu?')) return
    await supabase.from('inventory_items').delete().eq('id', id)
    loadAll()
  }

  // Count registrations per discipline for an event
  function getEventDiscRegCounts(eventId: string): { name: string; count: number }[] {
    const evDiscs = getEventDiscs(eventId)
    return evDiscs.map(ed => {
      const count = regDisciplines.filter(rd => rd.event_discipline_id === ed.id).length
      return { name: ed.discipline?.name ?? '?', count }
    })
  }

  function getEventTotalRegs(eventId: string): number {
    const memberCount = memberRegs.filter(r => r.event_id === eventId).length
    const guestCount = guestRegs.filter(r => r.event_id === eventId).length
    return memberCount + guestCount
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

  // ---- ATTENDANCE / SIGN-IN SHEET (Lista do podpisu na strzelnicy) ----
  async function loadAttendanceData(eventId: string) {
    const ev = events.find(e => e.id === eventId)
    if (!ev) return null

    const isCourse = ev.event_type === 'course'
    const evMemberRegs = memberRegs.filter(r => r.event_id === eventId)
    const evGuestRegs = guestRegs.filter(r => r.event_id === eventId)

    // Load full member data
    const memberIds = evMemberRegs.map(r => r.member_id).filter(Boolean)
    const { data: fullMembers } = memberIds.length > 0
      ? await supabase.from('members').select('*').in('id', memberIds)
      : { data: [] }
    const memberMap = new Map((fullMembers ?? []).map((m: any) => [m.id, m]))

    // For courses we only need names — skip weapons/permits loading
    let weaponsByMember = new Map<string, any[]>()
    let ownWeaponMap = new Map<string, boolean>()

    if (!isCourse) {
      const { data: memberWeapons } = memberIds.length > 0
        ? await supabase.from('member_weapons').select('*').in('member_id', memberIds).eq('is_active', true)
        : { data: [] }
      for (const w of (memberWeapons ?? [])) {
        if (!weaponsByMember.has(w.member_id)) weaponsByMember.set(w.member_id, [])
        weaponsByMember.get(w.member_id)!.push(w)
      }
      const regIds = evMemberRegs.map(r => r.id)
      for (const rd of regDisciplines) {
        if (rd.member_registration_id && regIds.includes(rd.member_registration_id)) {
          if (rd.own_weapon) ownWeaponMap.set(rd.member_registration_id, true)
        }
      }
    }

    const docTypeLabels: Record<string, string> = {
      dowod_osobisty: 'Dowod os.',
      paszport: 'Paszport',
      karta_pobytu: 'Karta pob.',
    }

    const rows: NonNullable<typeof attendancePreview>['rows'] = []
    let lp = 1

    for (const r of evMemberRegs) {
      const m = memberMap.get(r.member_id) as any
      if (!m) continue

      if (isCourse) {
        // Courses: only name + signature
        rows.push({ lp: lp++, name: m.full_name, isGuest: false, pesel: '', document: '', address: '', club: '', basis: '', weapon: '', permit: '', disciplines: '', missingData: false })
      } else {
        const discNames = getRegDisciplineNames(r.id, 'member')
        const hasOwnWeapon = ownWeaponMap.get(r.id) ?? false
        const mWeapons = weaponsByMember.get(m.id) ?? []

        const pesel = m.pesel || (m.date_of_birth ? new Date(m.date_of_birth).toLocaleDateString('pl') : '')
        const document = m.id_document_number ? `${docTypeLabels[m.id_document_type] || 'Dok.'} ${m.id_document_number}` : ''
        const address = m.address || ''

        let basis = ''
        if (hasOwnWeapon && m.has_weapons_permit) basis = 'Pozwolenie na bron'
        else if (m.shooting_patent_number) basis = `Patent: ${m.shooting_patent_number}`
        else if (m.license_number) basis = `Licencja: ${m.license_number}`
        else basis = 'Bron klubowa / pod nadzorem'

        let weapon = ''
        if (hasOwnWeapon && mWeapons.length > 0) weapon = mWeapons.map((w: any) => `${w.type} ${w.caliber} (${w.serial_number})`).join('; ')
        else if (hasOwnWeapon) weapon = 'bron wlasna - brak danych'
        else weapon = 'Bron klubowa'

        let permit = ''
        if (hasOwnWeapon && m.weapon_permit_number) {
          permit = m.weapon_permit_number
          if (m.weapon_permit_issuing_authority) permit += ` / ${m.weapon_permit_issuing_authority}`
        } else if (!hasOwnWeapon) permit = 'Sw. broni klubu'

        const missingData = !m.pesel || !m.id_document_number || !m.address || (hasOwnWeapon && !m.weapon_permit_number)

        rows.push({ lp: lp++, name: m.full_name, isGuest: false, pesel, document, address, club: m.club_name || '-', basis, weapon, permit, disciplines: discNames.join(', ') || '-', missingData })
      }
    }

    for (const r of evGuestRegs) {
      if (isCourse) {
        rows.push({ lp: lp++, name: `${r.full_name} (gosc)`, isGuest: true, pesel: '', document: '', address: '', club: '', basis: '', weapon: '', permit: '', disciplines: '', missingData: false })
      } else {
        const discNames = getRegDisciplineNames(r.id, 'guest')
        rows.push({ lp: lp++, name: `${r.full_name} (gosc)`, isGuest: true, pesel: '', document: '', address: '', club: '', basis: r.has_license ? `Licencja: ${r.license_number || '?'}` : 'Pod nadzorem', weapon: r.has_license ? 'Bron wlasna' : 'Bron klubowa', permit: '', disciplines: discNames.join(', ') || '-', missingData: true })
      }
    }

    // Build HTML for print
    const dateStr = new Date(ev.start_date).toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const printStyles = `body { font-family: Arial, sans-serif; margin: 15px; color: #000; font-size: 11px; }
      h1 { font-size: 16px; margin-bottom: 2px; }
      h2 { font-size: 12px; font-weight: normal; color: #555; margin-bottom: 4px; }
      .meta { font-size: 10px; color: #666; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #333; padding: 4px 6px; text-align: left; font-size: 10px; vertical-align: top; }
      th { background: #eee; font-weight: bold; font-size: 9px; }
      .sig-col { width: 150px; min-height: 30px; }
      .small { font-size: 9px; color: #555; }
      .warn { color: #c00; font-style: italic; }
      .footer { margin-top: 20px; font-size: 10px; }
      .footer-line { margin-top: 30px; border-top: 1px solid #333; width: 250px; padding-top: 4px; }`

    let html = `<!DOCTYPE html><html><head><title>${isCourse ? 'Lista obecnosci' : 'Lista do podpisu'} - ${ev.title}</title><style>
      ${printStyles}
      @media print { body { margin: 5mm; } @page { size: ${isCourse ? 'portrait' : 'landscape'}; margin: 5mm; } }
    </style></head><body>`

    html += `<h1>${isCourse ? 'LISTA OBECNOSCI' : 'REJESTR POBYTU NA STRZELNICY'}</h1>`
    html += `<h2>${ev.title}</h2>`
    html += `<div class="meta">${dateStr}`
    if (ev.location) html += ` &middot; ${ev.location}`
    if (ev.address) html += ` &middot; ${ev.address}`
    html += `</div>`

    if (isCourse) {
      // Simple table: Lp, Name, Signature
      html += `<table><thead><tr><th style="width:40px">Lp.</th><th>Imie i nazwisko</th><th class="sig-col">Podpis</th></tr></thead><tbody>`
      for (const row of rows) {
        html += `<tr><td>${row.lp}</td><td><strong>${row.name}</strong></td><td></td></tr>`
      }
      let walkInLp = rows.length + 1
      for (let i = 0; i < 10; i++) {
        html += `<tr><td>${walkInLp++}</td><td></td><td style="height:24px"></td></tr>`
      }
      html += `</tbody></table>`
      html += `<div class="footer"><div class="footer-line">Prowadzacy kurs (imie, nazwisko, podpis)</div></div>`
    } else {
      // Full shooting range sign-in sheet
      html += `<table><thead><tr><th>Lp.</th><th>Imie i nazwisko</th><th>PESEL / data ur.</th><th>Dokument tozsamosci</th><th>Adres zamieszkania</th><th>Klub</th><th>Podstawa uzytk. broni</th><th>Bron (rodzaj, kaliber, nr)</th><th>Nr pozwolenia / organ wydajacy</th><th>Dyscypliny</th><th class="sig-col">Podpis</th></tr></thead><tbody>`
      for (const row of rows) {
        const warnOrVal = (v: string) => v || '<span class="warn">brak</span>'
        html += `<tr><td>${row.lp}</td><td><strong>${row.name}</strong></td><td>${warnOrVal(row.pesel)}</td><td>${warnOrVal(row.document)}</td><td>${warnOrVal(row.address)}</td><td>${row.club}</td><td>${row.basis}</td><td>${row.weapon}</td><td>${warnOrVal(row.permit)}</td><td>${row.disciplines}</td><td></td></tr>`
      }
      let walkInLp = rows.length + 1
      for (let i = 0; i < 10; i++) {
        html += `<tr><td>${walkInLp++}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="height:24px"></td></tr>`
      }
      html += `</tbody></table>`
      html += `<div class="footer"><div class="footer-line">Prowadzacy strzelanie (imie, nazwisko, podpis)</div><div class="footer-line">Kierownik strzelnicy (imie, nazwisko, podpis)</div></div>`
    }
    html += `</body></html>`

    return {
      eventId: ev.id,
      eventTitle: ev.title,
      eventDate: dateStr,
      eventLocation: [ev.location, ev.address].filter(Boolean).join(' · '),
      isCourse,
      rows,
      htmlContent: html,
    }
  }

  async function openAttendancePreview(eventId: string) {
    setAttendanceLoading(true)
    const data = await loadAttendanceData(eventId)
    setAttendanceLoading(false)
    if (data) setAttendancePreview(data)
  }

  function printAttendanceFromPreview() {
    if (!attendancePreview) return
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(attendancePreview.htmlContent)
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
          { key: 'inventory' as Tab, label: 'Magazyn', icon: Package },
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
              const staffByDisc = ev.event_type === 'competition' ? getStaffingByDisciplines(ev.id) : null
              const staffByRegs = ev.event_type === 'competition' ? getStaffingByRegistrations(ev.id) : null
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
                        {evDiscs.length > 0 && ` · ${evDiscs.length} dyscyplin`}
                        {staffByDisc && ` · ${staffByDisc.totalStations} stanowisk · ${staffByDisc.recommended} sędziów wg dyscyplin`}
                        {totalPrice > 0 && ` · suma: ${totalPrice.toFixed(0)} zł`}
                        {ev.max_participants && ` · max ${ev.max_participants} os.`}
                      </p>
                      {ev.event_type !== 'course' && assigned.length > 0 && (
                        <p className="text-xs text-muted mt-1">
                          Sędziowie: {assigned.map(j => j.full_name).join(', ')}
                        </p>
                      )}
                      {/* Registration counts + both staffing suggestions */}
                      {evDiscs.length > 0 && (() => {
                        const discRegs = getEventDiscRegCounts(ev.id)
                        const total = getEventTotalRegs(ev.id)
                        return (
                          <>
                            <p className="text-xs text-muted mt-1">
                              Zapisanych: <span className="text-foreground font-medium">{total}</span>
                              {discRegs.length > 0 && (
                                <span> ({discRegs.map(d => `${d.name}: ${d.count}`).join(', ')})</span>
                              )}
                            </p>
                            {staffByDisc && (
                              <p className="text-xs mt-0.5">
                                <span className="text-muted">Wg dyscyplin: </span>
                                <span className={staffByDisc.missing > 0 ? 'text-red-400 font-medium' : 'text-green-400'}>
                                  {staffByDisc.assigned}/{staffByDisc.recommended} sędziów
                                  {staffByDisc.missing > 0 && ` (brakuje ${staffByDisc.missing})`}
                                </span>
                              </p>
                            )}
                            {staffByRegs && (
                              <p className="text-xs mt-0.5">
                                <span className="text-muted">Wg zapisanych: </span>
                                <span className={staffByRegs.missing > 0 ? 'text-yellow-400 font-medium' : 'text-green-400'}>
                                  {staffByRegs.assigned}/{staffByRegs.recommended} sędziów ({staffByRegs.totalStations} stanowisk potrzeba)
                                  {staffByRegs.missing > 0 && ` (brakuje ${staffByRegs.missing})`}
                                </span>
                              </p>
                            )}
                            {/* Revenue summary */}
                            {(() => {
                              const rev = getEventRevenue(ev.id)
                              if (rev.grandTotal === 0) return null
                              return (
                                <p className="text-xs mt-0.5">
                                  <span className="text-muted">Przychód: </span>
                                  <span className="text-green-400 font-bold">{rev.grandTotal.toLocaleString('pl')} zł</span>
                                  <span className="text-muted ml-1">
                                    ({rev.lines.map(l => `${l.name.split('—')[0].trim()}: ${l.total.toLocaleString('pl')} zł`).join(', ')})
                                  </span>
                                </p>
                              )
                            })()}
                          </>
                        )
                      })()}
                    </div>
                    <div className="flex items-center gap-1">
                      {getEventTotalRegs(ev.id) > 0 && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Wysłać przypomnienie o "${ev.title}" do wszystkich zapisanych?`)) return
                            const res = await fetch('/api/email/event-reminder', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ event_id: ev.id }),
                            })
                            const data = await res.json()
                            if (data.success) alert(`Wysłano ${data.sent} przypomnień.`)
                            else alert('Błąd: ' + (data.error || 'Nieznany'))
                          }}
                          className="p-2 text-muted hover:text-yellow-400 rounded-lg hover:bg-card-hover"
                          title="Wyślij przypomnienie email"
                        >
                          <Bell className="w-4 h-4" />
                        </button>
                      )}
                      {getEventTotalRegs(ev.id) > 0 && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Wysłać wyniki z "${ev.title}" do wszystkich zawodników?`)) return
                            const res = await fetch('/api/email/result-notify', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ event_id: ev.id }),
                            })
                            const data = await res.json()
                            if (data.success) alert(`Wysłano ${data.sent} powiadomień o wynikach.`)
                            else alert('Błąd: ' + (data.error || 'Nieznany'))
                          }}
                          className="p-2 text-muted hover:text-green-400 rounded-lg hover:bg-card-hover"
                          title="Wyślij wyniki email"
                        >
                          <Trophy className="w-4 h-4" />
                        </button>
                      )}
                      {getEventTotalRegs(ev.id) > 0 && (
                        <button
                          onClick={() => openAttendancePreview(ev.id)}
                          className="p-2 text-muted hover:text-primary rounded-lg hover:bg-card-hover"
                          title="Lista do podpisu"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      )}
                      {evDiscs.length > 0 && ev.event_type !== 'course' && (
                        <button
                          onClick={() => setSlotManagedEvent(isSlotManaged ? null : ev.id)}
                          className="p-2 text-muted hover:text-primary rounded-lg hover:bg-card-hover"
                          title="Zarzadzaj slotami"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                      )}
                      {ev.event_type !== 'course' && (
                        <button onClick={() => setExpandedEvent(isExpanded ? null : ev.id)} className="p-2 text-muted hover:text-foreground rounded-lg hover:bg-card-hover" title="Sedziowie">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
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

                      {/* === MATERIALS SUMMARY === */}
                      {(() => {
                        const mats = getEventMaterials(ev.id)
                        if (mats.lines.length === 0) return null
                        return (
                          <div className="mt-4 pt-4 border-t border-border">
                            <p className="text-sm font-medium mb-3 flex items-center gap-2">
                              <ClipboardList className="w-4 h-4 text-primary" />
                              Podsumowanie materiałów
                            </p>

                            {/* Per-discipline table */}
                            <div className="overflow-x-auto mb-4">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-muted border-b border-border">
                                    <th className="text-left py-1.5 pr-2 font-medium">Dyscyplina</th>
                                    <th className="text-right py-1.5 px-2 font-medium">Zawodnicy</th>
                                    <th className="text-left py-1.5 px-2 font-medium">Kaliber</th>
                                    <th className="text-right py-1.5 px-2 font-medium">Strzały</th>
                                    <th className="text-right py-1.5 px-2 font-medium">Amunicja (szt)</th>
                                    <th className="text-right py-1.5 px-2 font-medium">Paczki</th>
                                    <th className="text-left py-1.5 px-2 font-medium">Tarcza</th>
                                    <th className="text-right py-1.5 pl-2 font-medium">Tarcze (szt)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {mats.lines.map((l, idx) => (
                                    <tr key={idx} className="border-b border-border/50">
                                      <td className="py-1.5 pr-2 font-medium text-foreground">{l.discipline}</td>
                                      <td className="text-right py-1.5 px-2">{l.participants}</td>
                                      <td className="py-1.5 px-2 text-muted">{l.caliber}</td>
                                      <td className="text-right py-1.5 px-2">{l.shotsCount}/os</td>
                                      <td className="text-right py-1.5 px-2 font-semibold text-foreground">{l.ammoTotal.toLocaleString('pl')}</td>
                                      <td className="text-right py-1.5 px-2 text-primary font-semibold">{l.ammoPacks} ×{l.ammoPerPack}</td>
                                      <td className="py-1.5 px-2 text-muted truncate max-w-[160px]" title={l.targetName}>{l.targetName}</td>
                                      <td className="text-right py-1.5 pl-2 font-semibold text-foreground">{l.targetsTotal.toLocaleString('pl')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Aggregated totals */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {/* Ammo by caliber */}
                              <div className="bg-background/50 border border-border/50 rounded-lg p-3">
                                <p className="text-xs text-muted font-medium mb-2">🔫 Amunicja wg kalibru</p>
                                {Array.from(mats.totals.byCaliberAmmo.entries()).map(([cal, v]) => (
                                  <div key={cal} className="flex justify-between text-xs mb-1">
                                    <span className="text-muted">{cal}</span>
                                    <span className="font-semibold">{v.total.toLocaleString('pl')} szt <span className="text-primary">({v.packs} paczek ×{v.perPack})</span></span>
                                  </div>
                                ))}
                              </div>

                              {/* Targets */}
                              <div className="bg-background/50 border border-border/50 rounded-lg p-3">
                                <p className="text-xs text-muted font-medium mb-2">🎯 Tarcze / rzutki</p>
                                {Array.from(mats.totals.byTargetTarcze.entries()).map(([name, count]) => (
                                  <div key={name} className="flex justify-between text-xs mb-1 gap-2">
                                    <span className="text-muted truncate" title={name}>{name}</span>
                                    <span className="font-semibold flex-shrink-0">{count.toLocaleString('pl')} szt</span>
                                  </div>
                                ))}
                              </div>

                              {/* Weapons needed */}
                              <div className="bg-background/50 border border-border/50 rounded-lg p-3">
                                <p className="text-xs text-muted font-medium mb-2">🔧 Broń klubowa (max jednocześnie)</p>
                                {Array.from(mats.totals.weaponsNeeded.entries()).map(([cal, count]) => (
                                  <div key={cal} className="flex justify-between text-xs mb-1">
                                    <span className="text-muted">{cal}</span>
                                    <span className="font-semibold">{count} zawodników</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )
                      })()}
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
                  <div>
                    <label className="text-xs text-muted block mb-1">Data i godzina rozpoczęcia *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input required type="date" value={eventForm.start_day} onChange={e => {
                        setEventForm(f => ({ ...f, start_day: e.target.value, end_day: f.end_day || e.target.value }))
                      }} className={inputClass} />
                      <input required type="time" value={eventForm.start_time} onChange={e => setEventForm(f => ({ ...f, start_time: e.target.value }))} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Data i godzina zakończenia</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" value={eventForm.end_day} min={eventForm.start_day} onChange={e => setEventForm(f => ({ ...f, end_day: e.target.value }))} className={inputClass} />
                      <input type="time" value={eventForm.end_time} onChange={e => setEventForm(f => ({ ...f, end_time: e.target.value }))} className={inputClass} />
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
                  {/* Staffing suggestion based on disciplines - only for competitions */}
                  {eventForm.event_type === 'competition' && editingEventDisciplines.length > 0 && (() => {
                    let totalStations = 0
                    let totalJudges = 0
                    for (const ed of editingEventDisciplines) {
                      const disc = disciplines.find(d => d.id === ed.discipline_id)
                      const stations = disc?.stations_count ?? 1
                      const judgesPerStation = disc?.judges_per_station ?? 1
                      totalStations += stations
                      totalJudges += stations * judgesPerStation
                    }
                    return (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                        <p className="text-xs text-blue-400">
                          Łącznie {totalStations} stanowisk · wymaganych {totalJudges} sędziów/prowadzących strzelanie (wg dyscyplin)
                        </p>
                      </div>
                    )
                  })()}

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
                            <div key={idx} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <select
                                  value={ed.discipline_id}
                                  onChange={e => updateEventDiscipline(idx, 'discipline_id', e.target.value)}
                                  className={inputClass + ' flex-1'}
                                >
                                  {getFilteredDisciplines().filter(d => !usedIds.includes(d.id) || d.id === ed.discipline_id).map(d => (
                                    <option key={d.id} value={d.id}>{d.name}{d.category === 'service' ? ' (usługa)' : ''}</option>
                                  ))}
                                </select>
                                <div className="relative w-24 flex-shrink-0">
                                  <input type="number" step="0.01" min="0" value={ed.price_pln} onChange={e => updateEventDiscipline(idx, 'price_pln', e.target.value)} className={inputClass + ' pr-8'} placeholder="0" title="Cena" />
                                  <span className="absolute right-3 top-2.5 text-xs text-muted">zł</span>
                                </div>
                                <div className="relative w-24 flex-shrink-0">
                                  <input type="number" step="0.01" min="0" value={ed.own_weapon_price_pln} onChange={e => updateEventDiscipline(idx, 'own_weapon_price_pln', e.target.value)} className={inputClass + ' pr-8'} placeholder="0" title="Cena z własną bronią" />
                                  <span className="absolute right-3 top-2.5 text-[9px] text-muted">wł.b.</span>
                                </div>
                                <button type="button" onClick={() => removeDisciplineFromEvent(idx)} className="p-2 text-muted hover:text-danger rounded hover:bg-card-hover flex-shrink-0">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
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
                  <th className="text-left px-4 py-3">Kategoria</th>
                  <th className="text-left px-4 py-3">Kaliber</th>
                  <th className="text-right px-4 py-3">Strzałów</th>
                  <th className="text-right px-4 py-3">Cena</th>
                  <th className="text-right px-4 py-3">Stanowiska</th>
                  <th className="text-right px-4 py-3 w-24">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {disciplines.map(d => (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-card-hover">
                    <td className="px-4 py-3 text-sm">
                      <span className="font-medium">{d.name}</span>
                      {d.distance_m ? <span className="text-muted text-xs ml-1.5">({d.distance_m}m)</span> : null}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.category === 'service' ? 'bg-blue-500/20 text-blue-400' : 'bg-primary/20 text-primary'}`}>
                        {d.category === 'service' ? 'Usługa' : 'Dyscyplina'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted">{d.caliber ?? '-'}</td>
                    <td className="px-4 py-3 text-right text-sm">{d.category === 'discipline' ? <>{d.shots_count}<span className="text-muted text-xs ml-0.5">/{d.ammo_per_pack}pacz</span></> : '-'}</td>
                    <td className="px-4 py-3 text-right text-sm">{Number(d.default_price_pln).toFixed(0)} zł</td>
                    <td className="px-4 py-3 text-right text-sm">{d.stations_count}</td>
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
              <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                  <h2 className="text-lg font-bold">{editingDiscipline ? 'Edytuj dyscyplinę' : 'Nowa dyscyplina'}</h2>
                  <button type="button" onClick={() => setShowDisciplineForm(false)} className="p-1.5 text-muted hover:text-foreground rounded-lg hover:bg-card-hover"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={saveDiscipline} className="overflow-y-auto flex-1 px-6 py-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {/* Left column: basic info */}
                    <div className="col-span-2 grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-muted block mb-1">Nazwa *</label>
                        <input required value={disciplineForm.name} onChange={e => setDisciplineForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted block mb-1">Kategoria</label>
                          <select value={disciplineForm.category} onChange={e => setDisciplineForm(f => ({ ...f, category: e.target.value }))} className={inputClass}>
                            <option value="discipline">Dyscyplina</option>
                            <option value="service">Usługa</option>
                          </select>
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
                      </div>
                    </div>

                    <div className="col-span-2">
                      <label className="text-xs text-muted block mb-1">Opis</label>
                      <textarea value={disciplineForm.description} onChange={e => setDisciplineForm(f => ({ ...f, description: e.target.value }))} rows={2} className={inputClass + ' resize-none'} />
                    </div>

                    {/* Pricing row */}
                    <div className="col-span-2">
                      <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Ceny</p>
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="text-xs text-muted block mb-1">Cena domyślna (zł)</label>
                          <input type="number" step="0.01" min="0" value={disciplineForm.default_price_pln} onChange={e => setDisciplineForm(f => ({ ...f, default_price_pln: e.target.value }))} className={inputClass} placeholder="0" />
                        </div>
                        <div>
                          <label className="text-xs text-muted block mb-1">Własna broń (zł)</label>
                          <input type="number" step="0.01" min="0" value={disciplineForm.own_weapon_price_pln} onChange={e => setDisciplineForm(f => ({ ...f, own_weapon_price_pln: e.target.value }))} className={inputClass} placeholder="0" />
                        </div>
                        <div>
                          <label className="text-xs text-muted block mb-1">Stanowiska</label>
                          <input type="number" min="0" value={disciplineForm.stations_count} onChange={e => setDisciplineForm(f => ({ ...f, stations_count: e.target.value }))} className={inputClass} />
                        </div>
                        <div>
                          <label className="text-xs text-muted block mb-1">Zaw./godz.</label>
                          <input type="number" min="0" value={disciplineForm.participants_per_hour} onChange={e => setDisciplineForm(f => ({ ...f, participants_per_hour: e.target.value }))} className={inputClass} />
                        </div>
                      </div>
                    </div>

                    {/* Ammo & materials — only for discipline category */}
                    {disciplineForm.category === 'discipline' && (
                      <div className="col-span-2">
                        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Amunicja i materiały</p>
                        <div className="grid grid-cols-4 gap-3 mb-3">
                          <div>
                            <label className="text-xs text-muted block mb-1">Kaliber</label>
                            <input value={disciplineForm.caliber} onChange={e => setDisciplineForm(f => ({ ...f, caliber: e.target.value }))} className={inputClass} placeholder="9x19mm" />
                          </div>
                          <div>
                            <label className="text-xs text-muted block mb-1">Dystans (m)</label>
                            <input type="number" min="0" value={disciplineForm.distance_m} onChange={e => setDisciplineForm(f => ({ ...f, distance_m: e.target.value }))} className={inputClass} placeholder="25" />
                          </div>
                          <div>
                            <label className="text-xs text-muted block mb-1">Strzałów/os.</label>
                            <input type="number" min="0" value={disciplineForm.shots_count} onChange={e => setDisciplineForm(f => ({ ...f, shots_count: e.target.value }))} className={inputClass} />
                          </div>
                          <div>
                            <label className="text-xs text-muted block mb-1">Szt./paczka</label>
                            <input type="number" min="1" value={disciplineForm.ammo_per_pack} onChange={e => setDisciplineForm(f => ({ ...f, ammo_per_pack: e.target.value }))} className={inputClass} />
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          <div className="col-span-2">
                            <label className="text-xs text-muted block mb-1">Nazwa tarczy</label>
                            <input value={disciplineForm.target_name} onChange={e => setDisciplineForm(f => ({ ...f, target_name: e.target.value }))} className={inputClass} placeholder="np. TP-4" />
                          </div>
                          <div>
                            <label className="text-xs text-muted block mb-1">Tarcz/os.</label>
                            <input type="number" min="0" value={disciplineForm.targets_per_competitor} onChange={e => setDisciplineForm(f => ({ ...f, targets_per_competitor: e.target.value }))} className={inputClass} />
                          </div>
                          <div>
                            <label className="text-xs text-muted block mb-1">Sędz./stan.</label>
                            <input type="number" min="0" value={disciplineForm.judges_per_station} onChange={e => setDisciplineForm(f => ({ ...f, judges_per_station: e.target.value }))} className={inputClass} />
                          </div>
                        </div>
                        <p className="text-xs text-muted mt-2">Zapotrzebowanie na amunicję i tarcze obliczane automatycznie na podstawie zapisanych uczestników.</p>
                      </div>
                    )}
                  </div>

                  {error && <p className="text-sm text-danger mt-3">{error}</p>}
                </form>
                <div className="flex gap-2 px-6 py-4 border-t border-border shrink-0">
                  <button onClick={saveDiscipline} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark disabled:opacity-50">
                    <Save className="w-4 h-4" />
                    {saving ? 'Zapisywanie...' : 'Zapisz'}
                  </button>
                  <button type="button" onClick={() => setShowDisciplineForm(false)} className="px-4 py-2.5 border border-border text-sm rounded-lg hover:bg-card-hover">
                    Anuluj
                  </button>
                </div>
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
                    onClick={() => openAttendancePreview(ev.id)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors ml-2 font-medium"
                    title="Lista do podpisu na strzelnicy"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Lista do podpisu
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
      {/* ============ INVENTORY TAB ============ */}
      {tab === 'inventory' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Magazyn ({inventoryItems.length})
            </h2>
            <button onClick={openAddInventory} className="flex items-center gap-2 bg-primary text-background px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors">
              <Plus className="w-4 h-4" />
              Dodaj pozycję
            </button>
          </div>

          {/* Category filter */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {[
              { key: 'all', label: 'Wszystko', count: inventoryItems.length },
              { key: 'ammunition', label: 'Amunicja', count: inventoryItems.filter(i => i.category === 'ammunition').length },
              { key: 'targets', label: 'Tarcze / Rzutki', count: inventoryItems.filter(i => i.category === 'targets').length },
              { key: 'weapons', label: 'Broń', count: inventoryItems.filter(i => i.category === 'weapons').length },
              { key: 'other', label: 'Inne', count: inventoryItems.filter(i => i.category === 'other').length },
            ].filter(f => f.count > 0 || f.key === 'all').map(f => (
              <button key={f.key} onClick={() => setInventoryFilter(f.key)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${inventoryFilter === f.key ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted hover:text-foreground'}`}>
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {/* Low stock warnings */}
          {(() => {
            const lowStock = inventoryItems.filter(i => i.min_stock_level > 0 && i.quantity <= i.min_stock_level)
            if (lowStock.length === 0) return null
            return (
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-4">
                <p className="text-sm text-warning font-medium flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  Niski stan magazynowy ({lowStock.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {lowStock.map(i => (
                    <span key={i.id} className="text-xs px-2 py-1 rounded-full bg-warning/20 text-warning">
                      {i.name}: {i.quantity} {i.unit} (min. {i.min_stock_level})
                    </span>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted mb-1">Wartość amunicji</p>
              <p className="text-lg font-bold">
                {inventoryItems.filter(i => i.category === 'ammunition').reduce((s, i) => s + i.quantity * Number(i.purchase_price_pln), 0).toLocaleString('pl', { minimumFractionDigits: 2 })} zł
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted mb-1">Wartość broni</p>
              <p className="text-lg font-bold">
                {inventoryItems.filter(i => i.category === 'weapons').reduce((s, i) => s + i.quantity * Number(i.purchase_price_pln), 0).toLocaleString('pl', { minimumFractionDigits: 2 })} zł
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted mb-1">Wartość całkowita</p>
              <p className="text-lg font-bold text-primary">
                {inventoryItems.reduce((s, i) => s + i.quantity * Number(i.purchase_price_pln), 0).toLocaleString('pl', { minimumFractionDigits: 2 })} zł
              </p>
            </div>
          </div>

          {/* Items grouped by caliber/type */}
          {(() => {
            const filtered = inventoryItems.filter(i => inventoryFilter === 'all' || i.category === inventoryFilter)
            if (filtered.length === 0) return <p className="text-muted text-center py-8">Brak pozycji w magazynie.</p>

            const catLabels: Record<string, string> = { ammunition: 'Amunicja', targets: 'Tarcze', weapons: 'Broń', other: 'Inne' }
            const catColors: Record<string, string> = { ammunition: 'bg-orange-500/20 text-orange-400', targets: 'bg-blue-500/20 text-blue-400', weapons: 'bg-purple-500/20 text-purple-400', other: 'bg-gray-500/20 text-gray-400' }
            const catIcons: Record<string, React.ReactNode> = {
              ammunition: <Crosshair className="w-4 h-4 text-orange-400" />,
              targets: <CircleDot className="w-4 h-4 text-blue-400" />,
              weapons: <Zap className="w-4 h-4 text-purple-400" />,
              other: <Boxes className="w-4 h-4 text-gray-400" />,
            }

            // Group by caliber (or category for items without caliber)
            const groups = new Map<string, InventoryItem[]>()
            for (const item of filtered) {
              const key = item.caliber || catLabels[item.category] || 'Inne'
              if (!groups.has(key)) groups.set(key, [])
              groups.get(key)!.push(item)
            }

            return Array.from(groups.entries()).map(([groupKey, items]) => {
              const groupTotal = items.reduce((s, i) => s + i.quantity * Number(i.purchase_price_pln), 0)
              const groupQty = items.reduce((s, i) => s + i.quantity, 0)
              const isCollapsed = collapsedGroups.has(groupKey)
              const lowCount = items.filter(i => i.min_stock_level > 0 && i.quantity <= i.min_stock_level).length
              const groupCat = items[0]?.category || 'other'
              return (
                <div key={groupKey} className="mb-4 bg-card border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setCollapsedGroups(prev => {
                      const next = new Set(prev)
                      if (next.has(groupKey)) next.delete(groupKey)
                      else next.add(groupKey)
                      return next
                    })}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-card-hover transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {catIcons[groupCat] || catIcons.other}
                      <span className="text-sm font-bold">{groupKey}</span>
                      <span className="text-xs text-muted font-normal">({items.length} {items.length === 1 ? 'pozycja' : 'pozycji'})</span>
                      {lowCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning font-medium">{lowCount} niski stan</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted">
                        {groupQty.toLocaleString('pl')} szt. &middot; <span className="text-primary font-semibold">{groupTotal.toLocaleString('pl', { minimumFractionDigits: 2 })} zl</span>
                      </span>
                      {isCollapsed ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronUp className="w-4 h-4 text-muted" />}
                    </div>
                  </button>
                  {!isCollapsed && (
                    <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                      {items.map(item => {
                        const isLow = item.min_stock_level > 0 && item.quantity <= item.min_stock_level
                        const value = item.quantity * Number(item.purchase_price_pln)
                        return (
                          <div key={item.id} className={`bg-background border rounded-xl p-4 flex items-center gap-4 ${isLow ? 'border-warning/50' : 'border-border/50'}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColors[item.category] || catColors.other}`}>
                                  {catLabels[item.category] || item.category}
                                </span>
                                {isLow && <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning font-medium">Niski stan!</span>}
                              </div>
                              <h3 className="font-semibold text-sm">{item.name}</h3>
                              <div className="text-xs text-muted mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                                <span>Stan: <span className="text-foreground font-medium">{item.quantity.toLocaleString('pl')} {item.unit}</span></span>
                                <span>Cena zakupu: <span className="text-foreground">{Number(item.purchase_price_pln).toFixed(2)} zl/{item.unit}</span></span>
                                <span>Wartosc: <span className="text-foreground font-medium">{value.toLocaleString('pl', { minimumFractionDigits: 2 })} zl</span></span>
                                {item.purchase_date && <span>Zakup: {new Date(item.purchase_date).toLocaleDateString('pl')}</span>}
                                {item.supplier && <span>Dostawca: {item.supplier}</span>}
                                {item.min_stock_level > 0 && <span>Min. stan: {item.min_stock_level} {item.unit}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => openEditInventory(item)} className="p-2 text-muted hover:text-primary rounded-lg hover:bg-card-hover" title="Edytuj">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => deleteInventory(item.id)} className="p-2 text-muted hover:text-danger rounded-lg hover:bg-card-hover" title="Usun">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          })()}

          {/* Inventory Form Modal */}
          {showInventoryForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <h2 className="text-lg font-bold mb-4">{editingInventory ? 'Edytuj pozycję' : 'Nowa pozycja magazynowa'}</h2>
                <form onSubmit={saveInventory} className="space-y-4">
                  <div>
                    <label className="text-xs text-muted block mb-1">Nazwa *</label>
                    <input required value={inventoryForm.name} onChange={e => setInventoryForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">Kategoria</label>
                      <select value={inventoryForm.category} onChange={e => setInventoryForm(f => ({ ...f, category: e.target.value }))} className={inputClass}>
                        <option value="ammunition">Amunicja</option>
                        <option value="targets">Tarcze / Rzutki</option>
                        <option value="weapons">Broń</option>
                        <option value="other">Inne</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Kaliber</label>
                      <input value={inventoryForm.caliber} onChange={e => setInventoryForm(f => ({ ...f, caliber: e.target.value }))} placeholder="np. .22 LR" className={inputClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">Ilość *</label>
                      <input type="number" min="0" required value={inventoryForm.quantity} onChange={e => setInventoryForm(f => ({ ...f, quantity: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Jednostka</label>
                      <input value={inventoryForm.unit} onChange={e => setInventoryForm(f => ({ ...f, unit: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Min. stan</label>
                      <input type="number" min="0" value={inventoryForm.min_stock_level} onChange={e => setInventoryForm(f => ({ ...f, min_stock_level: e.target.value }))} className={inputClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">Cena zakupu (zł/szt)</label>
                      <input type="number" step="0.01" min="0" value={inventoryForm.purchase_price_pln} onChange={e => setInventoryForm(f => ({ ...f, purchase_price_pln: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Data zakupu</label>
                      <input type="date" value={inventoryForm.purchase_date} onChange={e => setInventoryForm(f => ({ ...f, purchase_date: e.target.value }))} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Dostawca</label>
                    <input value={inventoryForm.supplier} onChange={e => setInventoryForm(f => ({ ...f, supplier: e.target.value }))} placeholder="np. Kolter Wrocław" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Opis</label>
                    <textarea value={inventoryForm.description} onChange={e => setInventoryForm(f => ({ ...f, description: e.target.value }))} rows={2} className={inputClass + ' resize-none'} />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" className="flex-1 bg-primary text-background font-semibold py-2 rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2">
                      <Save className="w-4 h-4" />
                      {editingInventory ? 'Zapisz zmiany' : 'Dodaj'}
                    </button>
                    <button type="button" onClick={() => setShowInventoryForm(false)} className="flex-1 border border-border text-foreground font-semibold py-2 rounded-lg hover:bg-card-hover transition-colors">
                      Anuluj
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Attendance List Preview Modal */}
      {attendanceLoading && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-muted">Ladowanie danych listy...</p>
          </div>
        </div>
      )}

      {attendancePreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-7xl max-h-[95vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary" />
                  {attendancePreview.isCourse ? 'Lista obecnosci' : 'Lista do podpisu'}
                </h2>
                <p className="text-sm text-muted">{attendancePreview.eventTitle} &middot; {attendancePreview.eventDate}</p>
                {attendancePreview.eventLocation && <p className="text-xs text-muted">{attendancePreview.eventLocation}</p>}
              </div>
              <div className="flex items-center gap-2">
                {!attendancePreview.isCourse && (() => {
                  const missing = attendancePreview.rows.filter(r => r.missingData && !r.isGuest)
                  if (missing.length === 0) return null
                  return (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-warning/20 text-warning font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {missing.length} {missing.length === 1 ? 'osoba' : 'osob'} z brakujacymi danymi
                    </span>
                  )
                })()}
                <span className="text-xs px-2.5 py-1 rounded-full bg-primary/20 text-primary font-medium">
                  {attendancePreview.rows.length} {attendancePreview.rows.length === 1 ? 'osoba' : 'osob'}
                </span>
                <button
                  onClick={printAttendanceFromPreview}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Drukuj
                </button>
                <button
                  onClick={() => setAttendancePreview(null)}
                  className="p-2 text-muted hover:text-foreground rounded-lg hover:bg-card-hover"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto px-4 py-3">
              {attendancePreview.isCourse ? (
                /* Course: simple name + signature table */
                <table className="w-full text-sm border-collapse max-w-xl">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b-2 border-border">
                      <th className="text-left py-2 px-3 text-xs text-muted font-semibold w-12">Lp.</th>
                      <th className="text-left py-2 px-3 text-xs text-muted font-semibold">Imie i nazwisko</th>
                      <th className="text-left py-2 px-3 text-xs text-muted font-semibold w-40">Podpis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendancePreview.rows.map((row, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-card-hover transition-colors">
                        <td className="py-2.5 px-3 text-xs text-muted">{row.lp}</td>
                        <td className="py-2.5 px-3 font-medium">{row.name}</td>
                        <td className="py-2.5 px-3"></td>
                      </tr>
                    ))}
                    {[...Array(3)].map((_, i) => (
                      <tr key={`empty-${i}`} className="border-b border-border/30">
                        <td className="py-3 px-3 text-xs text-muted/30">{attendancePreview.rows.length + i + 1}</td>
                        <td colSpan={2} className="py-3 px-3 text-xs text-muted/30 italic">Wolny wiersz</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                /* Competition/training: full sign-in sheet */
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b-2 border-border">
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold w-10">Lp.</th>
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold">Imie i nazwisko</th>
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold">PESEL / data ur.</th>
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold">Dokument</th>
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold">Adres</th>
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold">Klub</th>
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold">Podstawa</th>
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold">Bron</th>
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold">Pozwolenie</th>
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold">Dyscypliny</th>
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold w-20">Podpis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendancePreview.rows.map((row, idx) => (
                      <tr key={idx} className={`border-b border-border/50 hover:bg-card-hover transition-colors ${row.missingData && !row.isGuest ? 'bg-warning/5' : ''}`}>
                        <td className="py-2 px-2 text-xs text-muted">{row.lp}</td>
                        <td className="py-2 px-2 font-medium">
                          {row.name}
                          {row.isGuest && <span className="text-xs text-muted ml-1">(gosc)</span>}
                        </td>
                        <td className={`py-2 px-2 text-xs ${!row.pesel && !row.isGuest ? 'text-warning italic' : ''}`}>
                          {row.pesel || (row.isGuest ? '-' : 'brak')}
                        </td>
                        <td className={`py-2 px-2 text-xs ${!row.document && !row.isGuest ? 'text-warning italic' : ''}`}>
                          {row.document || (row.isGuest ? '-' : 'brak')}
                        </td>
                        <td className={`py-2 px-2 text-xs ${!row.address && !row.isGuest ? 'text-warning italic' : ''}`}>
                          {row.address || (row.isGuest ? '-' : 'brak')}
                        </td>
                        <td className="py-2 px-2 text-xs">{row.club || '-'}</td>
                        <td className="py-2 px-2 text-xs">{row.basis}</td>
                        <td className="py-2 px-2 text-xs">{row.weapon}</td>
                        <td className={`py-2 px-2 text-xs ${!row.permit && !row.isGuest ? 'text-warning italic' : ''}`}>
                          {row.permit || (row.isGuest ? '-' : 'brak')}
                        </td>
                        <td className="py-2 px-2 text-xs">
                          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs">{row.disciplines}</span>
                        </td>
                        <td className="py-2 px-2"></td>
                      </tr>
                    ))}
                    {[...Array(3)].map((_, i) => (
                      <tr key={`empty-${i}`} className="border-b border-border/30">
                        <td className="py-3 px-2 text-xs text-muted/30">{attendancePreview.rows.length + i + 1}</td>
                        <td colSpan={10} className="py-3 px-2 text-xs text-muted/30 italic">Wolny wiersz (walk-in)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-border flex-shrink-0 text-xs text-muted">
              <span>+10 pustych wierszy na wydruku</span>
              <span>Wydruk w orientacji {attendancePreview.isCourse ? 'pionowej (portrait)' : 'poziomej (landscape)'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
