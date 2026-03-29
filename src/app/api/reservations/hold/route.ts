import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const HOLD_DURATION_SECONDS = 180 // 3 minutes

// POST — create a hold (temporary lock) on slot(s)
export async function POST(req: NextRequest) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing server config' }, { status: 500 })
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const body = await req.json()
    const { lane_id, station_number, stations_count, reservation_date, start_time, end_time } = body

    if (!lane_id || !station_number || !reservation_date || !start_time || !end_time) {
      return NextResponse.json({ error: 'Brakuje danych' }, { status: 400 })
    }

    // Clean up expired holds first
    await supabase.rpc('cleanup_expired_holds')

    const holdToken = randomUUID()
    const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_SECONDS * 1000).toISOString()
    const stationsCount = stations_count || 1

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
      // EXCLUDE constraint violation = slot taken
      if (error.code === '23P01') {
        return NextResponse.json({ error: 'Slot jest już zajęty' }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({
      hold_token: holdToken,
      expires_at: holdExpiresAt,
      hold_seconds: HOLD_DURATION_SECONDS,
      reservation_ids: data?.map(r => r.id) || [],
    })
  } catch (err: any) {
    console.error('Hold create error:', err)
    return NextResponse.json({ error: err.message ?? 'Błąd' }, { status: 500 })
  }
}

// PATCH — extend a hold (give more time)
export async function PATCH(req: NextRequest) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing server config' }, { status: 500 })
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const body = await req.json()
    const { hold_token } = body

    if (!hold_token) {
      return NextResponse.json({ error: 'Brak hold_token' }, { status: 400 })
    }

    const newExpiresAt = new Date(Date.now() + HOLD_DURATION_SECONDS * 1000).toISOString()

    const { data, error } = await supabase
      .from('lane_reservations')
      .update({ hold_expires_at: newExpiresAt })
      .eq('hold_token', hold_token)
      .eq('status', 'hold')
      .gt('hold_expires_at', new Date().toISOString())
      .select('id')

    if (error) throw error
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
    return NextResponse.json({ error: err.message ?? 'Błąd' }, { status: 500 })
  }
}

// DELETE — release a hold (user cancelled)
export async function DELETE(req: NextRequest) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing server config' }, { status: 500 })
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { hold_token } = await req.json()

    if (!hold_token) {
      return NextResponse.json({ error: 'Brak hold_token' }, { status: 400 })
    }

    await supabase
      .from('lane_reservations')
      .update({ status: 'cancelled' })
      .eq('hold_token', hold_token)
      .eq('status', 'hold')

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Hold release error:', err)
    return NextResponse.json({ error: err.message ?? 'Błąd' }, { status: 500 })
  }
}
