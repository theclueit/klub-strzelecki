'use client'

import type { RegDiscipline } from '@/types/admin'
import type { Discipline, EventDiscipline } from '@/types/database'

interface UseEventFinancialsParams {
  eventDisciplines: (EventDiscipline & { discipline?: Discipline })[]
  regDisciplines: RegDiscipline[]
  getEventDiscs: (eventId: string) => (EventDiscipline & { discipline?: Discipline })[]
}

export function useEventFinancials({
  eventDisciplines,
  regDisciplines,
  getEventDiscs,
}: UseEventFinancialsParams) {

  function getEventRevenue(eventId: string) {
    const evDiscs = getEventDiscs(eventId)
    let grandTotal = 0
    const lines = evDiscs.map(ed => {
      const rds = regDisciplines.filter(rd => rd.event_discipline_id === ed.id)
      const ownWeapon = rds.filter(r => r.own_weapon)
      const clubWeapon = rds.filter(r => !r.own_weapon)
      const d = ed.discipline as any
      const ownPrice = d?.own_weapon_price_pln ?? ed.price_pln ?? 0
      const clubPrice = d?.default_price_pln ?? ed.price_pln ?? 0
      const ownRev = ownWeapon.reduce((s, r) => s + (Number(r.price_pln) || Number(ownPrice)), 0)
      const clubRev = clubWeapon.reduce((s, r) => s + (Number(r.price_pln) || Number(clubPrice)), 0)
      const total = ownRev + clubRev
      grandTotal += total
      return { name: d?.name ?? '?', ownCount: ownWeapon.length, clubCount: clubWeapon.length, ownRev, clubRev, total }
    }).filter(l => l.ownCount + l.clubCount > 0)
    return { lines, grandTotal }
  }

  return {
    getEventRevenue,
  }
}
