import { supabase } from '@/lib/supabase'
import { Trophy } from 'lucide-react'
import RankingsClient from '@/components/RankingsClient'

export const dynamic = 'force-dynamic'

export default async function RankingsPage() {
  const [rankingsRes, resultsRes, membersRes, disciplinesRes, eventResultsRes] = await Promise.all([
    supabase
      .from('rankings')
      .select('*, member:members(id, full_name, class, license_number, club_name), discipline:disciplines(name)')
      .order('rank_position'),
    supabase
      .from('results')
      .select('member_id, total_score, discipline:disciplines(name), member:members!results_member_id_fkey(id, full_name, class, license_number, club_name)')
      .order('total_score', { ascending: false }),
    supabase
      .from('members')
      .select('id, full_name, class, license_number, club_name')
      .order('full_name'),
    supabase
      .from('disciplines')
      .select('name, category')
      .eq('category', 'discipline')
      .order('name'),
    supabase
      .from('results')
      .select('id, total_score, member:members!results_member_id_fkey(id, full_name, class, license_number, club_name), event:events(id, title, start_date, end_date), discipline:disciplines(name)')
      .order('total_score', { ascending: false }),
  ])

  const rankings = rankingsRes.data ?? []
  const results = resultsRes.data ?? []
  const members = membersRes.data ?? []
  const disciplines = (disciplinesRes.data ?? []).map((d: { name: string }) => d.name)
  const eventResults = (eventResultsRes.data ?? []) as any[]

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Trophy className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">Rankingi</h1>
      </div>

      <RankingsClient
        rankings={rankings as any}
        results={results as any}
        members={members as any}
        disciplines={disciplines}
        eventResults={eventResults as any}
      />
    </div>
  )
}
