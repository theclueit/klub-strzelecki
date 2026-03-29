import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { sendRangeRulesEmail } from '@/lib/email'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

// On-site booking by range registrar — custom weapon, ammo, price, instructor
export async function POST(req: NextRequest) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing server config' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const body = await req.json()
    const {
      weapon_id, instructor_id, date, start_time, duration_minutes,
      ammo_count, price_pln, guest_name, guest_phone, guest_address, guest_document, guest_email, notes,
      member_id, registrar_id, package_id,
    } = body

    if (!weapon_id || !instructor_id || !date || !start_time || !duration_minutes) {
      return NextResponse.json({ error: 'Brakuje wymaganych danych' }, { status: 400 })
    }

    // Verify registrar has range_registrar/admin role
    if (!registrar_id) {
      return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })
    }
    const { data: registrar } = await supabase
      .from('members')
      .select('role')
      .eq('id', registrar_id)
      .single()

    if (!registrar || !['admin', 'superadmin', 'registrar', 'range_registrar'].includes(registrar.role)) {
      return NextResponse.json({ error: 'Brak uprawnień rejestratora' }, { status: 403 })
    }

    // Auto-create recreational_client member if guest_email provided and no member_id
    let customerId = member_id || null
    if (!customerId && guest_email && guest_name) {
      // Check if client already exists by email
      const { data: existing } = await supabase
        .from('members')
        .select('id')
        .eq('email', guest_email)
        .single()

      if (existing) {
        customerId = existing.id
      } else {
        const { data: newClient } = await supabase
          .from('members')
          .insert({
            email: guest_email,
            full_name: guest_name,
            phone: guest_phone || null,
            address: guest_address || null,
            id_document_number: guest_document || null,
            role: 'recreational_client',
            is_active: true,
            club_name: '',
          })
          .select('id')
          .single()

        if (newClient) customerId = newClient.id
      }
    }

    // Calculate end time
    const startMin = timeToMin(start_time)
    const endMin = startMin + Number(duration_minutes)
    const endH = Math.floor(endMin / 60)
    const endM = endMin % 60
    const end_time = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`

    // Check instructor availability
    const { data: conflictInstructor } = await supabase
      .from('recreational_bookings')
      .select('id')
      .eq('instructor_id', instructor_id)
      .eq('booking_date', date)
      .neq('status', 'cancelled')
      .lt('start_time', end_time)
      .gt('end_time', start_time)
      .limit(1)

    if (conflictInstructor && conflictInstructor.length > 0) {
      return NextResponse.json({ error: 'Instruktor jest zajęty w tym terminie' }, { status: 409 })
    }

    // Check weapon availability
    const { data: conflictWeapon } = await supabase
      .from('recreational_bookings')
      .select('id')
      .eq('weapon_id', weapon_id)
      .eq('booking_date', date)
      .neq('status', 'cancelled')
      .lt('start_time', end_time)
      .gt('end_time', start_time)
      .limit(1)

    if (conflictWeapon && conflictWeapon.length > 0) {
      return NextResponse.json({ error: 'Broń jest zarezerwowana w tym terminie' }, { status: 409 })
    }

    // Find free lane station
    const { data: lanes } = await supabase
      .from('shooting_lanes')
      .select('*')
      .eq('is_active', true)
      .order('length_m')

    let selectedLaneId: string | null = null
    let selectedStation: number | null = null

    for (const lane of (lanes ?? [])) {
      const laneOpenMin = timeToMin(lane.open_time || '08:00')
      const laneCloseMin = timeToMin(lane.close_time || '20:00')
      if (startMin < laneOpenMin || endMin > laneCloseMin) continue

      const { data: laneConflicts } = await supabase
        .from('lane_reservations')
        .select('station_number')
        .eq('lane_id', lane.id)
        .eq('reservation_date', date)
        .neq('status', 'cancelled')
        .lt('start_time', end_time)
        .gt('end_time', start_time)

      const busyStations = new Set((laneConflicts ?? []).map((c: any) => c.station_number))
      for (let sn = 1; sn <= lane.stations_count; sn++) {
        if (!busyStations.has(sn)) {
          selectedLaneId = lane.id
          selectedStation = sn
          break
        }
      }
      if (selectedLaneId) break
    }

    // Create lane reservation
    let laneReservationId: string | null = null
    if (selectedLaneId && selectedStation !== null) {
      const { data: laneRes } = await supabase
        .from('lane_reservations')
        .insert({
          lane_id: selectedLaneId,
          station_number: selectedStation,
          member_id: member_id || null,
          reservation_date: date,
          start_time,
          end_time,
          status: 'reserved',
          paid: true, // On-site = paid cash
          guest_name: guest_name || null,
          notes: `Strzelanie rekreacyjne (rejestracja na miejscu)`,
        })
        .select()
        .single()
      laneReservationId = laneRes?.id || null
    }

    // Get weapon info for booking name
    const { data: weapon } = await supabase
      .from('range_weapons')
      .select('name, caliber')
      .eq('id', weapon_id)
      .single()

    // Create recreational booking — marked as paid and confirmed (on-site cash)
    const { data: booking, error: bookErr } = await supabase
      .from('recreational_bookings')
      .insert({
        package_id: package_id || null,
        weapon_id,
        customer_id: customerId,
        instructor_id,
        lane_reservation_id: laneReservationId,
        booking_date: date,
        start_time,
        end_time,
        ammo_count: Number(ammo_count) || 0,
        price_pln: Number(price_pln) || 0,
        status: 'confirmed',
        paid: true,
        guest_name: guest_name || null,
        guest_phone: guest_phone || null,
        guest_address: guest_address || null,
        guest_document: guest_document || null,
        notes: notes || `Rejestracja na miejscu przez rejestratora`,
      })
      .select()
      .single()

    if (bookErr) throw bookErr

    // Send range rules email if guest_email provided
    if (guest_email) {
      sendRangeRulesEmail({
        to: guest_email,
        guestName: guest_name || 'Strzelcu',
        bookingDate: date,
        weaponName: `${weapon?.name || 'Broń'} (${weapon?.caliber || ''})`,
      }).catch(() => {})
    }

    return NextResponse.json({
      success: true,
      booking_id: booking.id,
      weapon_name: weapon?.name,
      lane_reservation_id: laneReservationId,
    })
  } catch (err: any) {
    console.error('On-site recreational booking error:', err)
    return NextResponse.json({ error: err.message ?? 'Błąd rezerwacji' }, { status: 500 })
  }
}
