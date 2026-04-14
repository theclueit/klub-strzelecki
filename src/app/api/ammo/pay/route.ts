import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/api-auth'
import { p24RegisterTransaction } from '@/lib/przelewy24'
import { randomUUID } from 'crypto'

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://klub-strzelecki.vercel.app'

// Token-based endpoint — no auth required (guest pays via unique token)
export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { token } = await req.json()

    if (!token) {
      return NextResponse.json({ error: 'Brak tokenu' }, { status: 400 })
    }

    // Pobierz zakup
    const { data: purchase } = await supabase
      .from('ammo_purchases')
      .select('*, booking:recreational_bookings(guest_email, customer_id)')
      .eq('token', token)
      .single()

    if (!purchase) {
      return NextResponse.json({ error: 'Zakup nie istnieje' }, { status: 404 })
    }

    if (purchase.status === 'paid') {
      return NextResponse.json({ error: 'Już opłacone' }, { status: 400 })
    }

    const totalPln = Number(purchase.total_pln)
    if (totalPln <= 0) {
      return NextResponse.json({ error: 'Nieprawidłowa kwota' }, { status: 400 })
    }

    const sessionId = `AMMO-${randomUUID()}`
    const amountGrosze = Math.round(totalPln * 100)

    // Email do płatności
    const booking = purchase.booking as any
    let email = booking?.guest_email || ''
    if (!email && booking?.customer_id) {
      const { data: member } = await supabase
        .from('members')
        .select('email')
        .eq('id', booking.customer_id)
        .single()
      email = member?.email || ''
    }

    // Pobierz nazwę amunicji
    const { data: ammoItem } = await supabase
      .from('inventory_items')
      .select('name')
      .eq('id', purchase.inventory_item_id)
      .single()

    const description = `Dodatkowa amunicja: ${ammoItem?.name || 'amunicja'} × ${purchase.quantity}`

    // Utwórz płatność
    const { data: payment } = await supabase.from('payments').insert({
      member_id: booking?.customer_id || null,
      amount_pln: totalPln,
      session_id: sessionId,
      status: 'pending',
    }).select().single()

    if (payment) {
      await supabase.from('ammo_purchases').update({ payment_id: payment.id }).eq('id', purchase.id)
    }

    const { redirectUrl } = await p24RegisterTransaction({
      sessionId,
      amount: amountGrosze,
      currency: 'PLN',
      description,
      email,
      urlReturn: `${appUrl}/platnosc/sukces?session=${sessionId}`,
      urlStatus: `${appUrl}/api/payments/callback`,
    })

    return NextResponse.json({ success: true, redirect_url: redirectUrl })
  } catch (err: any) {
    console.error('Ammo pay error:', err)
    return NextResponse.json({ error: 'Błąd płatności' }, { status: 500 })
  }
}
