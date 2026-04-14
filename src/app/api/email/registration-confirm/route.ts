import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/api-auth'
import { sendRegistrationConfirmation } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth

    const { supabase, member: authMember } = auth
    const { registration_id } = await req.json()
    if (!registration_id) {
      return NextResponse.json({ error: 'Missing registration_id' }, { status: 400 })
    }

    const { data: reg, error: regErr } = await supabase
      .from('event_registrations')
      .select('*, member:members!member_id(full_name, email), event:events!event_id(title, start_date, location)')
      .eq('id', registration_id)
      .single()

    if (regErr || !reg) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    }

    // Only allow resending own confirmation, or admin can resend any
    if (reg.member_id !== authMember.id && !['admin', 'superadmin'].includes(authMember.role)) {
      return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })
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
      console.error('Registration confirm email error:', emailErr)
      return NextResponse.json({ error: 'Błąd wysyłki' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Registration confirm error:', err)
    return NextResponse.json({ error: 'Nieznany błąd' }, { status: 500 })
  }
}
