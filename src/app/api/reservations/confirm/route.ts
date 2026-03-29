import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// POST — convert hold → confirmed reservation
export async function POST(req: NextRequest) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing server config' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const body = await req.json()
    const {
      hold_token, member_id, guest_name, guest_email,
      guest_phone, guest_address, guest_document,
      notes, paid, pay_now,
    } = body

    if (!hold_token) {
      return NextResponse.json({ error: 'Brak hold_token' }, { status: 400 })
    }

    // Verify hold is still active
    const { data: holds, error: holdErr } = await supabase
      .from('lane_reservations')
      .select('id, lane_id')
      .eq('hold_token', hold_token)
      .eq('status', 'hold')
      .gt('hold_expires_at', new Date().toISOString())

    if (holdErr) throw holdErr
    if (!holds || holds.length === 0) {
      return NextResponse.json({ error: 'Rezerwacja wygasła. Wybierz slot ponownie.' }, { status: 410 })
    }

    // If guest — find or create member
    let resolvedMemberId = member_id
    if (!resolvedMemberId && guest_email) {
      const { data: existing } = await supabase
        .from('members')
        .select('id')
        .eq('email', guest_email)
        .single()

      if (existing) {
        resolvedMemberId = existing.id
      } else {
        const { data: newMember } = await supabase
          .from('members')
          .insert({
            email: guest_email,
            full_name: guest_name || '',
            phone: guest_phone || null,
            address: guest_address || '',
            id_document_number: guest_document || '',
            role: 'member',
            is_active: true,
            club_name: '',
          })
          .select('id')
          .single()

        if (newMember) resolvedMemberId = newMember.id
      }
    }

    // Convert hold → reserved
    const { data: updated, error: updateErr } = await supabase
      .from('lane_reservations')
      .update({
        status: 'reserved',
        member_id: resolvedMemberId || null,
        guest_name: guest_name || null,
        notes: notes || null,
        paid: paid || false,
        hold_token: null,
        hold_expires_at: null,
      })
      .eq('hold_token', hold_token)
      .eq('status', 'hold')
      .select()

    if (updateErr) throw updateErr
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'Rezerwacja wygasła' }, { status: 410 })
    }

    // Handle payment if requested
    if (pay_now && !paid && updated[0]) {
      const payRes = await fetch(new URL('/api/reservations/pay', req.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservation_id: updated[0].id }),
      })
      const payData = await payRes.json()
      if (payData.redirect_url) {
        return NextResponse.json({ success: true, redirect_url: payData.redirect_url })
      }
    }

    return NextResponse.json({
      success: true,
      reservation_ids: updated.map(r => r.id),
    })
  } catch (err: any) {
    console.error('Confirm reservation error:', err)
    return NextResponse.json({ error: err.message ?? 'Błąd' }, { status: 500 })
  }
}
