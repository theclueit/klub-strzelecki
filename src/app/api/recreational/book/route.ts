import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { p24RegisterTransaction } from '@/lib/przelewy24'
import { sendRangeRulesEmail } from '@/lib/email'
import { randomUUID } from 'crypto'
import { timeToMin } from '@/lib/date'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://klub-strzelecki.vercel.app'

interface BookingItem {
  package_id: string
  date: string
  start_time: string
  instructor_id: string
}

interface GuestData {
  name: string
  email: string
  phone: string
  address: string
  document: string
}

export async function POST(req: NextRequest) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing server config' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Auto-wygaś nieopłacone rezerwacje starsze niż 15 min (odblokuj sloty)
    await supabase.from('recreational_bookings')
      .update({ status: 'cancelled' })
      .eq('status', 'pending')
      .eq('paid', false)
      .lt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
    await supabase.from('lane_reservations')
      .update({ status: 'cancelled' })
      .eq('status', 'reserved')
      .eq('paid', false)
      .ilike('notes', 'Strzelanie rekreacyjne%')
      .lt('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())

    const body = await req.json()

    // Support both old format (single item) and new format (items array)
    let items: BookingItem[]
    if (body.items) {
      items = body.items
    } else {
      items = [{
        package_id: body.package_id,
        date: body.date,
        start_time: body.start_time,
        instructor_id: body.instructor_id,
      }]
    }

    const { member_id, notes } = body

    // Obsługa wielu osób (grupa) — tablica guests[]
    const guests: GuestData[] = body.guests
      ? body.guests
      : [{
          name: body.guest_name || '',
          email: body.guest_email || '',
          phone: body.guest_phone || '',
          address: body.guest_address || '',
          document: body.guest_document || '',
        }]

    if (items.length === 0) {
      return NextResponse.json({ error: 'Brak pozycji do rezerwacji' }, { status: 400 })
    }

    for (const item of items) {
      if (!item.package_id || !item.date || !item.start_time || !item.instructor_id) {
        return NextResponse.json({ error: 'Brakuje wymaganych danych w pozycji' }, { status: 400 })
      }
    }

    const bookingIds: string[] = []
    const laneReservationIds: string[] = []
    let totalPln = 0
    let firstPkgName = ''
    // IDs rezerwacji z tej grupy — pomijamy konflikty instruktora wewnątrz grupy
    const groupBookingIds: string[] = []

    // Iteruj: każda osoba × każdy pakiet
    for (const guest of guests) {
      for (const item of items) {
        // 1. Pobierz pakiet z bronią
        const { data: pkg } = await supabase
          .from('shooting_packages')
          .select('*, weapon:range_weapons(*, inventory_ammo_id)')
          .eq('id', item.package_id)
          .single()

        if (!pkg) return NextResponse.json({ error: `Pakiet nie istnieje: ${item.package_id}` }, { status: 404 })

        if (!firstPkgName) firstPkgName = pkg.name

        const weapon = pkg.weapon as any
        const startMin = timeToMin(item.start_time)
        const endMin = startMin + pkg.duration_minutes
        const endH = Math.floor(endMin / 60)
        const endM = endMin % 60
        const end_time = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`

        // 2. Sprawdź czy instruktor jest wolny (pomijaj rezerwacje z tej samej grupy)
        let instructorQuery = supabase
          .from('recreational_bookings')
          .select('id')
          .eq('instructor_id', item.instructor_id)
          .eq('booking_date', item.date)
          .neq('status', 'cancelled')
          .lt('start_time', end_time)
          .gt('end_time', item.start_time)
          .limit(1)

        for (const gid of groupBookingIds) {
          instructorQuery = instructorQuery.neq('id', gid)
        }
        const { data: conflictInstructor } = await instructorQuery

        if (conflictInstructor && conflictInstructor.length > 0) {
          return NextResponse.json({ error: `Instruktor jest zajęty: ${item.start_time} (${pkg.name})` }, { status: 409 })
        }

        // 3. Sprawdź czy broń jest wolna (pomijaj grupę — ta sama broń może być dzielona np. kolejno)
        // Dla grupy nie blokujemy broni — instruktor zarządza kolejnością
        if (guests.length === 1) {
          const { data: conflictWeapon } = await supabase
            .from('recreational_bookings')
            .select('id')
            .eq('weapon_id', weapon.id)
            .eq('booking_date', item.date)
            .neq('status', 'cancelled')
            .lt('start_time', end_time)
            .gt('end_time', item.start_time)
            .limit(1)

          if (conflictWeapon && conflictWeapon.length > 0) {
            return NextResponse.json({ error: `Broń jest zarezerwowana: ${item.start_time} (${pkg.name})` }, { status: 409 })
          }
        }

        // 4. Znajdź wolne stanowisko
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
            .eq('reservation_date', item.date)
            .neq('status', 'cancelled')
            .lt('start_time', end_time)
            .gt('end_time', item.start_time)

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
              reservation_date: item.date,
              start_time: item.start_time,
              end_time,
              status: 'reserved',
              paid: false,
              guest_name: guest.name || null,
              notes: `Strzelanie rekreacyjne: ${pkg.name}`,
            })
            .select()
            .single()
          laneReservationId = laneRes?.id || null
          if (laneReservationId) laneReservationIds.push(laneReservationId)
        }

        // 6. Utwórz rezerwację rekreacyjną
        const guestLabel = guests.length > 1 ? `${guest.name} (grupa ${guests.length} os.)` : (guest.name || null)
        const { data: booking, error: bookErr } = await supabase
          .from('recreational_bookings')
          .insert({
            package_id: item.package_id,
            weapon_id: weapon.id,
            customer_id: member_id || null,
            instructor_id: item.instructor_id,
            lane_reservation_id: laneReservationId,
            booking_date: item.date,
            start_time: item.start_time,
            end_time,
            ammo_count: pkg.ammo_count,
            price_pln: pkg.price_pln,
            status: 'pending',
            paid: false,
            guest_name: guest.name || null,
            guest_email: guest.email || null,
            guest_phone: guest.phone || null,
            guest_address: guest.address || null,
            guest_document: guest.document || null,
            notes: notes ? `${notes}${guests.length > 1 ? ` | ${guestLabel}` : ''}` : (guests.length > 1 ? guestLabel : null),
          })
          .select()
          .single()

        if (bookErr) throw bookErr
        bookingIds.push(booking.id)
        groupBookingIds.push(booking.id)
        totalPln += Number(pkg.price_pln)
      }
    }

    // 7. Wyślij regulamin strzelnicy na email
    const recipientEmail = guests[0]?.email || (member_id
      ? (await supabase.from('members').select('email').eq('id', member_id).single())?.data?.email
      : null)
    if (recipientEmail) {
      sendRangeRulesEmail({
        to: recipientEmail,
        guestName: guests[0]?.name || 'Strzelcu',
        bookingDate: items[0].date,
        weaponName: items.length === 1 ? firstPkgName : `${items.length} pakietów`,
        packageName: firstPkgName,
      }).catch(() => {}) // best-effort
    }

    // 8. Utwórz płatność i przekieruj do P24
    if (totalPln > 0) {
      const sessionId = `REC-${randomUUID()}`
      const amountGrosze = Math.round(totalPln * 100)

      const email = member_id
        ? (await supabase.from('members').select('email').eq('id', member_id).single())?.data?.email || ''
        : guests[0]?.email || ''

      const guestCount = guests.length > 1 ? ` (${guests.length} os.)` : ''
      const description = items.length === 1
        ? `Strzelanie rekreacyjne: ${firstPkgName}${guestCount}`
        : `Strzelanie rekreacyjne: ${items.length} pakietów${guestCount}`

      const { data: payment } = await supabase.from('payments').insert({
        member_id: member_id || null,
        amount_pln: totalPln,
        session_id: sessionId,
        status: 'pending',
      }).select().single()

      if (payment) {
        for (const bid of bookingIds) {
          await supabase.from('recreational_bookings').update({ payment_id: payment.id }).eq('id', bid)
        }
        for (const lid of laneReservationIds) {
          await supabase.from('lane_reservations').update({ payment_id: payment.id }).eq('id', lid)
        }
      }

      const { redirectUrl } = await p24RegisterTransaction({
        sessionId,
        amount: amountGrosze,
        currency: 'PLN',
        description,
        email,
        urlReturn: `${appUrl}/platnosc/sukces?session=${sessionId}`,
        urlStatus: `${appUrl}/api/payments/callback`,
      })

      return NextResponse.json({ success: true, redirect_url: redirectUrl })
    }

    return NextResponse.json({ success: true, booking_ids: bookingIds })
  } catch (err: any) {
    console.error('Recreational booking error:', err)
    return NextResponse.json({ error: err.message ?? 'Błąd rezerwacji' }, { status: 500 })
  }
}
