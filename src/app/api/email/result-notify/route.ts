import { NextRequest, NextResponse } from 'next/server'
import { requireRole, isAuthError } from '@/lib/api-auth'
import { sendResultNotification } from '@/lib/email'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole('admin', 'superadmin')
    if (isAuthError(auth)) return auth

    // Rate limit: 5 mass email sends per hour
    const rl = await checkRateLimit(`email-notify:${auth.member.id}`, { limit: 5, windowSeconds: 3600 })
    if (!rl.success) {
      return NextResponse.json({ error: 'Zbyt wiele wysyłek. Spróbuj później.' }, { status: 429 })
    }

    const { supabase } = auth
    const { event_id, discipline_id } = await req.json()
    if (!event_id) {
      return NextResponse.json({ error: 'Missing event_id' }, { status: 400 })
    }

    // Get event
    const { data: event } = await supabase
      .from('events')
      .select('title, start_date')
      .eq('id', event_id)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Build results query
    let query = supabase
      .from('results')
      .select('*, member:members!member_id(full_name, email), discipline:disciplines!discipline_id(name)')
      .eq('event_id', event_id)
      .order('total_score', { ascending: false })

    if (discipline_id) {
      query = query.eq('discipline_id', discipline_id)
    }

    const { data: results } = await query

    if (!results || results.length === 0) {
      return NextResponse.json({ success: true, sent: 0 })
    }

    let sent = 0
    const errors: string[] = []

    for (let i = 0; i < results.length; i++) {
      const result = results[i] as any
      const member = result.member
      const discipline = result.discipline

      if (!member?.email) continue

      const { error: emailErr } = await sendResultNotification({
        to: member.email,
        memberName: member.full_name,
        eventTitle: event.title,
        eventDate: event.start_date,
        disciplineName: discipline?.name || 'Ogólna',
        totalScore: result.total_score,
        maxScore: result.max_score,
        position: i + 1,
      })

      if (emailErr) {
        errors.push(member.email)
      } else {
        sent++
      }
    }

    return NextResponse.json({ success: true, sent, errors: errors.length > 0 ? errors : undefined })
  } catch (err: any) {
    console.error('Result notify error:', err)
    return NextResponse.json({ error: 'Błąd wysyłki' }, { status: 500 })
  }
}
