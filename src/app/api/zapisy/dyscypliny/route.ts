import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/api-auth'

// Add disciplines to an existing registration
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth

    const { supabase, member: authMember } = auth
    const body = await req.json()
    const { registration_id, disciplines } = body as {
      registration_id: string
      disciplines: Array<{
        event_discipline_id: string
        event_discipline_slot_id?: string
        own_weapon: boolean
      }>
    }

    if (!registration_id || !disciplines || disciplines.length === 0) {
      return NextResponse.json({ error: 'Brak registration_id lub dyscyplin' }, { status: 400 })
    }

    // Verify registration exists and belongs to this user
    const { data: reg } = await supabase
      .from('event_registrations')
      .select('id, event_id, member_id')
      .eq('id', registration_id)
      .single()

    if (!reg) {
      return NextResponse.json({ error: 'Rejestracja nie istnieje' }, { status: 404 })
    }

    // Only own registration or admin
    if (reg.member_id !== authMember.id && !['admin', 'superadmin'].includes(authMember.role)) {
      return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })
    }

    // Check for duplicate disciplines
    const { data: existing } = await supabase
      .from('registration_disciplines')
      .select('event_discipline_id')
      .eq('member_registration_id', registration_id)

    const existingIds = new Set((existing || []).map(e => e.event_discipline_id))
    const newDiscs = disciplines.filter(d => !existingIds.has(d.event_discipline_id))

    if (newDiscs.length === 0) {
      return NextResponse.json({ error: 'Wszystkie wybrane dyscypliny są już dodane' }, { status: 409 })
    }

    // Validate slot capacity
    for (const disc of newDiscs) {
      if (!disc.event_discipline_slot_id) continue

      const { data: slot } = await supabase
        .from('event_discipline_slots')
        .select('id, max_participants')
        .eq('id', disc.event_discipline_slot_id)
        .single()

      if (!slot) {
        return NextResponse.json({ error: 'Slot nie istnieje' }, { status: 404 })
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

    // Get prices from DB — not from frontend
    const edIds = newDiscs.map(d => d.event_discipline_id)
    const { data: eds } = await supabase
      .from('event_disciplines')
      .select('id, price_pln')
      .in('id', edIds)
    const priceMap = new Map((eds || []).map(ed => [ed.id, Number(ed.price_pln) || 0]))

    // Insert new disciplines
    const rows = newDiscs.map(d => ({
      event_discipline_id: d.event_discipline_id,
      member_registration_id: registration_id,
      price_pln: priceMap.get(d.event_discipline_id) ?? 0,
      own_weapon: d.own_weapon,
      ...(d.event_discipline_slot_id ? { event_discipline_slot_id: d.event_discipline_slot_id } : {}),
    }))

    const { error: insertErr } = await supabase.from('registration_disciplines').insert(rows)

    if (insertErr) {
      console.error('Insert disciplines error:', insertErr)
      return NextResponse.json({ error: 'Błąd dodawania dyscyplin' }, { status: 500 })
    }

    return NextResponse.json({ success: true, added: newDiscs.length })
  } catch (err: any) {
    console.error('Add disciplines error:', err)
    return NextResponse.json({ error: 'Nieznany błąd' }, { status: 500 })
  }
}
