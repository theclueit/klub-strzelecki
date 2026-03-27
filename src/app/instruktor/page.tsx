'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { Target, Clock, CheckCircle, XCircle, Package, User, ArrowRight, Shield, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

interface Booking {
  id: string
  package_id: string
  weapon_id: string
  customer_id: string | null
  instructor_id: string
  booking_date: string
  start_time: string
  end_time: string
  ammo_count: number
  price_pln: number
  status: string
  paid: boolean
  guest_name: string | null
  guest_phone: string | null
  notes: string | null
  weapon_issued: boolean
  weapon_returned: boolean
  ammo_issued: boolean
  package?: { name: string }
  weapon?: { name: string; caliber: string }
  customer?: { full_name: string; phone: string | null }
}

function formatDate(date: Date) {
  return date.toISOString().split('T')[0]
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export default function InstructorPage() {
  const { member, loading } = useAuth()
  const supabase = createSupabaseBrowser()
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()))
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loadingBookings, setLoadingBookings] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const dateObj = new Date(selectedDate + 'T00:00:00')

  const loadBookings = useCallback(async () => {
    if (!member) return
    setLoadingBookings(true)
    const { data } = await supabase
      .from('recreational_bookings')
      .select('*, package:shooting_packages(name), weapon:range_weapons(name, caliber), customer:members!recreational_bookings_customer_id_fkey(full_name, phone)')
      .eq('instructor_id', member.id)
      .eq('booking_date', selectedDate)
      .neq('status', 'cancelled')
      .order('start_time')
    setBookings((data ?? []) as any[])
    setLoadingBookings(false)
  }, [member, selectedDate])

  useEffect(() => { loadBookings() }, [loadBookings])

  const handleAction = async (bookingId: string, field: string, value: boolean) => {
    setActionLoading(`${bookingId}-${field}`)
    try {
      const update: any = { [field]: value }

      // Jeśli wydajemy amunicję, odejmij z magazynu
      if (field === 'ammo_issued' && value) {
        const booking = bookings.find(b => b.id === bookingId)
        if (booking) {
          // Pobierz inventory_ammo_id z broni
          const { data: weapon } = await supabase
            .from('range_weapons')
            .select('inventory_ammo_id')
            .eq('id', booking.weapon_id)
            .single()

          if (weapon?.inventory_ammo_id) {
            // Odejmij amunicję z magazynu
            const { data: item } = await supabase
              .from('inventory_items')
              .select('quantity')
              .eq('id', weapon.inventory_ammo_id)
              .single()

            if (item) {
              await supabase
                .from('inventory_items')
                .update({ quantity: item.quantity - booking.ammo_count })
                .eq('id', weapon.inventory_ammo_id)

              await supabase.from('inventory_transactions').insert({
                inventory_item_id: weapon.inventory_ammo_id,
                type: 'out',
                quantity: booking.ammo_count,
                note: `Strzelanie rekreacyjne: ${(booking.package as any)?.name || 'pakiet'} — ${(booking.customer as any)?.full_name || booking.guest_name || 'gość'}`,
                performed_by: member?.id,
              })
            }
          }
        }
      }

      // Jeśli broń i amunicja zwrócone — zmień status na completed
      if (field === 'weapon_returned' && value) {
        update.status = 'completed'
      }

      await supabase.from('recreational_bookings').update(update).eq('id', bookingId)
      loadBookings()
    } catch (err) {
      alert('Błąd: ' + (err as any).message)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) return <div className="p-8 text-center text-muted">Ładowanie...</div>
  if (!member || (member.role !== 'instructor' && member.role !== 'admin')) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <Shield className="w-12 h-12 text-muted mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">Brak dostępu</h1>
        <p className="text-muted mb-4">Ta strona jest dostępna tylko dla instruktorów.</p>
        <Link href="/" className="text-sm text-primary hover:underline">Wróć na stronę główną</Link>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Panel instruktora</h1>
        <p className="text-muted">Twoje rezerwacje strzelania rekreacyjnego. Wydaj broń i amunicję, potwierdź zwrot.</p>
      </div>

      {/* Nawigacja datą */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => setSelectedDate(formatDate(addDays(dateObj, -1)))} className="p-2 rounded-lg border border-border hover:bg-card">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="px-4 py-2 bg-card border border-border rounded-lg text-sm font-medium"
        />
        <button onClick={() => setSelectedDate(formatDate(addDays(dateObj, 1)))} className="p-2 rounded-lg border border-border hover:bg-card">
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="text-sm text-muted">
          {dateObj.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      {loadingBookings ? (
        <div className="flex items-center justify-center py-12 text-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Ładowanie...
        </div>
      ) : bookings.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted">
          <Target className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p className="font-semibold">Brak rezerwacji na ten dzień</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map(b => {
            const customerName = (b.customer as any)?.full_name || b.guest_name || 'Gość'
            const customerPhone = (b.customer as any)?.phone || b.guest_phone || '—'
            const weaponName = (b.weapon as any)?.name || 'Broń'
            const caliber = (b.weapon as any)?.caliber || ''
            const pkgName = (b.package as any)?.name || 'Pakiet'
            const isCompleted = b.status === 'completed'

            return (
              <div key={b.id} className={`bg-card border rounded-xl p-5 ${isCompleted ? 'border-green-500/30 opacity-60' : b.paid ? 'border-border' : 'border-yellow-500/30'}`}>
                {/* Nagłówek */}
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-primary" />
                      <span className="text-lg font-bold">{b.start_time.slice(0, 5)} – {b.end_time.slice(0, 5)}</span>
                      {isCompleted && <span className="px-2 py-0.5 bg-green-500/10 text-green-500 text-xs rounded font-medium">Zakończone</span>}
                      {!b.paid && <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-500 text-xs rounded font-medium">Nieopłacone</span>}
                    </div>
                    <p className="text-sm text-muted">{pkgName}</p>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-semibold">{Number(b.price_pln).toFixed(0)} zł</div>
                  </div>
                </div>

                {/* Dane */}
                <div className="grid sm:grid-cols-2 gap-3 mb-4 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted" />
                    <span><strong>{customerName}</strong> · tel. {customerPhone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-muted" />
                    <span><strong>{weaponName}</strong> ({caliber}) · {b.ammo_count} szt. amunicji</span>
                  </div>
                </div>

                {b.notes && <p className="text-xs text-muted mb-4 italic">Uwagi: {b.notes}</p>}

                {/* Akcje: wydaj/zdaj */}
                {!isCompleted && (
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
                    {/* Wydanie broni */}
                    <button
                      onClick={() => handleAction(b.id, 'weapon_issued', !b.weapon_issued)}
                      disabled={actionLoading === `${b.id}-weapon_issued`}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        b.weapon_issued
                          ? 'bg-green-500/10 border-green-500/30 text-green-500'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      {actionLoading === `${b.id}-weapon_issued` ? <Loader2 className="w-3 h-3 animate-spin" /> : b.weapon_issued ? <CheckCircle className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                      {b.weapon_issued ? 'Broń wydana' : 'Wydaj broń'}
                    </button>

                    {/* Wydanie amunicji */}
                    <button
                      onClick={() => handleAction(b.id, 'ammo_issued', !b.ammo_issued)}
                      disabled={actionLoading === `${b.id}-ammo_issued`}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                        b.ammo_issued
                          ? 'bg-green-500/10 border-green-500/30 text-green-500'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      {actionLoading === `${b.id}-ammo_issued` ? <Loader2 className="w-3 h-3 animate-spin" /> : b.ammo_issued ? <CheckCircle className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                      {b.ammo_issued ? `Amunicja wydana (${b.ammo_count} szt.)` : `Wydaj amunicję (${b.ammo_count} szt.)`}
                    </button>

                    {/* Zwrot broni */}
                    {b.weapon_issued && (
                      <button
                        onClick={() => handleAction(b.id, 'weapon_returned', true)}
                        disabled={actionLoading === `${b.id}-weapon_returned`}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-blue-500/30 text-blue-500 hover:bg-blue-500/10 transition-colors"
                      >
                        {actionLoading === `${b.id}-weapon_returned` ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                        Potwierdź zwrot broni (zakończ)
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
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
