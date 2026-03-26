import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendGuestRegistrationConfirmation } from '@/lib/email'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Guest registration
export async function POST(req: NextRequest) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing server config' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const body = await req.json()
    const { event_id, full_name, email, phone, experience, has_license, license_number, message, disciplines } = body as {
      event_id: string
      full_name: string
      email: string
      phone?: string
      experience?: string
      has_license: boolean
      license_number?: string
      message?: string
      disciplines?: Array<{
        event_discipline_id: string
        event_discipline_slot_id?: string
        own_weapon: boolean
        price_pln: number
      }>
    }

    if (!event_id || !full_name || !email) {
      return NextResponse.json({ error: 'Brak wymaganych pól (event_id, full_name, email)' }, { status: 400 })
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Nieprawidłowy format email' }, { status: 400 })
    }

    // Check event exists and is published
    const { data: event } = await supabase
      .from('events')
      .select('id, title, start_date, location, max_participants, is_published')
      .eq('id', event_id)
      .single()

    if (!event) {
      return NextResponse.json({ error: 'Wydarzenie nie istnieje' }, { status: 404 })
    }

    if (!event.is_published) {
      return NextResponse.json({ error: 'Wydarzenie nie jest opublikowane' }, { status: 400 })
    }

    if (new Date(event.start_date) < new Date()) {
      return NextResponse.json({ error: 'Wydarzenie już się odbyło' }, { status: 400 })
    }

    // Check not already registered (by email)
    const { data: existingGuest } = await supabase
      .from('guest_registrations')
      .select('id')
      .eq('event_id', event_id)
      .eq('email', email)
      .maybeSingle()

    if (existingGuest) {
      return NextResponse.json({ error: 'Ten email jest już zapisany na to wydarzenie' }, { status: 409 })
    }

    // Validate slot capacity
    if (disciplines && disciplines.length > 0) {
      for (const disc of disciplines) {
        if (!disc.event_discipline_slot_id) continue

        const { data: slot } = await supabase
          .from('event_discipline_slots')
          .select('id, max_participants')
          .eq('id', disc.event_discipline_slot_id)
          .single()

        if (!slot) {
          return NextResponse.json({ error: 'Wybrany termin nie istnieje' }, { status: 404 })
        }

        const { count } = await supabase
          .from('registration_disciplines')
          .select('id', { count: 'exact', head: true })
          .eq('event_discipline_slot_id', disc.event_discipline_slot_id)

        if (count !== null && count >= slot.max_participants) {
          return NextResponse.json({ error: 'Brak wolnych miejsc w wybranym terminie' }, { status: 409 })
        }
      }
    }

    // Create guest registration
    const { data: regData, error: regErr } = await supabase
      .from('guest_registrations')
      .insert({
        event_id,
        full_name,
        email,
        phone: phone || null,
        experience: experience || null,
        has_license: has_license || false,
        license_number: has_license && license_number ? license_number : null,
        message: message || null,
      })
      .select('id')
      .single()

    if (regErr) {
      if (regErr.code === '23505') {
        return NextResponse.json({ error: 'Ten email jest już zapisany na to wydarzenie' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Błąd zapisu: ' + regErr.message }, { status: 500 })
    }

    // Insert discipline selections
    let disciplineNames: string[] = []
    if (disciplines && disciplines.length > 0 && regData) {
      const rows = disciplines.map(d => ({
        event_discipline_id: d.event_discipline_id,
        guest_registration_id: regData.id,
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

    // Send confirmation email to guest
    sendGuestRegistrationConfirmation({
      to: email,
      guestName: full_name,
      eventTitle: event.title,
      eventDate: event.start_date,
      eventLocation: event.location,
      disciplines: disciplineNames,
    }).catch(() => {})

    return NextResponse.json({ success: true, registration_id: regData.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Nieznany błąd' }, { status: 500 })
  }
}
