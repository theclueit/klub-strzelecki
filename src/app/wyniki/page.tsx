import { supabase } from '@/lib/supabase'
import { Trophy, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ResultsPage() {
  // Get all events that have results
  const { data: results } = await supabase
    .from('results')
    .select('id, total_score, max_score, tens_count, misses, time_seconds, shot_at, member:members!results_member_id_fkey(id, full_name, class, license_number, club_name), event:events(id, title, start_date, event_type), discipline:disciplines(name, scoring_type)')
    .order('shot_at', { ascending: false })

  // Group by event
  const eventGroups: Record<string, {
    event: { id: string; title: string; start_date: string; event_type: string }
    results: any[]
  }> = {}

  for (const r of (results ?? []) as any[]) {
    if (!r.event) continue
    const eid = r.event.id as string
    if (!eventGroups[eid]) {
      eventGroups[eid] = { event: r.event, results: [] }
    }
    eventGroups[eid].results.push(r)
  }

  // Sort by event date descending
  const sorted = Object.values(eventGroups).sort((a, b) =>
    new Date(b.event.start_date).getTime() - new Date(a.event.start_date).getTime()
  )

  const medals = ['🥇', '🥈', '🥉']
  const classColors: Record<string, string> = {
    'Mistrz': 'bg-primary/20 text-primary',
    'I': 'bg-blue-500/20 text-blue-400',
    'II': 'bg-green-500/20 text-green-400',
    'III': 'bg-muted/20 text-muted',
  }
  const typeLabels: Record<string, string> = {
    competition: 'Zawody', training: 'Trening', course: 'Kurs', other: 'Inne',
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Trophy className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">Wyniki zawodów</h1>
      </div>

      {sorted.length === 0 ? (
        <p className="text-muted">Brak wyników. Wyniki pojawią się po pierwszych zawodach.</p>
      ) : (
        <div className="space-y-8">
          {sorted.map(group => {
            const ev = group.event
            const eventDate = new Date(ev.start_date).toLocaleDateString('pl-PL', {
              day: 'numeric', month: 'long', year: 'numeric',
            })

            // Group results by discipline
            const byDiscipline: Record<string, any[]> = {}
            for (const r of group.results as any[]) {
              const dName = r.discipline?.name ?? 'Inne'
              if (!byDiscipline[dName]) byDiscipline[dName] = []
              byDiscipline[dName].push(r)
            }
            // Sort each discipline group by score descending; for shotgun: score desc then time asc
            for (const dName of Object.keys(byDiscipline)) {
              const isShotgun = byDiscipline[dName][0]?.discipline?.scoring_type === 'shotgun'
              if (isShotgun) {
                // Shotgun: sort by total_score ASC (total_score = time + penalties, lowest = best)
                byDiscipline[dName].sort((a: any, b: any) => a.total_score - b.total_score)
              } else {
                byDiscipline[dName].sort((a: any, b: any) => b.total_score - a.total_score)
              }
            }

            return (
              <div key={ev.id} className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Event header */}
                <div className="px-6 py-5 border-b border-border">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                      {typeLabels[ev.event_type] ?? 'Inne'}
                    </span>
                    <span className="text-xs text-muted">{eventDate}</span>
                  </div>
                  <h2 className="text-xl font-bold">{ev.title}</h2>
                  <p className="text-sm text-muted mt-1">
                    {group.results.length} {group.results.length === 1 ? 'wynik' : group.results.length < 5 ? 'wyniki' : 'wyników'}
                    {' · '}{Object.keys(byDiscipline).length} {Object.keys(byDiscipline).length === 1 ? 'dyscyplina' : 'dyscyplin'}
                  </p>
                </div>

                {/* Results per discipline */}
                {Object.entries(byDiscipline).map(([discName, discResults]) => {
                  const isShotgun = discResults[0]?.discipline?.scoring_type === 'shotgun'
                  return (
                  <div key={discName}>
                    <div className="px-6 py-3 bg-background/50 border-b border-border/50">
                      <h3 className="text-sm font-semibold text-blue-400">{discName}</h3>
                    </div>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border/30 text-xs text-muted">
                          <th className="text-left px-6 py-2 w-12">#</th>
                          <th className="text-left px-6 py-2">Zawodnik</th>
                          <th className="text-left px-6 py-2">Klub</th>
                          <th className="text-left px-6 py-2">Klasa</th>
                          {isShotgun ? (
                            <>
                              <th className="text-right px-6 py-2">Czas</th>
                              <th className="text-right px-6 py-2">Pudła</th>
                              <th className="text-right px-6 py-2">Wynik</th>
                            </>
                          ) : (
                            <>
                              <th className="text-right px-6 py-2">Wynik</th>
                              <th className="text-right px-6 py-2">10-tki</th>
                              <th className="text-right px-6 py-2">Pudła</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {discResults.map((r: any, i: number) => (
                          <tr key={r.id} className="border-b border-border/20 hover:bg-card-hover text-sm">
                            <td className="px-6 py-2.5">
                              {i < 3 ? <span className="text-base">{medals[i]}</span> : <span className="text-muted">{i + 1}</span>}
                            </td>
                            <td className="px-6 py-2.5">
                              <Link href={`/zawodnicy/${r.member?.id}`} className="font-medium hover:text-primary transition-colors">
                                {r.member?.full_name ?? '?'}
                              </Link>
                              <div className="text-xs text-muted">{r.member?.license_number}</div>
                            </td>
                            <td className="px-6 py-2.5 text-muted text-xs">{r.member?.club_name ?? '-'}</td>
                            <td className="px-6 py-2.5">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${classColors[r.member?.class] ?? ''}`}>
                                {r.member?.class}
                              </span>
                            </td>
                            {isShotgun ? (
                              <>
                                <td className="px-6 py-2.5 text-right font-mono text-muted">
                                  {r.time_seconds ? `${Number(r.time_seconds).toFixed(2)}s` : '-'}
                                </td>
                                <td className="px-6 py-2.5 text-right text-muted">
                                  {r.misses ? <span className="text-danger">{r.misses} (+{r.misses * 5}s)</span> : '0'}
                                </td>
                                <td className="px-6 py-2.5 text-right">
                                  <span className="font-mono font-bold text-lg">{Number(r.total_score).toFixed(2)}s</span>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-6 py-2.5 text-right">
                                  <span className="font-mono font-bold text-lg">{r.total_score}</span>
                                  {r.max_score && <span className="text-xs text-muted">/{r.max_score}</span>}
                                </td>
                                <td className="px-6 py-2.5 text-right text-muted">{r.tens_count ?? '-'}</td>
                                <td className="px-6 py-2.5 text-right text-muted">{r.misses ?? '-'}</td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
