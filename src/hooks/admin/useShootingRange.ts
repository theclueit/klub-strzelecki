'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import type { ShootingLane, LaneReservation, EventRow } from '@/types/admin'

interface UseShootingRangeParams {
  shootingLanes: ShootingLane[]
  events: EventRow[]
  loadShootingLanes: () => void
}

export function useShootingRange({ shootingLanes, events, loadShootingLanes }: UseShootingRangeParams) {
  const supabase = createSupabaseBrowser()

  const [showLaneForm, setShowLaneForm] = useState(false)
  const [editingLane, setEditingLane] = useState<ShootingLane | null>(null)
  const [laneForm, setLaneForm] = useState({ name: '', length_m: '25', stations_count: '5', description: '', price_per_hour_pln: '0', is_active: true, open_time: '08:00', close_time: '20:00', min_advance_minutes: '60' })
  const [laneReservations, setLaneReservations] = useState<LaneReservation[]>([])
  const [laneResDate, setLaneResDate] = useState(() => new Date().toISOString().split('T')[0])
  const [laneResFilter, setLaneResFilter] = useState<string>('all')
  const [showEventBlockForm, setShowEventBlockForm] = useState(false)
  const [eventBlockForm, setEventBlockForm] = useState({ lane_id: '', event_id: '', date: '', start_time: '08:00', end_time: '20:00', stations: '' })

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

  return {
    showLaneForm, setShowLaneForm,
    editingLane, setEditingLane,
    laneForm, setLaneForm,
    laneReservations, setLaneReservations,
    laneResDate, setLaneResDate,
    laneResFilter, setLaneResFilter,
    showEventBlockForm, setShowEventBlockForm,
    eventBlockForm, setEventBlockForm,
    loadLaneReservations,
    openNewLane,
    openEditLane,
    saveLane,
    deleteLane,
    toggleResPaid,
    cancelReservation,
    blockLaneForEvent,
  }
}
