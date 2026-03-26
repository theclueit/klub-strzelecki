import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendEventReminder } from '@/lib/email'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing server config' }, { status: 500 })
    }

    const { event_id } = await req.json()
    if (!event_id) {
      return NextResponse.json({ error: 'Missing event_id' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
