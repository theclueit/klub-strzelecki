import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendRegistrationConfirmation } from '@/lib/email'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing server config' }, { status: 500 })
    }

    const { registration_id } = await req.json()
    if (!registration_id) {
      return NextResponse.json({ error: 'Missing registration_id' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { data: reg, error: regErr } = await supabase
      .from('event_registrations')
      .select('*, member:members!member_id(full_name, email), event:events!event_id(title, start_date, location)')
      .eq('id', registration_id)
      .single()

    if (regErr || !reg) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    }

    const member = reg.member as any
    const event = reg.event as any

    if (!member?.email) {
      return NextResponse.json({ error: 'Member has no email' }, { status: 400 })
    }

    // Get selected disciplines
    const { data: regDiscs } = await supabase
      .from('registration_disciplines')
      .select('event_discipline:event_disciplines!event_discipline_id(discipline:disciplines!discipline_id(name))')
      .eq('member_registration_id', registration_id)

    const disciplines = (regDiscs || []).map((rd: any) => rd.event_discipline?.discipline?.name).filter(Boolean)

    const { error: emailErr } = await sendRegistrationConfirmation({
      to: member.email,
      memberName: member.full_name,
      eventTitle: event.title,
      eventDate: event.start_date,
      eventLocation: event.location,
      disciplines,
    })

    if (emailErr) {
      return NextResponse.json({ error: 'Email send failed' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
