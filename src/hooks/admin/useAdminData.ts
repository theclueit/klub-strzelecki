'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import type {
  EventRow,
  EventJudge,
  GuestReg,
  RegDiscipline,
  InventoryItem,
  Regulation,
  ShootingLane,
  MemberReg,
  RangeWeapon,
  ShootingPackage,
} from '@/types/admin'
import type { Discipline, Member, EventDiscipline, EventDisciplineSlot } from '@/types/database'

export function useAdminData() {
  const supabase = createSupabaseBrowser()

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
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
  const [regulations, setRegulations] = useState<Regulation[]>([])
  const [memberTargetMap, setMemberTargetMap] = useState<Set<string>>(new Set())

  // Shooting ranges
  const [shootingLanes, setShootingLanes] = useState<ShootingLane[]>([])

  // Range weapons
  const [rangeWeapons, setRangeWeapons] = useState<{ id: string; name: string; type: string; caliber: string; status: string; description: string | null; inventory_ammo_id: string | null; is_active: boolean }[]>([])

  // Shooting packages
  const [shootingPackages, setShootingPackages] = useState<{ id: string; name: string; description: string | null; weapon_id: string; ammo_count: number; duration_minutes: number; price_pln: number; is_active: boolean }[]>([])

  async function loadShootingLanes() {
    const { data } = await supabase.from('shooting_lanes').select('*').order('length_m')
    setShootingLanes((data ?? []) as ShootingLane[])
  }

  async function loadShootingPackages() {
    const { data } = await supabase.from('shooting_packages').select('*').order('name')
    setShootingPackages((data ?? []) as any[])
  }

  async function loadRangeWeapons() {
    const { data } = await supabase.from('range_weapons').select('*').order('type').order('name')
    setRangeWeapons((data ?? []) as any[])
  }

  async function loadAll() {
    const [evRes, discRes, judgesRes, ejRes, membersRes, guestRes, memberRegsRes, edRes, rdRes, slotsRes, invRes, regRes] = await Promise.all([
      supabase.from('events').select('*').order('start_date', { ascending: false }),
      supabase.from('disciplines').select('*').order('name'),
      supabase.from('members').select('*').in('role', ['judge', 'admin', 'superadmin']).not('judge_license_number', 'is', null).order('full_name'),
      supabase.from('event_judges').select('*, event_judge_disciplines(event_discipline_id)'),
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
    setEventJudges((ejRes.data ?? []).map((ej: any) => ({
      ...ej,
      discipline_ids: (ej.event_judge_disciplines ?? []).map((d: any) => d.event_discipline_id),
    })) as EventJudge[])
    setAllMembers((membersRes.data ?? []) as Member[])
    setGuestRegs((guestRes.data ?? []) as GuestReg[])
    setMemberRegs((memberRegsRes.data ?? []) as any[])
    setEventDisciplines((edRes.data ?? []) as any[])
    setRegDisciplines((rdRes.data ?? []) as RegDiscipline[])
    setEventSlots((slotsRes.data ?? []) as EventDisciplineSlot[])
    setInventoryItems((invRes.data ?? []) as InventoryItem[])
    setRegulations((regRes.data ?? []) as Regulation[])
    // Load which members have target photos
    const { data: targetsData } = await supabase
      .from('results')
      .select('member_id, event_id')
      .not('target_image_url', 'is', null)
    const tSet = new Set<string>()
    for (const t of (targetsData ?? [])) tSet.add(`${t.member_id}:${t.event_id}`)
    setMemberTargetMap(tSet)
    // Also load shooting lanes, weapons, packages (needed for event lane blocking & range management)
    loadShootingLanes()
    loadShootingPackages()
  }

  // ---- Helper getters ----

  function getEventDiscs(eventId: string) {
    return eventDisciplines.filter(ed => ed.event_id === eventId)
  }

  function getEventTotalRegs(eventId: string): number {
    const memberCount = memberRegs.filter(r => r.event_id === eventId).length
    const guestCount = guestRegs.filter(r => r.event_id === eventId).length
    return memberCount + guestCount
  }

  function getEventDiscRegCounts(eventId: string): { name: string; count: number }[] {
    const evDiscs = getEventDiscs(eventId)
    return evDiscs.map(ed => {
      const count = regDisciplines.filter(rd => rd.event_discipline_id === ed.id).length
      return { name: ed.discipline?.name ?? '?', count }
    })
  }

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

  function getSlotsForEventDiscipline(edId: string) {
    return eventSlots.filter(s => s.event_discipline_id === edId)
  }

  function getSlotRegistrationCount(slotId: string) {
    return regDisciplines.filter(rd => rd.event_discipline_slot_id === slotId).length
  }

  function getFilteredDisciplines(eventType: string) {
    const cat = eventType === 'competition' ? 'discipline' : eventType === 'course' ? 'service' : null
    return cat ? disciplines.filter(d => d.category === cat) : disciplines
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

  return {
    // State
    events,
    setEvents,
    disciplines,
    setDisciplines,
    judges,
    setJudges,
    eventJudges,
    setEventJudges,
    allMembers,
    setAllMembers,
    guestRegs,
    setGuestRegs,
    memberRegs,
    setMemberRegs,
    eventDisciplines,
    setEventDisciplines,
    regDisciplines,
    setRegDisciplines,
    eventSlots,
    setEventSlots,
    inventoryItems,
    setInventoryItems,
    regulations,
    setRegulations,
    memberTargetMap,
    setMemberTargetMap,
    shootingLanes,
    setShootingLanes,
    rangeWeapons,
    setRangeWeapons,
    shootingPackages,
    setShootingPackages,

    // Data loading
    loadAll,
    loadShootingLanes,
    loadShootingPackages,
    loadRangeWeapons,

    // Helper getters
    getEventDiscs,
    getEventTotalRegs,
    getEventDiscRegCounts,
    getRegDisciplineNames,
    getRegTotal,
    getSlotsForEventDiscipline,
    getSlotRegistrationCount,
    getFilteredDisciplines,
    getEventJudges,
    getAvailableJudges,
  }
}
