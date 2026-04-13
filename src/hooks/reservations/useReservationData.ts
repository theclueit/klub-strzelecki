'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { formatDate, addDays, timeToMin } from '@/lib/date'
import type { Lane, Reservation } from './types'
import { getLaneSlots } from './types'

interface UseReservationDataParams {
  selectedLane: Lane | null
  selectedDate: string
  weekStart: Date
}

export function useReservationData({ selectedLane, selectedDate, weekStart }: UseReservationDataParams) {
  const supabase = createSupabaseBrowser()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loadingRes, setLoadingRes] = useState(false)
  const [weekReservations, setWeekReservations] = useState<Record<string, { total: number; paid: number; maxSlots: number }>>({})

  const loadReservations = useCallback(async () => {
    if (!selectedLane) return
    setLoadingRes(true)
    const { data } = await supabase
      .from('lane_reservations')
      .select('*, event:events(title), member:members!lane_reservations_member_id_fkey(full_name)')
      .eq('lane_id', selectedLane.id)
      .eq('reservation_date', selectedDate)
      .neq('status', 'cancelled')
    // Filter out expired holds client-side (server cleanup is async)
    const now = new Date().toISOString()
    const filtered = (data ?? []).filter((r: any) =>
      r.status !== 'hold' || !r.hold_expires_at || r.hold_expires_at > now
    )
    setReservations(filtered as any[])
    setLoadingRes(false)
  }, [selectedLane, selectedDate])

  const loadWeekStats = useCallback(async () => {
    if (!selectedLane) return
    const weekStartStr = formatDate(weekStart)
    const weekEndStr = formatDate(addDays(weekStart, 6))
    const { data } = await supabase
      .from('lane_reservations')
      .select('reservation_date, start_time, end_time, paid, station_number')
      .eq('lane_id', selectedLane.id)
      .gte('reservation_date', weekStartStr)
      .lte('reservation_date', weekEndStr)
      .neq('status', 'cancelled')

    // Oblicz statystyki per dzień
    const openH = parseInt(selectedLane.open_time?.split(':')[0] || '8')
    const closeH = parseInt(selectedLane.close_time?.split(':')[0] || '20')
    const slotsPerStation = (closeH - openH) * 2 // 30-min slots
    const maxSlots = slotsPerStation * selectedLane.stations_count

    const stats: Record<string, { total: number; paid: number; maxSlots: number }> = {}
    for (const r of (data ?? [])) {
      const d = r.reservation_date
      if (!stats[d]) stats[d] = { total: 0, paid: 0, maxSlots }
      const startMin = timeToMin(r.start_time)
      const endMin = timeToMin(r.end_time)
      const slotCount = (endMin - startMin) / 30
      stats[d].total += slotCount
      if (r.paid) stats[d].paid += slotCount
    }
    setWeekReservations(stats)
  }, [selectedLane, weekStart])

  useEffect(() => { loadReservations() }, [loadReservations])
  useEffect(() => { loadWeekStats() }, [loadWeekStats])

  const slots = useMemo(() => getLaneSlots(selectedLane), [selectedLane])
  const closeMin = useMemo(() => {
    if (!selectedLane) return 20 * 60
    return timeToMin(selectedLane.close_time || '20:00')
  }, [selectedLane])

  const stationNumbers = useMemo(() => {
    if (!selectedLane) return []
    return Array.from({ length: selectedLane.stations_count }, (_, i) => i + 1)
  }, [selectedLane])

  // Map: "station-slotTime" -> reservation
  const slotMap = useMemo(() => {
    const map: Record<string, Reservation> = {}
    for (const r of reservations) {
      const startMin = timeToMin(r.start_time)
      const endMin = timeToMin(r.end_time)
      for (let m = startMin; m < endMin; m += 30) {
        const h = Math.floor(m / 60)
        const mm = m % 60
        const key = `${r.station_number}-${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`
        map[key] = r
      }
    }
    return map
  }, [reservations])

  // Span info for colSpan rendering
  const spanMap = useMemo(() => {
    const map: Record<string, { res: Reservation; span: number; isFirst: boolean }> = {}
    for (const r of reservations) {
      const startMin = timeToMin(r.start_time)
      const endMin = timeToMin(r.end_time)
      const totalSlots = (endMin - startMin) / 30
      let idx = 0
      for (let m = startMin; m < endMin; m += 30) {
        const h = Math.floor(m / 60)
        const mm = m % 60
        const key = `${r.station_number}-${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`
        map[key] = { res: r, span: totalSlots, isFirst: idx === 0 }
        idx++
      }
    }
    return map
  }, [reservations])

  return {
    reservations,
    loadingRes,
    weekReservations,
    loadReservations,
    loadWeekStats,
    slots,
    closeMin,
    stationNumbers,
    slotMap,
    spanMap,
  }
}
