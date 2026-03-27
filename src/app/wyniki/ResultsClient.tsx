'use client'

import { useState, useMemo } from 'react'
import { Trophy, Search, X } from 'lucide-react'
import Link from 'next/link'

interface ResultRow {
  id: string
  total_score: number
  max_score: number | null
  tens_count: number | null
  misses: number | null
  time_seconds: number | null
  shot_at: string
  member?: { id: string; full_name: string; class: string; license_number: string | null; club_name: string | null }
  event?: { id: string; title: string; start_date: string; event_type: string }
  discipline?: { name: string; scoring_type: string | null }
}

export default function ResultsClient({ results }: { results: ResultRow[] }) {
  const [search, setSearch] = useState('')

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

  // Filter results by search query
  const filteredResults = useMemo(() => {
    if (!search.trim()) return results
    const q = search.toLowerCase().trim()
    return results.filter(r =>
      r.member?.full_name?.toLowerCase().includes(q) ||
      r.member?.club_name?.toLowerCase().includes(q) ||
      r.member?.license_number?.toLowerCase().includes(q)
    )
  }, [results, search])

  // Group by event
  const sorted = useMemo(() => {
    const eventGroups: Record<string, { event: NonNullable<ResultRow['event']>; results: ResultRow[] }> = {}
    for (const r of filteredResults) {
      if (!r.event) continue
      const eid = r.event.id
      if (!eventGroups[eid]) {
        eventGroups[eid] = { event: r.event, results: [] }
      }
      eventGroups[eid].results.push(r)
    }
    return Object.values(eventGroups).sort((a, b) =>
      new Date(b.event.start_date).getTime() - new Date(a.event.start_date).getTime()
    )
  }, [filteredResults])

  // For ranking: get full discipline results (unfiltered) to determine positions
  const fullByEventDiscipline = useMemo(() => {
    const map: Record<string, ResultRow[]> = {}
    for (const r of results) {
      if (!r.event || !r.discipline) continue
      const key = `${r.event.id}:${r.discipline.name}`
      if (!map[key]) map[key] = []
      map[key].push(r)
    }
    // Sort each
    for (const key of Object.keys(map)) {
      const isShotgun = map[key][0]?.discipline?.scoring_type === 'shotgun'
      if (isShotgun) {
        map[key].sort((a, b) => a.total_score - b.total_score)
      } else {
        map[key].sort((a, b) => b.total_score - a.total_score)
      }
    }
    return map
  }, [results])

  const matchCount = filteredResults.length
  const inputClass = "w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:border-primary text-sm"

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">Wyniki zawodów</h1>
      </div>

      {/* Search bar */}
      <div className="mb-8">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Szukaj zawodnika, klubu lub nr licencji..."
            className={inputClass + ' pl-10 pr-10'}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-muted hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {search.trim() && (
          <p className="text-xs text-muted mt-2">
            {matchCount === 0 ? 'Brak wyników' : `Znaleziono ${matchCount} ${matchCount === 1 ? 'wynik' : matchCount < 5 ? 'wyniki' : 'wyników'}`}
            {' '}dla &quot;{search.trim()}&quot;
          </p>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-muted">{search.trim() ? 'Brak pasujących wyników.' : 'Brak wyników. Wyniki pojawią się po pierwszych zawodach.'}</p>
      ) : (
        <div className="space-y-8">
          {sorted.map(group => {
            const ev = group.event
            const eventDate = new Date(ev.start_date).toLocaleDateString('pl-PL', {
              day: 'numeric', month: 'long', year: 'numeric',
            })

            // Group results by discipline
            const byDiscipline: Record<string, ResultRow[]> = {}
            for (const r of group.results) {
              const dName = r.discipline?.name ?? 'Inne'
              if (!byDiscipline[dName]) byDiscipline[dName] = []
              byDiscipline[dName].push(r)
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
                  // Get full ranking to show correct positions
                  const fullKey = `${ev.id}:${discName}`
                  const fullRanking = fullByEventDiscipline[fullKey] ?? []

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
                          {discResults.map((r) => {
                            // Position based on full ranking, not filtered
                            const pos = fullRanking.findIndex(fr => fr.id === r.id)
                            return (
                              <tr key={r.id} className="border-b border-border/20 hover:bg-card-hover text-sm">
                                <td className="px-6 py-2.5">
                                  {pos < 3 ? <span className="text-base">{medals[pos]}</span> : <span className="text-muted">{pos + 1}</span>}
                                </td>
                                <td className="px-6 py-2.5">
                                  <Link href={`/zawodnicy/${r.member?.id}`} className="font-medium hover:text-primary transition-colors">
                                    {r.member?.full_name ?? '?'}
                                  </Link>
                                  <div className="text-xs text-muted">{r.member?.license_number}</div>
                                </td>
                                <td className="px-6 py-2.5 text-muted text-xs">{r.member?.club_name ?? '-'}</td>
                                <td className="px-6 py-2.5">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${classColors[r.member?.class ?? ''] ?? ''}`}>
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
                            )
                          })}
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
