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

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const body = await req.json()
    const { event_id, member_id, disciplines } = body as {
      event_id: string
      member_id: string
      disciplines: Array<{
        event_discipline_id: string
        event_discipline_slot_id?: string
        own_weapon: boolean
        price_pln: number
      }>
    }

    if (!event_id || !member_id) {
      return NextResponse.json({ error: 'Brak event_id lub member_id' }, { status: 400 })
    }

    // Check event exists and is published
    const { data: event, error: eventErr } = await supabase
      .from('events')
      .select('id, title, start_date, location, max_participants, is_published')
      .eq('id', event_id)
      .single()

    if (eventErr || !event) {
      return NextResponse.json({ error: 'Wydarzenie nie istnieje' }, { status: 404 })
    }

    if (!event.is_published) {
      return NextResponse.json({ error: 'Wydarzenie nie jest opublikowane' }, { status: 400 })
    }

    // Check event hasn't passed
    if (new Date(event.start_date) < new Date()) {
      return NextResponse.json({ error: 'Wydarzenie już się odbyło' }, { status: 400 })
    }

    // Check member exists
    const { data: member, error: memberErr } = await supabase
      .from('members')
      .select('id, full_name, email')
      .eq('id', member_id)
      .single()

    if (memberErr || !member) {
      return NextResponse.json({ error: 'Członek nie istnieje' }, { status: 404 })
    }

    // Check not already registered
    const { data: existingReg } = await supabase
      .from('event_registrations')
      .select('id')
      .eq('event_id', event_id)
      .eq('member_id', member_id)
      .maybeSingle()

    if (existingReg) {
      return NextResponse.json({ error: 'Już jesteś zapisany na to wydarzenie', registration_id: existingReg.id }, { status: 409 })
    }

    // Check max participants (global event limit)
    if (event.max_participants) {
      const { count } = await supabase
        .from('event_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', event_id)

      if (count !== null && count >= event.max_participants) {
        return NextResponse.json({ error: 'Brak wolnych miejsc na wydarzenie' }, { status: 409 })
      }
    }

    // Validate slot capacity for each discipline
    if (disciplines && disciplines.length > 0) {
      for (const disc of disciplines) {
        if (!disc.event_discipline_slot_id) continue

        const { data: slot } = await supabase
          .from('event_discipline_slots')
          .select('id, max_participants')
          .eq('id', disc.event_discipline_slot_id)
          .single()

        if (!slot) {
          return NextResponse.json({ error: `Slot nie istnieje: ${disc.event_discipline_slot_id}` }, { status: 404 })
        }

        const { count } = await supabase
          .from('registration_disciplines')
          .select('id', { count: 'exact', head: true })
          .eq('event_discipline_slot_id', disc.event_discipline_slot_id)

        if (count !== null && count >= slot.max_participants) {
          const { data: ed } = await supabase
            .from('event_disciplines')
            .select('discipline:disciplines!discipline_id(name)')
            .eq('id', disc.event_discipline_id)
            .single()
          const discName = (ed?.discipline as any)?.name || 'dyscyplina'
          return NextResponse.json({ error: `Brak wolnych miejsc w wybranym terminie dla: ${discName}` }, { status: 409 })
        }
      }
    }

    // Create registration
    const { data: regData, error: regErr } = await supabase
      .from('event_registrations')
      .insert({
        event_id,
        member_id,
        status: 'registered',
      })
      .select('id')
      .single()

    if (regErr) {
      if (regErr.code === '23505') {
        return NextResponse.json({ error: 'Już jesteś zapisany na to wydarzenie' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Błąd zapisu: ' + regErr.message }, { status: 500 })
    }

    // Insert discipline selections
    let disciplineNames: string[] = []
    if (disciplines && disciplines.length > 0 && regData) {
      const rows = disciplines.map(d => ({
        event_discipline_id: d.event_discipline_id,
        member_registration_id: regData.id,
        price_pln: d.price_pln,
        own_weapon: d.own_weapon,
        ...(d.event_discipline_slot_id ? { event_discipline_slot_id: d.event_discipline_slot_id } : {}),
      }))

      await supabase.from('registration_disciplines').insert(rows)

      // Get discipline names for email
      const edIds = disciplines.map(d => d.event_discipline_id)
      const { data: eds } = await supabase
        .from('event_disciplines')
        .select('id, discipline:disciplines!discipline_id(name)')
        .in('id', edIds)

      disciplineNames = (eds || []).map((ed: any) => ed.discipline?.name).filter(Boolean)
    }

    // Send confirmation email
    if (member.email) {
      sendRegistrationConfirmation({
        to: member.email,
        memberName: member.full_name,
        eventTitle: event.title,
        eventDate: event.start_date,
        eventLocation: event.location,
        disciplines: disciplineNames,
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, registration_id: regData.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Nieznany błąd' }, { status: 500 })
  }
}
