import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST() {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing server config' }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get all results grouped by member + discipline
    const { data: results, error: resultsErr } = await supabase
      .from('results')
      .select('member_id, discipline_id, total_score, event_id')
      .not('discipline_id', 'is', null)

    if (resultsErr) {
      return NextResponse.json({ error: resultsErr.message }, { status: 500 })
    }

    if (!results || results.length === 0) {
      return NextResponse.json({ message: 'No results to process', count: 0 })
    }

    // Aggregate per member+discipline
    const map = new Map<string, { member_id: string; discipline_id: string; scores: number[]; events: Set<string> }>()

    for (const r of results) {
      if (!r.discipline_id || !r.member_id) continue
      const key = `${r.member_id}-${r.discipline_id}`
      if (!map.has(key)) {
        map.set(key, { member_id: r.member_id, discipline_id: r.discipline_id, scores: [], events: new Set() })
      }
      const entry = map.get(key)!
      entry.scores.push(Number(r.total_score))
      if (r.event_id) entry.events.add(r.event_id)
    }

    // Calculate rankings
    const rows = Array.from(map.values()).map(entry => {
      const best = Math.max(...entry.scores)
      const avg = entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length
      // Points: best score + bonus for participation (5 pts per event, max 25)
      const participationBonus = Math.min(entry.events.size * 5, 25)
      const totalPoints = best + participationBonus

      return {
        member_id: entry.member_id,
        discipline_id: entry.discipline_id,
        best_score: best,
        avg_score: Math.round(avg * 100) / 100,
        events_count: entry.events.size,
        total_points: totalPoints,
        updated_at: new Date().toISOString(),
      }
    })

    // Group by discipline for position calculation
    const byDiscipline = new Map<string, typeof rows>()
    for (const row of rows) {
      if (!byDiscipline.has(row.discipline_id)) byDiscipline.set(row.discipline_id, [])
      byDiscipline.get(row.discipline_id)!.push(row)
    }

    const finalRows: (typeof rows[0] & { rank_position: number })[] = []
    for (const [, discRows] of byDiscipline) {
      discRows.sort((a, b) => b.total_points - a.total_points)
      discRows.forEach((row, idx) => {
        finalRows.push({ ...row, rank_position: idx + 1 })
      })
    }

    // Upsert all rankings
    const { error: upsertErr } = await supabase
      .from('rankings')
      .upsert(finalRows, { onConflict: 'member_id,discipline_id' })

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Rankings updated', count: finalRows.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 })
  }
}
