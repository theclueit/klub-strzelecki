import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { p24VerifyTransaction, verifyP24Callback } from '@/lib/przelewy24'
import { sendPaymentConfirmation } from '@/lib/email'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing server config' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const body = await req.json()

    const { sessionId, amount, currency, orderId } = body

    if (!sessionId || !orderId) {
      return NextResponse.json({ error: 'Invalid callback data' }, { status: 400 })
    }

    // Verify callback signature
    if (!verifyP24Callback(body)) {
      console.error('P24 callback signature mismatch')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    // Find payment by session_id
    const { data: payment, error: payErr } = await supabase
      .from('payments')
      .select('id, registration_id, member_id, amount_pln, status')
      .eq('session_id', sessionId)
      .single()

    if (payErr || !payment) {
      console.error('Payment not found for session:', sessionId)
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
    }

    if (payment.status === 'completed') {
      return NextResponse.json({ status: 'already_completed' })
    }

    // Verify amount matches
    const expectedGrosze = Math.round(Number(payment.amount_pln) * 100)
    if (amount !== expectedGrosze) {
      console.error('Amount mismatch:', amount, 'vs', expectedGrosze)
      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id)
      return NextResponse.json({ error: 'Amount mismatch' }, { status: 400 })
    }

    // Verify with P24
    const verified = await p24VerifyTransaction({
      sessionId,
      orderId,
      amount,
      currency: currency || 'PLN',
    })

    if (!verified) {
      await supabase.from('payments').update({ status: 'failed' }).eq('id', payment.id)
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
    }

    // Update payment status
    await supabase.from('payments').update({
      status: 'completed',
      p24_order_id: orderId,
      completed_at: new Date().toISOString(),
    }).eq('id', payment.id)

    // Check payment type by session prefix
    const isReservationPayment = sessionId.startsWith('RES-')
    const isRecreationalPayment = sessionId.startsWith('REC-')
    const isAmmoPayment = sessionId.startsWith('AMMO-')

    if (isAmmoPayment) {
      // Mark ammo purchase as paid
      await supabase.from('ammo_purchases').update({ status: 'paid' }).eq('payment_id', payment.id)
    } else if (isRecreationalPayment) {
      // Mark recreational booking + lane reservation as paid
      await supabase.from('recreational_bookings').update({ paid: true, status: 'confirmed' }).eq('payment_id', payment.id)
      await supabase.from('lane_reservations').update({ paid: true }).eq('payment_id', payment.id)

      const { data: member } = await supabase
        .from('members')
        .select('email, full_name')
        .eq('id', payment.member_id)
        .single()

      if (member?.email) {
        sendPaymentConfirmation({
          to: member.email,
          memberName: member.full_name,
          eventTitle: 'Strzelanie rekreacyjne',
          eventDate: new Date().toISOString().split('T')[0],
          amount: Number(payment.amount_pln),
          sessionId,
        }).catch(() => {})
      }
    } else if (isReservationPayment) {
      // Mark lane reservation as paid
      await supabase
        .from('lane_reservations')
        .update({ paid: true })
        .eq('payment_id', payment.id)

      // Send confirmation email for reservation
      const { data: member } = await supabase
        .from('members')
        .select('email, full_name')
        .eq('id', payment.member_id)
        .single()

      if (member?.email) {
        sendPaymentConfirmation({
          to: member.email,
          memberName: member.full_name,
          eventTitle: 'Rezerwacja toru strzeleckiego',
          eventDate: new Date().toISOString().split('T')[0],
          amount: Number(payment.amount_pln),
          sessionId,
        }).catch(() => {})
      }
    } else {
      // Mark event registration as paid
      await supabase.from('event_registrations').update({ paid: true }).eq('id', payment.registration_id)

      // Send confirmation email
      const { data: reg } = await supabase
        .from('event_registrations')
        .select('event_id, member:members!event_registrations_member_id_fkey(email, full_name)')
        .eq('id', payment.registration_id)
        .single()

      if (reg) {
        const { data: event } = await supabase
          .from('events')
          .select('title, start_date')
          .eq('id', reg.event_id)
          .single()

        const member = reg.member as any
        if (member?.email && event) {
          sendPaymentConfirmation({
            to: member.email,
            memberName: member.full_name,
            eventTitle: event.title,
            eventDate: event.start_date,
            amount: Number(payment.amount_pln),
            sessionId,
          }).catch(() => {})
        }
      }
    }

    return NextResponse.json({ status: 'ok' })
  } catch (err: any) {
    console.error('P24 callback error:', err)
    return NextResponse.json({ error: err.message ?? 'Callback error' }, { status: 500 })
  }
}
