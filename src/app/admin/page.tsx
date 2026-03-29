'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { Shield, Calendar, Target, Users, Plus, Trash2, Pencil, Save, X, UserPlus, ChevronDown, ChevronUp, ClipboardList, Check, Ban, Tag, Clock, Printer, MapPin, Zap, Package, AlertTriangle, DollarSign, Eye, Crosshair, Boxes, Wrench, CircleDot, Bell, Mail, Trophy, Hash, History, ArrowDownUp, Camera } from 'lucide-react'
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
  allow_target_photos: boolean
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
  location: string | null
}

interface InventoryTransaction {
  id: string
  inventory_item_id: string
  type: 'in' | 'out' | 'event_out'
  quantity: number
  note: string | null
  event_id: string | null
  performed_by: string | null
  created_at: string
  performer?: { full_name: string }
  event?: { title: string }
}

interface Regulation {
  id: string
  slug: string
  title: string
  content: string
  version: number
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

interface ShootingLane {
  id: string
  name: string
  length_m: number
  stations_count: number
  description: string | null
  is_active: boolean
  price_per_hour_pln: number
}

interface LaneReservation {
  id: string
  lane_id: string
  station_number: number
  member_id: string | null
  event_id: string | null
  reservation_date: string
  start_time: string
  end_time: string
  status: string
  paid: boolean
  guest_name: string | null
  notes: string | null
  member?: { full_name: string }
  event?: { title: string }
  lane?: { name: string }
}

type Tab = 'events' | 'disciplines' | 'judges' | 'registrations' | 'inventory' | 'regulations' | 'ranges' | 'instructors'

const TIME_OPTIONS: string[] = []
for (let h = 6; h <= 22; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`)
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`)
}

function TimeSelect({ value, onChange, className, required }: { value: string; onChange: (v: string) => void; className?: string; required?: boolean }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={className} required={required}>
      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
    </select>
  )
}

