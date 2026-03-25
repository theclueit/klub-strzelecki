import { supabase } from '@/lib/supabase'
import { User, Trophy, Target, ArrowLeft, Shield, Crosshair, Award } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { notFound } from 'next/navigation'

export const revalidate = 60

const classColors: Record<string, string> = {
  'Mistrz': 'bg-primary/20 text-primary',
  'I': 'bg-blue-500/20 text-blue-400',
  'II': 'bg-green-500/20 text-green-400',
  'III': 'bg-muted/20 text-muted',
}

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: member } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .single()

  if (!member) notFound()

  const { data: results } = await supabase
    .from('results')
    .select('*, discipline:disciplines(name), event:events(title)')
    .eq('member_id', id)
    .order('shot_at', { ascending: false })

  const totalShots = results?.length ?? 0
  const bestScore = results?.reduce((max, r) => Math.max(max, r.total_score), 0) ?? 0
  const avgScore = totalShots > 0
    ? Math.round((results?.reduce((sum, r) => sum + r.total_score, 0) ?? 0) / totalShots)
    : 0

  // Group results by discipline for license summary
  const discStats: Record<string, { name: string; count: number; best: number; avg: number }> = {}
  results?.forEach((r: any) => {
    const dName = r.discipline?.name ?? 'Inne'
    if (!discStats[dName]) discStats[dName] = { name: dName, count: 0, best: 0, avg: 0 }
    discStats[dName].count++
    discStats[dName].best = Math.max(discStats[dName].best, r.total_score)
    discStats[dName].avg += r.total_score
  })
  Object.values(discStats).forEach(d => { d.avg = d.count > 0 ? Math.round(d.avg / d.count) : 0 })

  const badges: { label: string; color: string }[] = []
  if (member.role === 'judge' || member.role === 'admin') {
    badges.push({ label: member.judge_class ? `Sędzia ${member.judge_class}` : 'Sędzia', color: 'bg-primary/20 text-primary' })
  }
  if (member.is_range_officer) badges.push({ label: 'Prowadzący strzelanie', color: 'bg-blue-500/20 text-blue-400' })
  if (member.has_weapons_permit) badges.push({ label: 'Pozwolenie na broń', color: 'bg-success/20 text-success' })
  if (member.is_sports_instructor) badges.push({ label: 'Instruktor strzelectwa', color: 'bg-yellow-500/20 text-yellow-400' })

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link href="/zawodnicy" className="inline-flex items-center gap-2 text-muted hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Wszyscy zawodnicy
      </Link>

      {/* Profile header */}
      <div className="bg-card border border-border rounded-xl p-8 mb-8">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-3xl">
            {member.full_name.charAt(0)}
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-1">{member.full_name}</h1>
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-sm px-3 py-1 rounded-full font-medium ${classColors[member.class]}`}>
                Klasa {member.class}
              </span>
              <span className="text-sm text-muted">{member.license_number}</span>
              <span className="text-sm text-muted">{member.club_name}</span>
            </div>
            {badges.length > 0 && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {badges.map(b => (
                  <span key={b.label} className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.color}`}>
                    {b.label}
                  </span>
                ))}
              </div>
            )}
            <p className="text-sm text-muted mt-2">
              Członek od {format(new Date(member.joined_at), 'd MMMM yyyy', { locale: pl })}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-card border border-border rounded-xl p-5 text-center">
          <Target className="w-6 h-6 text-primary mx-auto mb-2" />
          <div className="text-2xl font-bold">{totalShots}</div>
          <div className="text-xs text-muted">Strzelań</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 text-center">
          <Trophy className="w-6 h-6 text-primary mx-auto mb-2" />
          <div className="text-2xl font-bold">{bestScore}</div>
          <div className="text-xs text-muted">Najlepszy wynik</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 text-center">
          <User className="w-6 h-6 text-primary mx-auto mb-2" />
          <div className="text-2xl font-bold">{avgScore}</div>
          <div className="text-xs text-muted">Średnia</div>
        </div>
      </div>

      {/* License renewal summary */}
      {Object.keys(discStats).length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            Podsumowanie do licencji
          </h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-sm text-muted">
                  <th className="text-left px-6 py-3">Dyscyplina</th>
                  <th className="text-right px-6 py-3">Starty</th>
                  <th className="text-right px-6 py-3">Najlepszy</th>
                  <th className="text-right px-6 py-3">Średnia</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(discStats).map(d => (
                  <tr key={d.name} className="border-b border-border/50 hover:bg-card-hover">
                    <td className="px-6 py-3 font-medium text-sm">{d.name}</td>
                    <td className="px-6 py-3 text-right text-sm">{d.count}</td>
                    <td className="px-6 py-3 text-right font-mono font-bold">{d.best}</td>
                    <td className="px-6 py-3 text-right font-mono text-muted">{d.avg}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted mt-2 px-1">
            Łączna liczba startów: {totalShots} | Sezon: {new Date().getFullYear()}
          </p>
        </div>
      )}

      {/* Results history */}
      <h2 className="text-xl font-semibold mb-4">Historia strzelań</h2>
      {!results?.length ? (
        <p className="text-muted">Brak zapisanych wyników.</p>
      ) : (
        <div className="space-y-3">
          {results.map((r: any) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-5 flex items-center justify-between">
              <div>
                <div className="font-medium">{r.event?.title ?? 'Strzelanie treningowe'}</div>
                <div className="text-sm text-muted">
                  {r.discipline?.name} &middot; {format(new Date(r.shot_at), 'd MMM yyyy, HH:mm', { locale: pl })}
                </div>
                {r.judge_comment && (
                  <p className="text-sm text-muted mt-1 italic">&ldquo;{r.judge_comment}&rdquo;</p>
                )}
              </div>
              <div className="text-right">
                <div className="text-2xl font-mono font-bold">{r.total_score}</div>
                {r.max_score && (
                  <div className="text-xs text-muted">/ {r.max_score}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
