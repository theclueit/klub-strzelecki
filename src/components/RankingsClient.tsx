'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, ChevronDown, ChevronUp, Calendar, Users } from 'lucide-react'

const medals = ['🥇', '🥈', '🥉']
const classColors: Record<string, string> = {
  'Mistrz': 'bg-primary/20 text-primary',
  'I': 'bg-blue-500/20 text-blue-400',
  'II': 'bg-green-500/20 text-green-400',
  'III': 'bg-muted/20 text-muted',
}

type Result = {
  member_id: string
  total_score: number
  discipline: { name: string } | null
  member: { id: string; full_name: string; class: string; license_number: string; club_name: string | null } | null
}

type EventResult = {
  id: string
  score: number
  member: { id: string; full_name: string; class: string; license_number: string; club_name: string | null } | null
  event: { id: string; title: string; start_date: string; end_date: string } | null
  discipline: { name: string } | null
}

type Member = {
  id: string
  full_name: string
  class: string
  license_number: string
  club_name: string | null
}

type GroupedEvent = {
  event_id: string
  title: string
  start_date: string
  end_date: string
  disciplines: {
    name: string
    participants: {
      member: EventResult['member']
      score: number
    }[]
  }[]
}

export default function RankingsClient({
  results,
  members,
  disciplines,
  eventResults,
}: {
  results: Result[]
  members: Member[]
  disciplines: string[]
  eventResults: EventResult[]
}) {
  const [activeDiscipline, setActiveDiscipline] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({})

  const hasResults = results && results.length > 0

  // Filter results by discipline
  const filteredResults = activeDiscipline === 'all'
    ? results
    : results.filter(r => r.discipline?.name === activeDiscipline)

  // Filter by search query
  const searchedResults = searchQuery
    ? filteredResults.filter(r =>
        r.member?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.member?.license_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.member?.club_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredResults

  // Filter members by search query (for fallback when no results)
  const searchedMembers = searchQuery
    ? members.filter(m =>
        m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.license_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.club_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : members

  // Group event results by event, then by discipline
  const groupedEvents: GroupedEvent[] = []
  const eventMap = new Map<string, GroupedEvent>()

  for (const er of eventResults) {
    if (!er.event) continue
    const eid = er.event.id
    if (!eventMap.has(eid)) {
      const ge: GroupedEvent = {
        event_id: eid,
        title: er.event.title,
        start_date: er.event.start_date,
        end_date: er.event.end_date,
        disciplines: [],
      }
      eventMap.set(eid, ge)
      groupedEvents.push(ge)
    }
    const ge = eventMap.get(eid)!
    const discName = er.discipline?.name ?? 'Brak dyscypliny'
    let disc = ge.disciplines.find(d => d.name === discName)
    if (!disc) {
      disc = { name: discName, participants: [] }
      ge.disciplines.push(disc)
    }
    disc.participants.push({ member: er.member, score: er.score })
  }

  // Sort participants within each discipline by score descending
  for (const ge of groupedEvents) {
    for (const disc of ge.disciplines) {
      disc.participants.sort((a, b) => b.score - a.score)
    }
  }

  // Sort events by start_date descending (most recent first)
  groupedEvents.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())

  const toggleEvent = (eventId: string) => {
    setExpandedEvents(prev => ({ ...prev, [eventId]: !prev[eventId] }))
  }

  return (
    <div className="space-y-12">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted" />
        <input
          type="text"
          placeholder="Szukaj zawodnika po nazwisku, licencji lub klubie..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
        />
      </div>

      {/* Discipline tabs */}
      {disciplines.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveDiscipline('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeDiscipline === 'all'
                ? 'bg-primary text-white'
                : 'bg-card border border-border text-muted hover:text-foreground'
            }`}
          >
            Wszystkie
          </button>
          {disciplines.map(d => (
            <button
              key={d}
              onClick={() => setActiveDiscipline(d)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeDiscipline === d
                  ? 'bg-primary text-white'
                  : 'bg-card border border-border text-muted hover:text-foreground'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      )}

      {/* Rankings table */}
      {hasResults ? (
        <div>
          <h2 className="text-xl font-semibold mb-4">Ranking ogolny</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-sm text-muted">
                    <th className="text-left px-6 py-4 w-16">#</th>
                    <th className="text-left px-6 py-4">Zawodnik</th>
                    <th className="text-left px-6 py-4">Klub</th>
                    <th className="text-left px-6 py-4">Klasa</th>
                    <th className="text-left px-6 py-4">Dyscyplina</th>
                    <th className="text-right px-6 py-4">Wynik</th>
                  </tr>
                </thead>
                <tbody>
                  {searchedResults.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-muted">
                        Brak wynikow pasujacych do wyszukiwania.
                      </td>
                    </tr>
                  ) : (
                    searchedResults.map((r: Result, i: number) => (
                      <tr key={r.member_id + '-' + i} className="border-b border-border/50 hover:bg-card-hover transition-colors">
                        <td className="px-6 py-4 text-lg">
                          {i < 3 ? medals[i] : <span className="text-muted">{i + 1}</span>}
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/zawodnicy/${r.member?.id}`} className="font-medium hover:text-primary transition-colors">
                            {r.member?.full_name ?? 'Nieznany'}
                          </Link>
                          <div className="text-xs text-muted">{r.member?.license_number}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted">
                          {r.member?.club_name ?? '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${classColors[r.member?.class ?? ''] ?? ''}`}>
                            {r.member?.class}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted">{r.discipline?.name ?? '-'}</td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-lg">{r.total_score}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-muted mb-8">Brak wynikow. Ranking zostanie uzupelniony po pierwszych zawodach.</p>
          <h2 className="text-xl font-semibold mb-4">Czlonkowie klubu</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-sm text-muted">
                    <th className="text-left px-6 py-4">#</th>
                    <th className="text-left px-6 py-4">Zawodnik</th>
                    <th className="text-left px-6 py-4">Klub</th>
                    <th className="text-left px-6 py-4">Klasa</th>
                    <th className="text-left px-6 py-4">Licencja</th>
                  </tr>
                </thead>
                <tbody>
                  {searchedMembers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-muted">
                        Brak wynikow pasujacych do wyszukiwania.
                      </td>
                    </tr>
                  ) : (
                    searchedMembers.map((m, i) => (
                      <tr key={m.id} className="border-b border-border/50 hover:bg-card-hover transition-colors">
                        <td className="px-6 py-4 text-muted">{i + 1}</td>
                        <td className="px-6 py-4">
                          <Link href={`/zawodnicy/${m.id}`} className="font-medium hover:text-primary transition-colors">
                            {m.full_name}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted">
                          {m.club_name ?? '-'}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${classColors[m.class] ?? ''}`}>
                            {m.class}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted">{m.license_number}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Ranking pod zawodami */}
      {groupedEvents.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">Ranking pod zawodami</h2>
          </div>
          <div className="space-y-4">
            {groupedEvents.map(ge => (
              <div key={ge.event_id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleEvent(ge.event_id)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-card-hover transition-colors text-left"
                >
                  <div>
                    <h3 className="font-semibold text-lg">{ge.title}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted mt-1">
                      <span>{new Date(ge.start_date).toLocaleDateString('pl-PL')} - {new Date(ge.end_date).toLocaleDateString('pl-PL')}</span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {ge.disciplines.reduce((sum, d) => sum + d.participants.length, 0)} uczestnikow
                      </span>
                    </div>
                  </div>
                  {expandedEvents[ge.event_id] ? (
                    <ChevronUp className="w-5 h-5 text-muted" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted" />
                  )}
                </button>

                {expandedEvents[ge.event_id] && (
                  <div className="border-t border-border">
                    {ge.disciplines.map(disc => (
                      <div key={disc.name} className="px-6 py-4">
                        <h4 className="text-sm font-semibold text-primary mb-3">{disc.name}</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="text-xs text-muted border-b border-border/50">
                                <th className="text-left py-2 pr-4 w-12">#</th>
                                <th className="text-left py-2 pr-4">Zawodnik</th>
                                <th className="text-left py-2 pr-4">Klub</th>
                                <th className="text-left py-2 pr-4">Klasa</th>
                                <th className="text-right py-2">Wynik</th>
                              </tr>
                            </thead>
                            <tbody>
                              {disc.participants.map((p, idx) => (
                                <tr key={p.member?.id ?? idx} className="border-b border-border/30 last:border-0">
                                  <td className="py-2 pr-4">
                                    {idx < 3 ? medals[idx] : <span className="text-muted text-sm">{idx + 1}</span>}
                                  </td>
                                  <td className="py-2 pr-4">
                                    <Link href={`/zawodnicy/${p.member?.id}`} className="text-sm font-medium hover:text-primary transition-colors">
                                      {p.member?.full_name ?? 'Nieznany'}
                                    </Link>
                                  </td>
                                  <td className="py-2 pr-4 text-sm text-muted">
                                    {p.member?.club_name ?? '-'}
                                  </td>
                                  <td className="py-2 pr-4">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${classColors[p.member?.class ?? ''] ?? ''}`}>
                                      {p.member?.class}
                                    </span>
                                  </td>
                                  <td className="py-2 text-right font-mono font-bold">{p.score}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
