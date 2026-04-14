import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/api-auth'
import { sendRegistrationConfirmation } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth

    const { supabase, member: authMember } = auth
    const body = await req.json()
    const { event_id, disciplines } = body as {
      event_id: string
      disciplines: Array<{
        event_discipline_id: string
        event_discipline_slot_id?: string
        own_weapon: boolean
      }>
    }

    // Force member_id from session — prevent IDOR
    const member_id = authMember.id

    if (!event_id) {
      return NextResponse.json({ error: 'Brak event_id' }, { status: 400 })
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

    // Get next start number for this event
    const { data: maxNumData } = await supabase
      .from('event_registrations')
      .select('start_number')
      .eq('event_id', event_id)
      .not('start_number', 'is', null)
      .order('start_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextStartNumber = ((maxNumData as any)?.start_number ?? 0) + 1

    // Create registration
    const { data: regData, error: regErr } = await supabase
      .from('event_registrations')
      .insert({
        event_id,
        member_id,
        status: 'registered',
        start_number: nextStartNumber,
      })
      .select('id, start_number')
      .single()

    if (regErr) {
      if (regErr.code === '23505') {
        return NextResponse.json({ error: 'Już jesteś zapisany na to wydarzenie' }, { status: 409 })
      }
      console.error('Registration insert error:', regErr)
      return NextResponse.json({ error: 'Błąd zapisu' }, { status: 500 })
    }

    // Insert discipline selections — get price from DB, not from frontend
    let disciplineNames: string[] = []
    if (disciplines && disciplines.length > 0 && regData) {
      const edIds = disciplines.map(d => d.event_discipline_id)
      const { data: eds } = await supabase
        .from('event_disciplines')
        .select('id, price_pln, discipline:disciplines!discipline_id(name)')
        .in('id', edIds)

      const priceMap = new Map((eds || []).map(ed => [ed.id, Number(ed.price_pln) || 0]))
      disciplineNames = (eds || []).map((ed: any) => ed.discipline?.name).filter(Boolean)

      const rows = disciplines.map(d => ({
        event_discipline_id: d.event_discipline_id,
        member_registration_id: regData.id,
        price_pln: priceMap.get(d.event_discipline_id) ?? 0, // Price from DB
        own_weapon: d.own_weapon,
        ...(d.event_discipline_slot_id ? { event_discipline_slot_id: d.event_discipline_slot_id } : {}),
      }))

      await supabase.from('registration_disciplines').insert(rows)
    }

    // Send confirmation email
    const { data: memberData } = await supabase
      .from('members')
      .select('email, full_name')
      .eq('id', member_id)
      .single()

    if (memberData?.email) {
      sendRegistrationConfirmation({
        to: memberData.email,
        memberName: memberData.full_name,
        eventTitle: event.title,
        eventDate: event.start_date,
        eventLocation: event.location,
        disciplines: disciplineNames,
        startNumber: regData.start_number,
      }).catch(() => {})
    }

    return NextResponse.json({ success: true, registration_id: regData.id })
  } catch (err: any) {
    console.error('Registration API error:', err)
    return NextResponse.json({ error: 'Nieznany błąd' }, { status: 500 })
  }
}
