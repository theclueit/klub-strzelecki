import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Guest lane reservation — auto-creates member account
export async function POST(req: NextRequest) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing server config' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const body = await req.json()
    const {
      lane_id, station_number, stations_count, reservation_date,
      start_time, end_time, notes,
      guest_name, guest_email, guest_phone, guest_address, guest_document,
      pay_now,
    } = body

    if (!lane_id || !station_number || !reservation_date || !start_time || !end_time) {
      return NextResponse.json({ error: 'Brakuje danych rezerwacji' }, { status: 400 })
    }
    if (!guest_name || !guest_email || !guest_address || !guest_document) {
      return NextResponse.json({ error: 'Podaj imię, email, adres i numer dokumentu' }, { status: 400 })
    }

    // Find or create member by email
    let memberId: string | null = null
    const { data: existing } = await supabase
      .from('members')
      .select('id')
      .eq('email', guest_email)
      .single()

    if (existing) {
      memberId = existing.id
    } else {
      const { data: newMember } = await supabase
        .from('members')
        .insert({
          email: guest_email,
          full_name: guest_name,
          phone: guest_phone || null,
          address: guest_address,
          id_document_number: guest_document,
          role: 'member',
          is_active: true,
          club_name: '',
        })
        .select('id')
        .single()

      if (newMember) memberId = newMember.id
    }

    // Get lane info for pricing
    const { data: lane } = await supabase
      .from('shooting_lanes')
      .select('price_per_hour_pln')
      .eq('id', lane_id)
      .single()

    // Check slot availability
    const stationsCount = stations_count || 1
    for (let i = 0; i < stationsCount; i++) {
      const sn = station_number + i
      const { data: conflict } = await supabase
        .from('lane_reservations')
        .select('id')
        .eq('lane_id', lane_id)
        .eq('station_number', sn)
        .eq('reservation_date', reservation_date)
        .neq('status', 'cancelled')
        .lt('start_time', end_time)
        .gt('end_time', start_time)
        .limit(1)

      if (conflict && conflict.length > 0) {
        return NextResponse.json({ error: `Stanowisko ${sn} jest zajęte w tym terminie` }, { status: 409 })
      }
    }

    // Calculate price
    const startMin = parseInt(start_time.split(':')[0]) * 60 + parseInt(start_time.split(':')[1] || '0')
    const endMin = parseInt(end_time.split(':')[0]) * 60 + parseInt(end_time.split(':')[1] || '0')
    const hours = (endMin - startMin) / 60
    const totalPln = (lane?.price_per_hour_pln || 0) * hours * stationsCount

    // Create reservations for all stations
    const inserts = Array.from({ length: stationsCount }, (_, i) => ({
      lane_id,
      station_number: station_number + i,
      member_id: memberId,
      reservation_date,
      start_time,
      end_time,
      status: 'reserved',
      paid: totalPln <= 0,
      guest_name,
      notes: notes || null,
    }))

    const { data: resArr, error } = await supabase
      .from('lane_reservations')
      .insert(inserts)
      .select()

    if (error) throw error

    // Handle payment if requested
    if (pay_now && totalPln > 0 && resArr?.[0]) {
      // TODO: integrate with P24 payment for guest reservations
      // For now return success without redirect
    }

    return NextResponse.json({
      success: true,
      reservation_ids: resArr?.map((r: any) => r.id) || [],
      member_id: memberId,
      total_pln: totalPln,
    })
  } catch (err: any) {
    console.error('Guest reservation error:', err)
    return NextResponse.json({ error: err.message ?? 'Błąd rezerwacji' }, { status: 500 })
  }
}
