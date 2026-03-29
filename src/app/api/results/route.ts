import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const {
      member_id,
      judge_id,
      event_id,
      discipline_id,
      total_score,
      max_score,
      tens_count,
      xs_count,
      misses,
      shots,
      judge_comment,
      time_seconds,
    } = body

    if (!member_id || total_score === undefined || total_score === null) {
      return NextResponse.json({ error: 'Brak wymaganych pól (member_id, total_score)' }, { status: 400 })
    }

    // Normalize comma decimal separator to dot
    const norm = (v: any) => typeof v === 'string' ? v.replace(',', '.') : v

    const { data, error } = await supabase.from('results').insert({
      member_id,
      judge_id: judge_id || null,
      event_id: event_id || null,
      discipline_id: discipline_id || null,
      total_score: parseFloat(norm(total_score)),
      max_score: max_score ? parseFloat(norm(max_score)) : null,
      tens_count: parseInt(tens_count) || 0,
      xs_count: parseInt(xs_count) || 0,
      misses: parseInt(misses) || 0,
      shots: shots || null,
      judge_comment: judge_comment || null,
      target_image_url: null,
      time_seconds: time_seconds ? parseFloat(norm(time_seconds)) : null,
    }).select('id').single()

    if (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 422 })
    }

    // Trigger rankings recalculation in background
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://klub-strzelecki.vercel.app'
    fetch(`${appUrl}/api/rankings`, { method: 'POST' }).catch(() => {})

    return NextResponse.json({ ok: true, id: data?.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Nieznany błąd' }, { status: 500 })
  }
}
