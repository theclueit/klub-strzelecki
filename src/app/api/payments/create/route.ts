import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/api-auth'
import { p24RegisterTransaction } from '@/lib/przelewy24'
import { randomUUID } from 'crypto'

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://klub-strzelecki.vercel.app'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth

    const { supabase, member } = auth
    const { registration_id } = await req.json()

    if (!registration_id) {
      return NextResponse.json({ error: 'Brak registration_id' }, { status: 400 })
    }

    // Get registration with member info
    const { data: reg, error: regErr } = await supabase
      .from('event_registrations')
      .select('id, event_id, member_id, paid')
      .eq('id', registration_id)
      .single()

    if (regErr || !reg) {
      return NextResponse.json({ error: 'Rejestracja nie istnieje' }, { status: 404 })
    }

    // Verify the registration belongs to the authenticated user
    if (reg.member_id !== member.id && !['admin', 'superadmin'].includes(member.role)) {
      return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })
    }

    if (reg.paid) {
      return NextResponse.json({ error: 'Rejestracja jest już opłacona' }, { status: 400 })
    }

    // Get event title
    const { data: event } = await supabase
      .from('events')
      .select('title')
      .eq('id', reg.event_id)
      .single()

    // Calculate total amount from registration_disciplines (from DB, not frontend)
    const { data: regDiscs } = await supabase
      .from('registration_disciplines')
      .select('price_pln')
      .eq('member_registration_id', registration_id)

    const totalPln = (regDiscs || []).reduce((sum, rd) => sum + (Number(rd.price_pln) || 0), 0)

    if (totalPln <= 0) {
      // Free event — mark as paid automatically
      await supabase.from('event_registrations').update({ paid: true }).eq('id', registration_id)
      return NextResponse.json({ success: true, free: true })
    }

    const sessionId = `KS-${randomUUID()}`
    const amountGrosze = Math.round(totalPln * 100)

    // Create payment record
    await supabase.from('payments').insert({
      registration_id,
      member_id: reg.member_id,
      amount_pln: totalPln,
      session_id: sessionId,
      status: 'pending',
    })

    // Register transaction with P24
    const { redirectUrl } = await p24RegisterTransaction({
      sessionId,
      amount: amountGrosze,
      currency: 'PLN',
      description: `Opłata startowa: ${event?.title || 'Zawody'}`,
      email: member.email,
      urlReturn: `${appUrl}/platnosc/sukces?session=${sessionId}`,
      urlStatus: `${appUrl}/api/payments/callback`,
    })

    return NextResponse.json({ success: true, redirect_url: redirectUrl })
  } catch (err: any) {
    console.error('Payment create error:', err)
    return NextResponse.json({ error: 'Błąd tworzenia płatności' }, { status: 500 })
  }
}
