'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { timeToMin } from '@/lib/date'
import type { Lane, Reservation } from './types'

interface UseBookingParams {
  selectedLane: Lane | null
  selectedDate: string
  member: any
  holdToken: string | null
  setHoldToken: (val: string | null) => void
  setHoldExpiresAt: (val: Date | null) => void
  setHoldTimeLeft: (val: number) => void
  setShowExtendPrompt: (val: boolean) => void
  loadReservations: () => void
  slots: string[]
  slotMap: Record<string, Reservation>
  closeMin: number
}

export function useBooking({
  selectedLane,
  selectedDate,
  member,
  holdToken,
  setHoldToken,
  setHoldExpiresAt,
  setHoldTimeLeft,
  setShowExtendPrompt,
  loadReservations,
  slots,
  slotMap,
  closeMin,
}: UseBookingParams) {
  const supabase = createSupabaseBrowser()
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

      // Convert hold -> confirmed reservation via API
      const res = await fetch('/api/reservations/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hold_token: holdToken,
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

  // Rejestrator strzelnicowy oznacza jako opłacone (gotówka) — via API with auth check
  const handleMarkPaid = async (resId: string) => {
    if (!confirm('Oznaczyć rezerwację jako opłaconą (gotówka)?')) return
    setPaymentLoading(resId)
    try {
      const res = await fetch('/api/reservations/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservation_id: resId }),
      })
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Błąd')
        return
      }
      loadReservations()
    } catch {
      alert('Błąd')
    } finally {
      setPaymentLoading(null)
    }
  }

  return {
    showBooking,
    setShowBooking,
    bookingSlots,
    setBookingSlots,
    bookingStations,
    setBookingStations,
    bookingNotes,
    setBookingNotes,
    bookingLoading,
    guestBooking,
    setGuestBooking,
    paymentLoading,
    isSlotFree,
    areAdjacentStationsFree,
    openBookingFromSelection,
    handleBook,
    handlePayExisting,
    handleMarkPaid,
  }
}
