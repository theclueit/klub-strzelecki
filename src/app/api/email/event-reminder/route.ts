import { NextRequest, NextResponse } from 'next/server'
import { requireRole, isAuthError } from '@/lib/api-auth'
import { sendEventReminder } from '@/lib/email'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole('admin', 'superadmin')
    if (isAuthError(auth)) return auth

    // Rate limit: 5 mass email sends per hour
    const rl = checkRateLimit(`email-reminder:${auth.member.id}`, { limit: 5, windowSeconds: 3600 })
    if (!rl.success) {
      return NextResponse.json({ error: 'Zbyt wiele wysyłek. Spróbuj później.' }, { status: 429 })
    }

    const { supabase } = auth
    const { event_id } = await req.json()
    if (!event_id) {
      return NextResponse.json({ error: 'Missing event_id' }, { status: 400 })
    }

    // Get event details
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('*')
      .eq('id', event_id)
      .single()

    if (eventErr || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const hoursUntil = (new Date(event.start_date).getTime() - Date.now()) / (1000 * 60 * 60)
    if (hoursUntil < 0) {
      return NextResponse.json({ error: 'Event already passed' }, { status: 400 })
    }

    // Get all registered members
    const { data: registrations } = await supabase
      .from('event_registrations')
      .select('member:members!member_id(full_name, email)')
      .eq('event_id', event_id)
      .eq('status', 'registered')

    if (!registrations || registrations.length === 0) {
      return NextResponse.json({ success: true, sent: 0 })
    }

    let sent = 0
    const errors: string[] = []

    for (const reg of registrations) {
      const member = reg.member as any
      if (!member?.email) continue

      const { error: emailErr } = await sendEventReminder({
        to: member.email,
        memberName: member.full_name,
        eventTitle: event.title,
        eventDate: event.start_date,
        eventLocation: event.location,
        hoursUntil,
      })

      if (emailErr) {
        errors.push(member.email)
      } else {
        sent++
      }
    }

    return NextResponse.json({ success: true, sent, errors: errors.length > 0 ? errors : undefined })
  } catch (err: any) {
    console.error('Event reminder error:', err)
    return NextResponse.json({ error: 'Błąd wysyłki' }, { status: 500 })
  }
}
