import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'

// Rankings recalculation — triggered internally after result submission
export async function POST() {
  try {
    // Rate limit: max 10 recalculations per minute (anti-DoS)
    const rl = await checkRateLimit('rankings:global', { limit: 10, windowSeconds: 60 })
    if (!rl.success) {
      return NextResponse.json({ message: 'Ranking update skipped (rate limited)' })
    }
    const supabase = createServiceClient()

    // Get all results grouped by member + discipline
    const { data: results, error: resultsErr } = await supabase
      .from('results')
      .select('member_id, discipline_id, total_score, event_id')
      .not('discipline_id', 'is', null)

    if (resultsErr) {
      console.error('Rankings fetch error:', resultsErr)
      return NextResponse.json({ error: 'Błąd pobierania wyników' }, { status: 500 })
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
      console.error('Rankings upsert error:', upsertErr)
      return NextResponse.json({ error: 'Błąd aktualizacji rankingów' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Rankings updated', count: finalRows.length })
  } catch (err: any) {
    console.error('Rankings error:', err)
    return NextResponse.json({ error: 'Nieznany błąd' }, { status: 500 })
  }
}
