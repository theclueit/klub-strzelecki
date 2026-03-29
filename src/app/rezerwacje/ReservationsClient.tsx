'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { ChevronLeft, ChevronRight, Clock, CreditCard, CheckCircle, X, MapPin, Crosshair, Loader2, Printer, Target, UserPlus, Package } from 'lucide-react'
import Link from 'next/link'

interface Lane {
  id: string
  name: string
  length_m: number
  stations_count: number
  description: string | null
  price_per_hour_pln: number
  open_time: string
  close_time: string
  min_advance_minutes: number
}

interface Reservation {
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
  hold_token: string | null
  hold_expires_at: string | null
  event?: { title: string } | null
  member?: { full_name: string } | null
}

// Generate 30-min slots between open and close
function getLaneSlots(lane: Lane | null): string[] {
  if (!lane) return []
  const openH = parseInt(lane.open_time?.split(':')[0] || '8')
  const openM = parseInt(lane.open_time?.split(':')[1] || '0')
  const closeH = parseInt(lane.close_time?.split(':')[0] || '20')
  const closeM = parseInt(lane.close_time?.split(':')[1] || '0')
  const startMin = openH * 60 + openM
  const endMin = closeH * 60 + closeM
  const slots: string[] = []
  for (let m = startMin; m < endMin; m += 30) {
    const h = Math.floor(m / 60)
    const mm = m % 60
    slots.push(`${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`)
  }
  return slots
}

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function formatDate(date: Date) {
  return date.toISOString().split('T')[0]
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function getDayName(date: Date) {
  return date.toLocaleDateString('pl-PL', { weekday: 'short' })
}

interface RangeWeapon {
  id: string
  name: string
  type: string
  caliber: string
  status: string
}

interface ShootingPackage {
  id: string
  name: string
  weapon_id: string
  ammo_count: number
  duration_minutes: number
  price_pln: number
}

interface Instructor {
  id: string
  full_name: string
}

export default function ReservationsClient({ lanes }: { lanes: Lane[] }) {
  const { member } = useAuth()
  const supabase = createSupabaseBrowser()
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()))
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loadingRes, setLoadingRes] = useState(false)
  const [selectedLane, setSelectedLane] = useState<Lane | null>(lanes[0] || null)
  const [showBooking, setShowBooking] = useState<{ stationNumber: number; slotTime: string } | null>(null)
  const [bookingSlots, setBookingSlots] = useState(2) // 2 slots = 1 hour
  const [bookingStations, setBookingStations] = useState(1) // ile stanowisk obok siebie
  const [bookingNotes, setBookingNotes] = useState('')
  const [bookingLoading, setBookingLoading] = useState(false)
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null)
  // Hold (temporary slot lock)
  const [holdToken, setHoldToken] = useState<string | null>(null)
  const [holdExpiresAt, setHoldExpiresAt] = useState<Date | null>(null)
  const [holdTimeLeft, setHoldTimeLeft] = useState(0) // seconds
  const [holdExtending, setHoldExtending] = useState(false)
  const [showExtendPrompt, setShowExtendPrompt] = useState(false)

  // Guest booking form (when not logged in)
  const [guestBooking, setGuestBooking] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    document: '',
  })

  // Drag-to-select
  const [dragStart, setDragStart] = useState<{ sn: number; slotIdx: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ sn: number; slotIdx: number } | null>(null)
  const isDragging = useRef(false)
  const gridRef = useRef<HTMLTableElement>(null)

  // On-site recreational booking (registrar only)
  const [showOnsiteBooking, setShowOnsiteBooking] = useState(false)
  const [onsiteWeapons, setOnsiteWeapons] = useState<RangeWeapon[]>([])
  const [onsitePackages, setOnsitePackages] = useState<ShootingPackage[]>([])
  const [onsiteInstructors, setOnsiteInstructors] = useState<Instructor[]>([])
  const [onsiteLoading, setOnsiteLoading] = useState(false)
  const [onsiteSaving, setOnsiteSaving] = useState(false)
  const [onsiteSuccess, setOnsiteSuccess] = useState('')
  const [onsiteForm, setOnsiteForm] = useState({
    package_id: '',
    weapon_id: '',
    instructor_id: '',
    start_time: '10:00',
    duration_minutes: '60',
    ammo_count: '50',
    price_pln: '0',
    guest_name: '',
    guest_phone: '',
    guest_address: '',
    guest_document: '',
    guest_email: '',
    targets: '',
    notes: '',
  })

  const dateObj = useMemo(() => new Date(selectedDate + 'T00:00:00'), [selectedDate])
  const weekStart = useMemo(() => {
    const d = new Date(dateObj)
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    return d
  }, [dateObj])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  // Rezerwacje na cały tydzień (do kolorowania kafelków dat)
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

  // Hold countdown timer
  useEffect(() => {
    if (!holdExpiresAt || !holdToken) return
    const tick = () => {
      const left = Math.max(0, Math.round((holdExpiresAt.getTime() - Date.now()) / 1000))
      setHoldTimeLeft(left)
      if (left <= 30 && left > 0 && !showExtendPrompt) {
        setShowExtendPrompt(true)
      }
      if (left <= 0) {
        // Hold expired — close modal and reload
        setHoldToken(null)
        setHoldExpiresAt(null)
        setShowBooking(null)
        setShowExtendPrompt(false)
        loadReservations()
      }
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [holdExpiresAt, holdToken, showExtendPrompt])

  // Release hold when modal closes without booking
  const releaseHold = useCallback(async () => {
    if (!holdToken) return
    try {
      await fetch('/api/reservations/hold', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hold_token: holdToken }),
      })
    } catch {}
    setHoldToken(null)
    setHoldExpiresAt(null)
    setShowExtendPrompt(false)
    loadReservations()
  }, [holdToken])

  // Extend hold
  const extendHold = useCallback(async () => {
    if (!holdToken) return
    setHoldExtending(true)
    try {
      const res = await fetch('/api/reservations/hold', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hold_token: holdToken }),
      })
      const data = await res.json()
      if (res.ok) {
        setHoldExpiresAt(new Date(data.expires_at))
        setShowExtendPrompt(false)
      } else {
        // Hold expired server-side
        setHoldToken(null)
        setHoldExpiresAt(null)
        setShowBooking(null)
        setShowExtendPrompt(false)
        loadReservations()
      }
    } catch {}
    setHoldExtending(false)
  }, [holdToken])

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

  const isSlotFree = (station: number, slotTime: string, slotCount: number = 1) => {
    const startMin = timeToMin(slotTime)
    for (let i = 0; i < slotCount; i++) {
      const m = startMin + i * 30
      if (m + 30 > closeMin) return false
      const h = Math.floor(m / 60)
      const mm = m % 60
      const key = `${station}-${h.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`
      if (slotMap[key]) return false
    }
    return true
  }

  // Sprawdza czy N sąsiednich stanowisk jest wolnych na dany czas
  const areAdjacentStationsFree = (startStation: number, stationCount: number, slotTime: string, slotCount: number) => {
    const maxStation = selectedLane?.stations_count || 0
    for (let s = 0; s < stationCount; s++) {
      const sn = startStation + s
      if (sn > maxStation) return false
      if (!isSlotFree(sn, slotTime, slotCount)) return false
    }
    return true
  }

  // Drag selection: compute rectangle of selected cells
  const dragSelection = useMemo(() => {
    if (!dragStart || !dragEnd) return null
    const minSn = Math.min(dragStart.sn, dragEnd.sn)
    const maxSn = Math.max(dragStart.sn, dragEnd.sn)
    const minSlot = Math.min(dragStart.slotIdx, dragEnd.slotIdx)
    const maxSlot = Math.max(dragStart.slotIdx, dragEnd.slotIdx)
    return { minSn, maxSn, minSlot, maxSlot }
  }, [dragStart, dragEnd])

  const isInDragSelection = (sn: number, slotIdx: number) => {
    if (!dragSelection) return false
    return sn >= dragSelection.minSn && sn <= dragSelection.maxSn &&
      slotIdx >= dragSelection.minSlot && slotIdx <= dragSelection.maxSlot
  }

  // Desktop drag-to-select uses pointer events to distinguish mouse from touch.
  // Touch/click uses tap-to-select: 1st tap = start, 2nd tap = end.
  // Refs mirror dragStart/dragEnd so the global mouseup handler always has current values
  // (state updates are async, but mouseup fires before React re-renders).
  const pointerIsMouse = useRef(false)
  const dragStartRef = useRef(dragStart)
  const dragEndRef = useRef(dragEnd)
  dragStartRef.current = dragStart
  dragEndRef.current = dragEnd

  const handlePointerDown = (sn: number, slotIdx: number, pointerType: string) => {
    if (isPast) return
    if (pointerType === 'mouse') {
      // Desktop: start drag — update refs immediately for mouseup handler
      const pos = { sn, slotIdx }
      pointerIsMouse.current = true
      isDragging.current = true
      dragStartRef.current = pos
      dragEndRef.current = pos
      setDragStart(pos)
      setDragEnd(pos)
    }
    // Touch: do nothing here — onClick will handle tap-to-select
  }

  const handleDragMove = (sn: number, slotIdx: number) => {
    if (!isDragging.current) return
    const pos = { sn, slotIdx }
    dragEndRef.current = pos
    setDragEnd(pos)
  }

  const handleDragEnd = () => {
    if (!isDragging.current) return
    isDragging.current = false

    const start = dragStartRef.current
    const end = dragEndRef.current
    if (!start || !end) return

    // Open booking from drag selection
    openBookingFromSelection(start, end)
    dragStartRef.current = null
    dragEndRef.current = null
    setDragStart(null)
    setDragEnd(null)
    // Block the upcoming click event from re-triggering
    pointerIsMouse.current = true
    setTimeout(() => { pointerIsMouse.current = false }, 50)
  }

  // Click handler: tap-to-select (primarily for touch, also works as fallback)
  // 1st click = start, 2nd click = end → open booking
  const handleSlotClick = (sn: number, slotIdx: number) => {
    if (isPast) return
    // Skip if this click came from a mouse drag-end (already handled)
    if (pointerIsMouse.current) {
      pointerIsMouse.current = false
      return
    }

    if (!dragStart) {
      // First tap — mark start
      setDragStart({ sn, slotIdx })
      setDragEnd({ sn, slotIdx })
    } else {
      // Second tap — mark end and open booking
      const end = { sn, slotIdx }
      openBookingFromSelection(dragStart, end)
      setDragStart(null)
      setDragEnd(null)
    }
  }

  // Shared: open booking modal from two corner points — creates a hold
  const openBookingFromSelection = async (start: { sn: number; slotIdx: number }, end: { sn: number; slotIdx: number }) => {
    const sel = {
      minSn: Math.min(start.sn, end.sn),
      maxSn: Math.max(start.sn, end.sn),
      minSlot: Math.min(start.slotIdx, end.slotIdx),
      maxSlot: Math.max(start.slotIdx, end.slotIdx),
    }

    const slotCount = sel.maxSlot - sel.minSlot + 1
    let allFree = true
    for (let s = sel.minSn; s <= sel.maxSn; s++) {
      for (let si = sel.minSlot; si <= sel.maxSlot; si++) {
        const key = `${s}-${slots[si]}`
        if (slotMap[key]) { allFree = false; break }
      }
      if (!allFree) break
    }

    if (allFree && slots[sel.minSlot] && selectedLane) {
      const stationCount = sel.maxSn - sel.minSn + 1
      const startTime = slots[sel.minSlot]
      const endMin = timeToMin(startTime) + slotCount * 30
      const endTime = `${Math.floor(endMin / 60).toString().padStart(2, '0')}:${(endMin % 60).toString().padStart(2, '0')}`

      // Create hold via API
      try {
        const res = await fetch('/api/reservations/hold', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lane_id: selectedLane.id,
            station_number: sel.minSn,
            stations_count: stationCount,
            reservation_date: selectedDate,
            start_time: startTime,
            end_time: endTime,
          }),
        })
        const data = await res.json()
        if (!res.ok) {
          if (res.status === 409) {
            alert('Ten slot jest już zajęty lub ktoś go właśnie rezerwuje.')
            loadReservations()
          }
          return
        }
        setHoldToken(data.hold_token)
        setHoldExpiresAt(new Date(data.expires_at))
        setHoldTimeLeft(data.hold_seconds)
        setShowExtendPrompt(false)
        setShowBooking({ stationNumber: sel.minSn, slotTime: startTime })
        setBookingSlots(slotCount)
        setBookingStations(stationCount)
        loadReservations() // reload to show hold in grid
      } catch {
        alert('Błąd połączenia z serwerem')
      }
    }
  }

  // Global mouseup listener to end drag (desktop only)
  useEffect(() => {
    const onUp = () => {
      if (isDragging.current) handleDragEnd()
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [slots, slotMap])

  const isRecreational = (res: Reservation) => res.notes?.startsWith('Strzelanie rekreacyjne')
  const isHold = (res: Reservation) => res.status === 'hold'

  const getSlotColor = (res: Reservation | undefined) => {
    if (!res) return 'bg-green-500/20 border-green-500/40 hover:bg-green-500/30' // wolne
    if (isHold(res)) return 'bg-amber-500/20 border-amber-500/40 animate-pulse' // ktoś rezerwuje
    if (res.event_id) return 'bg-blue-500/30 border-blue-500/50' // zawody
    if (isRecreational(res)) return 'bg-purple-500/30 border-purple-500/50' // pakiet rekreacyjny
    if (res.paid) return 'bg-red-500/30 border-red-500/50' // opłacone
    return 'bg-zinc-400/30 border-zinc-400/50' // zarezerwowane nieopłacone
  }

  const isRangeStaff = member && (member.role === 'admin' || member.role === 'superadmin' || member.role === 'registrar' || member.role === 'range_registrar')

  // Check if a slot is too close for online booking (only staff can book)
  const isSlotTooClose = (slotTime: string) => {
    if (isRangeStaff) return false // staff can always book
    if (!selectedLane) return false
    const minAdvance = selectedLane.min_advance_minutes ?? 60
    if (minAdvance === 0) return false
    const now = new Date()
    const slotDate = new Date(selectedDate + 'T' + slotTime + ':00')
    const diffMs = slotDate.getTime() - now.getTime()
    const diffMin = diffMs / 60000
    return diffMin < minAdvance
  }

  const getSlotLabel = (res: Reservation) => {
    if (isHold(res)) return 'Ktoś rezerwuje...'
    if (res.event_id) return res.event?.title || 'Zawody'
    if (isRecreational(res)) {
      // Pakiet rekreacyjny — admin widzi nazwisko, reszta widzi "Pakiet"
      if (isRangeStaff) {
        const name = res.guest_name || res.member?.full_name || ''
        const pkgName = res.notes?.replace('Strzelanie rekreacyjne: ', '') || 'Pakiet'
        return name ? `${name} · ${pkgName}` : pkgName
      }
      return 'Pakiet rekreacyjny'
    }
    // Imię widoczne tylko dla właściciela rezerwacji lub admina/rejestratora
    if (isRangeStaff || (member && res.member_id === member.id)) {
      return res.member?.full_name || res.guest_name || 'Zarezerwowane'
    }
    return 'Zarezerwowane'
  }

  const handleBook = async (payNow: boolean) => {
    if (!showBooking || !selectedLane) return

    // Walidacja danych gościa (gdy niezalogowany)
    if (!member) {
      if (!guestBooking.full_name || !guestBooking.email || !guestBooking.address || !guestBooking.document) {
        alert('Podaj imię i nazwisko, email, adres zamieszkania oraz numer dokumentu')
        return
      }
    }

    if (!holdToken) {
      alert('Rezerwacja wygasła. Wybierz slot ponownie.')
      setShowBooking(null)
      loadReservations()
      return
    }

    setBookingLoading(true)
    try {
      const startMin = timeToMin(showBooking.slotTime)
      const endMin = startMin + bookingSlots * 30
      const endH = Math.floor(endMin / 60)
      const endM = endMin % 60
      const startTime = showBooking.slotTime
      const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`
      const hours = (bookingSlots * 30) / 60
      const totalPln = selectedLane.price_per_hour_pln * hours * bookingStations

      // Convert hold → confirmed reservation via API
      const res = await fetch('/api/reservations/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hold_token: holdToken,
          member_id: member?.id || null,
          guest_name: member ? (member as any).full_name : guestBooking.full_name,
          guest_email: !member ? guestBooking.email : undefined,
          guest_phone: !member ? (guestBooking.phone || null) : undefined,
          guest_address: !member ? guestBooking.address : undefined,
          guest_document: !member ? guestBooking.document : undefined,
          notes: bookingNotes || null,
          paid: totalPln <= 0,
          pay_now: payNow,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert('Błąd: ' + (data.error || 'Nieznany błąd'))
        return
      }

      if (data.redirect_url) {
        window.location.href = data.redirect_url
        return
      }

      setHoldToken(null)
      setHoldExpiresAt(null)
      setShowBooking(null)
      setShowExtendPrompt(false)
      setBookingNotes('')
      setBookingSlots(2)
      setBookingStations(1)
      setGuestBooking({ full_name: '', email: '', phone: '', address: '', document: '' })
      loadReservations()
    } catch (err: any) {
      alert('Błąd rezerwacji: ' + (err.message || 'Spróbuj ponownie'))
    } finally {
      setBookingLoading(false)
    }
  }

  const handlePayExisting = async (resId: string) => {
    setPaymentLoading(resId)
    try {
      const payRes = await fetch('/api/reservations/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservation_id: resId }),
      })
      const payData = await payRes.json()
      if (payData.redirect_url) {
        window.location.href = payData.redirect_url
      }
    } catch {
      alert('Błąd płatności')
    } finally {
      setPaymentLoading(null)
    }
  }

  // Rejestrator strzelnicowy oznacza jako opłacone (gotówka)
  const handleMarkPaid = async (resId: string) => {
    if (!confirm('Oznaczyć rezerwację jako opłaconą (gotówka)?')) return
    setPaymentLoading(resId)
    try {
      await supabase.from('lane_reservations').update({ paid: true }).eq('id', resId)
      loadReservations()
    } catch {
      alert('Błąd')
    } finally {
      setPaymentLoading(null)
    }
  }

  const isPast = dateObj < new Date(new Date().toDateString())

  // Druk książki wejścia na strzelnicę
  const printEntryLog = () => {
    if (!selectedLane) return
    const dayReservations = reservations
      .filter(r => !r.event_id && r.status !== 'cancelled')
      .sort((a, b) => a.start_time.localeCompare(b.start_time))

    const dateStr = dateObj.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const rows = dayReservations.map((r, i) => `
      <tr>
        <td style="border:1px solid #ccc;padding:6px 8px;text-align:center">${i + 1}</td>
        <td style="border:1px solid #ccc;padding:6px 8px">${r.member?.full_name || r.guest_name || '—'}</td>
        <td style="border:1px solid #ccc;padding:6px 8px;text-align:center">St. ${r.station_number}</td>
        <td style="border:1px solid #ccc;padding:6px 8px;text-align:center">${r.start_time.slice(0,5)}–${r.end_time.slice(0,5)}</td>
        <td style="border:1px solid #ccc;padding:6px 8px;text-align:center">${r.paid ? '✓' : '—'}</td>
        <td style="border:1px solid #ccc;padding:6px 8px"></td>
        <td style="border:1px solid #ccc;padding:6px 8px"></td>
      </tr>
    `).join('')

    // Puste wiersze na walk-in
    const emptyRows = Array.from({ length: 10 }, (_, i) => `
      <tr>
        <td style="border:1px solid #ccc;padding:6px 8px;text-align:center;color:#999">${dayReservations.length + i + 1}</td>
        <td style="border:1px solid #ccc;padding:6px 8px" colspan="6"></td>
      </tr>
    `).join('')

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Książka wejścia</title></head><body style="font-family:Arial,sans-serif;padding:20px;font-size:13px">
      <h2 style="margin-bottom:4px">Książka wejścia na strzelnicę</h2>
      <p style="color:#666;margin-top:0">${selectedLane.name} · ${dateStr}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:12px">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="border:1px solid #ccc;padding:6px 8px;width:40px">Lp.</th>
            <th style="border:1px solid #ccc;padding:6px 8px;text-align:left">Imię i nazwisko</th>
            <th style="border:1px solid #ccc;padding:6px 8px;width:60px">Stan.</th>
            <th style="border:1px solid #ccc;padding:6px 8px;width:90px">Godziny</th>
            <th style="border:1px solid #ccc;padding:6px 8px;width:50px">Opł.</th>
            <th style="border:1px solid #ccc;padding:6px 8px;width:100px">Nr dokumentu</th>
            <th style="border:1px solid #ccc;padding:6px 8px;width:100px">Podpis</th>
          </tr>
        </thead>
        <tbody>${rows}${emptyRows}</tbody>
      </table>
      <p style="margin-top:16px;font-size:11px;color:#999">Wygenerowano: ${new Date().toLocaleString('pl-PL')}</p>
    </body></html>`

    const w = window.open('', '_blank')
    if (w) {
      w.document.write(html)
      w.document.close()
      setTimeout(() => w.print(), 500)
    }
  }

  // === On-site recreational booking ===
  const openOnsiteBooking = async () => {
    setOnsiteLoading(true)
    setOnsiteSuccess('')
    setOnsiteForm({
      package_id: '', weapon_id: '', instructor_id: '',
      start_time: '10:00', duration_minutes: '60',
      ammo_count: '50', price_pln: '0',
      guest_name: '', guest_phone: '', guest_address: '', guest_document: '', guest_email: '',
      targets: '', notes: '',
    })
    setShowOnsiteBooking(true)

    // Load weapons, packages, instructors
    const [weaponsRes, pkgsRes, instructorsRes] = await Promise.all([
      supabase.from('range_weapons').select('id, name, type, caliber, status').eq('status', 'in_stock').order('type').order('name'),
      supabase.from('shooting_packages').select('id, name, weapon_id, ammo_count, duration_minutes, price_pln').eq('is_active', true).order('name'),
      supabase.from('members').select('id, full_name').eq('role', 'instructor').eq('is_active', true).order('full_name'),
    ])

    // Also include admins as instructors
    const { data: admins } = await supabase.from('members').select('id, full_name').eq('role', 'admin').eq('is_active', true)
    const allInstructors = [...(instructorsRes.data ?? []), ...(admins ?? [])]
    const unique = Array.from(new Map(allInstructors.map(i => [i.id, i])).values())

    setOnsiteWeapons((weaponsRes.data ?? []) as RangeWeapon[])
    setOnsitePackages((pkgsRes.data ?? []) as ShootingPackage[])
    setOnsiteInstructors(unique as Instructor[])
    setOnsiteLoading(false)
  }

  const handlePackageSelect = (pkgId: string) => {
    const pkg = onsitePackages.find(p => p.id === pkgId)
    if (pkg) {
      setOnsiteForm(f => ({
        ...f,
        package_id: pkgId,
        weapon_id: pkg.weapon_id,
        ammo_count: String(pkg.ammo_count),
        duration_minutes: String(pkg.duration_minutes),
        price_pln: String(pkg.price_pln),
      }))
    } else {
      setOnsiteForm(f => ({ ...f, package_id: '' }))
    }
  }

  const handleOnsiteSubmit = async () => {
    if (!member) return
    if (!onsiteForm.weapon_id || !onsiteForm.instructor_id) {
      alert('Wybierz broń i instruktora')
      return
    }
    if (!onsiteForm.guest_name || !onsiteForm.guest_address || !onsiteForm.guest_document || !onsiteForm.guest_email) {
      alert('Podaj imię i nazwisko, adres zamieszkania, numer dokumentu oraz email klienta')
      return
    }

    setOnsiteSaving(true)
    try {
      const res = await fetch('/api/recreational/onsite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weapon_id: onsiteForm.weapon_id,
          instructor_id: onsiteForm.instructor_id,
          date: selectedDate,
          start_time: onsiteForm.start_time,
          duration_minutes: parseInt(onsiteForm.duration_minutes),
          ammo_count: parseInt(onsiteForm.ammo_count),
          price_pln: parseFloat(onsiteForm.price_pln),
          guest_name: onsiteForm.guest_name,
          guest_phone: onsiteForm.guest_phone,
          guest_address: onsiteForm.guest_address,
          guest_document: onsiteForm.guest_document,
          guest_email: onsiteForm.guest_email,
          notes: [onsiteForm.targets ? `Tarcze: ${onsiteForm.targets}` : '', onsiteForm.notes].filter(Boolean).join(' | '),
          registrar_id: member.id,
          package_id: onsiteForm.package_id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert('Błąd: ' + (data.error || 'Nieznany błąd'))
        return
      }
      setOnsiteSuccess(`Zarezerwowano: ${onsiteForm.guest_name}, ${data.weapon_name || 'broń'}, ${onsiteForm.ammo_count} szt. amunicji, ${onsiteForm.price_pln} zł`)
      loadReservations()
    } catch (err: any) {
      alert('Błąd: ' + (err.message || 'Spróbuj ponownie'))
    } finally {
      setOnsiteSaving(false)
    }
  }

  // Hour labels for the header (group 30-min slots)
  const hourLabels = useMemo(() => {
    const hours: { label: string; colSpan: number }[] = []
    if (slots.length === 0) return hours
    let currentH = slots[0].split(':')[0]
    let count = 0
    for (const s of slots) {
      const h = s.split(':')[0]
      if (h === currentH) {
        count++
      } else {
        hours.push({ label: `${currentH}:00`, colSpan: count })
        currentH = h
        count = 1
      }
    }
    hours.push({ label: `${currentH}:00`, colSpan: count })
    return hours
  }, [slots])

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Rezerwacja toru</h1>
        <p className="text-muted">Wybierz oś, dzień i stanowisko. Kliknij wolny slot, aby zarezerwować.</p>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-4 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-green-500/30 border border-green-500/50" />
          <span>Wolne</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-zinc-400/30 border border-zinc-400/50" />
          <span>Zarezerwowane</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-red-500/30 border border-red-500/50" />
          <span>Zarezerwowane i opłacone</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-amber-500/20 border border-amber-500/40 animate-pulse" />
          <span>Ktoś rezerwuje</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-purple-500/30 border border-purple-500/50" />
          <span>Pakiet rekreacyjny</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-blue-500/30 border border-blue-500/50" />
          <span>Zawody</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-4 rounded bg-orange-500/10 border border-orange-500/20" />
          <span>Tylko na miejscu</span>
        </div>
      </div>

      {lanes.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted">
          <Crosshair className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p className="font-semibold mb-1">Brak skonfigurowanych osi</p>
          <p className="text-sm">Administrator musi najpierw dodać osie strzeleckie w panelu admina.</p>
        </div>
      ) : (
        <>
          {/* Wybór osi */}
          <div className="flex flex-wrap gap-2 mb-6">
            {lanes.map(lane => (
              <button
                key={lane.id}
                onClick={() => setSelectedLane(lane)}
                className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors text-left ${
                  selectedLane?.id === lane.id
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'border-border text-muted hover:border-primary/40 hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5" />
                  {lane.name}
                </div>
                <div className="text-xs opacity-70 mt-0.5">
                  {lane.length_m}m · {lane.stations_count} stan. · {lane.open_time?.slice(0,5) || '08:00'}–{lane.close_time?.slice(0,5) || '20:00'} · {lane.price_per_hour_pln > 0 ? `${lane.price_per_hour_pln} zł/h` : 'bezpłatne'}
                </div>
              </button>
            ))}
          </div>

          {/* Nawigacja datą */}
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => setSelectedDate(formatDate(addDays(dateObj, -7)))}
              className="p-2 rounded-lg border border-border hover:bg-card transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex gap-1 flex-1 overflow-x-auto">
              {weekDays.map(day => {
                const ds = formatDate(day)
                const isSelected = ds === selectedDate
                const isTodayDay = formatDate(new Date()) === ds
                const isPastDay = day < new Date(new Date().toDateString())
                const stats = weekReservations[ds]
                const occupancy = stats ? stats.total / stats.maxSlots : 0
                const paidRatio = stats ? stats.paid / stats.maxSlots : 0
                return (
                  <button
                    key={ds}
                    onClick={() => setSelectedDate(ds)}
                    className={`flex-1 min-w-[80px] px-2 py-2 rounded-lg text-sm font-medium transition-colors relative overflow-hidden ${
                      isSelected
                        ? 'bg-primary text-background'
                        : isTodayDay
                          ? 'bg-primary/10 border border-primary text-primary'
                          : isPastDay
                            ? 'text-muted/50 border border-border/50'
                            : 'border border-border hover:bg-card text-foreground'
                    }`}
                  >
                    {/* Pasek zajętości */}
                    {!isSelected && stats && stats.total > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-background/50 rounded-b-lg overflow-hidden">
                        <div
                          className="h-full bg-red-500/60 absolute left-0 top-0 transition-all"
                          style={{ width: `${Math.min(paidRatio * 100, 100)}%` }}
                        />
                        <div
                          className="h-full bg-zinc-400/60 absolute top-0 transition-all"
                          style={{ left: `${Math.min(paidRatio * 100, 100)}%`, width: `${Math.min((occupancy - paidRatio) * 100, 100 - paidRatio * 100)}%` }}
                        />
                      </div>
                    )}
                    <div className="text-xs uppercase">{getDayName(day)}</div>
                    <div className="font-bold">{day.getDate()}</div>
                    <div className="text-xs opacity-70">{day.toLocaleDateString('pl-PL', { month: 'short' })}</div>
                    {stats && stats.total > 0 && !isSelected && (
                      <div className="text-[9px] opacity-60 mt-0.5">
                        {Math.round(occupancy * 100)}%
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setSelectedDate(formatDate(addDays(dateObj, 7)))}
              className="p-2 rounded-lg border border-border hover:bg-card transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Siatka rezerwacji - kalendarz 30 min */}
          {selectedLane && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="font-semibold">{selectedLane.name}</h2>
                  <p className="text-xs text-muted">
                    {selectedLane.length_m}m · {selectedLane.stations_count} stanowisk
                    · {selectedLane.open_time?.slice(0,5)}–{selectedLane.close_time?.slice(0,5)}
                    {selectedLane.price_per_hour_pln > 0 && ` · ${selectedLane.price_per_hour_pln} zł/h`}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {isRangeStaff && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={openOnsiteBooking}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-primary/30 text-primary rounded-lg hover:bg-primary/10 transition-colors"
                        title="Zestaw strzelecki na miejscu"
                      >
                        <Package className="w-3.5 h-3.5" />
                        Zestaw strzelecki
                      </button>
                      <button
                        onClick={printEntryLog}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-background transition-colors"
                        title="Drukuj książkę wejścia"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Książka wejścia
                      </button>
                    </div>
                  )}
                  <div className="text-sm font-medium">
                    {dateObj.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </div>
              </div>

              {/* Tap selection hint */}
              {dragStart && !showBooking && (
                <div className="flex items-center justify-between bg-primary/10 border border-primary/30 rounded-lg px-4 py-2 mb-2 text-sm">
                  <span className="text-primary font-medium">
                    Zaznaczono start: St. {dragStart.sn}, {slots[dragStart.slotIdx]} — kliknij slot końcowy
                  </span>
                  <button
                    onClick={() => { setDragStart(null); setDragEnd(null) }}
                    className="text-xs text-muted hover:text-foreground ml-3 px-2 py-1 rounded bg-background border border-border"
                  >
                    Anuluj
                  </button>
                </div>
              )}

              <div className="overflow-x-auto">
                {loadingRes ? (
                  <div className="flex items-center justify-center py-16 text-muted">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Ładowanie...
                  </div>
                ) : (
                  <table ref={gridRef} className="w-full border-collapse select-none" style={{ minWidth: `${120 + slots.length * 40}px` }}>
                    {/* Nagłówek godzin */}
                    <thead>
                      <tr className="bg-background/50">
                        <th className="py-2 px-3 text-xs text-muted font-medium text-left border-b border-border w-28" rowSpan={2}>
                          Stanowisko
                        </th>
                        {hourLabels.map((hl, i) => (
                          <th
                            key={i}
                            colSpan={hl.colSpan}
                            className="py-1 px-0 text-xs text-muted font-medium text-center border-b border-l border-border"
                          >
                            {hl.label}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-background/30">
                        {slots.map(s => (
                          <th key={s} className="py-0.5 px-0 text-[10px] text-muted/60 font-normal text-center border-b border-l border-border/50" style={{ minWidth: '38px' }}>
                            {s.split(':')[1]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stationNumbers.map(sn => (
                        <tr key={sn} className="border-b border-border/30">
                          <td className="py-0.5 px-3 text-sm font-medium border-r border-border">
                            <div className="flex items-center gap-1.5">
                              <Crosshair className="w-3.5 h-3.5 text-muted" />
                              Nr {sn}
                            </div>
                          </td>
                          {slots.map(slotTime => {
                            const key = `${sn}-${slotTime}`
                            const info = spanMap[key]

                            // If part of a reservation but not first slot, skip (colSpan handles it)
                            if (info && !info.isFirst) return null

                            if (info && info.isFirst) {
                              const { res, span } = info
                              const isMine = member && res.member_id === member.id
                              const color = isHold(res)
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 animate-pulse'
                                : res.event_id
                                  ? 'bg-blue-500/30 border-blue-500/50 text-blue-300'
                                  : isRecreational(res)
                                    ? 'bg-purple-500/30 border-purple-500/50 text-purple-300'
                                    : res.paid
                                      ? 'bg-red-500/30 border-red-500/50 text-red-300'
                                      : 'bg-zinc-400/30 border-zinc-400/50 text-zinc-300'
                              return (
                                <td key={slotTime} colSpan={span} className="py-0.5 px-0.5 border-l border-border/30">
                                  <div
                                    className={`${color} border rounded h-10 flex items-center justify-center text-[10px] font-medium px-1 relative group cursor-default`}
                                    title={`${res.start_time.slice(0,5)}–${res.end_time.slice(0,5)} · ${getSlotLabel(res)}${!res.event_id ? (res.paid ? ' (opłacone)' : ' (nieopłacone)') : ''}`}
                                  >
                                    <span className="truncate">
                                      {span >= 2 ? getSlotLabel(res) : ''}
                                    </span>
                                    {/* Właściciel: zapłać online */}
                                    {isMine && !res.paid && !res.event_id && (
                                      <button
                                        onClick={() => handlePayExisting(res.id)}
                                        disabled={paymentLoading === res.id}
                                        className="absolute -top-1 -right-1 bg-primary text-background rounded-full w-5 h-5 flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Zapłać online"
                                      >
                                        {paymentLoading === res.id ? '…' : '💳'}
                                      </button>
                                    )}
                                    {/* Rejestrator: oznacz opłacone */}
                                    {isRangeStaff && !isMine && !res.paid && !res.event_id && (
                                      <button
                                        onClick={() => handleMarkPaid(res.id)}
                                        disabled={paymentLoading === res.id}
                                        className="absolute -top-1 -right-1 bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Oznacz jako opłacone (gotówka)"
                                      >
                                        {paymentLoading === res.id ? '…' : '✓'}
                                      </button>
                                    )}
                                  </div>
                                </td>
                              )
                            }

                            // Wolny slot
                            const tooClose = isSlotTooClose(slotTime)
                            const canBook = !isPast && !tooClose
                            const slotIdx = slots.indexOf(slotTime)
                            const inSelection = canBook && isInDragSelection(sn, slotIdx)
                            return (
                              <td
                                key={slotTime}
                                className="py-0.5 px-0.5 border-l border-border/30 select-none"
                                onPointerDown={e => { e.preventDefault(); canBook && handlePointerDown(sn, slotIdx, e.pointerType) }}
                                onMouseEnter={() => canBook && handleDragMove(sn, slotIdx)}
                                onClick={() => canBook && handleSlotClick(sn, slotIdx)}
                                title={tooClose ? `Rezerwacja online min. ${selectedLane?.min_advance_minutes ?? 60} min wcześniej` : undefined}
                              >
                                <div
                                  className={`rounded h-10 border transition-all ${
                                    inSelection
                                      ? 'bg-primary/30 border-primary/60 ring-1 ring-primary/40'
                                      : tooClose
                                        ? 'bg-orange-500/10 border-orange-500/20 cursor-not-allowed'
                                        : canBook
                                          ? 'bg-green-500/15 border-green-500/30 hover:bg-green-500/30 hover:border-green-500/50 cursor-pointer'
                                          : 'bg-green-500/10 border-green-500/20'
                                  }`}
                                />
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {!member && (
            <div className="mt-4 bg-card border border-border rounded-xl p-4 text-center">
              <p className="text-sm text-muted">Kliknij lub przeciągnij po wolnych slotach, aby zarezerwować tor. Nie musisz być zalogowany.</p>
            </div>
          )}
        </>
      )}

      {/* Modal rezerwacji */}
      {showBooking && selectedLane && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { releaseHold(); setShowBooking(null) }}>
          <div className="bg-card border border-border rounded-xl max-w-lg w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header — sticky */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold">Rezerwacja toru</h3>
                  {holdTimeLeft > 0 && (
                    <span className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                      holdTimeLeft <= 30 ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/15 text-amber-400'
                    }`}>
                      {Math.floor(holdTimeLeft / 60)}:{(holdTimeLeft % 60).toString().padStart(2, '0')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted">
                  {selectedLane.name} ({selectedLane.length_m}m) · St. {showBooking.stationNumber}
                  {bookingStations > 1 && `–${showBooking.stationNumber + bookingStations - 1}`}
                  {' · '}{dateObj.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {' · '}{showBooking.slotTime}–{(() => {
                    const endMin = timeToMin(showBooking.slotTime) + bookingSlots * 30
                    return `${Math.floor(endMin / 60).toString().padStart(2, '0')}:${(endMin % 60).toString().padStart(2, '0')}`
                  })()}
                </p>
              </div>
              <button onClick={() => { releaseHold(); setShowBooking(null) }} className="p-1.5 rounded-lg hover:bg-background">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Extend hold prompt */}
            {showExtendPrompt && (
              <div className="mx-5 mt-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center justify-between gap-3">
                <p className="text-sm text-amber-300">Potrzebujesz więcej czasu?</p>
                <button
                  onClick={extendHold}
                  disabled={holdExtending}
                  className="px-3 py-1.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-lg text-sm font-medium hover:bg-amber-500/30 transition-colors disabled:opacity-50"
                >
                  {holdExtending ? 'Przedłużam...' : 'Przedłuż o 3 min'}
                </button>
              </div>
            )}

            {/* Scrollable content */}
            <div className="overflow-y-auto px-5 py-4 space-y-4 text-sm flex-1">
              {/* Stanowiska + Czas w jednym rzędzie */}
              <div className="grid grid-cols-2 gap-4">
                {selectedLane.stations_count > 1 && (
                  <div>
                    <label className="block text-xs text-muted mb-1.5 font-medium">Stanowiska</label>
                    <div className="flex flex-wrap gap-1">
                      {Array.from({ length: Math.min(selectedLane.stations_count - showBooking.stationNumber + 1, 4) }, (_, i) => i + 1).map(n => {
                        const available = areAdjacentStationsFree(showBooking.stationNumber, n, showBooking.slotTime, bookingSlots)
                        return (
                          <button
                            key={n}
                            disabled={!available}
                            onClick={() => setBookingStations(n)}
                            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                              bookingStations === n
                                ? 'bg-primary/10 border-primary text-primary'
                                : available
                                  ? 'border-border hover:border-primary/40'
                                  : 'border-border/30 text-muted/30 cursor-not-allowed'
                            }`}
                          >
                            {n}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                <div className={selectedLane.stations_count <= 1 ? 'col-span-2' : ''}>
                  <label className="block text-xs text-muted mb-1.5 font-medium">Czas trwania</label>
                  <div className="flex flex-wrap gap-1">
                    {[1, 2, 3, 4, 6, 8].map(s => {
                      const mins = s * 30
                      const label = mins >= 60
                        ? `${Math.floor(mins / 60)}h${mins % 60 ? '30' : ''}`
                        : `${mins}min`
                      const available = areAdjacentStationsFree(showBooking.stationNumber, bookingStations, showBooking.slotTime, s)
                      return (
                        <button
                          key={s}
                          disabled={!available}
                          onClick={() => setBookingSlots(s)}
                          className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
                            bookingSlots === s
                              ? 'bg-primary/10 border-primary text-primary'
                              : available
                                ? 'border-border hover:border-primary/40'
                                : 'border-border/30 text-muted/30 cursor-not-allowed'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Dane gościa — kompaktowe (gdy niezalogowany) */}
              {!member && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted mb-2 font-medium">Twoje dane *</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={guestBooking.full_name}
                      onChange={e => setGuestBooking(f => ({ ...f, full_name: e.target.value }))}
                      placeholder="Imię i nazwisko *"
                      className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    />
                    <input
                      type="email"
                      value={guestBooking.email}
                      onChange={e => setGuestBooking(f => ({ ...f, email: e.target.value }))}
                      placeholder="Email *"
                      className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      value={guestBooking.address}
                      onChange={e => setGuestBooking(f => ({ ...f, address: e.target.value }))}
                      placeholder="Adres zamieszkania *"
                      className="col-span-2 px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    />
                    <input
                      type="text"
                      value={guestBooking.document}
                      onChange={e => setGuestBooking(f => ({ ...f, document: e.target.value }))}
                      placeholder="Nr dowodu / paszportu *"
                      className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    />
                    <input
                      type="tel"
                      value={guestBooking.phone}
                      onChange={e => setGuestBooking(f => ({ ...f, phone: e.target.value }))}
                      placeholder="Telefon"
                      className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    />
                  </div>
                  <p className="text-[10px] text-muted mt-1">Potwierdzenie rezerwacji zostanie wysłane na podany email</p>
                </div>
              )}

              {/* Uwagi */}
              <input
                type="text"
                value={bookingNotes}
                onChange={e => setBookingNotes(e.target.value)}
                placeholder="Uwagi (opcjonalnie)"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
              />
            </div>

            {/* Footer — sticky: cena + przyciski */}
            <div className="px-5 py-3 border-t border-border shrink-0 space-y-2">
              {selectedLane.price_per_hour_pln > 0 && (
                <div className="flex justify-between text-sm font-semibold mb-1">
                  <span>Do zapłaty:</span>
                  <span className="text-primary">
                    {(selectedLane.price_per_hour_pln * (bookingSlots * 30) / 60 * bookingStations).toFixed(2)} zł
                    {bookingStations > 1 && <span className="text-xs font-normal text-muted ml-1">({bookingStations} × {(selectedLane.price_per_hour_pln * (bookingSlots * 30) / 60).toFixed(2)} zł)</span>}
                  </span>
                </div>
              )}
              {(() => {
                const guestInvalid = !member && (!guestBooking.full_name || !guestBooking.email || !guestBooking.address || !guestBooking.document)
                return selectedLane.price_per_hour_pln > 0 ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleBook(true)}
                      disabled={bookingLoading || guestInvalid}
                      className="flex items-center justify-center gap-2 flex-1 px-4 py-2.5 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 text-sm"
                    >
                      {bookingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                      Zapłać online
                    </button>
                    <button
                      onClick={() => handleBook(false)}
                      disabled={bookingLoading || guestInvalid}
                      className="flex items-center justify-center gap-2 flex-1 px-4 py-2.5 border border-border font-medium rounded-lg hover:bg-background transition-colors disabled:opacity-50 text-sm"
                    >
                      <Clock className="w-4 h-4" />
                      Na miejscu
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleBook(false)}
                    disabled={bookingLoading || guestInvalid}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 text-sm"
                  >
                    {bookingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Zarezerwuj
                  </button>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* On-site recreational booking modal */}
      {showOnsiteBooking && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Zestaw strzelecki na miejscu
              </h2>
              <button onClick={() => setShowOnsiteBooking(false)} className="p-1 text-muted hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {onsiteSuccess ? (
              <div className="text-center py-8">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="font-semibold mb-2">Zarezerwowano!</p>
                <p className="text-sm text-muted mb-4">{onsiteSuccess}</p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => { setOnsiteSuccess(''); setOnsiteForm(f => ({ ...f, guest_name: '', guest_phone: '', guest_address: '', guest_document: '', guest_email: '', targets: '', notes: '' })) }}
                    className="px-4 py-2 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark"
                  >
                    Kolejny klient
                  </button>
                  <button
                    onClick={() => setShowOnsiteBooking(false)}
                    className="px-4 py-2 border border-border text-sm rounded-lg hover:bg-card-hover"
                  >
                    Zamknij
                  </button>
                </div>
              </div>
            ) : onsiteLoading ? (
              <div className="flex items-center justify-center py-12 text-muted">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Ładowanie danych...
              </div>
            ) : (
              <div className="space-y-4">
                {/* Gotowy pakiet */}
                {onsitePackages.length > 0 && (
                  <div>
                    <label className="text-xs text-muted block mb-1">Gotowy pakiet (opcjonalnie)</label>
                    <select
                      value={onsiteForm.package_id}
                      onChange={e => handlePackageSelect(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    >
                      <option value="">— Własny zestaw —</option>
                      {onsitePackages.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} · {p.ammo_count} szt. · {p.duration_minutes} min · {Number(p.price_pln).toFixed(0)} zł
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Broń */}
                <div>
                  <label className="text-xs text-muted block mb-1">Broń *</label>
                  <select
                    value={onsiteForm.weapon_id}
                    onChange={e => setOnsiteForm(f => ({ ...f, weapon_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                  >
                    <option value="">Wybierz broń...</option>
                    {onsiteWeapons.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.caliber}) — {w.type === 'pistol' ? 'Pistolet' : w.type === 'rifle' ? 'Karabin' : w.type === 'shotgun' ? 'Strzelba' : 'Inne'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Instruktor */}
                <div>
                  <label className="text-xs text-muted block mb-1">Instruktor *</label>
                  <select
                    value={onsiteForm.instructor_id}
                    onChange={e => setOnsiteForm(f => ({ ...f, instructor_id: e.target.value }))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                  >
                    <option value="">Wybierz instruktora...</option>
                    {onsiteInstructors.map(i => (
                      <option key={i.id} value={i.id}>{i.full_name}</option>
                    ))}
                  </select>
                </div>

                {/* Czas */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted block mb-1">Godzina rozpoczęcia</label>
                    <input
                      type="time"
                      value={onsiteForm.start_time}
                      onChange={e => setOnsiteForm(f => ({ ...f, start_time: e.target.value }))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Czas trwania (min)</label>
                    <select
                      value={onsiteForm.duration_minutes}
                      onChange={e => setOnsiteForm(f => ({ ...f, duration_minutes: e.target.value }))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    >
                      <option value="30">30 min</option>
                      <option value="60">1 godzina</option>
                      <option value="90">1,5 godziny</option>
                      <option value="120">2 godziny</option>
                    </select>
                  </div>
                </div>

                {/* Amunicja i cena */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted block mb-1">Liczba naboi</label>
                    <input
                      type="number"
                      min="0"
                      value={onsiteForm.ammo_count}
                      onChange={e => setOnsiteForm(f => ({ ...f, ammo_count: e.target.value }))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Cena (zł)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={onsiteForm.price_pln}
                      onChange={e => setOnsiteForm(f => ({ ...f, price_pln: e.target.value }))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    />
                  </div>
                </div>

                {/* Tarcze */}
                <div>
                  <label className="text-xs text-muted block mb-1">Tarcze</label>
                  <input
                    type="text"
                    value={onsiteForm.targets}
                    onChange={e => setOnsiteForm(f => ({ ...f, targets: e.target.value }))}
                    placeholder="Np. 2x tarcza sportowa 50m, 3x sylwetka"
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                  />
                </div>

                {/* Dane klienta (wymagane do książki wejścia) */}
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted mb-2 font-medium">Dane klienta (do książki wejścia na strzelnicę) *</p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">Imię i nazwisko *</label>
                      <input
                        type="text"
                        value={onsiteForm.guest_name}
                        onChange={e => setOnsiteForm(f => ({ ...f, guest_name: e.target.value }))}
                        placeholder="Jan Kowalski"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Adres zamieszkania *</label>
                      <input
                        type="text"
                        value={onsiteForm.guest_address}
                        onChange={e => setOnsiteForm(f => ({ ...f, guest_address: e.target.value }))}
                        placeholder="ul. Strzelecka 1, 00-001 Warszawa"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Nr i seria dowodu / nr paszportu *</label>
                      <input
                        type="text"
                        value={onsiteForm.guest_document}
                        onChange={e => setOnsiteForm(f => ({ ...f, guest_document: e.target.value }))}
                        placeholder="ABC 123456"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Email *</label>
                      <input
                        type="email"
                        value={onsiteForm.guest_email}
                        onChange={e => setOnsiteForm(f => ({ ...f, guest_email: e.target.value }))}
                        placeholder="jan@example.com"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                      />
                      <p className="text-[10px] text-muted mt-1">Na ten adres zostanie wysłany regulamin strzelnicy</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Telefon</label>
                      <input
                        type="tel"
                        value={onsiteForm.guest_phone}
                        onChange={e => setOnsiteForm(f => ({ ...f, guest_phone: e.target.value }))}
                        placeholder="+48..."
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Uwagi</label>
                  <textarea
                    value={onsiteForm.notes}
                    onChange={e => setOnsiteForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Dodatkowe informacje..."
                    rows={2}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none"
                  />
                </div>

                {/* Podsumowanie */}
                {onsiteForm.weapon_id && (
                  <div className="bg-background rounded-lg p-3 text-sm space-y-1 border border-border">
                    <p className="font-semibold">Podsumowanie:</p>
                    <p>Broń: <span className="text-primary">{onsiteWeapons.find(w => w.id === onsiteForm.weapon_id)?.name}</span></p>
                    <p>Amunicja: {onsiteForm.ammo_count} szt.</p>
                    <p>Czas: {onsiteForm.start_time} · {onsiteForm.duration_minutes} min</p>
                    <p className="font-semibold text-lg pt-1 border-t border-border mt-1">
                      Do zapłaty: <span className="text-primary">{Number(onsiteForm.price_pln).toFixed(2)} zł</span>
                    </p>
                  </div>
                )}

                <button
                  onClick={handleOnsiteSubmit}
                  disabled={onsiteSaving || !onsiteForm.weapon_id || !onsiteForm.instructor_id || !onsiteForm.guest_name || !onsiteForm.guest_address || !onsiteForm.guest_document || !onsiteForm.guest_email}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {onsiteSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Zarejestruj i oznacz jako opłacone (gotówka)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
          &larr; Wróć na stronę główną
        </Link>
      </div>
    </div>
  )
}
