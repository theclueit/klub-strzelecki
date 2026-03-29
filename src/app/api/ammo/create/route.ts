import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { booking_id, inventory_item_id, quantity, instructor_id } = await req.json()

    if (!booking_id || !inventory_item_id || !quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Brakuje wymaganych danych' }, { status: 400 })
    }

    // Sprawdź rezerwację
    const { data: booking } = await supabase
      .from('recreational_bookings')
      .select('id, guest_name, customer_id')
      .eq('id', booking_id)
      .single()

    if (!booking) {
      return NextResponse.json({ error: 'Rezerwacja nie istnieje' }, { status: 404 })
    }

    // Pobierz cenę amunicji
    const { data: ammoItem } = await supabase
      .from('inventory_items')
      .select('id, name, sell_price_pln, purchase_price_pln, quantity')
      .eq('id', inventory_item_id)
      .single()

    if (!ammoItem) {
      return NextResponse.json({ error: 'Amunicja nie istnieje' }, { status: 404 })
    }

    const ai = ammoItem as any
    const pricePerUnit = Number(ai.sell_price_pln || ai.purchase_price_pln || 0)
    if (pricePerUnit <= 0) {
      return NextResponse.json({ error: 'Brak ceny sprzedaży amunicji' }, { status: 400 })
    }

    const totalPln = Math.round(pricePerUnit * quantity * 100) / 100
    const stock = Number(ai.quantity || 0)

    // Sprawdź stan magazynowy
    if (stock < quantity) {
      return NextResponse.json({ error: `Za mało amunicji w magazynie (dostępne: ${stock})` }, { status: 400 })
    }

    // Utwórz zakup amunicji
    const { data: purchase, error } = await supabase
      .from('ammo_purchases')
      .insert({
        booking_id,
        inventory_item_id,
        quantity,
        price_per_unit_pln: pricePerUnit,
        total_pln: totalPln,
        created_by: instructor_id || null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) throw error

    // Natychmiast odejmij amunicję z magazynu (instruktor już wydał)
    await supabase
      .from('inventory_items')
      .update({ quantity: stock - quantity })
      .eq('id', inventory_item_id)

    await supabase.from('inventory_transactions').insert({
      inventory_item_id,
      type: 'out',
      quantity,
      note: `Dodatkowa amunicja: ${ai.name} × ${quantity} — rezerwacja ${booking_id}`,
      performed_by: instructor_id || null,
    })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://klub-strzelecki.vercel.app'
    const paymentUrl = `${appUrl}/amunicja/${purchase.token}`

    return NextResponse.json({
      success: true,
      purchase_id: purchase.id,
      token: purchase.token,
      payment_url: paymentUrl,
      total_pln: totalPln,
      ammo_name: ai.name,
    })
  } catch (err: any) {
    console.error('Ammo purchase error:', err)
    return NextResponse.json({ error: err.message ?? 'Błąd' }, { status: 500 })
  }
}
