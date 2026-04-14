import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createAuthClient } from '@/lib/api-auth'
import { confirmSchema, parseBody } from '@/lib/validation'

// POST — convert hold → confirmed reservation
// Token-based — hold_token acts as auth (short-lived, random UUID)
export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient()
    const parsed = parseBody(confirmSchema, await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const {
      hold_token, guest_name, guest_email,
      guest_phone, guest_address, guest_document,
      notes, paid, pay_now,
    } = parsed.data

    // Resolve member_id from session if authenticated — prevent IDOR
    let member_id: string | null = null
    try {
      const authClient = await createAuthClient()
      const { data: { user } } = await authClient.auth.getUser()
      if (user) {
        const { data: member } = await supabase
          .from('members')
          .select('id')
          .eq('auth_id', user.id)
          .single()
        if (member) member_id = member.id
      }
    } catch {
      // Not authenticated — guest flow, member_id stays null
    }

    // Verify hold is still active — include time/lane info for price calculation
    const { data: holds, error: holdErr } = await supabase
      .from('lane_reservations')
      .select('id, lane_id, start_time, end_time, lane:shooting_lanes!lane_id(price_per_hour_pln)')
      .eq('hold_token', hold_token)
      .eq('status', 'hold')
      .gt('hold_expires_at', new Date().toISOString())

    if (holdErr) {
      console.error('Hold verify error:', holdErr)
      return NextResponse.json({ error: 'Błąd weryfikacji' }, { status: 500 })
    }
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

    // Calculate whether reservation is free (price = 0) server-side
    // Don't trust client-sent `paid` flag — only mark as paid if genuinely free
    const firstHold = holds[0] as any
    const lane = firstHold?.lane
    const pricePerHour = Number(lane?.price_per_hour_pln || 0)
    const startH = parseInt(firstHold.start_time?.split(':')[0] || '0')
    const endH = parseInt(firstHold.end_time?.split(':')[0] || '0')
    const hours = endH - startH
    const isFree = pricePerHour * hours * holds.length <= 0

    // Convert hold → reserved
    const { data: updated, error: updateErr } = await supabase
      .from('lane_reservations')
      .update({
        status: 'reserved',
        member_id: resolvedMemberId || null,
        guest_name: guest_name || null,
        notes: notes || null,
        paid: isFree, // Only mark as paid if genuinely free — payment callback handles the rest
        hold_token: null,
        hold_expires_at: null,
      })
      .eq('hold_token', hold_token)
      .eq('status', 'hold')
      .select()

    if (updateErr) {
      console.error('Confirm update error:', updateErr)
      return NextResponse.json({ error: 'Błąd potwierdzenia' }, { status: 500 })
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'Rezerwacja wygasła' }, { status: 410 })
    }

    // Handle payment if requested
    if (pay_now && !isFree && updated[0]) {
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
    return NextResponse.json({ error: 'Błąd potwierdzenia' }, { status: 500 })
  }
}
