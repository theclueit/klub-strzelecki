import { supabase } from '@/lib/supabase'
import ResultsClient from './ResultsClient'

export const dynamic = 'force-dynamic'

export default async function ResultsPage() {
  const { data: results } = await supabase
    .from('results')
    .select('id, total_score, max_score, tens_count, misses, time_seconds, shot_at, member:members!results_member_id_fkey(id, full_name, class, license_number, club_name), event:events(id, title, start_date, event_type), discipline:disciplines(name, scoring_type)')
    .order('shot_at', { ascending: false })

  return <ResultsClient results={(results ?? []) as any[]} />
}
