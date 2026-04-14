'use client'

import { useState, useMemo } from 'react'
import { Trophy, Search, X, Printer, Camera, Download } from 'lucide-react'
import Link from 'next/link'

interface ResultRow {
  id: string
  total_score: number
  max_score: number | null
  tens_count: number | null
  misses: number | null
  time_seconds: number | null
  shot_at: string
  target_image_url?: string | null
  member?: { id: string; full_name: string; class: string; license_number: string | null; club_name: string | null }
  event?: { id: string; title: string; start_date: string; event_type: string }
  discipline?: { name: string; scoring_type: string | null }
}

export default function ResultsClient({ results }: { results: ResultRow[] }) {
  const [search, setSearch] = useState('')
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

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

  function buildResultsHtml(eventId: string) {
    const group = sorted.find(g => g.event.id === eventId)
    if (!group) return null

    const ev = group.event
    const eventDate = new Date(ev.start_date).toLocaleDateString('pl-PL', {
      day: 'numeric', month: 'long', year: 'numeric',
    })

    // Group by discipline
    const byDiscipline: Record<string, ResultRow[]> = {}
    for (const r of group.results) {
      const dName = r.discipline?.name ?? 'Inne'
      if (!byDiscipline[dName]) byDiscipline[dName] = []
      byDiscipline[dName].push(r)
    }

    let html = `<!DOCTYPE html><html><head><title>Wyniki - ${ev.title}</title><style>
      @page { size: A4 landscape; margin: 12mm 15mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; }
      .header { text-align: center; margin-bottom: 8mm; padding-bottom: 4mm; border-bottom: 2px solid #000; }
      .club-name { font-size: 18px; font-weight: bold; }
      .event-title { font-size: 22px; font-weight: 900; margin: 3mm 0; }
      .event-meta { font-size: 12px; color: #444; }
      .discipline-section { margin-top: 6mm; page-break-inside: avoid; }
      .discipline-name { font-size: 14px; font-weight: bold; background: #f0f0f0; padding: 2mm 3mm; margin-bottom: 2mm; border-left: 3px solid #333; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 4mm; }
      th { background: #333; color: #fff; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
      th, td { border: 1px solid #ccc; padding: 2mm 3mm; text-align: left; }
      td { font-size: 11px; }
      .pos { width: 8mm; text-align: center; font-weight: bold; }
      .pos-1 { background: #ffd700; }
      .pos-2 { background: #e0e0e0; }
      .pos-3 { background: #deb887; }
      .score { text-align: right; font-weight: bold; font-size: 13px; font-family: monospace; }
      .num-right { text-align: right; }
      .club { font-size: 10px; color: #555; }
      .license { font-size: 9px; color: #888; }
      .class-badge { font-size: 9px; padding: 1px 4px; border-radius: 3px; font-weight: bold; }
      .class-M { background: #e3f2fd; color: #1565c0; }
      .class-I { background: #e8f5e9; color: #2e7d32; }
      .class-II { background: #fff3e0; color: #ef6c00; }
      .class-III { background: #f5f5f5; color: #666; }
      .footer { margin-top: 8mm; font-size: 10px; color: #666; text-align: center; border-top: 1px solid #ccc; padding-top: 3mm; }
      .sig-area { margin-top: 15mm; display: flex; justify-content: space-between; }
      .sig-line { border-top: 1px solid #000; width: 60mm; padding-top: 2mm; font-size: 10px; text-align: center; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body>`

    // Header
    html += `<div class="header">
      <div class="club-name">Klub Strzelecki CEL</div>
      <div class="event-title">${ev.title}</div>
      <div class="event-meta">${eventDate} · ${typeLabels[ev.event_type] ?? 'Inne'}</div>
      <div class="event-meta">${group.results.length} zawodników · ${Object.keys(byDiscipline).length} dyscyplin</div>
    </div>`

    // Per discipline
    for (const [discName, discResults] of Object.entries(byDiscipline)) {
      const isShotgun = discResults[0]?.discipline?.scoring_type === 'shotgun'
      const fullKey = `${ev.id}:${discName}`
      const fullRanking = fullByEventDiscipline[fullKey] ?? []

      html += `<div class="discipline-section">
        <div class="discipline-name">${discName}</div>
        <table>
          <thead><tr>
            <th class="pos">#</th>
            <th>Zawodnik</th>
            <th>Klub</th>
            <th>Klasa</th>`

      if (isShotgun) {
        html += `<th class="num-right">Czas</th><th class="num-right">Pudła</th><th class="num-right">Wynik</th>`
      } else {
        html += `<th class="num-right">Wynik</th><th class="num-right">10-tki</th><th class="num-right">Pudła</th>`
      }
      html += `</tr></thead><tbody>`

      for (const r of discResults) {
        const pos = fullRanking.findIndex(fr => fr.id === r.id)
        const posClass = pos === 0 ? 'pos-1' : pos === 1 ? 'pos-2' : pos === 2 ? 'pos-3' : ''
        const memberClass = r.member?.class ?? ''
        const classMap: Record<string, string> = { 'Mistrz': 'M', 'I': 'I', 'II': 'II', 'III': 'III' }

        html += `<tr>
          <td class="pos ${posClass}">${pos + 1}</td>
          <td><strong>${r.member?.full_name ?? '?'}</strong><br/><span class="license">${r.member?.license_number ?? ''}</span></td>
          <td class="club">${r.member?.club_name ?? '-'}</td>
          <td><span class="class-badge class-${classMap[memberClass] ?? ''}">${memberClass}</span></td>`

        if (isShotgun) {
          const time = r.time_seconds ? Number(r.time_seconds).toFixed(2) + 's' : '-'
          const misses = r.misses ?? 0
          html += `<td class="num-right">${time}</td>
            <td class="num-right">${misses > 0 ? misses + ' (+' + misses * 5 + 's)' : '0'}</td>
            <td class="score">${Number(r.total_score).toFixed(2)}s</td>`
        } else {
          html += `<td class="score">${r.total_score}${r.max_score ? '/' + r.max_score : ''}</td>
            <td class="num-right">${r.tens_count ?? '-'}</td>
            <td class="num-right">${r.misses ?? '-'}</td>`
        }
        html += `</tr>`
      }
      html += `</tbody></table></div>`
    }

    // Signatures
    html += `<div class="sig-area">
      <div class="sig-line">Sędzia główny</div>
      <div class="sig-line">Kierownik strzelnicy</div>
    </div>`

    // Footer
    html += `<div class="footer">
      Wygenerowano: ${new Date().toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
      · Klub Strzelecki CEL
    </div>`

    html += `</body></html>`
    return { html, title: ev.title }
  }

  function printEventResults(eventId: string) {
    const result = buildResultsHtml(eventId)
    if (!result) return
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(result.html)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => printWindow.print(), 300)
    }
  }

  async function downloadEventPdf(eventId: string) {
    const result = buildResultsHtml(eventId)
    if (!result) return
    const html2pdf = (await import('html2pdf.js')).default
    const container = document.createElement('div')
    container.innerHTML = result.html
    // Extract just the body content and styles
    const styleContent = container.querySelector('style')?.textContent || ''
    const bodyContent = container.querySelector('body')?.innerHTML || result.html
    const wrapper = document.createElement('div')
    const style = document.createElement('style')
    style.textContent = styleContent
    wrapper.appendChild(style)
    wrapper.innerHTML += bodyContent
    document.body.appendChild(wrapper)
    await html2pdf().set({
      margin: [10, 12],
      filename: `Wyniki - ${result.title}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    }).from(wrapper).save()
    document.body.removeChild(wrapper)
  }

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
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">{ev.title}</h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => printEventResults(ev.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-card-hover hover:border-primary hover:text-primary transition-colors"
                        title="Drukuj wyniki"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Drukuj
                      </button>
                      <button
                        onClick={() => downloadEventPdf(ev.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-card-hover hover:border-primary hover:text-primary transition-colors"
                        title="Pobierz PDF"
                      >
                        <Download className="w-3.5 h-3.5" />
                        PDF
                      </button>
                    </div>
                  </div>
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
                            <th className="text-center px-3 py-2 w-16">Tarcza</th>
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
                                <td className="px-3 py-2.5 text-center">
                                  {r.target_image_url ? (
                                    <button onClick={() => setLightboxUrl(r.target_image_url!)} className="inline-block hover:opacity-80 transition-opacity" title="Podgląd tarczy">
                                      <img src={r.target_image_url} alt="Tarcza" className="w-10 h-10 object-cover rounded border border-border" />
                                    </button>
                                  ) : (
                                    <span className="text-muted/30"><Camera className="w-4 h-4 mx-auto" /></span>
                                  )}
                                </td>
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
      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <div className="relative max-w-2xl max-h-[90vh]">
            <button onClick={() => setLightboxUrl(null)} className="absolute -top-10 right-0 text-white hover:text-primary transition-colors">
              <X className="w-8 h-8" />
            </button>
            <img src={lightboxUrl} alt="Tarcza — powiększenie" className="max-w-full max-h-[85vh] rounded-lg object-contain" />
          </div>
        </div>
      )}
    </div>
  )
}
