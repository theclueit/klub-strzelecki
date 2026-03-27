import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { p24RegisterTransaction } from '@/lib/przelewy24'
import { sendRangeRulesEmail } from '@/lib/email'
import { randomUUID } from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://klub-strzelecki.vercel.app'

function timeToMin(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

export async function POST(req: NextRequest) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing server config' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const body = await req.json()
    const { package_id, date, start_time, instructor_id, member_id, guest_name, guest_email, guest_phone, guest_address, guest_document, notes } = body

    if (!package_id || !date || !start_time || !instructor_id) {
      return NextResponse.json({ error: 'Brakuje wymaganych danych' }, { status: 400 })
    }

    // 1. Pobierz pakiet z bronią
    const { data: pkg } = await supabase
      .from('shooting_packages')
      .select('*, weapon:range_weapons(*, inventory_ammo_id)')
      .eq('id', package_id)
      .single()

    if (!pkg) return NextResponse.json({ error: 'Pakiet nie istnieje' }, { status: 404 })

    const weapon = pkg.weapon as any
    const startMin = timeToMin(start_time)
    const endMin = startMin + pkg.duration_minutes
    const endH = Math.floor(endMin / 60)
    const endM = endMin % 60
    const end_time = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`

    // 2. Sprawdź czy instruktor jest wolny
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

    // 3. Sprawdź czy broń jest wolna
    const { data: conflictWeapon } = await supabase
      .from('recreational_bookings')
      .select('id')
      .eq('weapon_id', weapon.id)
      .eq('booking_date', date)
      .neq('status', 'cancelled')
      .lt('start_time', end_time)
      .gt('end_time', start_time)
      .limit(1)

    if (conflictWeapon && conflictWeapon.length > 0) {
      return NextResponse.json({ error: 'Broń jest zarezerwowana w tym terminie' }, { status: 409 })
    }

    // 4. Znajdź wolne stanowisko na jakiejś osi
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

      const busyStations = new Set((laneConflicts ?? []).map(c => c.station_number))
      for (let sn = 1; sn <= lane.stations_count; sn++) {
        if (!busyStations.has(sn)) {
          selectedLaneId = lane.id
          selectedStation = sn
          break
        }
      }
      if (selectedLaneId) break
    }

    // 5. Utwórz rezerwację toru
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
          paid: false,
          guest_name: guest_name || null,
          notes: `Strzelanie rekreacyjne: ${pkg.name}`,
        })
        .select()
        .single()
      laneReservationId = laneRes?.id || null
    }

    // 6. Utwórz rezerwację rekreacyjną
    const { data: booking, error: bookErr } = await supabase
      .from('recreational_bookings')
      .insert({
        package_id,
        weapon_id: weapon.id,
        customer_id: member_id || null,
        instructor_id,
        lane_reservation_id: laneReservationId,
        booking_date: date,
        start_time,
        end_time,
        ammo_count: pkg.ammo_count,
        price_pln: pkg.price_pln,
        status: 'pending',
        paid: false,
        guest_name: guest_name || null,
        guest_email: guest_email || null,
        guest_phone: guest_phone || null,
        guest_address: guest_address || null,
        guest_document: guest_document || null,
        notes: notes || null,
      })
      .select()
      .single()

    if (bookErr) throw bookErr

    // 6b. Wyślij regulamin strzelnicy na email
    const recipientEmail = guest_email || (member_id
      ? (await supabase.from('members').select('email').eq('id', member_id).single())?.data?.email
      : null)
    if (recipientEmail) {
      sendRangeRulesEmail({
        to: recipientEmail,
        guestName: guest_name || 'Strzelcu',
        bookingDate: date,
        weaponName: `${weapon.name} (${weapon.caliber})`,
        packageName: pkg.name,
      }).catch(() => {}) // best-effort
    }

    // 7. Utwórz płatność i przekieruj do P24
    const totalPln = Number(pkg.price_pln)
    if (totalPln > 0) {
      const sessionId = `REC-${randomUUID()}`
      const amountGrosze = Math.round(totalPln * 100)

      const email = member_id
        ? (await supabase.from('members').select('email').eq('id', member_id).single())?.data?.email || ''
        : guest_email || ''

      const { data: payment } = await supabase.from('payments').insert({
        member_id: member_id || null,
        amount_pln: totalPln,
        session_id: sessionId,
        status: 'pending',
      }).select().single()

      if (payment) {
        await supabase.from('recreational_bookings').update({ payment_id: payment.id }).eq('id', booking.id)
        if (laneReservationId) {
          await supabase.from('lane_reservations').update({ payment_id: payment.id }).eq('id', laneReservationId)
        }
      }

      const { redirectUrl } = await p24RegisterTransaction({
        sessionId,
        amount: amountGrosze,
        currency: 'PLN',
        description: `Strzelanie rekreacyjne: ${pkg.name}`,
        email,
        urlReturn: `${appUrl}/platnosc/sukces?session=${sessionId}`,
        urlStatus: `${appUrl}/api/payments/callback`,
      })

      return NextResponse.json({ success: true, redirect_url: redirectUrl })
    }

    return NextResponse.json({ success: true, booking_id: booking.id })
  } catch (err: any) {
    console.error('Recreational booking error:', err)
    return NextResponse.json({ error: err.message ?? 'Błąd rezerwacji' }, { status: 500 })
  }
}
