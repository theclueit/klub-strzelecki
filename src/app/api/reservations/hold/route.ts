import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/api-auth'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { holdCreateSchema, holdExtendSchema, holdDeleteSchema, parseBody } from '@/lib/validation'
import { randomUUID } from 'crypto'

const HOLD_DURATION_SECONDS = 180 // 3 minutes

// POST — create a hold (temporary lock) on slot(s)
// Public endpoint — guests can hold slots before providing details
export async function POST(req: NextRequest) {
  try {
    // Rate limit: 20 holds per hour per IP (prevent DoS flood)
    const ip = getClientIp(req)
    const rl = await checkRateLimit(`hold:${ip}`, { limit: 20, windowSeconds: 3600 })
    if (!rl.success) {
      return NextResponse.json({ error: 'Zbyt wiele prób rezerwacji. Spróbuj później.' }, { status: 429 })
    }

    const supabase = createServiceClient()
    const parsed = parseBody(holdCreateSchema, await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { lane_id, station_number, stations_count, reservation_date, start_time, end_time } = parsed.data

    // Clean up expired holds first
    await supabase.rpc('cleanup_expired_holds')

    const holdToken = randomUUID()
    const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_SECONDS * 1000).toISOString()
    const stationsCount = stations_count

    const inserts = Array.from({ length: stationsCount }, (_, i) => ({
      lane_id,
      station_number: station_number + i,
      reservation_date,
      start_time,
      end_time,
      status: 'hold',
      paid: false,
      hold_token: holdToken,
      hold_expires_at: holdExpiresAt,
    }))

    const { data, error } = await supabase
      .from('lane_reservations')
      .insert(inserts)
      .select('id')

    if (error) {
      if (error.code === '23P01') {
        return NextResponse.json({ error: 'Slot jest już zajęty' }, { status: 409 })
      }
      console.error('Hold create error:', error)
      return NextResponse.json({ error: 'Błąd rezerwacji' }, { status: 500 })
    }

    return NextResponse.json({
      hold_token: holdToken,
      expires_at: holdExpiresAt,
      hold_seconds: HOLD_DURATION_SECONDS,
      reservation_ids: data?.map(r => r.id) || [],
    })
  } catch (err: any) {
    console.error('Hold create error:', err)
    return NextResponse.json({ error: 'Błąd rezerwacji' }, { status: 500 })
  }
}

// PATCH — extend a hold (give more time)
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createServiceClient()
    const parsed = parseBody(holdExtendSchema, await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { hold_token } = parsed.data

    const newExpiresAt = new Date(Date.now() + HOLD_DURATION_SECONDS * 1000).toISOString()

    const { data, error } = await supabase
      .from('lane_reservations')
      .update({ hold_expires_at: newExpiresAt })
      .eq('hold_token', hold_token)
      .eq('status', 'hold')
      .gt('hold_expires_at', new Date().toISOString())
      .select('id')

    if (error) {
      console.error('Hold extend error:', error)
      return NextResponse.json({ error: 'Błąd przedłużenia' }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Hold wygasł lub nie istnieje' }, { status: 410 })
    }

    return NextResponse.json({
      hold_token,
      expires_at: newExpiresAt,
      hold_seconds: HOLD_DURATION_SECONDS,
    })
  } catch (err: any) {
    console.error('Hold extend error:', err)
    return NextResponse.json({ error: 'Błąd przedłużenia' }, { status: 500 })
  }
}

// DELETE — release a hold (user cancelled)
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createServiceClient()
    const parsed = parseBody(holdDeleteSchema, await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
    const { hold_token } = parsed.data

    await supabase
      .from('lane_reservations')
      .update({ status: 'cancelled' })
      .eq('hold_token', hold_token)
      .eq('status', 'hold')

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Hold release error:', err)
    return NextResponse.json({ error: 'Błąd anulowania' }, { status: 500 })
  }
}
