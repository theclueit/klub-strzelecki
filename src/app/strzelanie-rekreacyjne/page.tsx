import { supabase } from '@/lib/supabase'
import RecreationalClient from './RecreationalClient'

export default async function RecreationalPage() {
  const { data: allPackages } = await supabase
    .from('shooting_packages')
    .select('*, weapon:range_weapons(*)')
    .eq('is_active', true)
    .order('price_pln')

  // Filtruj — pokaż tylko pakiety z bronią na stanie
  const packages = (allPackages ?? []).filter((p: any) => p.weapon?.status === 'in_stock')

  const { data: lanes } = await supabase
    .from('shooting_lanes')
    .select('*')
    .eq('is_active', true)
    .order('length_m')

  return <RecreationalClient packages={(packages ?? []) as any[]} lanes={(lanes ?? []) as any[]} />
}
