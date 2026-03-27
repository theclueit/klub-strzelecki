import { supabase } from '@/lib/supabase'
import ReservationsClient from './ReservationsClient'

export default async function ReservationsPage() {
  const { data: lanes } = await supabase
    .from('shooting_lanes')
    .select('*')
    .eq('is_active', true)
    .order('length_m', { ascending: true })

  return <ReservationsClient lanes={(lanes ?? []) as any[]} />
}
