import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendResultNotification } from '@/lib/email'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing server config' }, { status: 500 })
    }

    const { event_id, discipline_id } = await req.json()
    if (!event_id) {
      return NextResponse.json({ error: 'Missing event_id' }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
