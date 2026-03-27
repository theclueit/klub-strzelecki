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
    setReservations((data ?? []) as any[])
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

  const handleDragStart = (sn: number, slotIdx: number) => {
    if (isPast) return
    isDragging.current = true
    setDragStart({ sn, slotIdx })
    setDragEnd({ sn, slotIdx })
  }

  const handleDragMove = (sn: number, slotIdx: number) => {
    if (!isDragging.current) return
    setDragEnd({ sn, slotIdx })
  }

  const handleDragEnd = () => {
    if (!isDragging.current || !dragStart || !dragEnd) {
      isDragging.current = false
      setDragStart(null)
      setDragEnd(null)
      return
    }
    isDragging.current = false

    const sel = {
      minSn: Math.min(dragStart.sn, dragEnd.sn),
      maxSn: Math.max(dragStart.sn, dragEnd.sn),
      minSlot: Math.min(dragStart.slotIdx, dragEnd.slotIdx),
      maxSlot: Math.max(dragStart.slotIdx, dragEnd.slotIdx),
    }

    // Check all selected slots are free
    const slotCount = sel.maxSlot - sel.minSlot + 1
    let allFree = true
    for (let sn = sel.minSn; sn <= sel.maxSn; sn++) {
      for (let si = sel.minSlot; si <= sel.maxSlot; si++) {
        const key = `${sn}-${slots[si]}`
        if (slotMap[key]) { allFree = false; break }
      }
      if (!allFree) break
    }

    if (allFree && slots[sel.minSlot]) {
      const stationCount = sel.maxSn - sel.minSn + 1
      setShowBooking({ stationNumber: sel.minSn, slotTime: slots[sel.minSlot] })
      setBookingSlots(slotCount)
      setBookingStations(stationCount)
    }

    setDragStart(null)
    setDragEnd(null)
  }

  // Global mouseup listener to end drag even if mouse leaves the grid
  useEffect(() => {
    const onUp = () => {
      if (isDragging.current) handleDragEnd()
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [dragStart, dragEnd, slots, slotMap])

  const getSlotColor = (res: Reservation | undefined) => {
    if (!res) return 'bg-green-500/20 border-green-500/40 hover:bg-green-500/30' // wolne
    if (res.event_id) return 'bg-blue-500/30 border-blue-500/50' // zawody
    if (res.paid) return 'bg-red-500/30 border-red-500/50' // opłacone
    return 'bg-zinc-400/30 border-zinc-400/50' // zarezerwowane nieopłacone
  }

  const isRangeStaff = member && (member.role === 'admin' || member.role === 'registrar' || member.role === 'range_registrar')

  const getSlotLabel = (res: Reservation) => {
    if (res.event_id) return res.event?.title || 'Zawody'
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

      if (member) {
        // Zalogowany użytkownik — bezpośredni insert przez Supabase
        const inserts = Array.from({ length: bookingStations }, (_, i) => ({
          lane_id: selectedLane.id,
          station_number: showBooking.stationNumber + i,
          member_id: member.id,
          reservation_date: selectedDate,
          start_time: startTime,
          end_time: endTime,
          status: 'reserved',
          paid: totalPln <= 0,
          notes: bookingNotes || null,
        }))

        const { data: resArr, error } = await supabase
          .from('lane_reservations')
          .insert(inserts)
          .select()

        if (error) throw error
        const firstRes = resArr?.[0]

        if (payNow && totalPln > 0 && firstRes) {
          const payRes = await fetch('/api/reservations/pay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reservation_id: firstRes.id }),
          })
          const payData = await payRes.json()
          if (payData.redirect_url) {
            window.location.href = payData.redirect_url
            return
          }
        }
      } else {
        // Gość — API tworzy konto i rezerwację
        const res = await fetch('/api/reservations/guest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lane_id: selectedLane.id,
            station_number: showBooking.stationNumber,
            stations_count: bookingStations,
            reservation_date: selectedDate,
            start_time: startTime,
            end_time: endTime,
            notes: bookingNotes || null,
            guest_name: guestBooking.full_name,
            guest_email: guestBooking.email,
            guest_phone: guestBooking.phone || null,
            guest_address: guestBooking.address,
            guest_document: guestBooking.document,
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
      }

      setShowBooking(null)
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
          <span className="w-4 h-4 rounded bg-blue-500/30 border border-blue-500/50" />
          <span>Zawody</span>
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

              <div className="overflow-x-auto">
                {loadingRes ? (
                  <div className="flex items-center justify-center py-16 text-muted">
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Ładowanie...
                  </div>
                ) : (
                  <table className="w-full border-collapse select-none" style={{ minWidth: `${120 + slots.length * 40}px` }}>
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
                              const color = res.event_id
                                ? 'bg-blue-500/30 border-blue-500/50 text-blue-300'
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
                            const canBook = !isPast
                            const slotIdx = slots.indexOf(slotTime)
                            const inSelection = canBook && isInDragSelection(sn, slotIdx)
                            return (
                              <td
                                key={slotTime}
                                className="py-0.5 px-0.5 border-l border-border/30 select-none"
                                onMouseDown={e => { e.preventDefault(); canBook && handleDragStart(sn, slotIdx) }}
                                onMouseEnter={() => canBook && handleDragMove(sn, slotIdx)}
                                onMouseUp={() => canBook && handleDragEnd()}
                              >
                                <div
                                  className={`rounded h-10 border transition-all ${
                                    inSelection
                                      ? 'bg-primary/30 border-primary/60 ring-1 ring-primary/40'
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowBooking(null)}>
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Rezerwacja toru</h3>
              <button onClick={() => setShowBooking(null)} className="p-1 rounded hover:bg-background">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-6 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Oś:</span>
                <span className="font-medium">{selectedLane.name} ({selectedLane.length_m}m)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Stanowisko:</span>
                <span className="font-medium">Nr {showBooking.stationNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Data:</span>
                <span className="font-medium">{dateObj.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Od:</span>
                <span className="font-medium">{showBooking.slotTime}</span>
              </div>

              {/* Liczba stanowisk */}
              {selectedLane.stations_count > 1 && (
                <div>
                  <label className="block text-muted mb-1">Liczba stanowisk:</label>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: Math.min(selectedLane.stations_count - showBooking.stationNumber + 1, 4) }, (_, i) => i + 1).map(n => {
                      const available = areAdjacentStationsFree(showBooking.stationNumber, n, showBooking.slotTime, bookingSlots)
                      return (
                        <button
                          key={n}
                          disabled={!available}
                          onClick={() => setBookingStations(n)}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                            bookingStations === n
                              ? 'bg-primary/10 border-primary text-primary'
                              : available
                                ? 'border-border hover:border-primary/40'
                                : 'border-border/30 text-muted/30 cursor-not-allowed'
                          }`}
                        >
                          {n} {n === 1 ? 'stanowisko' : n < 5 ? 'stanowiska' : 'stanowisk'}
                        </button>
                      )
                    })}
                  </div>
                  {bookingStations > 1 && (
                    <p className="text-xs text-muted mt-1">
                      Stanowiska: {showBooking.stationNumber}–{showBooking.stationNumber + bookingStations - 1}
                    </p>
                  )}
                </div>
              )}

              {/* Czas trwania w slotach 30-min */}
              <div>
                <label className="block text-muted mb-1">Czas trwania:</label>
                <div className="flex flex-wrap gap-1.5">
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
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
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

              {/* Preview: do kiedy */}
              <div className="flex justify-between text-muted">
                <span>Do:</span>
                <span className="font-medium text-foreground">
                  {(() => {
                    const endMin = timeToMin(showBooking.slotTime) + bookingSlots * 30
                    const h = Math.floor(endMin / 60)
                    const m = endMin % 60
                    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
                  })()}
                </span>
              </div>

              {/* Formularz danych gościa (gdy niezalogowany) */}
              {!member && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted mb-2 font-medium">Dane do rezerwacji *</p>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-muted block mb-1">Imię i nazwisko *</label>
                      <input
                        type="text"
                        value={guestBooking.full_name}
                        onChange={e => setGuestBooking(f => ({ ...f, full_name: e.target.value }))}
                        placeholder="Jan Kowalski"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Email *</label>
                      <input
                        type="email"
                        value={guestBooking.email}
                        onChange={e => setGuestBooking(f => ({ ...f, email: e.target.value }))}
                        placeholder="jan@example.com"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                      />
                      <p className="text-[10px] text-muted mt-0.5">Potwierdzenie rezerwacji zostanie wysłane na ten adres</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Adres zamieszkania *</label>
                      <input
                        type="text"
                        value={guestBooking.address}
                        onChange={e => setGuestBooking(f => ({ ...f, address: e.target.value }))}
                        placeholder="ul. Strzelecka 1, 00-001 Warszawa"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Nr i seria dowodu / paszportu *</label>
                      <input
                        type="text"
                        value={guestBooking.document}
                        onChange={e => setGuestBooking(f => ({ ...f, document: e.target.value }))}
                        placeholder="ABC 123456"
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Telefon</label>
                      <input
                        type="tel"
                        value={guestBooking.phone}
                        onChange={e => setGuestBooking(f => ({ ...f, phone: e.target.value }))}
                        placeholder="+48..."
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-muted mb-1">Uwagi (opcjonalnie):</label>
                <input
                  type="text"
                  value={bookingNotes}
                  onChange={e => setBookingNotes(e.target.value)}
                  placeholder="Np. strzelanie z karabinu .308"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                />
              </div>

              {selectedLane.price_per_hour_pln > 0 && (
                <div className="flex justify-between pt-2 border-t border-border font-semibold">
                  <span>Do zapłaty:</span>
                  <span className="text-primary">
                    {(selectedLane.price_per_hour_pln * (bookingSlots * 30) / 60 * bookingStations).toFixed(2)} zł
                    {bookingStations > 1 && <span className="text-xs font-normal text-muted ml-1">({bookingStations} × {(selectedLane.price_per_hour_pln * (bookingSlots * 30) / 60).toFixed(2)} zł)</span>}
                  </span>
                </div>
              )}
            </div>

            {(() => {
              const guestInvalid = !member && (!guestBooking.full_name || !guestBooking.email || !guestBooking.address || !guestBooking.document)
              return (
                <div className="space-y-2">
                  {selectedLane.price_per_hour_pln > 0 ? (
                    <>
                      <button
                        onClick={() => handleBook(true)}
                        disabled={bookingLoading || guestInvalid}
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                      >
                        {bookingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                        Rezerwuj i zapłać online
                      </button>
                      <button
                        onClick={() => handleBook(false)}
                        disabled={bookingLoading || guestInvalid}
                        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 border border-border text-sm font-medium rounded-lg hover:bg-background transition-colors disabled:opacity-50"
                      >
                        <Clock className="w-4 h-4" />
                        Rezerwuj — zapłacę na miejscu
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleBook(false)}
                      disabled={bookingLoading || guestInvalid}
                      className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                    >
                      {bookingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Zarezerwuj
                    </button>
                  )}
                </div>
              )
            })()}
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
