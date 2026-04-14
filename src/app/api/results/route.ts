import { NextRequest, NextResponse } from 'next/server'
import { requireRole, isAuthError } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  try {
    // Only judges, admins, and superadmins can submit results
    const auth = await requireRole('judge', 'admin', 'superadmin')
    if (isAuthError(auth)) return auth

    const { supabase, member } = auth
    const body = await req.json()

    const {
      member_id,
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
      judge_id: member.id, // Always use authenticated judge's ID
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
      console.error('Result insert error:', error)
      return NextResponse.json({ error: 'Błąd zapisu wyniku' }, { status: 422 })
    }

    // Trigger rankings recalculation in background
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://klub-strzelecki.vercel.app'
    fetch(`${appUrl}/api/rankings`, { method: 'POST' }).catch(() => {})

    return NextResponse.json({ ok: true, id: data?.id })
  } catch (err: any) {
    console.error('Results API error:', err)
    return NextResponse.json({ error: 'Nieznany błąd' }, { status: 500 })
  }
}