export default function AdminPage() {
  const { member, loading } = useAuth()
  const router = useRouter()
  const supabase = createSupabaseBrowser()

  const [tab, setTab] = useState<Tab>('events')
  const [rangeSubTab, setRangeSubTab] = useState<'lanes' | 'packages' | 'weapons'>('lanes')
  const [events, setEvents] = useState<EventRow[]>([])
  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [judges, setJudges] = useState<Member[]>([])
  const [eventJudges, setEventJudges] = useState<EventJudge[]>([])
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [guestRegs, setGuestRegs] = useState<GuestReg[]>([])
  const [memberRegs, setMemberRegs] = useState<{ id: string; event_id: string; member_id: string; registered_at: string; status: string; paid?: boolean; start_number?: number; member?: Member }[]>([])
  const [eventDisciplines, setEventDisciplines] = useState<(EventDiscipline & { discipline?: Discipline })[]>([])
  const [regDisciplines, setRegDisciplines] = useState<RegDiscipline[]>([])
  const [eventSlots, setEventSlots] = useState<EventDisciplineSlot[]>([])
  const [regulations, setRegulations] = useState<Regulation[]>([])
  const [regulationHistory, setRegulationHistory] = useState<Regulation[]>([])
  const [editingRegulation, setEditingRegulation] = useState<Regulation | null>(null)
  const [regContent, setRegContent] = useState('')
  const [historySlug, setHistorySlug] = useState<string | null>(null)
  const [savingReg, setSavingReg] = useState(false)

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

  // Results with targets preview
  const [resultsPreview, setResultsPreview] = useState<{ eventId: string; eventTitle: string; results: any[] } | null>(null)
  const [resultsLightbox, setResultsLightbox] = useState<string | null>(null)

  // Inventory
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [showInventoryForm, setShowInventoryForm] = useState(false)
  const [editingInventory, setEditingInventory] = useState<InventoryItem | null>(null)
  const [inventoryFilter, setInventoryFilter] = useState<string>('all')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [inventoryForm, setInventoryForm] = useState({
    name: '', category: 'ammunition', description: '', caliber: '', quantity: '0', unit: 'szt.',
    purchase_price_pln: '0', purchase_date: '', supplier: '', min_stock_level: '0', location: '',
  })

  // Inventory transactions
  const [showTransactionHistory, setShowTransactionHistory] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([])
  const [showStockAdjust, setShowStockAdjust] = useState<InventoryItem | null>(null)
  const [stockAdjustForm, setStockAdjustForm] = useState({ type: 'in' as 'in' | 'out', quantity: '', note: '' })

  // Online users
  const [onlineUsers, setOnlineUsers] = useState<{ id: string; full_name: string; role: string; last_seen_at: string }[]>([])
  const [showOnlineList, setShowOnlineList] = useState(false)

  // Shooting ranges
  const [shootingLanes, setShootingLanes] = useState<ShootingLane[]>([])
  const [showLaneForm, setShowLaneForm] = useState(false)
  const [editingLane, setEditingLane] = useState<ShootingLane | null>(null)
  const [laneForm, setLaneForm] = useState({ name: '', length_m: '25', stations_count: '5', description: '', price_per_hour_pln: '0', is_active: true, open_time: '08:00', close_time: '20:00', min_advance_minutes: '60' })
  const [laneReservations, setLaneReservations] = useState<LaneReservation[]>([])
  const [laneResDate, setLaneResDate] = useState(() => new Date().toISOString().split('T')[0])
  const [laneResFilter, setLaneResFilter] = useState<string>('all')
  const [showEventBlockForm, setShowEventBlockForm] = useState(false)
  const [eventBlockForm, setEventBlockForm] = useState({ lane_id: '', event_id: '', date: '', start_time: '08:00', end_time: '20:00', stations: '' })

  // Range weapons
  const [rangeWeapons, setRangeWeapons] = useState<{ id: string; name: string; type: string; caliber: string; status: string; description: string | null; inventory_ammo_id: string | null; is_active: boolean }[]>([])
  const [showWeaponForm, setShowWeaponForm] = useState(false)
  const [editingWeapon, setEditingWeapon] = useState<any | null>(null)
  const [weaponForm, setWeaponForm] = useState({ name: '', type: 'pistol', caliber: '', description: '', status: 'draft', inventory_ammo_id: '' })

  // Shooting packages CRUD
  const [shootingPackages, setShootingPackages] = useState<{ id: string; name: string; description: string | null; weapon_id: string; ammo_count: number; duration_minutes: number; price_pln: number; is_active: boolean }[]>([])
  const [showPackageForm, setShowPackageForm] = useState(false)
  const [editingPackage, setEditingPackage] = useState<any | null>(null)
  const [packageForm, setPackageForm] = useState({ name: '', description: '', weapon_id: '', ammo_count: '50', duration_minutes: '60', price_pln: '0', is_active: true })

  // Instructor schedule
  const [instructorAvailability, setInstructorAvailability] = useState<{ id: string; instructor_id: string; day_of_week: number; start_time: string; end_time: string; is_active: boolean; instructor?: { full_name: string } }[]>([])
  const [instructorsList, setInstructorsList] = useState<{ id: string; full_name: string }[]>([])
  const [showInstructorScheduleForm, setShowInstructorScheduleForm] = useState(false)
  const [instructorScheduleForm, setInstructorScheduleForm] = useState({ instructor_id: '', day_of_week: '1', start_time: '09:00', end_time: '17:00' })

  // Login history (superadmin only)
  interface LoginEntry { id: string; member_id: string | null; auth_id: string | null; email: string | null; full_name: string | null; ip_address: string | null; user_agent: string | null; event_type: string; created_at: string }
  const [loginHistory, setLoginHistory] = useState<LoginEntry[]>([])
  const [loginHistoryLoading, setLoginHistoryLoading] = useState(false)
  const [showLoginHistory, setShowLoginHistory] = useState(false)

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
  const [onsiteMode, setOnsiteMode] = useState<'member' | 'guest'>('member')
  const [onsiteMemberId, setOnsiteMemberId] = useState('')
  const [onsiteEventId, setOnsiteEventId] = useState('')
  const [onsiteDisciplineId, setOnsiteDisciplineId] = useState('')
  const [onsiteSlotId, setOnsiteSlotId] = useState('')
  const [onsiteSaving, setOnsiteSaving] = useState(false)
  const [onsiteMessage, setOnsiteMessage] = useState('')
  const [onsiteMemberSearch, setOnsiteMemberSearch] = useState('')
  const [permSearchQuery, setPermSearchQuery] = useState('')
  const [lastOnsiteReg, setLastOnsiteReg] = useState<{
    memberId: string; memberName: string; eventId: string; eventTitle: string;
    discName: string; discScoringType: string; discShotsCount: number; regId: string;
  } | null>(null)
  const [onsiteGuestForm, setOnsiteGuestForm] = useState({
    full_name: '', email: '', phone: '', has_license: false, license_number: '', club_name: '',
  })

  // Form states
  const [eventForm, setEventForm] = useState({
    title: '', description: '', event_type: 'competition' as string,
    start_day: '', start_time: '09:00', end_day: '', end_time: '17:00',
    location: '', address: '',
    max_participants: '', is_published: true, allow_target_photos: true,
  })
  const [disciplineForm, setDisciplineForm] = useState({
    name: '', description: '', target_type: '' as string, category: 'discipline' as string, default_price_pln: '0',
    own_weapon_price_pln: '0', stations_count: '0', judges_per_station: '0', participants_per_hour: '0',
    caliber: '', shots_count: '60', ammo_per_pack: '50', targets_per_competitor: '0', distance_m: '', target_name: '',
  })
  // Event disciplines management
  const [editingEventDisciplines, setEditingEventDisciplines] = useState<{ discipline_id: string; price_pln: string; own_weapon_price_pln: string }[]>([])
  // Osie do zablokowania na zawody
  const [eventLaneIds, setEventLaneIds] = useState<string[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && (!member || !['admin', 'superadmin'].includes(member.role))) {
      router.push('/')
      return
    }
    if (member?.role === 'admin' || member?.role === 'superadmin') {
      loadAll()
      loadOnlineUsers()
      const onlineInterval = setInterval(loadOnlineUsers, 30_000)
      return () => clearInterval(onlineInterval)
    }
  }, [member, loading])

  async function loadAll() {
    const [evRes, discRes, judgesRes, ejRes, membersRes, guestRes, memberRegsRes, edRes, rdRes, slotsRes, invRes, regRes] = await Promise.all([
      supabase.from('events').select('*').order('start_date', { ascending: false }),
      supabase.from('disciplines').select('*').order('name'),
      supabase.from('members').select('*').in('role', ['judge', 'admin', 'superadmin']).not('judge_license_number', 'is', null).order('full_name'),
      supabase.from('event_judges').select('*'),
      supabase.from('members').select('*').eq('is_active', true).order('full_name'),
      supabase.from('guest_registrations').select('*').order('registered_at', { ascending: false }),
      supabase.from('event_registrations').select('*, member:members(id, full_name, email, license_number, pesel, address, id_document_number, has_weapons_permit, weapon_permit_number, club_name, phone)').order('registered_at', { ascending: false }),
      supabase.from('event_disciplines').select('*, discipline:disciplines(*)').order('price_pln'),
      supabase.from('registration_disciplines').select('*'),
      supabase.from('event_discipline_slots').select('*').order('start_time'),
      supabase.from('inventory_items').select('*').order('category').order('name'),
      supabase.from('regulations').select('*').eq('is_active', true).order('updated_at', { ascending: false }),
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
    setRegulations((regRes.data ?? []) as Regulation[])
    // Also load shooting lanes, weapons, packages (needed for event lane blocking & range management)
    loadShootingLanes()
    loadShootingPackages()
  }

  async function loadOnlineUsers() {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('members')
      .select('id, full_name, role, last_seen_at')
      .gte('last_seen_at', fiveMinAgo)
      .order('last_seen_at', { ascending: false })
    setOnlineUsers((data ?? []) as typeof onlineUsers)
  }

  // ---- LOGIN HISTORY (superadmin) ----
  async function loadLoginHistory() {
    setLoginHistoryLoading(true)
    const { data } = await supabase
      .from('login_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    setLoginHistory((data ?? []) as LoginEntry[])
    setLoginHistoryLoading(false)
  }

  // ---- SHOOTING RANGES ----
  async function loadShootingLanes() {
    const { data } = await supabase.from('shooting_lanes').select('*').order('length_m')
    setShootingLanes((data ?? []) as ShootingLane[])
  }

  async function loadLaneReservations() {
    let q = supabase
      .from('lane_reservations')
      .select('*, member:members!lane_reservations_member_id_fkey(full_name), event:events(title), lane:shooting_lanes(name)')
      .eq('reservation_date', laneResDate)
      .neq('status', 'cancelled')
      .order('start_time')
    if (laneResFilter !== 'all') {
      q = q.eq('lane_id', laneResFilter)
    }
    const { data } = await q
    setLaneReservations((data ?? []) as any[])
  }

  function openNewLane() {
    setEditingLane(null)
    setLaneForm({ name: '', length_m: '25', stations_count: '5', description: '', price_per_hour_pln: '0', is_active: true, open_time: '08:00', close_time: '20:00', min_advance_minutes: '60' })
    setShowLaneForm(true)
  }

  function openEditLane(lane: ShootingLane) {
    setEditingLane(lane)
    setLaneForm({
      name: lane.name,
      length_m: String(lane.length_m),
      stations_count: String(lane.stations_count),
      description: lane.description || '',
      price_per_hour_pln: String(lane.price_per_hour_pln),
      is_active: lane.is_active,
      open_time: (lane as any).open_time?.slice(0, 5) || '08:00',
      close_time: (lane as any).close_time?.slice(0, 5) || '20:00',
      min_advance_minutes: String((lane as any).min_advance_minutes ?? 60),
    })
    setShowLaneForm(true)
  }

  async function saveLane() {
    const payload = {
      name: laneForm.name,
      length_m: parseInt(laneForm.length_m),
      stations_count: parseInt(laneForm.stations_count),
      description: laneForm.description || null,
      price_per_hour_pln: parseFloat(laneForm.price_per_hour_pln) || 0,
      is_active: laneForm.is_active,
      open_time: laneForm.open_time,
      close_time: laneForm.close_time,
      min_advance_minutes: parseInt(laneForm.min_advance_minutes) || 60,
    }
    if (editingLane) {
      await supabase.from('shooting_lanes').update(payload).eq('id', editingLane.id)
    } else {
      await supabase.from('shooting_lanes').insert(payload)
    }
    setShowLaneForm(false)
    loadShootingLanes()
  }

  async function deleteLane(id: string) {
    if (!confirm('Usunąć tę oś? Wszystkie rezerwacje zostaną usunięte.')) return
    await supabase.from('shooting_lanes').delete().eq('id', id)
    loadShootingLanes()
  }

  async function toggleResPaid(resId: string, paid: boolean) {
    await supabase.from('lane_reservations').update({ paid }).eq('id', resId)
    loadLaneReservations()
  }

  async function cancelReservation(resId: string) {
    if (!confirm('Anulować tę rezerwację?')) return
    await supabase.from('lane_reservations').update({ status: 'cancelled' }).eq('id', resId)
    loadLaneReservations()
  }

  async function blockLaneForEvent() {
    const lane = shootingLanes.find(l => l.id === eventBlockForm.lane_id)
    if (!lane || !eventBlockForm.event_id || !eventBlockForm.date) return
    const stations = eventBlockForm.stations
      ? eventBlockForm.stations.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n))
      : Array.from({ length: lane.stations_count }, (_, i) => i + 1)

    for (const sn of stations) {
      await supabase.from('lane_reservations').insert({
        lane_id: eventBlockForm.lane_id,
        station_number: sn,
        event_id: eventBlockForm.event_id,
        reservation_date: eventBlockForm.date,
        start_time: eventBlockForm.start_time,
        end_time: eventBlockForm.end_time,
        status: 'confirmed',
        paid: true,
      })
    }
    setShowEventBlockForm(false)
    loadLaneReservations()
  }

  async function loadRangeWeapons() {
    const { data } = await supabase.from('range_weapons').select('*').order('type').order('name')
    setRangeWeapons((data ?? []) as any[])
  }

  async function saveWeapon() {
    const payload = {
      name: weaponForm.name,
      type: weaponForm.type,
      caliber: weaponForm.caliber,
      description: weaponForm.description || null,
      status: weaponForm.status,
      is_active: weaponForm.status === 'in_stock',
      inventory_ammo_id: weaponForm.inventory_ammo_id || null,
    }
    if (editingWeapon) {
      await supabase.from('range_weapons').update(payload).eq('id', editingWeapon.id)
    } else {
      await supabase.from('range_weapons').insert(payload)
    }
    setShowWeaponForm(false)
    loadRangeWeapons()
  }

  async function deleteWeapon(id: string) {
    if (!confirm('Usunąć tę broń?')) return
    await supabase.from('range_weapons').delete().eq('id', id)
    loadRangeWeapons()
  }

  async function updateWeaponStatus(id: string, status: string) {
    await supabase.from('range_weapons').update({ status, is_active: status === 'in_stock' }).eq('id', id)
    loadRangeWeapons()
  }

  // Shooting packages CRUD
  async function loadShootingPackages() {
    const { data } = await supabase.from('shooting_packages').select('*').order('name')
    setShootingPackages((data ?? []) as any[])
  }

  function openNewPackage() {
    setEditingPackage(null)
    setPackageForm({ name: '', description: '', weapon_id: '', ammo_count: '50', duration_minutes: '60', price_pln: '0', is_active: true })
    setShowPackageForm(true)
  }

  function openEditPackage(pkg: any) {
    setEditingPackage(pkg)
    setPackageForm({
      name: pkg.name,
      description: pkg.description || '',
      weapon_id: pkg.weapon_id || '',
      ammo_count: String(pkg.ammo_count),
      duration_minutes: String(pkg.duration_minutes),
      price_pln: String(pkg.price_pln),
      is_active: pkg.is_active,
    })
    setShowPackageForm(true)
  }

  async function savePackage() {
    const payload = {
      name: packageForm.name,
      description: packageForm.description || null,
      weapon_id: packageForm.weapon_id || null,
      ammo_count: parseInt(packageForm.ammo_count) || 0,
      duration_minutes: parseInt(packageForm.duration_minutes) || 60,
      price_pln: parseFloat(packageForm.price_pln) || 0,
      is_active: packageForm.is_active,
    }
    if (editingPackage) {
      await supabase.from('shooting_packages').update(payload).eq('id', editingPackage.id)
    } else {
      await supabase.from('shooting_packages').insert(payload)
    }
    setShowPackageForm(false)
    loadShootingPackages()
  }

  async function deletePackage(id: string) {
    if (!confirm('Usunąć pakiet?')) return
    await supabase.from('shooting_packages').delete().eq('id', id)
    loadShootingPackages()
  }

  async function togglePackageActive(id: string, active: boolean) {
    await supabase.from('shooting_packages').update({ is_active: !active }).eq('id', id)
    loadShootingPackages()
  }

  async function loadInstructorSchedule() {
    const [availRes, instrRes] = await Promise.all([
      supabase.from('instructor_availability').select('*, instructor:members!instructor_availability_instructor_id_fkey(full_name)').order('instructor_id').order('day_of_week'),
      supabase.from('members').select('id, full_name').in('role', ['instructor', 'admin']).eq('is_active', true).order('full_name'),
    ])
    setInstructorAvailability((availRes.data ?? []) as any[])
    setInstructorsList((instrRes.data ?? []) as any[])
  }

  async function saveInstructorSchedule() {
    const { instructor_id, day_of_week, start_time, end_time } = instructorScheduleForm
    if (!instructor_id) return
    await supabase.from('instructor_availability').insert({
      instructor_id,
      day_of_week: parseInt(day_of_week),
      start_time,
      end_time,
      is_active: true,
    })
    setShowInstructorScheduleForm(false)
    loadInstructorSchedule()
  }

  async function deleteInstructorAvailability(id: string) {
    if (!confirm('Usunąć ten wpis dostępności?')) return
    await supabase.from('instructor_availability').delete().eq('id', id)
    loadInstructorSchedule()
  }

  async function toggleInstructorAvailability(id: string, isActive: boolean) {
    await supabase.from('instructor_availability').update({ is_active: isActive }).eq('id', id)
    loadInstructorSchedule()
  }

  useEffect(() => {
    if (tab === 'ranges') {
      loadShootingLanes()
      loadLaneReservations()
      loadRangeWeapons()
    }
    if (tab === 'instructors') {
      loadInstructorSchedule()
    }
  }, [tab, laneResDate, laneResFilter])

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
    const m = allMembers.find(x => x.id === memberId)
    if (!m?.judge_license_number) {
      alert(`${m?.full_name || 'Ten członek'} nie posiada licencji sędziowskiej. Licencję można dodać w profilu użytkownika.`)
      return
    }
    await supabase.from('members').update({ role: 'judge' }).eq('id', memberId)
    loadAll()
  }

  async function changeRole(memberId: string, newRole: string) {
    const m = allMembers.find(x => x.id === memberId)
    if (newRole === 'judge' && !m?.judge_license_number) {
      alert(`${m?.full_name || 'Ten członek'} nie posiada licencji sędziowskiej.\nLicencję sędziowską można dodać w profilu użytkownika.`)
      return
    }
    // Nie pozwól zdegradować admina/superadmina
    if (['admin', 'superadmin'].includes(m!.role) && !['admin', 'superadmin'].includes(newRole)) {
      alert(`Nie można zmienić roli ${m?.full_name} — administrator/superadmin jest chroniony. Zmianę może wykonać tylko bezpośrednio w bazie danych.`)
      return
    }
    if (!confirm(`Zmienić rolę ${m?.full_name || ''} na "${newRole}"?`)) return
    await supabase.from('members').update({ role: newRole }).eq('id', m!.id)
    loadAll()
  }

  function filterByPermSearch(members: Member[]): Member[] {
    if (!permSearchQuery.trim()) return members
    const q = permSearchQuery.toLowerCase().trim()
    return members.filter(m =>
      m.full_name.toLowerCase().includes(q) ||
      (m.email && m.email.toLowerCase().includes(q)) ||
      (m.license_number && m.license_number.toLowerCase().includes(q)) ||
      (m.judge_license_number && m.judge_license_number.toLowerCase().includes(q))
    )
  }

  function printSingleMetryczka(reg: NonNullable<typeof lastOnsiteReg>, startNumber?: string) {
    const { memberName, eventTitle, discName, discScoringType, discShotsCount } = reg
    const parts = memberName.trim().split(/\s+/)
    const lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0]
    const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : ''
    const dashIdx = discName.indexOf(' — ')
    const abbr = dashIdx > 0 ? discName.substring(0, dashIdx).trim() : discName.substring(0, Math.min(discName.length, 8))
    const fullDiscName = discName.includes(' — ') ? discName.split(' — ').slice(1).join(' — ') : discName
    const sn = startNumber || '0000'
    const metNr = `${abbr}/${sn}`
    const displayCount = Math.min(discShotsCount, 60) <= 10 ? Math.min(discShotsCount, 60) : 10

    let html = `<!DOCTYPE html><html><head><title>Metryczka - ${memberName}</title><style>
      @page { size: 85mm auto; margin: 2mm 3mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 12px; color: #000; width: 79mm; }
      .header { text-align: center; margin-bottom: 2mm; }
      .club-name { font-size: 14px; font-weight: bold; }
      .club-short { font-size: 20px; font-weight: 900; margin: 1mm 0; }
      .event-name { font-size: 9px; margin-bottom: 1mm; }
      .field { font-size: 10px; margin: 1mm 0; }
      .field-label { font-size: 9px; }
      .field-value { font-weight: bold; font-size: 12px; }
      .field-value-large { font-weight: 900; font-size: 14px; }
      .dotted { border-bottom: 1px dotted #000; min-height: 4mm; margin: 1mm 0; }
      .sig-section { margin-top: 2mm; }
      .sig-label { font-size: 9px; margin-top: 1mm; }
      .sig-line { border-bottom: 1px dotted #000; height: 6mm; margin-bottom: 1mm; }
      .score-grid { border-collapse: collapse; margin: 1mm auto; }
      .score-grid td { border: 1px solid #000; width: 10mm; height: 7mm; text-align: center; }
      .penalty-row { display: flex; justify-content: space-between; align-items: flex-start; margin: 1mm 0; }
      .penalty-box { border: 1px solid #000; min-width: 15mm; min-height: 6mm; display: inline-block; }
    </style></head><body>`

    html += `<div class="header"><div class="club-name">Klub Strzelecki</div><div class="club-short">CEL</div></div>`
    html += `<div class="event-name">${eventTitle}</div>`
    html += `<div class="field"><span class="field-label">Konkurencja:</span><br/>${fullDiscName}</div>`
    html += `<div class="field"><span class="field-label">Metryczka nr:</span> <span class="field-value-large">${metNr}</span></div>`
    html += `<div class="field"><span class="field-label">Nazwisko:</span> <span class="field-value">${lastName.toUpperCase()}</span></div>`
    html += `<div class="field"><span class="field-label">Imię:</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="field-value">${firstName}</span></div>`

    if (discScoringType === 'shotgun') {
      html += `<div class="field" style="margin-top:3mm"><span class="field-label">Czas konkurencji:</span></div><div class="dotted"></div>`
      html += `<div class="penalty-row"><div><span class="field-label">Ilość pudeł:</span><br/><div class="penalty-box">&nbsp;</div></div><div style="text-align:right"><span class="field-label">Kara za 1 pudło:</span><br/><span class="field-value">5 sek.</span></div></div><div class="dotted"></div>`
    } else {
      html += `<div class="field" style="margin-top:3mm"><span class="field-label">Ilość strzałów ocenianych:</span> <span class="field-value">${displayCount}</span></div>`
      html += `<div class="field" style="margin-top:2mm"><span class="field-label">Oceny:</span></div>`
      const cols = 5; const rows2 = Math.ceil(displayCount / cols)
      html += `<table class="score-grid">`
      for (let row = 0; row < rows2; row++) { html += '<tr>'; for (let col = 0; col < cols; col++) { if (row * cols + col < displayCount) html += '<td>&nbsp;</td>' }; html += '</tr>' }
      html += `</table>`
    }

    html += `<div class="sig-section"><div class="sig-line"></div><div class="sig-label">Podpis zawodnika/zawodniczki:</div></div>`
    html += `<div class="sig-section"><div class="sig-line"></div><div class="sig-label">Podpis sędziego:</div></div>`
    html += `</body></html>`

    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300) }
  }

  async function printAllMetryczki(reg: NonNullable<typeof lastOnsiteReg>) {
    // Get all disciplines this member is registered for in this event
    const memberId = reg.memberId
    const eventId = reg.eventId

    // Get member's registration
    const memberReg = memberRegs.find(r => r.event_id === eventId && r.member?.id === memberId)
    const startNumber = memberReg?.start_number ? String(memberReg.start_number).padStart(4, '0') : '0000'

    // Get their registered disciplines
    const regDiscIds = regDisciplines
      .filter(rd => rd.member_registration_id === memberReg?.id)
      .map(rd => rd.event_discipline_id)

    // Get event disciplines with discipline details
    const evDiscs = getEventDiscs(eventId)
    const applicableDiscs = regDiscIds.length > 0
      ? evDiscs.filter(ed => regDiscIds.includes(ed.id))
      : evDiscs

    // Filter only actual disciplines
    const competitionDiscs = applicableDiscs.filter(ed => {
      const disc = disciplines.find(d => d.id === ed.discipline_id)
      return disc && disc.category === 'discipline'
    })

    if (competitionDiscs.length === 0) {
      // Fallback: print only the current discipline
      printSingleMetryczka(reg, startNumber)
      return
    }

    // Build continuous metryczki (no page breaks — save paper)
    let html = `<!DOCTYPE html><html><head><title>Metryczki - ${reg.memberName}</title><style>
      @page { size: 85mm auto; margin: 2mm 3mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 12px; color: #000; width: 79mm; }
      .metryczka { width: 79mm; padding: 2mm 0; }
      .metryczka + .metryczka { border-top: 1px dashed #000; margin-top: 3mm; padding-top: 3mm; }
      .header { text-align: center; margin-bottom: 2mm; }
      .club-name { font-size: 14px; font-weight: bold; }
      .club-short { font-size: 20px; font-weight: 900; margin: 1mm 0; }
      .event-name { font-size: 9px; margin-bottom: 1mm; }
      .field { font-size: 10px; margin: 1mm 0; }
      .field-label { font-size: 9px; }
      .field-value { font-weight: bold; font-size: 12px; }
      .field-value-large { font-weight: 900; font-size: 14px; }
      .dotted { border-bottom: 1px dotted #000; min-height: 4mm; margin: 1mm 0; }
      .sig-section { margin-top: 2mm; }
      .sig-label { font-size: 9px; margin-top: 1mm; }
      .sig-line { border-bottom: 1px dotted #000; height: 6mm; margin-bottom: 1mm; }
      .score-grid { border-collapse: collapse; margin: 1mm auto; }
      .score-grid td { border: 1px solid #000; width: 10mm; height: 7mm; text-align: center; }
      .penalty-row { display: flex; justify-content: space-between; align-items: flex-start; margin: 1mm 0; }
      .penalty-box { border: 1px solid #000; min-width: 15mm; min-height: 6mm; display: inline-block; }
    </style></head><body>`

    const parts = reg.memberName.trim().split(/\s+/)
    const lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0]
    const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : ''

    for (const ed of competitionDiscs) {
      const disc = disciplines.find(d => d.id === ed.discipline_id)
      if (!disc) continue
      const discName = disc.name
      const dashIdx = discName.indexOf(' — ')
      const abbr = dashIdx > 0 ? discName.substring(0, dashIdx).trim() : discName.substring(0, Math.min(discName.length, 8))
      const fullDiscName = discName.includes(' — ') ? discName.split(' — ').slice(1).join(' — ') : discName
      const metNr = `${abbr}/${startNumber}`
      const displayCount = Math.min(disc.shots_count ?? 10, 60) <= 10 ? Math.min(disc.shots_count ?? 10, 60) : 10

      html += `<div class="metryczka">`
      html += `<div class="header"><div class="club-name">Klub Strzelecki</div><div class="club-short">CEL</div></div>`
      html += `<div class="event-name">${reg.eventTitle}</div>`
      html += `<div class="field"><span class="field-label">Konkurencja:</span><br/>${fullDiscName}</div>`
      html += `<div class="field"><span class="field-label">Metryczka nr:</span> <span class="field-value-large">${metNr}</span></div>`
      html += `<div class="field"><span class="field-label">Nazwisko:</span> <span class="field-value">${lastName.toUpperCase()}</span></div>`
      html += `<div class="field"><span class="field-label">Imię:</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="field-value">${firstName}</span></div>`

      if (disc.scoring_type === 'shotgun') {
        html += `<div class="field" style="margin-top:3mm"><span class="field-label">Czas konkurencji:</span></div><div class="dotted"></div>`
        html += `<div class="penalty-row"><div><span class="field-label">Ilość pudeł:</span><br/><div class="penalty-box">&nbsp;</div></div><div style="text-align:right"><span class="field-label">Kara za 1 pudło:</span><br/><span class="field-value">5 sek.</span></div></div><div class="dotted"></div>`
      } else {
        html += `<div class="field" style="margin-top:3mm"><span class="field-label">Ilość strzałów ocenianych:</span> <span class="field-value">${displayCount}</span></div>`
        html += `<div class="field" style="margin-top:2mm"><span class="field-label">Oceny:</span></div>`
        const cols = 5; const rows2 = Math.ceil(displayCount / cols)
        html += `<table class="score-grid">`
        for (let row = 0; row < rows2; row++) { html += '<tr>'; for (let col = 0; col < cols; col++) { if (row * cols + col < displayCount) html += '<td>&nbsp;</td>' }; html += '</tr>' }
        html += `</table>`
      }

      html += `<div class="sig-section"><div class="sig-line"></div><div class="sig-label">Podpis zawodnika/zawodniczki:</div></div>`
      html += `<div class="sig-section"><div class="sig-line"></div><div class="sig-label">Podpis sędziego:</div></div>`
      html += `</div>`
    }

    html += `</body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300) }
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
    setInventoryForm({ name: '', category: 'ammunition', description: '', caliber: '', quantity: '0', unit: 'szt.', purchase_price_pln: '0', purchase_date: '', supplier: '', min_stock_level: '0', location: '' })
    setShowInventoryForm(true)
  }
  function openEditInventory(item: InventoryItem) {
    setEditingInventory(item)
    setInventoryForm({
      name: item.name, category: item.category, description: item.description || '', caliber: item.caliber || '',
      quantity: String(item.quantity), unit: item.unit, purchase_price_pln: String(item.purchase_price_pln),
      purchase_date: item.purchase_date || '', supplier: item.supplier || '', min_stock_level: String(item.min_stock_level),
      location: item.location || '',
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
      location: inventoryForm.location || null,
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

  async function loadTransactions(itemId: string) {
    setShowTransactionHistory(itemId)
    const { data } = await supabase
      .from('inventory_transactions')
      .select('*, performer:members!inventory_transactions_performed_by_fkey(full_name), event:events!inventory_transactions_event_id_fkey(title)')
      .eq('inventory_item_id', itemId)
      .order('created_at', { ascending: false })
    setTransactions((data ?? []) as InventoryTransaction[])
  }

  async function saveStockAdjust(e: React.FormEvent) {
    e.preventDefault()
    if (!showStockAdjust || !member) return
    const qty = parseInt(stockAdjustForm.quantity)
    if (!qty || qty <= 0) return
    const item = showStockAdjust
    const newQty = stockAdjustForm.type === 'in' ? item.quantity + qty : Math.max(0, item.quantity - qty)
    await supabase.from('inventory_transactions').insert({
      inventory_item_id: item.id,
      type: stockAdjustForm.type,
      quantity: qty,
      note: stockAdjustForm.note || null,
      performed_by: member.id,
    })
    await supabase.from('inventory_items').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', item.id)
    setShowStockAdjust(null)
    loadAll()
  }

  async function settleEventMaterials(eventId: string) {
    // Check if already settled
    const { data: existing } = await supabase.from('inventory_transactions').select('id').eq('event_id', eventId).eq('type', 'event_out').limit(1)
    if (existing && existing.length > 0) {
      alert('Te zawody zostały już rozliczone.')
      return
    }
    if (!confirm('Rozliczyć materiały dla tych zawodów? Ilości zostaną automatycznie odjęte z magazynu.')) return
    const summary = getEventMaterials(eventId)
    if (!summary) return
    const errors: string[] = []
    // Deduct ammunition by caliber
    for (const [caliber, info] of summary.totals.byCaliberAmmo.entries()) {
      if (!caliber || caliber === '-') continue
      const matchingItems = inventoryItems.filter(i => i.category === 'ammunition' && i.caliber === caliber)
      if (matchingItems.length === 0) { errors.push(`Brak amunicji ${caliber} w magazynie`); continue }
      let remaining = info.total
      for (const item of matchingItems) {
        if (remaining <= 0) break
        const deduct = Math.min(remaining, item.quantity)
        await supabase.from('inventory_transactions').insert({
          inventory_item_id: item.id, type: 'event_out', quantity: deduct,
          note: `Zużycie na zawodach`, event_id: eventId, performed_by: member?.id,
        })
        await supabase.from('inventory_items').update({ quantity: item.quantity - deduct, updated_at: new Date().toISOString() }).eq('id', item.id)
        remaining -= deduct
      }
      if (remaining > 0) errors.push(`Brakuje ${remaining} szt. amunicji ${caliber}`)
    }
    // Deduct targets
    for (const [targetName, qty] of summary.totals.byTargetTarcze.entries()) {
      if (!targetName || targetName === '-') continue
      const matchingItems = inventoryItems.filter(i => i.category === 'targets' && i.name.toLowerCase().includes(targetName.toLowerCase()))
      if (matchingItems.length === 0) { errors.push(`Brak tarcz "${targetName}" w magazynie`); continue }
      let remaining = qty
      for (const item of matchingItems) {
        if (remaining <= 0) break
        const deduct = Math.min(remaining, item.quantity)
        await supabase.from('inventory_transactions').insert({
          inventory_item_id: item.id, type: 'event_out', quantity: deduct,
          note: `Zużycie na zawodach`, event_id: eventId, performed_by: member?.id,
        })
        await supabase.from('inventory_items').update({ quantity: item.quantity - deduct, updated_at: new Date().toISOString() }).eq('id', item.id)
        remaining -= deduct
      }
      if (remaining > 0) errors.push(`Brakuje ${remaining} szt. tarcz "${targetName}"`)
    }
    if (errors.length > 0) alert('Rozliczono z uwagami:\n' + errors.join('\n'))
    else alert('Materiały rozliczone pomyślnie!')
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

  // ---- PRINT START NUMBERS (naklejki) ----
  async function printStartNumbers(eventId: string) {
    const ev = events.find(e => e.id === eventId)
    if (!ev) return

    const { data: regs } = await supabase
      .from('event_registrations')
      .select('member_id, start_number, member:members(full_name, club_name, license_number)')
      .eq('event_id', eventId)
      .neq('status', 'cancelled')
      .not('start_number', 'is', null)
      .order('start_number')

    if (!regs || regs.length === 0) {
      alert('Brak zawodników z numerami startowymi')
      return
    }

    const qrBaseUrl = `START-${eventId}-`

    let html = `<!DOCTYPE html><html><head><title>Numery startowe - ${ev.title}</title><style>
      @page { size: A4; margin: 5mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; width: 210mm; }
      .card {
        width: 70mm; height: 99mm;
        border: 1px dashed #ccc;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        padding: 8mm;
        page-break-inside: avoid;
      }
      .number {
        font-size: 72px; font-weight: 900;
        line-height: 1; margin-bottom: 4mm;
        color: #000;
      }
      .name {
        font-size: 16px; font-weight: 700;
        text-align: center; margin-bottom: 2mm;
        max-width: 100%; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap;
      }
      .club {
        font-size: 12px; color: #555;
        text-align: center; margin-bottom: 3mm;
      }
      .license {
        font-size: 10px; color: #888;
        margin-bottom: 3mm;
      }
      .qr {
        width: 25mm; height: 25mm;
      }
      .event-title {
        font-size: 9px; color: #999;
        text-align: center; margin-top: 2mm;
        max-width: 100%; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap;
      }
      @media print {
        .grid { gap: 0; }
        .card { border: 1px dashed #ddd; }
      }
    </style></head><body><div class="grid">`

    for (const r of regs as any[]) {
      const sn = r.start_number
      const name = r.member?.full_name ?? '?'
      const club = r.member?.club_name ?? ''
      const license = r.member?.license_number ?? ''
      const qrData = encodeURIComponent(qrBaseUrl + sn)
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`

      html += `<div class="card">
        <div class="number">${sn}</div>
        <div class="name">${name}</div>
        <div class="club">${club}</div>
        ${license ? `<div class="license">${license}</div>` : ''}
        <img class="qr" src="${qrUrl}" alt="QR ${sn}" />
        <div class="event-title">${ev.title}</div>
      </div>`
    }

    html += `</div></body></html>`

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      // Wait for QR images to load
      setTimeout(() => printWindow.print(), 1500)
    }
  }

  // ---- VIEW EVENT RESULTS WITH TARGETS ----
  async function viewEventResults(eventId: string) {
    const ev = events.find(e => e.id === eventId)
    if (!ev) return
    const { data } = await supabase
      .from('results')
      .select('id, total_score, max_score, tens_count, misses, time_seconds, target_image_url, shot_at, member:members!results_member_id_fkey(id, full_name), discipline:disciplines(name, scoring_type)')
      .eq('event_id', eventId)
      .order('shot_at', { ascending: false })
    setResultsPreview({ eventId, eventTitle: ev.title, results: data ?? [] })
  }

  // ---- PRINT METRYCZKI (thermal printer TSP700 II, 85x110mm) ----
  async function printMetryczki(eventId: string) {
    const ev = events.find(e => e.id === eventId)
    if (!ev) return

    // Load registrations with members
    const { data: regs } = await supabase
      .from('event_registrations')
      .select('id, member_id, start_number, member:members(full_name, club_name, license_number)')
      .eq('event_id', eventId)
      .neq('status', 'cancelled')
      .order('start_number')

    if (!regs || regs.length === 0) {
      alert('Brak zawodników do wydruku metryczek')
      return
    }

    // Load event disciplines with discipline details
    const { data: evDiscsData } = await supabase
      .from('event_disciplines')
      .select('id, discipline_id, discipline:disciplines(name, scoring_type, shots_count)')
      .eq('event_id', eventId)

    // Load registration_disciplines to know which athlete is in which discipline
    const { data: regDiscs } = await supabase
      .from('registration_disciplines')
      .select('member_registration_id, event_discipline_id')
      .in('member_registration_id', regs.map(r => r.id))

    if (!evDiscsData || evDiscsData.length === 0) {
      alert('Brak dyscyplin w wydarzeniu')
      return
    }

    const dateStr = new Date(ev.start_date).toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' })

    // Extract discipline abbreviation from name like "Pcz — Pistolet centralnego zapłonu 25m" → "Pcz"
    function discAbbr(name: string): string {
      const dashIdx = name.indexOf(' — ')
      if (dashIdx > 0) return name.substring(0, dashIdx).trim()
      // For names like "Trap", "Skeet" etc.
      return name.substring(0, Math.min(name.length, 8))
    }

    // Split full_name into first name + last name
    function splitName(fullName: string): { firstName: string; lastName: string } {
      const parts = fullName.trim().split(/\s+/)
      if (parts.length === 1) return { firstName: parts[0], lastName: '' }
      const lastName = parts[parts.length - 1]
      const firstName = parts.slice(0, -1).join(' ')
      return { firstName, lastName }
    }

    // Build metryczki HTML for thermal printer (85mm continuous paper)
    let html = `<!DOCTYPE html><html><head><title>Metryczki - ${ev.title}</title><style>
      @page { size: 85mm auto; margin: 2mm 3mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Arial', sans-serif; font-size: 12px; color: #000; width: 79mm; }
      .metryczka {
        width: 79mm; padding: 2mm 0;
      }
      .metryczka + .metryczka { border-top: 1px dashed #000; margin-top: 3mm; padding-top: 3mm; }
      .header { text-align: center; margin-bottom: 2mm; }
      .club-name { font-size: 14px; font-weight: bold; }
      .club-short { font-size: 20px; font-weight: 900; margin: 1mm 0; }
      .event-name { font-size: 9px; margin-bottom: 1mm; }
      .field { font-size: 10px; margin: 1mm 0; }
      .field-label { font-size: 9px; }
      .field-value { font-weight: bold; font-size: 12px; }
      .field-value-large { font-weight: 900; font-size: 14px; }
      .dotted { border-bottom: 1px dotted #000; min-height: 4mm; margin: 1mm 0; }
      .dotted-short { border-bottom: 1px dotted #000; display: inline-block; min-width: 25mm; min-height: 4mm; }
      .sig-section { margin-top: 2mm; }
      .sig-label { font-size: 9px; margin-top: 1mm; }
      .sig-line { border-bottom: 1px dotted #000; height: 6mm; margin-bottom: 1mm; }
      .score-grid { border-collapse: collapse; margin: 1mm auto; }
      .score-grid td { border: 1px solid #000; width: 10mm; height: 7mm; text-align: center; font-size: 10px; }
      .penalty-row { display: flex; justify-content: space-between; align-items: flex-start; margin: 1mm 0; }
      .penalty-box { border: 1px solid #000; min-width: 15mm; min-height: 6mm; display: inline-block; text-align: center; }
      .catering-title { font-size: 28px; font-weight: 900; text-align: center; margin: 4mm 0; }
      .separator { border-top: 1px dashed #aaa; margin: 2mm 0; }
      @media print {
        body { width: 72mm; }
        .metryczka { page-break-after: always; }
        .metryczka:last-child { page-break-after: auto; }
      }
    </style></head><body>`

    // Build map of registration_id → discipline ids
    const regDiscMap = new Map<string, string[]>()
    for (const rd of (regDiscs ?? [])) {
      if (!rd.member_registration_id) continue
      const arr = regDiscMap.get(rd.member_registration_id) || []
      arr.push(rd.event_discipline_id)
      regDiscMap.set(rd.member_registration_id, arr)
    }

    // For each registration, print metryczki per discipline
    for (const reg of regs as any[]) {
      const memberName = reg.member?.full_name ?? 'Nieznany'
      const { firstName, lastName } = splitName(memberName)
      const startNum = String(reg.start_number ?? 0).padStart(4, '0')

      // Get disciplines for this registration
      const regDiscIds = regDiscMap.get(reg.id) || []
      // If no registration_disciplines, print for all event disciplines
      const applicableDiscs = regDiscIds.length > 0
        ? (evDiscsData as any[]).filter(ed => regDiscIds.includes(ed.id))
        : evDiscsData as any[]

      // Filter only actual disciplines (not services)
      const competitionDiscs = applicableDiscs.filter((ed: any) => {
        const disc = ed.discipline
        return disc && disc.scoring_type && disc.scoring_type !== 'service'
      })

      for (const ed of competitionDiscs) {
        const disc = (ed as any).discipline
        const discName = disc?.name ?? 'Dyscyplina'
        const scoringType = disc?.scoring_type ?? 'points'
        const shotsCount = disc?.shots_count ?? 10
        const abbr = discAbbr(discName)
        // Full discipline name (after " — " or full name)
        const fullDiscName = discName.includes(' — ') ? discName.split(' — ').slice(1).join(' — ') : discName
        const metNr = `${abbr}/${startNum}`

        html += `<div class="metryczka">`
        // Header
        html += `<div class="header">
          <div class="club-name">Klub Strzelecki</div>
          <div class="club-short">CEL</div>
        </div>`
        // Event name
        html += `<div class="event-name">${ev.title}</div>`
        // Konkurencja
        html += `<div class="field"><span class="field-label">Konkurencja:</span><br/>${fullDiscName}</div>`
        // Metryczka nr
        html += `<div class="field"><span class="field-label">Metryczka nr:</span> <span class="field-value-large">${metNr}</span></div>`
        // Nazwisko / Imię
        html += `<div class="field"><span class="field-label">Nazwisko:</span> <span class="field-value">${lastName.toUpperCase()}</span></div>`
        html += `<div class="field"><span class="field-label">Imię:</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="field-value">${firstName}</span></div>`

        if (scoringType === 'shotgun') {
          // Time-based metryczka (strzelba / dynamika)
          html += `<div class="field" style="margin-top:3mm"><span class="field-label">Czas konkurencji:</span></div>`
          html += `<div class="dotted"></div>`
          html += `<div class="penalty-row">
            <div><span class="field-label">Ilość pudeł:</span><br/><div class="penalty-box">&nbsp;</div></div>
            <div style="text-align:right"><span class="field-label">Kara za 1 pudło:</span><br/><span class="field-value">5 sek.</span></div>
          </div>`
          html += `<div class="dotted"></div>`
        } else {
          // Score-based metryczka (precyzja / punkty)
          const evalCount = Math.min(shotsCount, 60)
          const displayCount = evalCount <= 10 ? evalCount : 10
          html += `<div class="field" style="margin-top:3mm"><span class="field-label">Ilość strzałów ocenianych:</span> <span class="field-value">${displayCount}</span></div>`
          html += `<div class="field" style="margin-top:2mm"><span class="field-label">Oceny:</span></div>`
          // Grid: rows of 5
          const cols = 5
          const rows2 = Math.ceil(displayCount / cols)
          html += `<table class="score-grid">`
          for (let row = 0; row < rows2; row++) {
            html += '<tr>'
            for (let col = 0; col < cols; col++) {
              const cellNum = row * cols + col + 1
              if (cellNum <= displayCount) {
                html += '<td>&nbsp;</td>'
              }
            }
            html += '</tr>'
          }
          html += `</table>`
        }

        // Signatures
        html += `<div class="sig-section">
          <div class="sig-line"></div>
          <div class="sig-label">Podpis zawodnika/zawodniczki:</div>
        </div>`
        html += `<div class="sig-section">
          <div class="sig-line"></div>
          <div class="sig-label">Podpis sędziego:</div>
        </div>`
        html += `</div>` // end metryczka
      }

      // Catering card for each athlete
      html += `<div class="metryczka">
        <div class="header">
          <div class="club-name">Klub Strzelecki CEL</div>
          <div class="catering-title">KATERING</div>
        </div>
        <div class="event-name">${ev.title}</div>
        <div class="field">Data zawodów: ${dateStr}</div>
        <div class="field" style="margin-top:3mm"><span class="field-value">${memberName}</span></div>
        <div class="field"><span class="field-label">Nr startowy:</span> <span class="field-value">${startNum}</span></div>
      </div>`
    }

    html += `</body></html>`

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => printWindow.print(), 500)
    }
  }

  if (loading) return <div className="p-8 text-center text-muted">Ladowanie...</div>
  if (!member || !['admin', 'superadmin'].includes(member.role)) return null

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
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Panel administracyjny</h1>
        </div>
        <button
          onClick={async () => {
            if (!confirm('Przeliczyć rankingi na podstawie wszystkich wyników?')) return
            const res = await fetch('/api/rankings', { method: 'POST' })
            const data = await res.json()
            alert(data.error ? `Błąd: ${data.error}` : `Rankingi przeliczone (${data.count} pozycji)`)
          }}
          className="flex items-center gap-2 px-3 py-2 text-xs border border-border rounded-lg hover:bg-card-hover transition-colors"
        >
          <Trophy className="w-3.5 h-3.5" />
          Przelicz rankingi
        </button>
      </div>

      {/* Online users */}
      <div className="mb-6">
        <button
          onClick={() => setShowOnlineList(!showOnlineList)}
          className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl hover:bg-card-hover transition-colors w-full sm:w-auto"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
          <span className="text-sm font-medium">
            {onlineUsers.length} {onlineUsers.length === 1 ? 'osoba online' : onlineUsers.length < 5 ? 'osoby online' : 'osób online'}
          </span>
          {showOnlineList ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
        </button>
        {showOnlineList && (
          <div className="mt-2 bg-card border border-border rounded-xl overflow-hidden">
            {onlineUsers.length === 0 ? (
              <p className="text-sm text-muted px-4 py-3">Brak zalogowanych użytkowników.</p>
            ) : (
              <div className="divide-y divide-border/50">
                {onlineUsers.map(u => {
                  const roleLabels: Record<string, string> = { superadmin: 'Superadmin', admin: 'Admin', judge: 'Sędzia', member: 'Członek', registrar: 'Rejestrator', range_registrar: 'Rej. strzelnica' }
                  const roleColors: Record<string, string> = { superadmin: 'bg-red-500/20 text-red-400', admin: 'bg-primary/20 text-primary', judge: 'bg-blue-500/20 text-blue-400', member: 'bg-gray-500/20 text-gray-400', registrar: 'bg-purple-500/20 text-purple-400', range_registrar: 'bg-orange-500/20 text-orange-400' }
                  const ago = Math.round((Date.now() - new Date(u.last_seen_at).getTime()) / 60_000)
                  return (
                    <div key={u.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-success" />
                        <span className="text-sm font-medium">{u.full_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[u.role] || roleColors.member}`}>
                          {roleLabels[u.role] || u.role}
                        </span>
                      </div>
                      <span className="text-xs text-muted">
                        {ago < 1 ? 'teraz' : `${ago} min temu`}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-border overflow-x-auto">
        {[
          { key: 'events' as Tab, label: 'Zawody / Wydarzenia', icon: Calendar },
          { key: 'disciplines' as Tab, label: 'Dyscypliny', icon: Target },
          { key: 'registrations' as Tab, label: 'Zgloszenia', icon: ClipboardList },
          { key: 'judges' as Tab, label: 'Uprawnienia', icon: Users },
          { key: 'inventory' as Tab, label: 'Magazyn', icon: Package },
          { key: 'ranges' as Tab, label: 'Strzelnica', icon: Crosshair },
          { key: 'instructors' as Tab, label: 'Instruktorzy', icon: UserPlus },
          { key: 'regulations' as Tab, label: 'Regulaminy', icon: Shield },
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
                          onClick={() => viewEventResults(ev.id)}
                          className="p-2 text-muted hover:text-blue-400 rounded-lg hover:bg-card-hover"
                          title="Podgląd wyników z tarczami"
                        >
                          <Camera className="w-4 h-4" />
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
                        <>
                          <button
                            onClick={() => openAttendancePreview(ev.id)}
                            className="p-2 text-muted hover:text-primary rounded-lg hover:bg-card-hover"
                            title="Lista do podpisu"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => printStartNumbers(ev.id)}
                            className="p-2 text-muted hover:text-primary rounded-lg hover:bg-card-hover"
                            title="Drukuj numery startowe"
                          >
                            <Hash className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => printMetryczki(ev.id)}
                            className="p-2 text-muted hover:text-primary rounded-lg hover:bg-card-hover"
                            title="Drukuj metryczki (drukarka termiczna)"
                          >
                            <ClipboardList className="w-4 h-4" />
                          </button>
                        </>
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
                              {j.full_name} {j.judge_license_number ? `(${j.judge_license_number})` : ''}
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
                                {j.full_name} {j.judge_license_number ? `(${j.judge_license_number})` : ''}
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
                            <div className="mt-4 pt-3 border-t border-border/50">
                              <button onClick={() => settleEventMaterials(ev.id)} className="flex items-center gap-2 bg-primary/10 text-primary border border-primary/30 px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors">
                                <Package className="w-4 h-4" />
                                Rozlicz materiały z magazynu
                              </button>
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
                      <TimeSelect required value={eventForm.start_time} onChange={v => setEventForm(f => ({ ...f, start_time: v }))} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Data i godzina zakończenia</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" value={eventForm.end_day} min={eventForm.start_day} onChange={e => setEventForm(f => ({ ...f, end_day: e.target.value }))} className={inputClass} />
                      <TimeSelect value={eventForm.end_time} onChange={v => setEventForm(f => ({ ...f, end_time: v }))} className={inputClass} />
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

                  {/* ---- Lane blocking for events ---- */}
                  {shootingLanes.length > 0 && (
                    <div>
                      <label className="text-sm font-medium flex items-center gap-1 mb-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        Blokada osi na wydarzenie
                      </label>
                      <p className="text-xs text-muted mb-2">Wybrane osie zostaną automatycznie zarezerwowane na czas wydarzenia.</p>
                      <div className="space-y-1.5">
                        {shootingLanes.filter(l => l.is_active).map(lane => (
                          <label key={lane.id} className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-border hover:bg-card-hover transition-colors">
                            <input
                              type="checkbox"
                              checked={eventLaneIds.includes(lane.id)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setEventLaneIds(prev => [...prev, lane.id])
                                } else {
                                  setEventLaneIds(prev => prev.filter(id => id !== lane.id))
                                }
                              }}
                              className="w-4 h-4 accent-primary"
                            />
                            <span className="text-sm">{lane.name}</span>
                            <span className="text-xs text-muted ml-auto">{lane.length_m}m · {lane.stations_count} stanowisk</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={eventForm.is_published} onChange={e => setEventForm(f => ({ ...f, is_published: e.target.checked }))} className="w-4 h-4 accent-primary" />
                    <span className="text-sm">Opublikowane (widoczne w kalendarzu)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={eventForm.allow_target_photos} onChange={e => setEventForm(f => ({ ...f, allow_target_photos: e.target.checked }))} className="w-4 h-4 accent-primary" />
                    <span className="text-sm">Zezwól na zdjęcia tarczy (sędzia może fotografować tarcze)</span>
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
          <h2 className="text-lg font-semibold mb-4">Uprawnienia i role ({allMembers.length} członków)</h2>

          {/* Wyszukiwarka */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Szukaj po imieniu, nazwisku, emailu lub licencji..."
              value={permSearchQuery}
              onChange={e => setPermSearchQuery(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Sekcja: Administratorzy */}
          {(() => {
            const admins = filterByPermSearch(allMembers.filter(m => m.role === 'admin' || m.role === 'superadmin'))
            return admins.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Administratorzy ({admins.length})
                </h3>
                <div className="bg-card border border-primary/20 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {admins.map(m => (
                        <tr key={m.id} className="border-b border-border/50 last:border-0">
                          <td className="px-4 py-3 font-medium">{m.full_name}</td>
                          <td className="px-4 py-3 text-muted">{m.email}</td>
                          <td className="px-4 py-3 text-muted">{m.license_number || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.role === 'superadmin' ? 'bg-red-500/20 text-red-400' : 'bg-primary/20 text-primary'}`}>{m.role === 'superadmin' ? 'Superadmin' : 'Admin'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          {/* Sekcja: Sędziowie */}
          {(() => {
            const judgesList = filterByPermSearch(allMembers.filter(m => m.role === 'judge' || (m.judge_license_number && ['admin', 'superadmin'].includes(m.role))))
            return (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-blue-500" />
                  Sędziowie ({judgesList.length})
                </h3>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  {judgesList.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-muted">Brak sędziów. Zmień rolę członka poniżej.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted">
                          <th className="text-left px-4 py-2">Imię i nazwisko</th>
                          <th className="text-left px-4 py-2">Licencja sędziowska</th>
                          <th className="text-left px-4 py-2">Klasa</th>
                          <th className="text-left px-4 py-2">Przypisane zawody</th>
                          <th className="text-left px-4 py-2 w-28">Rola</th>
                        </tr>
                      </thead>
                      <tbody>
                        {judgesList.map(j => {
                          const assignedEvents = eventJudges
                            .filter(ej => ej.judge_id === j.id)
                            .map(ej => events.find(ev => ev.id === ej.event_id))
                            .filter(Boolean)
                          return (
                            <tr key={j.id} className="border-b border-border/50 last:border-0 hover:bg-card-hover">
                              <td className="px-4 py-2.5 font-medium">{j.full_name}</td>
                              <td className="px-4 py-2.5 text-muted">{j.judge_license_number || '-'}</td>
                              <td className="px-4 py-2.5 text-muted">{j.judge_class || '-'}</td>
                              <td className="px-4 py-2.5 text-muted text-xs">
                                {assignedEvents.length === 0 ? '-' : assignedEvents.map(e => e!.title).join(', ')}
                              </td>
                              <td className="px-4 py-2.5">
                                {['admin', 'superadmin'].includes(j.role) ? (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${j.role === 'superadmin' ? 'bg-red-500/20 text-red-400' : 'bg-primary/20 text-primary'}`}>
                                    {j.role === 'superadmin' ? 'Superadmin' : 'Admin'}
                                  </span>
                                ) : (
                                  <select
                                    value={j.role}
                                    onChange={(e) => changeRole(j.id, e.target.value)}
                                    className="bg-background border border-border rounded px-2 py-1 text-xs"
                                  >
                                    <option value="member">Członek</option>
                                    <option value="judge">Sędzia</option>
                                    <option value="registrar">Rejestrator</option>
                                    <option value="range_registrar">Rej. strzelnica</option>
                                    <option value="instructor">Instruktor</option>
                                  </select>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Sekcja: Rejestratorzy */}
          {(() => {
            const registrars = filterByPermSearch(allMembers.filter(m => m.role === 'registrar'))
            return registrars.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-green-500" />
                  Rejestratorzy ({registrars.length})
                </h3>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted">
                        <th className="text-left px-4 py-2">Imię i nazwisko</th>
                        <th className="text-left px-4 py-2">Email</th>
                        <th className="text-left px-4 py-2 w-28">Rola</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrars.map(m => (
                        <tr key={m.id} className="border-b border-border/50 last:border-0 hover:bg-card-hover">
                          <td className="px-4 py-2.5 font-medium">{m.full_name}</td>
                          <td className="px-4 py-2.5 text-muted">{m.email}</td>
                          <td className="px-4 py-2.5">
                            <select
                              value={m.role}
                              onChange={(e) => changeRole(m.id, e.target.value)}
                              className="bg-background border border-border rounded px-2 py-1 text-xs"
                            >
                              <option value="member">Członek</option>
                              <option value="judge">Sędzia</option>
                              <option value="registrar">Rejestrator</option>
                                  <option value="range_registrar">Rej. strzelnica</option>
                                  <option value="instructor">Instruktor</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          {/* Sekcja: Rejestratorzy strzelnicowi */}
          {(() => {
            const rangeRegs = filterByPermSearch(allMembers.filter(m => m.role === 'range_registrar'))
            return rangeRegs.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-orange-500" />
                  Rejestratorzy strzelnicowi ({rangeRegs.length})
                </h3>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted">
                        <th className="text-left px-4 py-2">Imię i nazwisko</th>
                        <th className="text-left px-4 py-2">Email</th>
                        <th className="text-left px-4 py-2 w-28">Rola</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rangeRegs.map(m => (
                        <tr key={m.id} className="border-b border-border/50 last:border-0 hover:bg-card-hover">
                          <td className="px-4 py-2.5 font-medium">{m.full_name}</td>
                          <td className="px-4 py-2.5 text-muted">{m.email}</td>
                          <td className="px-4 py-2.5">
                            <select
                              value={m.role}
                              onChange={(e) => changeRole(m.id, e.target.value)}
                              className="bg-background border border-border rounded px-2 py-1 text-xs"
                            >
                              <option value="member">Członek</option>
                              <option value="judge">Sędzia</option>
                              <option value="registrar">Rejestrator</option>
                              <option value="range_registrar">Rej. strzelnica</option>
                                  <option value="instructor">Instruktor</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          {/* Sekcja: Instruktorzy */}
          {(() => {
            const instructors = filterByPermSearch(allMembers.filter(m => m.role === 'instructor'))
            return instructors.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-500" />
                  Instruktorzy ({instructors.length})
                </h3>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted">
                        <th className="text-left px-4 py-2">Imię i nazwisko</th>
                        <th className="text-left px-4 py-2">Email</th>
                        <th className="text-left px-4 py-2">Licencja instruktora</th>
                        <th className="text-left px-4 py-2">Prow. strzelanie</th>
                        <th className="text-left px-4 py-2 w-28">Rola</th>
                      </tr>
                    </thead>
                    <tbody>
                      {instructors.map(m => (
                        <tr key={m.id} className="border-b border-border/50 last:border-0 hover:bg-card-hover">
                          <td className="px-4 py-2.5 font-medium">{m.full_name}</td>
                          <td className="px-4 py-2.5 text-muted">{m.email}</td>
                          <td className="px-4 py-2.5">
                            <input
                              type="text"
                              defaultValue={(m as any).instructor_license || ''}
                              placeholder="Nr licencji..."
                              onBlur={async (e) => {
                                const val = e.target.value.trim()
                                await supabase.from('members').update({ instructor_license: val || null }).eq('id', m.id)
                              }}
                              className="bg-background border border-border rounded px-2 py-1 text-xs w-full max-w-[140px]"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                defaultChecked={(m as any).has_shooting_leader || false}
                                onChange={async (e) => {
                                  await supabase.from('members').update({ has_shooting_leader: e.target.checked }).eq('id', m.id)
                                }}
                                className="w-3.5 h-3.5 accent-green-500"
                              />
                              <span className="text-xs text-muted">Prow. strzelanie</span>
                            </label>
                          </td>
                          <td className="px-4 py-2.5">
                            <select
                              value={m.role}
                              onChange={(e) => changeRole(m.id, e.target.value)}
                              className="bg-background border border-border rounded px-2 py-1 text-xs"
                            >
                              <option value="member">Członek</option>
                              <option value="judge">Sędzia</option>
                              <option value="registrar">Rejestrator</option>
                              <option value="range_registrar">Rej. strzelnica</option>
                              <option value="instructor">Instruktor</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          {/* Sekcja: Członkowie (bez specjalnych uprawnień) */}
          {(() => {
            const members = filterByPermSearch(allMembers.filter(m => m.role === 'member'))
            return (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted" />
                  Członkowie ({members.length})
                </h3>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted">
                        <th className="text-left px-4 py-2">Imię i nazwisko</th>
                        <th className="text-left px-4 py-2">Email</th>
                        <th className="text-left px-4 py-2">Licencja</th>
                        <th className="text-left px-4 py-2 w-28">Rola</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map(m => (
                        <tr key={m.id} className="border-b border-border/50 last:border-0 hover:bg-card-hover">
                          <td className="px-4 py-2.5 font-medium">{m.full_name}</td>
                          <td className="px-4 py-2.5 text-muted">{m.email}</td>
                          <td className="px-4 py-2.5 text-muted">{m.license_number || '-'}</td>
                          <td className="px-4 py-2.5">
                            <select
                              value={m.role}
                              onChange={(e) => changeRole(m.id, e.target.value)}
                              className="bg-background border border-border rounded px-2 py-1 text-xs"
                            >
                              <option value="member">Członek</option>
                              <option value="judge">Sędzia</option>
                              <option value="registrar">Rejestrator</option>
                                  <option value="range_registrar">Rej. strzelnica</option>
                                  <option value="instructor">Instruktor</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}
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
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    Rejestracja na miejscu
                  </h3>
                  <div className="flex bg-background rounded-lg p-0.5 border border-border">
                    <button
                      onClick={() => { setOnsiteMode('member'); setOnsiteMessage('') }}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${onsiteMode === 'member' ? 'bg-primary text-background font-semibold' : 'text-muted hover:text-foreground'}`}
                    >
                      Członek
                    </button>
                    <button
                      onClick={() => { setOnsiteMode('guest'); setOnsiteMessage('') }}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${onsiteMode === 'guest' ? 'bg-primary text-background font-semibold' : 'text-muted hover:text-foreground'}`}
                    >
                      Gość
                    </button>
                  </div>
                </div>

                {/* Row 1: Event + Discipline + Slot (shared) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
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
                  <div>
                    <label className="text-xs text-muted block mb-1">Slot (opcjonalnie)</label>
                    <select
                      value={onsiteSlotId}
                      onChange={e => setOnsiteSlotId(e.target.value)}
                      className={inputClass + ' text-xs'}
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

                {/* Row 2: Member or Guest specific */}
                {onsiteMode === 'member' ? (
                  <div className="relative">
                    <label className="text-xs text-muted block mb-1">Członek</label>
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
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">Imię i nazwisko *</label>
                      <input
                        type="text"
                        value={onsiteGuestForm.full_name}
                        onChange={e => setOnsiteGuestForm(f => ({ ...f, full_name: e.target.value }))}
                        className={inputClass + ' text-xs'}
                        placeholder="Jan Kowalski"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Klub (opcjonalnie)</label>
                      <input
                        type="text"
                        value={onsiteGuestForm.club_name}
                        onChange={e => setOnsiteGuestForm(f => ({ ...f, club_name: e.target.value }))}
                        className={inputClass + ' text-xs'}
                        placeholder="Nazwa klubu"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Email (opcjonalnie)</label>
                      <input
                        type="email"
                        value={onsiteGuestForm.email}
                        onChange={e => setOnsiteGuestForm(f => ({ ...f, email: e.target.value }))}
                        className={inputClass + ' text-xs'}
                        placeholder="jan@example.com"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Telefon (opcjonalnie)</label>
                      <input
                        type="tel"
                        value={onsiteGuestForm.phone}
                        onChange={e => setOnsiteGuestForm(f => ({ ...f, phone: e.target.value }))}
                        className={inputClass + ' text-xs'}
                        placeholder="+48 123 456 789"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Pozwolenie na broń</label>
                      <div className="flex items-center gap-3 mt-1">
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={onsiteGuestForm.has_license}
                            onChange={e => setOnsiteGuestForm(f => ({ ...f, has_license: e.target.checked }))}
                            className="rounded border-border"
                          />
                          Posiada
                        </label>
                        {onsiteGuestForm.has_license && (
                          <input
                            type="text"
                            value={onsiteGuestForm.license_number}
                            onChange={e => setOnsiteGuestForm(f => ({ ...f, license_number: e.target.value }))}
                            className={inputClass + ' text-xs flex-1'}
                            placeholder="Nr pozwolenia"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <button
                    onClick={onsiteMode === 'member' ? quickRegisterOnsite : quickRegisterGuestOnsite}
                    disabled={onsiteSaving || !onsiteEventId || !onsiteDisciplineId || (onsiteMode === 'member' ? !onsiteMemberId : !onsiteGuestForm.full_name)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-background text-xs font-semibold rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {onsiteSaving ? 'Rejestrowanie...' : onsiteMode === 'member' ? 'Zarejestruj członka' : 'Zarejestruj gościa'}
                  </button>
                  {onsiteMessage && (
                    <p className={`text-xs ${onsiteMessage.includes('✅') ? 'text-green-400' : 'text-danger'}`}>
                      {onsiteMessage}
                    </p>
                  )}
                </div>

                {/* Po rejestracji: drukuj metryczkę */}
                {lastOnsiteReg && (
                  <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-xs text-green-400 font-medium mb-2">
                      Zarejestrowano: {lastOnsiteReg.memberName} — {lastOnsiteReg.discName}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => printSingleMetryczka(lastOnsiteReg)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border text-xs rounded-lg hover:border-primary hover:text-primary transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Drukuj metryczkę
                      </button>
                      <button
                        onClick={() => printAllMetryczki(lastOnsiteReg)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border text-xs rounded-lg hover:border-primary hover:text-primary transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Drukuj wszystkie dyscypliny
                      </button>
                      <button
                        onClick={() => setLastOnsiteReg(null)}
                        className="text-xs text-muted hover:text-foreground px-2 py-1.5"
                      >
                        Zamknij
                      </button>
                    </div>
                  </div>
                )}

                {/* Lista zarejestrowanych na bieżące zawody */}
                {onsiteEventId && (() => {
                  const evMRegs = memberRegs.filter(r => r.event_id === onsiteEventId && r.status !== 'cancelled')
                  const evGRegs = guestRegs.filter(r => r.event_id === onsiteEventId && r.status !== 'cancelled')
                  const allRegs = [
                    ...evMRegs.map(r => ({ id: r.id, name: (r.member as any)?.full_name ?? '?', type: 'member' as const, paid: (r as any).paid, startNumber: r.start_number, memberId: (r.member as any)?.id })),
                    ...evGRegs.map(r => ({ id: r.id, name: r.full_name, type: 'guest' as const, paid: false, startNumber: null, memberId: '' })),
                  ]
                  if (allRegs.length === 0) return null
                  return (
                    <div className="mt-4 border-t border-border pt-3">
                      <p className="text-xs font-semibold text-muted mb-2">Zarejestrowani ({allRegs.length}):</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {allRegs.map(reg => {
                          const discIds = reg.type === 'member'
                            ? regDisciplines.filter(rd => rd.member_registration_id === reg.id).map(rd => rd.event_discipline_id)
                            : regDisciplines.filter(rd => rd.guest_registration_id === reg.id).map(rd => rd.event_discipline_id)
                          const discNames = discIds.map(did => {
                            const ed = eventDisciplines.find(e => e.id === did)
                            return ed ? (disciplines.find(d => d.id === ed.discipline_id)?.name ?? '') : ''
                          }).filter(Boolean)

                          return (
                            <div key={reg.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-card-hover">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${reg.type === 'member' ? 'bg-primary/20 text-primary' : 'bg-blue-500/20 text-blue-400'}`}>
                                  {reg.startNumber ?? (reg.type === 'member' ? 'CZŁ' : 'G')}
                                </span>
                                <span className="font-medium truncate">{reg.name}</span>
                                <span className="text-muted truncate">{discNames.join(', ')}</span>
                                {reg.paid && <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-success/20 text-success">PLN</span>}
                              </div>
                              <button
                                onClick={() => {
                                  const evDiscs = getEventDiscs(onsiteEventId)
                                  const applicableDiscs = discIds.length > 0 ? evDiscs.filter(ed => discIds.includes(ed.id)) : evDiscs
                                  const competitionDiscs = applicableDiscs.filter(ed => {
                                    const disc = disciplines.find(d => d.id === ed.discipline_id)
                                    return disc && disc.category === 'discipline'
                                  })
                                  if (competitionDiscs.length === 0) return
                                  const firstDisc = disciplines.find(d => d.id === competitionDiscs[0].discipline_id)
                                  const sn = reg.startNumber ? String(reg.startNumber).padStart(4, '0') : '0000'
                                  const regData = {
                                    memberId: reg.memberId ?? '',
                                    memberName: reg.name,
                                    eventId: onsiteEventId,
                                    eventTitle: events.find(e => e.id === onsiteEventId)?.title ?? '',
                                    discName: firstDisc?.name ?? '',
                                    discScoringType: firstDisc?.scoring_type ?? 'points',
                                    discShotsCount: firstDisc?.shots_count ?? 10,
                                    regId: reg.id,
                                  }
                                  competitionDiscs.length === 1 ? printSingleMetryczka(regData, sn) : printAllMetryczki(regData)
                                }}
                                className="shrink-0 p-1 text-muted hover:text-primary rounded hover:bg-card-hover"
                                title="Drukuj metryczki"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
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
                  <button
                    onClick={() => viewEventResults(ev.id)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors font-medium"
                    title="Podgląd wyników i tarcz"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Wyniki / Tarcze
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
                              {(r as any).paid
                                ? <span className="text-xs px-2 py-0.5 rounded-full bg-success/20 text-success ml-1">Opłacono</span>
                                : total > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning ml-1">Nieopłacono</span>
                              }
                            </td>
                            <td className="px-4 py-2 text-right">
                              <div className="flex items-center justify-end gap-1 flex-wrap">
                                {!(r as any).paid && total > 0 && (
                                  <button
                                    onClick={async () => {
                                      if (!confirm(`Zapłacono gotówką: ${(r.member as any)?.full_name} — ${total.toFixed(0)} zł?`)) return
                                      await supabase.from('event_registrations').update({ paid: true }).eq('id', r.id)
                                      loadAll()
                                    }}
                                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-success/10 text-success border border-success/30 rounded-lg hover:bg-success/20 transition-colors font-medium"
                                  >
                                    <DollarSign className="w-3 h-3" />
                                    Gotówka {total.toFixed(0)} zł
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    const member = (r.member as any)
                                    const discIds = regDisciplines.filter(rd => rd.member_registration_id === r.id).map(rd => rd.event_discipline_id)
                                    const evDiscs = getEventDiscs(ev.id)
                                    const applicableDiscs = discIds.length > 0 ? evDiscs.filter(ed => discIds.includes(ed.id)) : evDiscs
                                    const competitionDiscs = applicableDiscs.filter(ed => {
                                      const disc = disciplines.find(d => d.id === ed.discipline_id)
                                      return disc && disc.category === 'discipline'
                                    })
                                    if (competitionDiscs.length === 0) return alert('Brak dyscyplin do wydruku')
                                    const sn = r.start_number ? String(r.start_number).padStart(4, '0') : '0000'
                                    const firstDisc = disciplines.find(d => d.id === competitionDiscs[0].discipline_id)
                                    const regData = {
                                      memberId: member?.id ?? '',
                                      memberName: member?.full_name ?? '?',
                                      eventId: ev.id,
                                      eventTitle: ev.title,
                                      discName: firstDisc?.name ?? '',
                                      discScoringType: firstDisc?.scoring_type ?? 'points',
                                      discShotsCount: firstDisc?.shots_count ?? 10,
                                      regId: r.id,
                                    }
                                    if (competitionDiscs.length === 1) {
                                      printSingleMetryczka(regData, sn)
                                    } else {
                                      printAllMetryczki(regData)
                                    }
                                  }}
                                  className="flex items-center gap-1 text-xs px-2 py-1.5 border border-border rounded-lg hover:border-primary hover:text-primary transition-colors"
                                  title="Drukuj metryczki"
                                >
                                  <Printer className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
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
                              <div className="flex items-center justify-end gap-1 flex-wrap">
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
                                <button
                                  onClick={() => {
                                    const discIds = regDisciplines.filter(rd => rd.guest_registration_id === r.id).map(rd => rd.event_discipline_id)
                                    const evDiscs = getEventDiscs(ev.id)
                                    const applicableDiscs = discIds.length > 0 ? evDiscs.filter(ed => discIds.includes(ed.id)) : evDiscs
                                    const competitionDiscs = applicableDiscs.filter(ed => {
                                      const disc = disciplines.find(d => d.id === ed.discipline_id)
                                      return disc && disc.category === 'discipline'
                                    })
                                    if (competitionDiscs.length === 0) return alert('Brak dyscyplin do wydruku')
                                    const firstDisc = disciplines.find(d => d.id === competitionDiscs[0].discipline_id)
                                    const regData = {
                                      memberId: '',
                                      memberName: r.full_name,
                                      eventId: ev.id,
                                      eventTitle: ev.title,
                                      discName: firstDisc?.name ?? '',
                                      discScoringType: firstDisc?.scoring_type ?? 'points',
                                      discShotsCount: firstDisc?.shots_count ?? 10,
                                      regId: r.id,
                                    }
                                    if (competitionDiscs.length === 1) {
                                      printSingleMetryczka(regData, '0000')
                                    } else {
                                      printAllMetryczki(regData)
                                    }
                                  }}
                                  className="p-1.5 text-muted hover:text-primary rounded hover:bg-card-hover"
                                  title="Drukuj metryczki"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
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
                                {item.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{item.location}</span>}
                                {item.purchase_date && <span>Zakup: {new Date(item.purchase_date).toLocaleDateString('pl')}</span>}
                                {item.supplier && <span>Dostawca: {item.supplier}</span>}
                                {item.min_stock_level > 0 && <span>Min. stan: {item.min_stock_level} {item.unit}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => { setShowStockAdjust(item); setStockAdjustForm({ type: 'in', quantity: '', note: '' }) }} className="p-2 text-muted hover:text-success rounded-lg hover:bg-card-hover" title="Wydaj / Przyjmij">
                                <ArrowDownUp className="w-4 h-4" />
                              </button>
                              <button onClick={() => loadTransactions(item.id)} className="p-2 text-muted hover:text-primary rounded-lg hover:bg-card-hover" title="Historia">
                                <History className="w-4 h-4" />
                              </button>
                              <button onClick={() => openEditInventory(item)} className="p-2 text-muted hover:text-primary rounded-lg hover:bg-card-hover" title="Edytuj">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => deleteInventory(item.id)} className="p-2 text-muted hover:text-danger rounded-lg hover:bg-card-hover" title="Usuń">
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
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">Dostawca</label>
                      <input value={inventoryForm.supplier} onChange={e => setInventoryForm(f => ({ ...f, supplier: e.target.value }))} placeholder="np. Kolter Wrocław" className={inputClass} />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Lokalizacja</label>
                      <input value={inventoryForm.location} onChange={e => setInventoryForm(f => ({ ...f, location: e.target.value }))} placeholder="np. Magazyn A, Szafa 3" className={inputClass} />
                    </div>
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

          {/* Transaction History Modal */}
          {showTransactionHistory && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold flex items-center gap-2">
                    <History className="w-5 h-5 text-primary" />
                    Historia wydań — {inventoryItems.find(i => i.id === showTransactionHistory)?.name}
                  </h2>
                  <button onClick={() => setShowTransactionHistory(null)} className="p-2 text-muted hover:text-foreground rounded-lg hover:bg-card-hover">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {transactions.length === 0 ? (
                  <p className="text-muted text-center py-8">Brak historii transakcji.</p>
                ) : (
                  <div className="space-y-2">
                    {transactions.map(tx => {
                      const typeLabels: Record<string, string> = { in: 'Przyjęcie', out: 'Wydanie', event_out: 'Zawody' }
                      const typeColors: Record<string, string> = { in: 'bg-success/20 text-success', out: 'bg-orange-500/20 text-orange-400', event_out: 'bg-blue-500/20 text-blue-400' }
                      return (
                        <div key={tx.id} className="flex items-center gap-3 bg-background border border-border/50 rounded-lg p-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[tx.type] || ''}`}>
                            {tx.type === 'in' ? '+' : '-'}{tx.quantity} {inventoryItems.find(i => i.id === showTransactionHistory)?.unit || 'szt.'}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[tx.type] || ''}`}>
                            {typeLabels[tx.type] || tx.type}
                          </span>
                          <div className="flex-1 min-w-0">
                            {tx.note && <span className="text-sm">{tx.note}</span>}
                            {tx.event && <span className="text-xs text-muted ml-2">({tx.event.title})</span>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-xs text-muted">{new Date(tx.created_at).toLocaleDateString('pl')} {new Date(tx.created_at).toLocaleTimeString('pl', { hour: '2-digit', minute: '2-digit' })}</div>
                            {tx.performer && <div className="text-xs text-muted">{tx.performer.full_name}</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stock Adjustment Modal */}
          {showStockAdjust && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
                <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
                  <ArrowDownUp className="w-5 h-5 text-primary" />
                  Wydanie / Przyjęcie
                </h2>
                <p className="text-sm text-muted mb-4">{showStockAdjust.name} — stan: {showStockAdjust.quantity} {showStockAdjust.unit}</p>
                <form onSubmit={saveStockAdjust} className="space-y-4">
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setStockAdjustForm(f => ({ ...f, type: 'in' }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${stockAdjustForm.type === 'in' ? 'border-success bg-success/10 text-success' : 'border-border text-muted hover:text-foreground'}`}>
                      + Przyjęcie
                    </button>
                    <button type="button" onClick={() => setStockAdjustForm(f => ({ ...f, type: 'out' }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${stockAdjustForm.type === 'out' ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-border text-muted hover:text-foreground'}`}>
                      - Wydanie
                    </button>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Ilość *</label>
                    <input type="number" min="1" required value={stockAdjustForm.quantity} onChange={e => setStockAdjustForm(f => ({ ...f, quantity: e.target.value }))} className={inputClass} placeholder="Wpisz ilość" />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Notatka</label>
                    <input value={stockAdjustForm.note} onChange={e => setStockAdjustForm(f => ({ ...f, note: e.target.value }))} className={inputClass} placeholder="np. Zakup, wydanie na trening" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button type="submit" className="flex-1 bg-primary text-background font-semibold py-2 rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2">
                      <Save className="w-4 h-4" />
                      Zapisz
                    </button>
                    <button type="button" onClick={() => setShowStockAdjust(null)} className="flex-1 border border-border text-foreground font-semibold py-2 rounded-lg hover:bg-card-hover transition-colors">
                      Anuluj
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
      {/* ============ INSTRUCTORS TAB ============ */}
      {tab === 'instructors' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Grafik instruktorów</h2>
            <button
              onClick={() => {
                setInstructorScheduleForm({ instructor_id: instructorsList[0]?.id || '', day_of_week: '1', start_time: '09:00', end_time: '17:00' })
                setShowInstructorScheduleForm(true)
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors"
            >
              <Plus className="w-4 h-4" />
              Dodaj dostępność
            </button>
          </div>

          {instructorAvailability.length === 0 ? (
            <p className="text-muted text-sm py-4">Brak zdefiniowanego grafiku instruktorów.</p>
          ) : (
            <div className="space-y-3">
              {(() => {
                const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota']
                const grouped = new Map<string, typeof instructorAvailability>()
                for (const avail of instructorAvailability) {
                  const name = (avail.instructor as any)?.full_name || 'Nieznany'
                  if (!grouped.has(name)) grouped.set(name, [])
                  grouped.get(name)!.push(avail)
                }
                return Array.from(grouped.entries()).map(([name, avails]) => (
                  <div key={name} className="bg-card border border-border rounded-xl p-4">
                    <h4 className="font-semibold text-sm mb-2">{name}</h4>
                    <div className="flex flex-wrap gap-2">
                      {avails.sort((a, b) => a.day_of_week - b.day_of_week).map(avail => (
                        <div
                          key={avail.id}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                            avail.is_active
                              ? 'border-green-500/30 bg-green-500/5 text-green-400'
                              : 'border-border bg-background text-muted line-through'
                          }`}
                        >
                          <span className="font-medium">{dayNames[avail.day_of_week]}</span>
                          <span>{avail.start_time.slice(0, 5)}–{avail.end_time.slice(0, 5)}</span>
                          <button
                            onClick={() => toggleInstructorAvailability(avail.id, !avail.is_active)}
                            className="ml-1 p-0.5 rounded hover:bg-background"
                            title={avail.is_active ? 'Wyłącz' : 'Włącz'}
                          >
                            {avail.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => deleteInstructorAvailability(avail.id)}
                            className="p-0.5 rounded hover:bg-background text-red-500"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}

          {/* Lista instruktorów */}
          <div className="border-t border-border pt-6 mt-6">
            <h3 className="text-lg font-semibold mb-4">Instruktorzy ({allMembers.filter(m => m.role === 'instructor').length})</h3>
            {(() => {
              const instructors = allMembers.filter(m => m.role === 'instructor')
              return instructors.length === 0 ? (
                <p className="text-muted text-sm">Brak instruktorów. Zmień rolę członka na &quot;Instruktor&quot; w zakładce Uprawnienia.</p>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {instructors.map(i => (
                    <div key={i.id} className="bg-card border border-border rounded-xl p-4">
                      <p className="font-semibold text-sm">{i.full_name}</p>
                      <p className="text-xs text-muted">{i.email}</p>
                      <p className="text-xs text-muted mt-1">{i.phone || 'Brak telefonu'}</p>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Regulations Tab */}
      {tab === 'regulations' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Regulaminy i zasady</h2>
          </div>

          {/* Active regulations list */}
          <div className="space-y-3">
            {regulations.map(reg => (
              <div key={reg.id} className="bg-card border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">{reg.title}</h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">v{reg.version}</span>
                      <span>Slug: {reg.slug}</span>
                      <span>Ostatnia zmiana: {new Date(reg.updated_at).toLocaleDateString('pl-PL')}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        setHistorySlug(historySlug === reg.slug ? null : reg.slug)
                        if (historySlug !== reg.slug) {
                          const { data } = await supabase
                            .from('regulations')
                            .select('*')
                            .eq('slug', reg.slug)
                            .order('version', { ascending: false })
                          setRegulationHistory((data ?? []) as Regulation[])
                        }
                      }}
                      className="px-3 py-1.5 text-xs rounded border border-border hover:bg-card-hover transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5 inline mr-1" />
                      Historia
                    </button>
                    <button
                      onClick={() => {
                        setEditingRegulation(reg)
                        setRegContent(reg.content)
                      }}
                      className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5 inline mr-1" />
                      Edytuj
                    </button>
                  </div>
                </div>

                {/* Version history */}
                {historySlug === reg.slug && (
                  <div className="mt-4 border-t border-border pt-4">
                    <h4 className="text-sm font-medium mb-2">Historia wersji</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {regulationHistory.map(ver => (
                        <div key={ver.id} className={`flex items-center justify-between p-2 rounded text-xs ${ver.is_active ? 'bg-primary/10 border border-primary/30' : 'bg-background'}`}>
                          <div>
                            <span className="font-medium">v{ver.version}</span>
                            <span className="text-muted ml-2">{new Date(ver.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            {ver.is_active && <span className="ml-2 text-primary font-medium">(aktualna)</span>}
                          </div>
                          {!ver.is_active && (
                            <button
                              onClick={async () => {
                                if (!confirm(`Przywrócić wersję ${ver.version}?`)) return
                                setSavingReg(true)
                                await supabase.from('regulations').update({ is_active: false }).eq('slug', reg.slug).eq('is_active', true)
                                await supabase.from('regulations').insert({
                                  slug: reg.slug,
                                  title: reg.title,
                                  content: ver.content,
                                  version: reg.version + 1,
                                  is_active: true,
                                  created_by: member?.id || null,
                                })
                                setSavingReg(false)
                                setHistorySlug(null)
                                loadAll()
                              }}
                              className="px-2 py-1 rounded border border-border hover:bg-card-hover transition-colors"
                              disabled={savingReg}
                            >
                              Przywróć
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Inline editor */}
                {editingRegulation?.id === reg.id && (
                  <div className="mt-4 border-t border-border pt-4">
                    <textarea
                      value={regContent}
                      onChange={e => setRegContent(e.target.value)}
                      rows={15}
                      className="w-full p-3 bg-background border border-border rounded-lg text-sm font-mono resize-y"
                      placeholder="Treść regulaminu (HTML dozwolony)..."
                    />
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-xs text-muted">Zapisanie utworzy nową wersję (v{reg.version + 1})</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setEditingRegulation(null); setRegContent('') }}
                          className="px-3 py-1.5 text-xs rounded border border-border hover:bg-card-hover transition-colors"
                        >
                          Anuluj
                        </button>
                        <button
                          onClick={async () => {
                            if (regContent.trim() === reg.content.trim()) {
                              alert('Nie wprowadzono żadnych zmian.')
                              return
                            }
                            setSavingReg(true)
                            await supabase.from('regulations').update({ is_active: false }).eq('id', reg.id)
                            await supabase.from('regulations').insert({
                              slug: reg.slug,
                              title: reg.title,
                              content: regContent,
                              version: reg.version + 1,
                              is_active: true,
                              created_by: member?.id || null,
                            })
                            setSavingReg(false)
                            setEditingRegulation(null)
                            setRegContent('')
                            loadAll()
                          }}
                          disabled={savingReg}
                          className="px-4 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                          {savingReg ? 'Zapisywanie...' : 'Zapisz nową wersję'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {regulations.length === 0 && (
              <p className="text-muted text-center py-8">Brak regulaminów w bazie danych.</p>
            )}
          </div>
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

      {/* ============ RANGES TAB ============ */}
      {tab === 'ranges' && (
        <div>
          {/* Sub-tabs */}
          <div className="flex gap-2 mb-6 border-b border-border">
            {[
              { key: 'lanes', label: 'Osie i rezerwacje', icon: Crosshair },
              { key: 'packages', label: 'Pakiety', icon: Package },
              { key: 'weapons', label: 'Broń klubowa', icon: Target },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setRangeSubTab(key as any)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
                  rangeSubTab === key
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Sub-tab: Osie i rezerwacje */}
          {rangeSubTab === 'lanes' && (
          <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Osie strzeleckie ({shootingLanes.length})</h2>
            <div className="flex gap-2">
              <button onClick={() => { setShowEventBlockForm(true); setEventBlockForm({ lane_id: shootingLanes[0]?.id || '', event_id: '', date: '', start_time: '08:00', end_time: '20:00', stations: '' }) }} className="flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium rounded-lg hover:bg-card transition-colors">
                <Ban className="w-4 h-4" />
                Zablokuj na zawody
              </button>
              <button onClick={openNewLane} className="flex items-center gap-2 px-4 py-2 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors">
                <Plus className="w-4 h-4" />
                Dodaj oś
              </button>
            </div>
          </div>

          {/* Lista osi */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {shootingLanes.map(lane => (
              <div key={lane.id} className={`bg-card border rounded-xl p-4 ${lane.is_active ? 'border-border' : 'border-red-500/30 opacity-60'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{lane.name}</h3>
                  <div className="flex gap-1">
                    <button onClick={() => openEditLane(lane)} className="p-1.5 rounded hover:bg-background"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteLane(lane.id)} className="p-1.5 rounded hover:bg-background text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="space-y-1 text-sm text-muted">
                  <p>Długość: <span className="text-foreground font-medium">{lane.length_m}m</span></p>
                  <p>Stanowiska: <span className="text-foreground font-medium">{lane.stations_count}</span></p>
                  <p>Godziny: <span className="text-foreground font-medium">{(lane as any).open_time?.slice(0,5) || '08:00'} – {(lane as any).close_time?.slice(0,5) || '20:00'}</span></p>
                  <p>Cena: <span className="text-foreground font-medium">{lane.price_per_hour_pln > 0 ? `${lane.price_per_hour_pln} zł/h` : 'bezpłatne'}</span></p>
                  {lane.description && <p className="text-xs">{lane.description}</p>}
                  {!lane.is_active && <span className="inline-block px-2 py-0.5 bg-red-500/10 text-red-500 text-xs rounded">Nieaktywna</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Rezerwacje na dany dzień */}
          <div className="border-t border-border pt-6">
            <h3 className="text-lg font-semibold mb-4">Rezerwacje</h3>
            <div className="flex gap-3 mb-4">
              <input
                type="date"
                value={laneResDate}
                onChange={e => setLaneResDate(e.target.value)}
                className="px-3 py-2 bg-card border border-border rounded-lg text-sm"
              />
              <select
                value={laneResFilter}
                onChange={e => setLaneResFilter(e.target.value)}
                className="px-3 py-2 bg-card border border-border rounded-lg text-sm"
              >
                <option value="all">Wszystkie osie</option>
                {shootingLanes.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            {laneReservations.length === 0 ? (
              <p className="text-muted text-sm py-4">Brak rezerwacji na wybrany dzień.</p>
            ) : (
              <div className="space-y-2">
                {laneReservations.map(res => (
                  <div key={res.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-2 h-8 rounded-full ${res.event_id ? 'bg-blue-500' : res.paid ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      <div>
                        <div className="font-medium text-sm">
                          {(res.lane as any)?.name || 'Tor'} · Stanowisko {res.station_number}
                        </div>
                        <div className="text-xs text-muted">
                          {res.start_time.slice(0, 5)} – {res.end_time.slice(0, 5)}
                          {' · '}
                          {res.event_id
                            ? <span className="text-blue-500">{(res.event as any)?.title || 'Zawody'}</span>
                            : (res.member as any)?.full_name || res.guest_name || 'Anonim'
                          }
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!res.event_id && (
                        <button
                          onClick={() => toggleResPaid(res.id, !res.paid)}
                          className={`px-2.5 py-1 rounded text-xs font-medium ${
                            res.paid ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
                          }`}
                        >
                          {res.paid ? '✓ Opłacone' : '○ Nieopłacone'}
                        </button>
                      )}
                      {res.event_id && (
                        <span className="px-2.5 py-1 rounded text-xs font-medium bg-blue-500/10 text-blue-500">Zawody</span>
                      )}
                      <button onClick={() => cancelReservation(res.id)} className="p-1.5 rounded hover:bg-background text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          </div>
          )}

          {/* Sub-tab: Pakiety */}
          {rangeSubTab === 'packages' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Pakiety strzeleckie ({shootingPackages.length})</h3>
              <button onClick={openNewPackage} className="px-3 py-1.5 bg-primary text-background text-xs font-semibold rounded-lg hover:bg-primary-dark">+ Dodaj pakiet</button>
            </div>
            {shootingPackages.length === 0 ? (
              <p className="text-muted text-sm">Brak pakietów. Dodaj pierwszy.</p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {shootingPackages.map(pkg => (
                  <div key={pkg.id} className={`bg-card border rounded-xl p-4 ${pkg.is_active ? 'border-border' : 'border-border/30 opacity-60'}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-sm">{pkg.name}</h4>
                        <p className="text-xs text-muted">{rangeWeapons.find(w => w.id === pkg.weapon_id)?.name || '—'}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${pkg.is_active ? 'bg-green-500/20 text-green-400' : 'bg-zinc-500/20 text-zinc-400'}`}>
                        {pkg.is_active ? 'Aktywny' : 'Nieaktywny'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted mb-2">
                      <span>{pkg.ammo_count} szt.</span>
                      <span>{pkg.duration_minutes} min</span>
                      <span className="font-semibold text-primary">{Number(pkg.price_pln).toFixed(0)} zł</span>
                    </div>
                    {pkg.description && <p className="text-xs text-muted mb-2 line-clamp-2">{pkg.description}</p>}
                    <div className="flex gap-1">
                      <button onClick={() => openEditPackage(pkg)} className="text-xs px-2 py-1 border border-border rounded hover:bg-background">Edytuj</button>
                      <button onClick={() => togglePackageActive(pkg.id, pkg.is_active)} className="text-xs px-2 py-1 border border-border rounded hover:bg-background">
                        {pkg.is_active ? 'Dezaktywuj' : 'Aktywuj'}
                      </button>
                      <button onClick={() => deletePackage(pkg.id)} className="text-xs px-2 py-1 border border-red-500/30 text-red-400 rounded hover:bg-red-500/10">Usuń</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

          {/* Modal pakietu */}
          {showPackageForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold mb-4">{editingPackage ? 'Edytuj pakiet' : 'Nowy pakiet'}</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-muted mb-1">Nazwa *</label>
                    <input value={packageForm.name} onChange={e => setPackageForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" placeholder="np. Pistolet 9mm Standard" />
                  </div>
                  <div>
                    <label className="block text-sm text-muted mb-1">Broń</label>
                    <select value={packageForm.weapon_id} onChange={e => setPackageForm(f => ({ ...f, weapon_id: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                      <option value="">— brak —</option>
                      {rangeWeapons.filter(w => w.status === 'in_stock').map(w => (
                        <option key={w.id} value={w.id}>{w.name} ({w.caliber})</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm text-muted mb-1">Amunicja (szt.)</label>
                      <input type="number" value={packageForm.ammo_count} onChange={e => setPackageForm(f => ({ ...f, ammo_count: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm text-muted mb-1">Czas (min)</label>
                      <input type="number" value={packageForm.duration_minutes} onChange={e => setPackageForm(f => ({ ...f, duration_minutes: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm text-muted mb-1">Cena (zł)</label>
                      <input type="number" step="0.01" value={packageForm.price_pln} onChange={e => setPackageForm(f => ({ ...f, price_pln: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-muted mb-1">Opis</label>
                    <textarea value={packageForm.description} onChange={e => setPackageForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none" placeholder="Opis pakietu..." />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={packageForm.is_active} onChange={e => setPackageForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                    Aktywny (widoczny dla klientów)
                  </label>
                </div>
                <div className="flex gap-2 mt-6">
                  <button onClick={() => setShowPackageForm(false)} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-background">Anuluj</button>
                  <button onClick={savePackage} disabled={!packageForm.name} className="flex-1 px-4 py-2.5 bg-primary text-background rounded-lg text-sm font-semibold hover:bg-primary-dark disabled:opacity-50">
                    {editingPackage ? 'Zapisz' : 'Dodaj'}
                  </button>
                </div>
              </div>
            </div>
          )}

          </div>
          )}

          {/* Sub-tab: Broń klubowa */}
          {rangeSubTab === 'weapons' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Broń klubowa ({rangeWeapons.length})</h3>
              <button
                onClick={() => {
                  setEditingWeapon(null)
                  setWeaponForm({ name: '', type: 'pistol', caliber: '', description: '', status: 'draft', inventory_ammo_id: '' })
                  setShowWeaponForm(true)
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors"
              >
                <Plus className="w-4 h-4" />
                Dodaj broń
              </button>
            </div>

            {rangeWeapons.length === 0 ? (
              <p className="text-muted text-sm py-4">Brak broni. Dodaj broń, aby przypisać ją do pakietów strzeleckich.</p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {rangeWeapons.map(w => {
                  const statusColors: Record<string, string> = {
                    draft: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
                    in_stock: 'bg-green-500/10 text-green-500 border-green-500/30',
                    maintenance: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
                    decommissioned: 'bg-red-500/10 text-red-500 border-red-500/30',
                  }
                  const statusLabels: Record<string, string> = {
                    draft: 'Planowana',
                    in_stock: 'Na stanie',
                    maintenance: 'Serwis',
                    decommissioned: 'Wycofana',
                  }
                  const typeLabels: Record<string, string> = { pistol: 'Pistolet', rifle: 'Karabin', shotgun: 'Strzelba', other: 'Inne' }

                  return (
                    <div key={w.id} className={`bg-card border rounded-xl p-4 ${w.status === 'in_stock' ? 'border-green-500/20' : w.status === 'decommissioned' ? 'border-red-500/20 opacity-50' : 'border-border'}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-sm">{w.name}</h4>
                          <p className="text-xs text-muted">{typeLabels[w.type] || w.type} · {w.caliber}</p>
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              setEditingWeapon(w)
                              setWeaponForm({
                                name: w.name, type: w.type, caliber: w.caliber,
                                description: w.description || '', status: w.status,
                                inventory_ammo_id: w.inventory_ammo_id || '',
                              })
                              setShowWeaponForm(true)
                            }}
                            className="p-1.5 rounded hover:bg-background"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteWeapon(w.id)} className="p-1.5 rounded hover:bg-background text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {w.description && <p className="text-xs text-muted mb-2">{w.description}</p>}
                      <div className="flex items-center gap-2">
                        <select
                          value={w.status}
                          onChange={e => updateWeaponStatus(w.id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded-lg border font-medium ${statusColors[w.status] || 'border-border'}`}
                        >
                          <option value="draft">Planowana</option>
                          <option value="in_stock">Na stanie</option>
                          <option value="maintenance">Serwis</option>
                          <option value="decommissioned">Wycofana</option>
                        </select>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

          {/* Modal: nowa/edycja broń */}
          {showWeaponForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowWeaponForm(false)}>
              <div className="bg-card border border-border rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4">{editingWeapon ? 'Edytuj broń' : 'Nowa broń'}</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-muted mb-1">Nazwa</label>
                    <input value={weaponForm.name} onChange={e => setWeaponForm(f => ({ ...f, name: e.target.value }))} placeholder="np. Glock 17 Gen5" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-muted mb-1">Typ</label>
                      <select value={weaponForm.type} onChange={e => setWeaponForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                        <option value="pistol">Pistolet</option>
                        <option value="rifle">Karabin</option>
                        <option value="shotgun">Strzelba</option>
                        <option value="other">Inne</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-muted mb-1">Kaliber</label>
                      <input value={weaponForm.caliber} onChange={e => setWeaponForm(f => ({ ...f, caliber: e.target.value }))} placeholder="np. 9x19mm" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-muted mb-1">Status</label>
                    <select value={weaponForm.status} onChange={e => setWeaponForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                      <option value="draft">Planowana (nie widoczna w ofercie)</option>
                      <option value="in_stock">Na stanie (dostępna)</option>
                      <option value="maintenance">Serwis (tymczasowo niedostępna)</option>
                      <option value="decommissioned">Wycofana</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-muted mb-1">Powiązana amunicja z magazynu</label>
                    <select value={weaponForm.inventory_ammo_id} onChange={e => setWeaponForm(f => ({ ...f, inventory_ammo_id: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                      <option value="">— Brak —</option>
                      {inventoryItems.filter(i => i.category === 'ammunition').map(i => (
                        <option key={i.id} value={i.id}>{i.name} ({i.caliber || '-'}) · {i.quantity} {i.unit}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-muted mb-1">Opis (opcjonalnie)</label>
                    <input value={weaponForm.description} onChange={e => setWeaponForm(f => ({ ...f, description: e.target.value }))} placeholder="np. Broń krótka, ramka polimerowa" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <button onClick={() => setShowWeaponForm(false)} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-background">Anuluj</button>
                  <button onClick={saveWeapon} disabled={!weaponForm.name || !weaponForm.caliber} className="flex-1 px-4 py-2.5 bg-primary text-background rounded-lg text-sm font-semibold hover:bg-primary-dark disabled:opacity-50">
                    <Save className="w-4 h-4 inline mr-1" />
                    {editingWeapon ? 'Zapisz' : 'Dodaj'}
                  </button>
                </div>
              </div>
            </div>
          )}

          </div>
          )}

          {/* Modal: nowy wpis grafiku instruktora */}
          {showInstructorScheduleForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowInstructorScheduleForm(false)}>
              <div className="bg-card border border-border rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4">Dodaj dostępność instruktora</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-muted mb-1">Instruktor</label>
                    <select
                      value={instructorScheduleForm.instructor_id}
                      onChange={e => setInstructorScheduleForm(f => ({ ...f, instructor_id: e.target.value }))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    >
                      {instructorsList.map(i => (
                        <option key={i.id} value={i.id}>{i.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-muted mb-1">Dzień tygodnia</label>
                    <select
                      value={instructorScheduleForm.day_of_week}
                      onChange={e => setInstructorScheduleForm(f => ({ ...f, day_of_week: e.target.value }))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    >
                      <option value="1">Poniedziałek</option>
                      <option value="2">Wtorek</option>
                      <option value="3">Środa</option>
                      <option value="4">Czwartek</option>
                      <option value="5">Piątek</option>
                      <option value="6">Sobota</option>
                      <option value="0">Niedziela</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-muted mb-1">Od</label>
                      <TimeSelect value={instructorScheduleForm.start_time} onChange={v => setInstructorScheduleForm(f => ({ ...f, start_time: v }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm text-muted mb-1">Do</label>
                      <TimeSelect value={instructorScheduleForm.end_time} onChange={v => setInstructorScheduleForm(f => ({ ...f, end_time: v }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <button onClick={() => setShowInstructorScheduleForm(false)} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-background">Anuluj</button>
                  <button
                    onClick={saveInstructorSchedule}
                    disabled={!instructorScheduleForm.instructor_id}
                    className="flex-1 px-4 py-2.5 bg-primary text-background rounded-lg text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
                  >
                    <Save className="w-4 h-4 inline mr-1" />
                    Dodaj
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: nowa/edycja osi */}
          {showLaneForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowLaneForm(false)}>
              <div className="bg-card border border-border rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4">{editingLane ? 'Edytuj oś' : 'Nowa oś strzelecka'}</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-muted mb-1">Nazwa</label>
                    <input value={laneForm.name} onChange={e => setLaneForm(f => ({ ...f, name: e.target.value }))} placeholder="np. Oś 25m" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-muted mb-1">Długość (m)</label>
                      <input type="number" value={laneForm.length_m} onChange={e => setLaneForm(f => ({ ...f, length_m: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm text-muted mb-1">Liczba stanowisk</label>
                      <input type="number" value={laneForm.stations_count} onChange={e => setLaneForm(f => ({ ...f, stations_count: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-muted mb-1">Otwarcie</label>
                      <TimeSelect value={laneForm.open_time} onChange={v => setLaneForm(f => ({ ...f, open_time: v }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm text-muted mb-1">Zamknięcie</label>
                      <TimeSelect value={laneForm.close_time} onChange={v => setLaneForm(f => ({ ...f, close_time: v }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-muted mb-1">Cena za godzinę (zł)</label>
                    <input type="number" step="0.01" value={laneForm.price_per_hour_pln} onChange={e => setLaneForm(f => ({ ...f, price_per_hour_pln: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm text-muted mb-1">Min. wyprzedzenie rezerwacji online</label>
                    <select value={laneForm.min_advance_minutes} onChange={e => setLaneForm(f => ({ ...f, min_advance_minutes: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                      <option value="0">Bez ograniczeń</option>
                      <option value="30">30 minut</option>
                      <option value="60">1 godzina</option>
                      <option value="120">2 godziny</option>
                      <option value="180">3 godziny</option>
                      <option value="360">6 godzin</option>
                      <option value="720">12 godzin</option>
                      <option value="1440">24 godziny (dzień wcześniej)</option>
                    </select>
                    <p className="text-[10px] text-muted mt-1">Sloty bliższe niż ten czas są dostępne tylko dla rejestratora na miejscu</p>
                  </div>
                  <div>
                    <label className="block text-sm text-muted mb-1">Opis (opcjonalnie)</label>
                    <input value={laneForm.description} onChange={e => setLaneForm(f => ({ ...f, description: e.target.value }))} placeholder="np. Broń krótka, pneumatyczna" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={laneForm.is_active} onChange={e => setLaneForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                    Aktywna (widoczna w rezerwacjach)
                  </label>
                </div>
                <div className="flex gap-2 mt-6">
                  <button onClick={() => setShowLaneForm(false)} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-background">Anuluj</button>
                  <button onClick={saveLane} disabled={!laneForm.name} className="flex-1 px-4 py-2.5 bg-primary text-background rounded-lg text-sm font-semibold hover:bg-primary-dark disabled:opacity-50">
                    <Save className="w-4 h-4 inline mr-1" />
                    {editingLane ? 'Zapisz' : 'Dodaj'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: blokada na zawody */}
          {showEventBlockForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEventBlockForm(false)}>
              <div className="bg-card border border-border rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4">Zablokuj oś na zawody</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-muted mb-1">Oś</label>
                    <select value={eventBlockForm.lane_id} onChange={e => setEventBlockForm(f => ({ ...f, lane_id: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                      {shootingLanes.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-muted mb-1">Wydarzenie</label>
                    <select value={eventBlockForm.event_id} onChange={e => setEventBlockForm(f => ({ ...f, event_id: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                      <option value="">Wybierz...</option>
                      {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title} ({ev.start_date})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-muted mb-1">Data</label>
                    <input type="date" value={eventBlockForm.date} onChange={e => setEventBlockForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-muted mb-1">Od</label>
                      <TimeSelect value={eventBlockForm.start_time} onChange={v => setEventBlockForm(f => ({ ...f, start_time: v }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm text-muted mb-1">Do</label>
                      <TimeSelect value={eventBlockForm.end_time} onChange={v => setEventBlockForm(f => ({ ...f, end_time: v }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-muted mb-1">Stanowiska (puste = wszystkie)</label>
                    <input value={eventBlockForm.stations} onChange={e => setEventBlockForm(f => ({ ...f, stations: e.target.value }))} placeholder="np. 1,2,3 lub puste dla wszystkich" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                  </div>
                </div>
                <div className="flex gap-2 mt-6">
                  <button onClick={() => setShowEventBlockForm(false)} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-background">Anuluj</button>
                  <button onClick={blockLaneForEvent} disabled={!eventBlockForm.event_id || !eventBlockForm.date} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                    <Ban className="w-4 h-4 inline mr-1" />
                    Zablokuj
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Login History — superadmin only */}
      {member.role === 'superadmin' && (
        <div className="mt-8 bg-card border border-border rounded-xl p-6">
          <button
            onClick={() => { setShowLoginHistory(!showLoginHistory); if (!showLoginHistory && loginHistory.length === 0) loadLoginHistory() }}
            className="flex items-center gap-3 w-full text-left"
          >
            <History className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold flex-1">Historia logowań</h2>
            {showLoginHistory ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
          </button>

          {showLoginHistory && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted">Ostatnie 200 zdarzeń logowania</p>
                <button onClick={loadLoginHistory} disabled={loginHistoryLoading} className="text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-background disabled:opacity-50">
                  {loginHistoryLoading ? 'Ładowanie...' : 'Odśwież'}
                </button>
              </div>

              {loginHistoryLoading ? (
                <p className="text-sm text-muted py-4 text-center">Ładowanie...</p>
              ) : loginHistory.length === 0 ? (
                <p className="text-sm text-muted py-4 text-center">Brak wpisów.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted">
                        <th className="py-2 px-3 font-medium">Data</th>
                        <th className="py-2 px-3 font-medium">Użytkownik</th>
                        <th className="py-2 px-3 font-medium">Email</th>
                        <th className="py-2 px-3 font-medium">Typ</th>
                        <th className="py-2 px-3 font-medium">IP</th>
                        <th className="py-2 px-3 font-medium">Urządzenie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginHistory.map(entry => {
                        const eventLabels: Record<string, { label: string; color: string }> = {
                          login: { label: 'Logowanie', color: 'text-green-400' },
                          logout: { label: 'Wylogowanie', color: 'text-red-400' },
                          login_resolved: { label: 'Logowanie ✓', color: 'text-green-400' },
                          token_refresh: { label: 'Odświeżenie', color: 'text-muted' },
                        }
                        const ev = eventLabels[entry.event_type] || { label: entry.event_type, color: 'text-muted' }
                        // Parse user agent for readable device
                        const ua = entry.user_agent || ''
                        const isMobile = /Mobile|Android|iPhone/i.test(ua)
                        const browser = /Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : /Edge/.test(ua) ? 'Edge' : 'Inna'
                        const deviceLabel = isMobile ? `📱 ${browser}` : `💻 ${browser}`

                        return (
                          <tr key={entry.id} className="border-b border-border/30 hover:bg-background/50">
                            <td className="py-2 px-3 whitespace-nowrap text-xs">
                              {new Date(entry.created_at).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                            <td className="py-2 px-3 font-medium">{entry.full_name || '—'}</td>
                            <td className="py-2 px-3 text-muted">{entry.email || '—'}</td>
                            <td className={`py-2 px-3 font-medium ${ev.color}`}>{ev.label}</td>
                            <td className="py-2 px-3 text-xs text-muted font-mono">{entry.ip_address || '—'}</td>
                            <td className="py-2 px-3 text-xs" title={ua}>{deviceLabel}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* Results with targets modal */}
      {resultsPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto" onClick={() => { setResultsPreview(null); setResultsLightbox(null) }}>
          <div className="bg-card border border-border rounded-xl w-full max-w-4xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-lg">Wyniki — {resultsPreview.eventTitle}</h2>
              <button onClick={() => { setResultsPreview(null); setResultsLightbox(null) }} className="p-1 hover:bg-card-hover rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              {resultsPreview.results.length === 0 ? (
                <p className="text-muted text-center py-8">Brak wyników dla tego wydarzenia</p>
              ) : (
                (() => {
                  const byDisc: Record<string, typeof resultsPreview.results> = {}
                  for (const r of resultsPreview.results) {
                    const dn = r.discipline?.name ?? 'Bez dyscypliny'
                    if (!byDisc[dn]) byDisc[dn] = []
                    byDisc[dn].push(r)
                  }
                  return Object.entries(byDisc).map(([discName, dResults]) => {
                    const isShotgun = dResults[0]?.discipline?.scoring_type === 'shotgun'
                    const sorted = [...dResults].sort((a, b) => isShotgun ? a.total_score - b.total_score : b.total_score - a.total_score)
                    return (
                      <div key={discName} className="mb-6">
                        <h3 className="text-sm font-semibold text-blue-400 mb-2">{discName}</h3>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/30 text-xs text-muted">
                              <th className="text-left px-3 py-2 w-10">#</th>
                              <th className="text-left px-3 py-2">Zawodnik</th>
                              {isShotgun ? (
                                <>
                                  <th className="text-right px-3 py-2">Czas</th>
                                  <th className="text-right px-3 py-2">Pudła</th>
                                  <th className="text-right px-3 py-2">Wynik</th>
                                </>
                              ) : (
                                <>
                                  <th className="text-right px-3 py-2">Wynik</th>
                                  <th className="text-right px-3 py-2">10-tki</th>
                                  <th className="text-right px-3 py-2">Pudła</th>
                                </>
                              )}
                              <th className="text-center px-3 py-2 w-20">Tarcza</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sorted.map((r: any, idx: number) => (
                              <tr key={r.id} className="border-b border-border/20 hover:bg-card-hover">
                                <td className="px-3 py-2">{idx < 3 ? ['🥇','🥈','🥉'][idx] : idx + 1}</td>
                                <td className="px-3 py-2 font-medium">{r.member?.full_name ?? '?'}</td>
                                {isShotgun ? (
                                  <>
                                    <td className="px-3 py-2 text-right font-mono text-muted">{r.time_seconds ? `${Number(r.time_seconds).toFixed(2)}s` : '-'}</td>
                                    <td className="px-3 py-2 text-right text-muted">{r.misses ? <span className="text-danger">{r.misses}</span> : '0'}</td>
                                    <td className="px-3 py-2 text-right font-mono font-bold">{Number(r.total_score).toFixed(2)}s</td>
                                  </>
                                ) : (
                                  <>
                                    <td className="px-3 py-2 text-right font-mono font-bold">{r.total_score}{r.max_score && <span className="text-xs text-muted">/{r.max_score}</span>}</td>
                                    <td className="px-3 py-2 text-right text-muted">{r.tens_count ?? '-'}</td>
                                    <td className="px-3 py-2 text-right text-muted">{r.misses ?? '-'}</td>
                                  </>
                                )}
                                <td className="px-3 py-2 text-center">
                                  {r.target_image_url ? (
                                    <button onClick={() => setResultsLightbox(r.target_image_url)} className="hover:opacity-80 transition-opacity" title="Podgląd tarczy">
                                      <img src={r.target_image_url} alt="Tarcza" className="w-10 h-10 object-cover rounded border border-border inline-block" />
                                    </button>
                                  ) : (
                                    <Camera className="w-4 h-4 text-muted/30 mx-auto" />
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  })
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* Results target lightbox */}
      {resultsLightbox && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setResultsLightbox(null)}>
          <div className="relative max-w-2xl max-h-[90vh]">
            <button onClick={() => setResultsLightbox(null)} className="absolute -top-10 right-0 text-white hover:text-primary transition-colors"><X className="w-8 h-8" /></button>
            <img src={resultsLightbox} alt="Tarcza — powiększenie" className="max-w-full max-h-[85vh] rounded-lg object-contain" />
          </div>
        </div>
      )}
    </div>
  )
}
