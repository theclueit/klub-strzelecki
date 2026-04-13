import { useState, useEffect, useMemo, useCallback } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { formatDate, addDays, timeToMin } from '@/lib/date'
import type { RecPackage, Lane, TimeSlot, CartItem, GuestForm } from './types'

export function useRecreationalBooking(packages: RecPackage[], lanes: Lane[]) {
  const { member } = useAuth()
  const supabase = createSupabaseBrowser()

  const [selectedPkg, setSelectedPkg] = useState<RecPackage | null>(null)
  const [selectedDate, setSelectedDate] = useState(() => formatDate(addDays(new Date(), 1)))
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [bookingLoading, setBookingLoading] = useState(false)

  const emptyGuest = (): GuestForm => ({ name: '', email: '', phone: '', address: '', document: '' })
  const [guestForms, setGuestForms] = useState<GuestForm[]>([emptyGuest()])
  const [notes, setNotes] = useState('')
  const peopleCount = guestForms.length
  const [bookingSuccess, setBookingSuccess] = useState(false)
  const [cart, setCart] = useState<CartItem[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const saved = sessionStorage.getItem('rec-cart')
      return saved ? JSON.parse(saved) : []
    } catch { return [] }
  })
  const [showCart, setShowCart] = useState(false)
  const [sameDayPrompt, setSameDayPrompt] = useState(false)
  const [showRearrangePrompt, setShowRearrangePrompt] = useState(false)

  useEffect(() => {
    try {
      if (cart.length > 0) {
        sessionStorage.setItem('rec-cart', JSON.stringify(cart))
      } else {
        sessionStorage.removeItem('rec-cart')
      }
    } catch {}
  }, [cart])

  const dateObj = useMemo(() => new Date(selectedDate + 'T00:00:00'), [selectedDate])
  const isPast = dateObj <= new Date(new Date().toDateString())

  const cartPkgIds = useMemo(() => new Set(cart.map(c => c.pkg.id)), [cart])

  const groupedPackages = useMemo(() => {
    const groups: Record<string, RecPackage[]> = {}
    for (const pkg of packages) {
      if (cartPkgIds.has(pkg.id)) continue
      const type = pkg.weapon?.type || 'other'
      if (!groups[type]) groups[type] = []
      groups[type].push(pkg)
    }
    return groups
  }, [packages, cartPkgIds])

  const loadAvailableSlots = useCallback(async () => {
    if (!selectedPkg || isPast) {
      setAvailableSlots([])
      return
    }
    setLoadingSlots(true)
    try {
      const dayOfWeek = dateObj.getDay()

      const { data: avails } = await supabase
        .from('instructor_availability')
        .select('*, instructor:members!instructor_availability_instructor_id_fkey(id, full_name)')
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)

      const { data: existingBookings } = await supabase
        .from('recreational_bookings')
        .select('instructor_id, weapon_id, start_time, end_time')
        .eq('booking_date', selectedDate)
        .neq('status', 'cancelled')

      const { data: laneRes } = await supabase
        .from('lane_reservations')
        .select('lane_id, station_number, start_time, end_time')
        .eq('reservation_date', selectedDate)
        .neq('status', 'cancelled')

      const slots: TimeSlot[] = []

      for (const avail of (avails ?? [])) {
        const instructor = avail.instructor as any
        if (!instructor) continue

        const startMin = timeToMin(avail.start_time)
        const endMin = timeToMin(avail.end_time)
        const slotDuration = selectedPkg.duration_minutes

        for (let m = startMin; m + slotDuration <= endMin; m += 30) {
          const slotStart = `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`
          const slotEndMin = m + slotDuration

          const instructorBusy = (existingBookings ?? []).some(b =>
            b.instructor_id === instructor.id &&
            timeToMin(b.start_time) < slotEndMin &&
            timeToMin(b.end_time) > m
          )
          if (instructorBusy) continue

          const weaponBusy = (existingBookings ?? []).some(b =>
            b.weapon_id === selectedPkg.weapon_id &&
            timeToMin(b.start_time) < slotEndMin &&
            timeToMin(b.end_time) > m
          )
          if (weaponBusy) continue

          let hasFreeLane = false
          for (const lane of lanes) {
            const laneOpenMin = timeToMin(lane.open_time || '08:00')
            const laneCloseMin = timeToMin(lane.close_time || '20:00')
            if (m < laneOpenMin || slotEndMin > laneCloseMin) continue

            for (let sn = 1; sn <= lane.stations_count; sn++) {
              const stationBusy = (laneRes ?? []).some(r =>
                r.lane_id === lane.id &&
                r.station_number === sn &&
                timeToMin(r.start_time) < slotEndMin &&
                timeToMin(r.end_time) > m
              )
              if (!stationBusy) { hasFreeLane = true; break }
            }
            if (hasFreeLane) break
          }
          if (!hasFreeLane && lanes.length > 0) continue

          const existing = slots.find(s => s.time === slotStart)
          if (!existing) {
            slots.push({
              time: slotStart,
              available: true,
              instructorId: instructor.id,
              instructorName: instructor.full_name,
            })
          }
        }
      }

      slots.sort((a, b) => a.time.localeCompare(b.time))
      setAvailableSlots(slots)
    } catch (err) {
      console.error('Error loading slots:', err)
    } finally {
      setLoadingSlots(false)
    }
  }, [selectedPkg, selectedDate, isPast, lanes])

  useEffect(() => { loadAvailableSlots() }, [loadAvailableSlots])

  const lastCartEndMin = useMemo(() => {
    if (cart.length === 0) return null
    const sameDateItems = cart.filter(c => c.date === selectedDate)
    if (sameDateItems.length === 0) return null
    let maxEnd = 0
    for (const item of sameDateItems) {
      const end = timeToMin(item.slot.time) + item.pkg.duration_minutes
      if (end > maxEnd) maxEnd = end
    }
    return maxEnd
  }, [cart, selectedDate])

  const suggestedSlotInfo = useMemo(() => {
    if (!lastCartEndMin || availableSlots.length === 0) return null
    const nextSlot = availableSlots.find(s => timeToMin(s.time) >= lastCartEndMin)
    if (!nextSlot) return null
    const gapMin = timeToMin(nextSlot.time) - lastCartEndMin
    return { slot: nextSlot, gapMin }
  }, [lastCartEndMin, availableSlots])

  const rearrangeInfo = useMemo(() => {
    if (!selectedPkg || !lastCartEndMin || availableSlots.length === 0) return null
    const continuous = availableSlots.find(s => timeToMin(s.time) === lastCartEndMin)
    if (continuous) return null

    const sameDateItems = cart.filter(c => c.date === selectedDate)
    const totalDurationMin = sameDateItems.reduce((sum, c) => sum + c.pkg.duration_minutes, 0) + selectedPkg.duration_minutes

    for (const startSlot of availableSlots) {
      const blockStartMin = timeToMin(startSlot.time)
      const blockEndMin = blockStartMin + totalDurationMin

      let allAvailable = true
      for (let m = blockStartMin; m < blockEndMin; m += 30) {
        const timeStr = `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`
        if (!availableSlots.some(s => s.time === timeStr)) {
          allAvailable = false
          break
        }
      }
      if (!allAvailable) continue

      const newPkgStartMin = blockStartMin + (totalDurationMin - selectedPkg.duration_minutes)
      const newPkgSlot = availableSlots.find(s => timeToMin(s.time) === newPkgStartMin)
      if (!newPkgSlot) continue

      const endTime = `${Math.floor(blockEndMin / 60).toString().padStart(2, '0')}:${(blockEndMin % 60).toString().padStart(2, '0')}`
      return {
        startTime: startSlot.time,
        endTime,
        newPkgSlot,
        cartRemap: sameDateItems.map((item, idx) => {
          const itemStartMin = blockStartMin + sameDateItems.slice(0, idx).reduce((s, c) => s + c.pkg.duration_minutes, 0)
          const itemEndMin = itemStartMin + item.pkg.duration_minutes
          return {
            cartIndex: cart.indexOf(item),
            startTime: `${Math.floor(itemStartMin / 60).toString().padStart(2, '0')}:${(itemStartMin % 60).toString().padStart(2, '0')}`,
            endTime: `${Math.floor(itemEndMin / 60).toString().padStart(2, '0')}:${(itemEndMin % 60).toString().padStart(2, '0')}`,
            slot: availableSlots.find(s => s.time === `${Math.floor(itemStartMin / 60).toString().padStart(2, '0')}:${(itemStartMin % 60).toString().padStart(2, '0')}`) || item.slot,
          }
        }),
      }
    }
    return null
  }, [selectedPkg, lastCartEndMin, availableSlots, cart, selectedDate])

  useEffect(() => {
    if (cart.length > 0 && selectedPkg && !selectedSlot && lastCartEndMin && availableSlots.length > 0) {
      const continuous = availableSlots.find(s => timeToMin(s.time) === lastCartEndMin)
      if (continuous) {
        setSelectedSlot(continuous)
        setShowRearrangePrompt(false)
      } else if (rearrangeInfo) {
        setShowRearrangePrompt(true)
      } else if (suggestedSlotInfo) {
        setSelectedSlot(suggestedSlotInfo.slot)
      }
    }
  }, [suggestedSlotInfo, cart.length, selectedPkg, lastCartEndMin, availableSlots, rearrangeInfo])

  function acceptRearrangement() {
    if (!rearrangeInfo) return
    setCart(prev => {
      const updated = [...prev]
      for (const remap of rearrangeInfo.cartRemap) {
        if (updated[remap.cartIndex]) {
          updated[remap.cartIndex] = { ...updated[remap.cartIndex], slot: remap.slot }
        }
      }
      return updated
    })
    setSelectedSlot(rearrangeInfo.newPkgSlot)
    setShowRearrangePrompt(false)
  }

  function declineRearrangement() {
    setShowRearrangePrompt(false)
    if (suggestedSlotInfo) setSelectedSlot(suggestedSlotInfo.slot)
  }

  function addToCart() {
    if (!selectedPkg || !selectedSlot) return
    setCart(prev => [...prev, { pkg: selectedPkg, date: selectedDate, slot: selectedSlot }])
    setSelectedSlot(null)
    setSelectedPkg(null)
    setSameDayPrompt(true)
  }

  function removeFromCart(index: number) {
    setCart(prev => prev.filter((_, i) => i !== index))
    if (cart.length <= 1) setShowCart(false)
  }

  const cartTotalPerPerson = cart.reduce((sum, item) => sum + Number(item.pkg.price_pln), 0)
  const cartTotal = cartTotalPerPerson * peopleCount

  function addPerson() { setGuestForms(prev => [...prev, emptyGuest()]) }
  function removePerson(idx: number) {
    if (guestForms.length <= 1) return
    setGuestForms(prev => prev.filter((_, i) => i !== idx))
  }
  function updateGuestForm(idx: number, field: keyof GuestForm, value: string) {
    setGuestForms(prev => prev.map((g, i) => i === idx ? { ...g, [field]: value } : g))
  }

  async function handleBook() {
    const itemsToBook = cart.length > 0 ? cart : (selectedPkg && selectedSlot ? [{ pkg: selectedPkg, date: selectedDate, slot: selectedSlot }] : [])
    if (itemsToBook.length === 0) return
    if (!member) {
      for (let i = 0; i < guestForms.length; i++) {
        const g = guestForms[i]
        if (!g.name || !g.phone || !g.address || !g.document) {
          alert(`Osoba ${i + 1}: Podaj imię i nazwisko, adres, numer dokumentu i telefon`)
          return
        }
      }
    }
    setBookingLoading(true)
    try {
      const res = await fetch('/api/recreational/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToBook.map(item => ({
            package_id: item.pkg.id,
            date: item.date,
            start_time: item.slot.time,
            instructor_id: item.slot.instructorId,
          })),
          member_id: member?.id || null,
          guests: member ? undefined : guestForms,
          guest_name: member ? null : guestForms[0]?.name,
          guest_email: member ? null : guestForms[0]?.email,
          guest_phone: member ? null : guestForms[0]?.phone,
          guest_address: member ? null : guestForms[0]?.address,
          guest_document: member ? null : guestForms[0]?.document,
          notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Błąd rezerwacji'); return }
      if (data.redirect_url) { window.location.href = data.redirect_url; return }
      setBookingSuccess(true)
      setSelectedSlot(null)
      setCart([])
      setShowCart(false)
    } catch {
      alert('Błąd rezerwacji')
    } finally {
      setBookingLoading(false)
    }
  }

  return {
    member,
    selectedPkg, setSelectedPkg,
    selectedDate, setSelectedDate,
    availableSlots, loadingSlots,
    selectedSlot, setSelectedSlot,
    bookingLoading, bookingSuccess, setBookingSuccess,
    guestForms, notes, setNotes, peopleCount,
    cart, showCart, setShowCart,
    sameDayPrompt, setSameDayPrompt,
    showRearrangePrompt,
    dateObj, isPast,
    groupedPackages,
    lastCartEndMin,
    suggestedSlotInfo,
    rearrangeInfo,
    cartTotalPerPerson, cartTotal,
    acceptRearrangement, declineRearrangement,
    addToCart, removeFromCart,
    addPerson, removePerson, updateGuestForm,
    handleBook,
  }
}
