import { supabase } from '@/lib/supabase'
import { Trophy } from 'lucide-react'
import Link from 'next/link'

export const revalidate = 60

const medals = ['🥇', '🥈', '🥉']
const classColors: Record<string, string> = {
  'Mistrz': 'bg-primary/20 text-primary',
  'I': 'bg-blue-500/20 text-blue-400',
  'II': 'bg-green-500/20 text-green-400',
  'III': 'bg-muted/20 text-muted',
}

export default async function RankingsPage() {
  const { data: results } = await supabase
    .from('results')
    .select('member_id, total_score, discipline:disciplines(name), member:members(id, full_name, class, license_number)')
    .order('total_score', { ascending: false })

  const { data: members } = await supabase
    .from('members')
    .select('*')
    .order('full_name')

  // Build rankings from results or show members if no results yet
  const hasResults = results && results.length > 0

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Trophy className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">Rankingi</h1>
      </div>

      {hasResults ? (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-sm text-muted">
                <th className="text-left px-6 py-4 w-16">#</th>
                <th className="text-left px-6 py-4">Zawodnik</th>
                <th className="text-left px-6 py-4">Klasa</th>
                <th className="text-left px-6 py-4">Dyscyplina</th>
                <th className="text-right px-6 py-4">Wynik</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r: any, i: number) => (
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
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${classColors[r.member?.class] ?? ''}`}>
                      {r.member?.class}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted">{r.discipline?.name ?? '-'}</td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-lg">{r.total_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div>
          <p className="text-muted mb-8">Brak wyników. Ranking zostanie uzupełniony po pierwszych zawodach.</p>
          <h2 className="text-xl font-semibold mb-4">Członkowie klubu</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-sm text-muted">
                  <th className="text-left px-6 py-4">#</th>
                  <th className="text-left px-6 py-4">Zawodnik</th>
                  <th className="text-left px-6 py-4">Klasa</th>
                  <th className="text-left px-6 py-4">Licencja</th>
                </tr>
              </thead>
              <tbody>
                {members?.map((m, i) => (
                  <tr key={m.id} className="border-b border-border/50 hover:bg-card-hover transition-colors">
                    <td className="px-6 py-4 text-muted">{i + 1}</td>
                    <td className="px-6 py-4">
                      <Link href={`/zawodnicy/${m.id}`} className="font-medium hover:text-primary transition-colors">
                        {m.full_name}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${classColors[m.class] ?? ''}`}>
                        {m.class}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted">{m.license_number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
