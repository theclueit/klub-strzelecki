'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import { Package, CreditCard, CheckCircle, Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface AmmoPurchase {
  id: string
  quantity: number
  price_per_unit_pln: number
  total_pln: number
  status: string
  token: string
  ammo_item?: { name: string; caliber: string } | null
  booking?: { guest_name: string | null; start_time: string; end_time: string; booking_date: string } | null
}

export default function AmmoPaymentPage() {
  const { token } = useParams<{ token: string }>()
  const supabase = createSupabaseBrowser()
  const [purchase, setPurchase] = useState<AmmoPurchase | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('ammo_purchases')
        .select('*, ammo_item:inventory_items(name, caliber), booking:recreational_bookings(guest_name, start_time, end_time, booking_date)')
        .eq('token', token)
        .single()

      if (data) {
        setPurchase(data as any)
      } else {
        setError('Zakup nie istnieje lub link jest nieprawidłowy')
      }
      setLoading(false)
    }
    load()
  }, [token])

  const handlePay = async () => {
    setPaying(true)
    try {
      const res = await fetch('/api/ammo/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const data = await res.json()
      if (data.redirect_url) {
        window.location.href = data.redirect_url
      } else {
        alert(data.error || 'Błąd płatności')
      }
    } catch {
      alert('Błąd płatności')
    } finally {
      setPaying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted" />
      </div>
    )
  }

  if (error || !purchase) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">Błąd</h1>
        <p className="text-muted mb-4">{error || 'Nie znaleziono zakupu'}</p>
        <Link href="/" className="text-sm text-primary hover:underline">Strona główna</Link>
      </div>
    )
  }

  if (purchase.status === 'paid') {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Opłacone!</h1>
        <p className="text-muted mb-4">Dodatkowa amunicja została opłacona. Miłego strzelania!</p>
        <Link href="/" className="text-sm text-primary hover:underline">Strona główna</Link>
      </div>
    )
  }

  const ammo = purchase.ammo_item as any
  const booking = purchase.booking as any

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="text-center mb-6">
          <Package className="w-10 h-10 text-primary mx-auto mb-3" />
          <h1 className="text-xl font-bold">Dodatkowa amunicja</h1>
          <p className="text-sm text-muted mt-1">Opłać amunicję zamówioną przez instruktora</p>
        </div>

        <div className="space-y-3 mb-6">
          <div className="bg-background rounded-lg p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-semibold text-sm">{ammo?.name || 'Amunicja'}</p>
                {ammo?.caliber && <p className="text-xs text-muted">{ammo.caliber}</p>}
              </div>
              <span className="text-lg font-bold text-primary">{Number(purchase.total_pln).toFixed(0)} zł</span>
            </div>
            <div className="flex justify-between text-xs text-muted mt-2">
              <span>{purchase.quantity} szt. × {Number(purchase.price_per_unit_pln).toFixed(2)} zł</span>
            </div>
          </div>

          {booking && (
            <div className="text-xs text-muted text-center">
              {booking.guest_name && <span>{booking.guest_name} · </span>}
              {new Date(booking.booking_date + 'T00:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}
              {' '}{booking.start_time?.slice(0, 5)}–{booking.end_time?.slice(0, 5)}
            </div>
          )}
        </div>

        <button
          onClick={handlePay}
          disabled={paying}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-background font-semibold rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 text-lg"
        >
          {paying ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
          Zapłać {Number(purchase.total_pln).toFixed(0)} zł
        </button>
      </div>
    </div>
  )
}
