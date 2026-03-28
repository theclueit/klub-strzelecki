'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { Target, Clock, CreditCard, CheckCircle, X, Loader2, ChevronLeft, ChevronRight, User, Crosshair, Package } from 'lucide-react'
import Link from 'next/link'

interface Weapon {
  id: string
  name: string
  type: string
  caliber: string
  description: string | null
}

interface Package {
  id: string
  name: string
  description: string | null
  weapon_id: string
  ammo_count: number
  duration_minutes: number
  price_pln: number
  weapon: Weapon
}

interface Lane {
  id: string
  name: string
  length_m: number
  stations_count: number
  open_time: string
  close_time: string
}

interface TimeSlot {
  time: string
  available: boolean
  instructorId: string | null
  instructorName: string | null
}

function formatDate(date: Date) {
  return date.toISOString().split('T')[0]
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

const TYPE_LABELS: Record<string, string> = {
  pistol: 'Pistolet',
  rifle: 'Karabin',
  shotgun: 'Strzelba',
  other: 'Inne',
}

export default function RecreationalClient({ packages, lanes }: { packages: Package[]; lanes: Lane[] }) {
  const { member } = useAuth()
  const supabase = createSupabaseBrowser()

  const [selectedPkg, setSelectedPkg] = useState<Package | null>(null)
  const [selectedDate, setSelectedDate] = useState(() => formatDate(addDays(new Date(), 1)))
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [guestForm, setGuestForm] = useState({ name: '', email: '', phone: '', address: '', document: '' })
  const [notes, setNotes] = useState('')
  const [bookingSuccess, setBookingSuccess] = useState(false)

  // On-site booking (registrar only)
  const isRangeStaff = member && ['admin', 'registrar', 'range_registrar'].includes(member.role)
  const [showOnsite, setShowOnsite] = useState(false)
  const [onsiteWeapons, setOnsiteWeapons] = useState<{ id: string; name: string; type: string; caliber: string }[]>([])
  const [onsiteInstructors, setOnsiteInstructors] = useState<{ id: string; full_name: string }[]>([])
  const [onsiteLoading, setOnsiteLoading] = useState(false)
  const [onsiteSaving, setOnsiteSaving] = useState(false)
  const [onsiteSuccess, setOnsiteSuccess] = useState('')
  const [onsiteForm, setOnsiteForm] = useState({
    package_id: '', weapon_id: '', instructor_id: '',
    start_time: '10:00', duration_minutes: '60',
    ammo_count: '50', price_pln: '0',
    guest_name: '', guest_phone: '', guest_address: '', guest_document: '', guest_email: '',
    targets: '', notes: '',
  })

  const dateObj = useMemo(() => new Date(selectedDate + 'T00:00:00'), [selectedDate])
  const isPast = dateObj <= new Date(new Date().toDateString())

  // Grupuj pakiety po typie broni
  const groupedPackages = useMemo(() => {
    const groups: Record<string, Package[]> = {}
    for (const pkg of packages) {
      const type = pkg.weapon?.type || 'other'
      if (!groups[type]) groups[type] = []
      groups[type].push(pkg)
    }
    return groups
  }, [packages])

  // Ładuj dostępne sloty po wybraniu pakietu i daty
  const loadAvailableSlots = useCallback(async () => {
    if (!selectedPkg || isPast) {
      setAvailableSlots([])
      return
    }
    setLoadingSlots(true)
    try {
      const dayOfWeek = dateObj.getDay()
      const durationSlots = Math.ceil(selectedPkg.duration_minutes / 30)

      // 1. Pobierz dostępność instruktorów na ten dzień tygodnia
      const { data: avails } = await supabase
        .from('instructor_availability')
        .select('*, instructor:members!instructor_availability_instructor_id_fkey(id, full_name)')
        .eq('day_of_week', dayOfWeek)
        .eq('is_active', true)

      // 2. Pobierz istniejące rezerwacje rekreacyjne na ten dzień
      const { data: existingBookings } = await supabase
        .from('recreational_bookings')
        .select('instructor_id, weapon_id, start_time, end_time')
        .eq('booking_date', selectedDate)
        .neq('status', 'cancelled')

      // 3. Pobierz rezerwacje torów na ten dzień (wszystkie osie)
      const { data: laneRes } = await supabase
        .from('lane_reservations')
        .select('lane_id, station_number, start_time, end_time')
        .eq('reservation_date', selectedDate)
        .neq('status', 'cancelled')

      const slots: TimeSlot[] = []

      // Dla każdego instruktora z dostępnością
      for (const avail of (avails ?? [])) {
        const instructor = avail.instructor as any
        if (!instructor) continue

        const startMin = timeToMin(avail.start_time)
        const endMin = timeToMin(avail.end_time)
        const slotDuration = selectedPkg.duration_minutes

        for (let m = startMin; m + slotDuration <= endMin; m += 30) {
          const slotStart = `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`
          const slotEndMin = m + slotDuration
          const slotEnd = `${Math.floor(slotEndMin / 60).toString().padStart(2, '0')}:${(slotEndMin % 60).toString().padStart(2, '0')}`

          // Sprawdź czy instruktor jest wolny
          const instructorBusy = (existingBookings ?? []).some(b =>
            b.instructor_id === instructor.id &&
            timeToMin(b.start_time) < slotEndMin &&
            timeToMin(b.end_time) > m
          )
          if (instructorBusy) continue

          // Sprawdź czy broń jest wolna
          const weaponBusy = (existingBookings ?? []).some(b =>
            b.weapon_id === selectedPkg.weapon_id &&
            timeToMin(b.start_time) < slotEndMin &&
            timeToMin(b.end_time) > m
          )
          if (weaponBusy) continue

          // Sprawdź czy jest wolne stanowisko na jakiejś osi
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
              if (!stationBusy) {
                hasFreeLane = true
                break
              }
            }
            if (hasFreeLane) break
          }
          if (!hasFreeLane && lanes.length > 0) continue

          // Sprawdź czy slot nie jest duplikatem (inny instruktor w tej samej godzinie)
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

  // On-site: open modal, load data
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
    setShowOnsite(true)
    const [weaponsRes, instructorsRes] = await Promise.all([
      supabase.from('range_weapons').select('id, name, type, caliber').eq('status', 'in_stock').order('type').order('name'),
      supabase.from('members').select('id, full_name').in('role', ['instructor', 'admin']).eq('is_active', true).order('full_name'),
    ])
    setOnsiteWeapons(weaponsRes.data ?? [])
    setOnsiteInstructors(instructorsRes.data ?? [])
    setOnsiteLoading(false)
  }

  const handlePackageSelect = (pkgId: string) => {
    const pkg = packages.find(p => p.id === pkgId)
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
      alert('Podaj imię i nazwisko, adres, numer dokumentu oraz email klienta')
      return
    }
    setOnsiteSaving(true)
    try {
      const today = formatDate(new Date())
      const res = await fetch('/api/recreational/onsite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weapon_id: onsiteForm.weapon_id,
          instructor_id: onsiteForm.instructor_id,
          date: today,
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
    } catch (err: any) {
      alert('Błąd: ' + (err.message || 'Spróbuj ponownie'))
    } finally {
      setOnsiteSaving(false)
    }
  }

  const handleBook = async () => {
    if (!selectedPkg || !selectedSlot) return
    if (!member && (!guestForm.name || !guestForm.phone || !guestForm.address || !guestForm.document)) {
      alert('Podaj imię i nazwisko, adres zamieszkania, numer dokumentu i telefon')
      return
    }
    setBookingLoading(true)
    try {
      const res = await fetch('/api/recreational/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          package_id: selectedPkg.id,
          date: selectedDate,
          start_time: selectedSlot.time,
          instructor_id: selectedSlot.instructorId,
          member_id: member?.id || null,
          guest_name: member ? null : guestForm.name,
          guest_email: member ? null : guestForm.email,
          guest_phone: member ? null : guestForm.phone,
          guest_address: member ? null : guestForm.address,
          guest_document: member ? null : guestForm.document,
          notes,
        }),
      })
      const data = await res.json()
      if (data.redirect_url) {
        window.location.href = data.redirect_url
        return
      }
      if (data.success) {
        setBookingSuccess(true)
        setSelectedSlot(null)
      } else {
        alert(data.error || 'Błąd rezerwacji')
      }
    } catch {
      alert('Błąd rezerwacji')
    } finally {
      setBookingLoading(false)
    }
  }

  if (bookingSuccess) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Zarezerwowano!</h1>
        <p className="text-muted mb-6">
          Twoje strzelanie rekreacyjne zostało zarezerwowane. Instruktor przygotuje broń i amunicję.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => { setBookingSuccess(false); setSelectedPkg(null) }} className="px-6 py-2.5 border border-border rounded-lg font-medium hover:bg-card transition-colors">
            Zarezerwuj kolejne
          </button>
          <Link href="/" className="px-6 py-2.5 bg-primary text-background rounded-lg font-semibold hover:bg-primary-dark transition-colors">
            Strona główna
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Strzelanie rekreacyjne</h1>
          <p className="text-muted">Wybierz pakiet, datę i godzinę. Instruktor przygotuje broń i amunicję — Ty strzelasz!</p>
        </div>
        {isRangeStaff && (
          <button
            onClick={openOnsiteBooking}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
          >
            <Package className="w-4 h-4" />
            Zestaw na miejscu
          </button>
        )}
      </div>

      {packages.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted">
          <Target className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p className="font-semibold mb-1">Brak dostępnych pakietów</p>
          <p className="text-sm">Administrator musi najpierw skonfigurować pakiety strzeleckie.</p>
        </div>
      ) : (
        <>
          {/* Krok 1: Wybór pakietu */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-primary text-background rounded-full flex items-center justify-center text-sm font-bold">1</span>
              Wybierz pakiet
            </h2>

            {Object.entries(groupedPackages).map(([type, pkgs]) => (
              <div key={type} className="mb-4">
                <h3 className="text-sm font-medium text-muted mb-2">{TYPE_LABELS[type] || type}</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pkgs.map(pkg => (
                    <button
                      key={pkg.id}
                      onClick={() => { setSelectedPkg(pkg); setSelectedSlot(null) }}
                      className={`text-left p-4 rounded-xl border transition-colors ${
                        selectedPkg?.id === pkg.id
                          ? 'bg-primary/10 border-primary'
                          : 'bg-card border-border hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-sm">{pkg.name}</h4>
                          <p className="text-xs text-muted">{pkg.weapon?.name} · {pkg.weapon?.caliber}</p>
                        </div>
                        <Crosshair className={`w-5 h-5 ${selectedPkg?.id === pkg.id ? 'text-primary' : 'text-muted/30'}`} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          {pkg.ammo_count} szt.
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {pkg.duration_minutes} min
                        </span>
                      </div>
                      {pkg.description && <p className="text-xs text-muted mt-2">{pkg.description}</p>}
                      <div className="mt-3 text-lg font-bold text-primary">{Number(pkg.price_pln).toFixed(0)} zł</div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Krok 2: Wybór daty i godziny */}
          {selectedPkg && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-primary text-background rounded-full flex items-center justify-center text-sm font-bold">2</span>
                Wybierz termin
              </h2>

              {/* Data */}
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setSelectedDate(formatDate(addDays(dateObj, -1)))}
                  className="p-2 rounded-lg border border-border hover:bg-card"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  min={formatDate(addDays(new Date(), 1))}
                  onChange={e => { setSelectedDate(e.target.value); setSelectedSlot(null) }}
                  className="px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium"
                />
                <button
                  onClick={() => setSelectedDate(formatDate(addDays(dateObj, 1)))}
                  className="p-2 rounded-lg border border-border hover:bg-card"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="text-sm text-muted ml-2">
                  {dateObj.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>

              {/* Godziny */}
              {loadingSlots ? (
                <div className="flex items-center gap-2 py-8 justify-center text-muted">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Sprawdzam dostępność...
                </div>
              ) : isPast ? (
                <p className="text-muted text-sm py-4">Wybierz przyszłą datę.</p>
              ) : availableSlots.length === 0 ? (
                <p className="text-muted text-sm py-4">Brak dostępnych terminów na wybrany dzień. Spróbuj inną datę.</p>
              ) : (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                  {availableSlots.map(slot => (
                    <button
                      key={slot.time}
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-3 px-2 rounded-lg text-sm font-medium border transition-colors ${
                        selectedSlot?.time === slot.time
                          ? 'bg-primary text-background border-primary'
                          : 'bg-card border-border hover:border-primary/40'
                      }`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Krok 3: Dane i podsumowanie */}
          {selectedPkg && selectedSlot && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="w-7 h-7 bg-primary text-background rounded-full flex items-center justify-center text-sm font-bold">3</span>
                Podsumowanie i rezerwacja
              </h2>

              <div className="bg-card border border-border rounded-xl p-6">
                {/* Podsumowanie */}
                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted">Pakiet:</span>
                      <span className="font-medium">{selectedPkg.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Broń:</span>
                      <span className="font-medium">{selectedPkg.weapon?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Kaliber:</span>
                      <span className="font-medium">{selectedPkg.weapon?.caliber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Amunicja:</span>
                      <span className="font-medium">{selectedPkg.ammo_count} szt.</span>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted">Data:</span>
                      <span className="font-medium">{dateObj.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Godzina:</span>
                      <span className="font-medium">
                        {selectedSlot.time} – {(() => {
                          const endMin = timeToMin(selectedSlot.time) + selectedPkg.duration_minutes
                          return `${Math.floor(endMin / 60).toString().padStart(2, '0')}:${(endMin % 60).toString().padStart(2, '0')}`
                        })()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Czas trwania:</span>
                      <span className="font-medium">{selectedPkg.duration_minutes} min</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Instruktor:</span>
                      <span className="font-medium">{selectedSlot.instructorName}</span>
                    </div>
                  </div>
                </div>

                {/* Dane klienta (wymagane do książki wejścia na strzelnicę) */}
                {!member && (
                  <div className="border-t border-border pt-4 mb-4">
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Twoje dane (wymagane do wejścia na strzelnicę)
                    </h4>
                    <div className="space-y-3">
                      <div className="grid sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Imię i nazwisko *"
                          value={guestForm.name}
                          onChange={e => setGuestForm(f => ({ ...f, name: e.target.value }))}
                          required
                          className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                        />
                        <input
                          type="tel"
                          placeholder="Telefon *"
                          value={guestForm.phone}
                          onChange={e => setGuestForm(f => ({ ...f, phone: e.target.value }))}
                          required
                          className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Adres zamieszkania *"
                        value={guestForm.address}
                        onChange={e => setGuestForm(f => ({ ...f, address: e.target.value }))}
                        required
                        className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                      />
                      <div className="grid sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Nr i seria dowodu / nr paszportu *"
                          value={guestForm.document}
                          onChange={e => setGuestForm(f => ({ ...f, document: e.target.value }))}
                          required
                          className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                        />
                        <input
                          type="email"
                          placeholder="Email (na regulamin strzelnicy)"
                          value={guestForm.email}
                          onChange={e => setGuestForm(f => ({ ...f, email: e.target.value }))}
                          className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted mt-2">
                      * Na podany email wyślemy regulamin strzelnicy i zasady bezpieczeństwa.
                    </p>
                  </div>
                )}

                {/* Uwagi */}
                <input
                  type="text"
                  placeholder="Uwagi (opcjonalnie)"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm mb-4"
                />

                {/* Cena i przycisk */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="text-2xl font-bold text-primary">{Number(selectedPkg.price_pln).toFixed(0)} zł</div>
                  <button
                    onClick={handleBook}
                    disabled={bookingLoading}
                    className="flex items-center gap-2 px-8 py-3 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
                  >
                    {bookingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                    Rezerwuj i zapłać
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="mt-8 text-center">
        <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
          &larr; Wróć na stronę główną
        </Link>
      </div>

      {/* Modal zestawu strzeleckiego na miejscu (rejestrator) */}
      {showOnsite && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Zestaw strzelecki na miejscu
              </h2>
              <button onClick={() => setShowOnsite(false)} className="p-1 text-muted hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {onsiteSuccess ? (
              <div className="text-center py-6">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="font-semibold mb-2">Rezerwacja utworzona!</p>
                <p className="text-sm text-muted mb-4">{onsiteSuccess}</p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={() => { setOnsiteSuccess(''); setOnsiteForm(f => ({ ...f, guest_name: '', guest_phone: '', guest_address: '', guest_document: '', guest_email: '', targets: '', notes: '' })) }}
                    className="px-4 py-2 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark"
                  >
                    Następny klient
                  </button>
                  <button onClick={() => setShowOnsite(false)} className="px-4 py-2 border border-border text-sm rounded-lg hover:bg-background">
                    Zamknij
                  </button>
                </div>
              </div>
            ) : onsiteLoading ? (
              <div className="flex items-center gap-2 justify-center py-12 text-muted">
                <Loader2 className="w-5 h-5 animate-spin" />
                Ładowanie...
              </div>
            ) : (
              <div className="space-y-4">
                {/* Pakiet */}
                <div>
                  <label className="text-xs text-muted block mb-1">Pakiet (opcjonalnie)</label>
                  <select
                    value={onsiteForm.package_id}
                    onChange={e => handlePackageSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                  >
                    <option value="">— własny zestaw —</option>
                    {packages.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.price_pln} zł)</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Broń */}
                  <div>
                    <label className="text-xs text-muted block mb-1">Broń *</label>
                    <select
                      value={onsiteForm.weapon_id}
                      onChange={e => setOnsiteForm(f => ({ ...f, weapon_id: e.target.value }))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    >
                      <option value="">Wybierz...</option>
                      {onsiteWeapons.map(w => (
                        <option key={w.id} value={w.id}>{w.name} ({w.caliber})</option>
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
                      <option value="">Wybierz...</option>
                      {onsiteInstructors.map(i => (
                        <option key={i.id} value={i.id}>{i.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted block mb-1">Godzina</label>
                    <input type="time" value={onsiteForm.start_time} onChange={e => setOnsiteForm(f => ({ ...f, start_time: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Czas (min)</label>
                    <input type="number" value={onsiteForm.duration_minutes} onChange={e => setOnsiteForm(f => ({ ...f, duration_minutes: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Cena (zł)</label>
                    <input type="number" step="0.01" value={onsiteForm.price_pln} onChange={e => setOnsiteForm(f => ({ ...f, price_pln: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted block mb-1">Ilość amunicji</label>
                    <input type="number" value={onsiteForm.ammo_count} onChange={e => setOnsiteForm(f => ({ ...f, ammo_count: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Tarcze</label>
                    <input type="text" value={onsiteForm.targets} onChange={e => setOnsiteForm(f => ({ ...f, targets: e.target.value }))} placeholder="np. 3x tarcza TS-2" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                  </div>
                </div>

                {/* Dane klienta */}
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted mb-2 font-medium">Dane klienta (do książki wejścia) *</p>
                  <div className="space-y-2">
                    <input type="text" value={onsiteForm.guest_name} onChange={e => setOnsiteForm(f => ({ ...f, guest_name: e.target.value }))} placeholder="Imię i nazwisko *" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                    <input type="email" value={onsiteForm.guest_email} onChange={e => setOnsiteForm(f => ({ ...f, guest_email: e.target.value }))} placeholder="Email * (regulamin strzelnicy)" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                    <input type="text" value={onsiteForm.guest_address} onChange={e => setOnsiteForm(f => ({ ...f, guest_address: e.target.value }))} placeholder="Adres zamieszkania *" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={onsiteForm.guest_document} onChange={e => setOnsiteForm(f => ({ ...f, guest_document: e.target.value }))} placeholder="Nr dowodu / paszportu *" className="px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                      <input type="tel" value={onsiteForm.guest_phone} onChange={e => setOnsiteForm(f => ({ ...f, guest_phone: e.target.value }))} placeholder="Telefon" className="px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                    </div>
                  </div>
                </div>

                <textarea value={onsiteForm.notes} onChange={e => setOnsiteForm(f => ({ ...f, notes: e.target.value }))} placeholder="Uwagi..." rows={2} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none" />

                {/* Podsumowanie */}
                {onsiteForm.weapon_id && (
                  <div className="bg-background rounded-lg p-3 text-sm space-y-1 border border-border">
                    <p className="font-semibold">Podsumowanie:</p>
                    <p>Broń: <span className="text-primary">{onsiteWeapons.find(w => w.id === onsiteForm.weapon_id)?.name}</span></p>
                    <p>Amunicja: {onsiteForm.ammo_count} szt. · Czas: {onsiteForm.start_time} · {onsiteForm.duration_minutes} min</p>
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
    </div>
  )
}
