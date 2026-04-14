import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, createAuthClient } from '@/lib/api-auth'
import { p24RegisterTransaction } from '@/lib/przelewy24'
import { randomUUID } from 'crypto'

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://klub-strzelecki.vercel.app'

// Payment for lane reservation — requires auth or internal call
export async function POST(req: NextRequest) {
  try {
    const supabase = createServiceClient()
    const { reservation_id } = await req.json()

    if (!reservation_id) {
      return NextResponse.json({ error: 'Brak reservation_id' }, { status: 400 })
    }

    // Get reservation with lane and member info
    const { data: res, error: resErr } = await supabase
      .from('lane_reservations')
      .select('*, lane:shooting_lanes(*), member:members!lane_reservations_member_id_fkey(id, email, full_name, auth_id)')
      .eq('id', reservation_id)
      .single()

    if (resErr || !res) {
      return NextResponse.json({ error: 'Rezerwacja nie istnieje' }, { status: 404 })
    }

    if (res.paid) {
      return NextResponse.json({ error: 'Rezerwacja jest już opłacona' }, { status: 400 })
    }

    // Verify ownership: check if caller is the reservation owner, admin, or internal call
    // Internal calls come from /api/reservations/confirm via server-side fetch (no browser origin)
    const isInternalCall = !req.headers.get('origin') && !req.headers.get('referer')
    if (!isInternalCall) {
      const authClient = await createAuthClient()
      const { data: { user } } = await authClient.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 })
      }

      // Check user is reservation owner or admin
      const member = res.member as any
      const isOwner = member?.auth_id === user.id
      if (!isOwner) {
        // Check if admin
        const { data: callerMember } = await supabase
          .from('members')
          .select('role')
          .eq('auth_id', user.id)
          .single()
        if (!callerMember || !['admin', 'superadmin', 'registrar', 'range_registrar'].includes(callerMember.role)) {
          return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })
        }
      }
    }

    const lane = res.lane as any
    const member = res.member as any

    // Calculate total from DB data
    const startH = parseInt(res.start_time.split(':')[0])
    const endH = parseInt(res.end_time.split(':')[0])
    const hours = endH - startH
    const totalPln = (lane?.price_per_hour_pln || 0) * hours

    if (totalPln <= 0) {
      await supabase.from('lane_reservations').update({ paid: true }).eq('id', reservation_id)
      return NextResponse.json({ success: true, free: true })
    }

    const sessionId = `RES-${randomUUID()}`
    const amountGrosze = Math.round(totalPln * 100)

    // Create payment record
    const { data: payment } = await supabase.from('payments').insert({
      member_id: res.member_id,
      amount_pln: totalPln,
      session_id: sessionId,
      status: 'pending',
    }).select().single()

    // Link payment to reservation
    if (payment) {
      await supabase.from('lane_reservations').update({ payment_id: payment.id }).eq('id', reservation_id)
    }

    // Register transaction with P24
    const { redirectUrl } = await p24RegisterTransaction({
      sessionId,
      amount: amountGrosze,
      currency: 'PLN',
      description: `Rezerwacja toru: ${lane?.name || 'Tor'} (${hours}h)`,
      email: member?.email || '',
      urlReturn: `${appUrl}/platnosc/sukces?session=${sessionId}`,
      urlStatus: `${appUrl}/api/payments/callback`,
    })

    return NextResponse.json({ success: true, redirect_url: redirectUrl })
  } catch (err: any) {
    console.error('Reservation payment error:', err)
    return NextResponse.json({ error: 'Błąd płatności' }, { status: 500 })
  }
}
