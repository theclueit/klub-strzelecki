'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import type { EventRow, EventJudge, RegDiscipline } from '@/types/admin'
import type { Discipline, Member, EventDiscipline } from '@/types/database'

interface UseJudgeManagementParams {
  judges: Member[]
  eventJudges: EventJudge[]
  events: EventRow[]
  allMembers: Member[]
  eventDisciplines: (EventDiscipline & { discipline?: Discipline })[]
  regDisciplines: RegDiscipline[]
  disciplines: Discipline[]
  loadAll: () => Promise<void>
  getEventDiscs: (eventId: string) => (EventDiscipline & { discipline?: Discipline })[]
  getEventJudges: (eventId: string) => Member[]
}

export function useJudgeManagement({ judges, eventJudges, events, allMembers, eventDisciplines, regDisciplines, disciplines, loadAll, getEventDiscs, getEventJudges }: UseJudgeManagementParams) {
  const supabase = createSupabaseBrowser()

  const [permSearchQuery, setPermSearchQuery] = useState('')

  async function notifyJudge(eventJudgeId: string) {
    try {
      await fetch('/api/judge-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_judge_id: eventJudgeId }),
      })
    } catch {
      // Notification is best-effort; don't block the UI
    }
  }

  async function assignJudge(eventId: string, judgeId: string) {
    const { data } = await supabase.from('event_judges').insert({ event_id: eventId, judge_id: judgeId }).select('id').single()
    // If event is published, send email notification immediately
    const ev = events.find(e => e.id === eventId)
    if (data && ev?.is_published) {
      notifyJudge(data.id)
    }
    loadAll()
  }

  async function removeJudge(eventId: string, judgeId: string) {
    await supabase.from('event_judges').delete().eq('event_id', eventId).eq('judge_id', judgeId)
    loadAll()
  }

  async function promoteToJudge(memberId: string) {
    const m = allMembers.find(x => x.id === memberId)
    if (!m?.judge_license_number) {
      alert(`${m?.full_name || 'Ten członek'} nie posiada licencji sędziowskiej. Licencję można dodać w profilu użytkownika.`)
      return
    }
    await supabase.from('members').update({ role: 'judge' }).eq('id', memberId)
    loadAll()
  }

  async function changeRole(memberId: string, newRole: string) {
    const m = allMembers.find(x => x.id === memberId)
    if (newRole === 'judge' && !m?.judge_license_number) {
      alert(`${m?.full_name || 'Ten członek'} nie posiada licencji sędziowskiej.\nLicencję sędziowską można dodać w profilu użytkownika.`)
      return
    }
    // Nie pozwól zdegradować admina/superadmina
    if (['admin', 'superadmin'].includes(m!.role) && !['admin', 'superadmin'].includes(newRole)) {
      alert(`Nie można zmienić roli ${m?.full_name} — administrator/superadmin jest chroniony. Zmianę może wykonać tylko bezpośrednio w bazie danych.`)
      return
    }
    if (!confirm(`Zmienić rolę ${m?.full_name || ''} na "${newRole}"?`)) return
    await supabase.from('members').update({ role: newRole }).eq('id', m!.id)
    loadAll()
  }

  function filterByPermSearch(members: Member[]): Member[] {
    if (!permSearchQuery.trim()) return members
    const q = permSearchQuery.toLowerCase().trim()
    return members.filter(m =>
      m.full_name.toLowerCase().includes(q) ||
      (m.email && m.email.toLowerCase().includes(q)) ||
      (m.license_number && m.license_number.toLowerCase().includes(q)) ||
      (m.judge_license_number && m.judge_license_number.toLowerCase().includes(q))
    )
  }

  function getStaffingByDisciplines(eventId: string) {
    const evDiscs = getEventDiscs(eventId)
    if (evDiscs.length === 0) return null
    let totalRequired = 0
    let totalStations = 0
    for (const ed of evDiscs) {
      const disc = ed.discipline ?? disciplines.find(d => d.id === ed.discipline_id)
      const stations = disc?.stations_count ?? 1
      const judgesPerStation = disc?.judges_per_station ?? 1
      totalStations += stations
      totalRequired += stations * judgesPerStation
    }
    if (totalRequired === 0) return null
    const assigned = getEventJudges(eventId).length
    const missing = Math.max(0, totalRequired - assigned)
    return { recommended: totalRequired, assigned, missing, totalStations }
  }

  function getStaffingByRegistrations(eventId: string) {
    const ev = events.find(e => e.id === eventId)
    if (!ev) return null
    const evDiscs = getEventDiscs(eventId)
    if (evDiscs.length === 0) return null

    const startDate = new Date(ev.start_date)
    const endDate = ev.end_date ? new Date(ev.end_date) : new Date(startDate.getTime() + 8 * 60 * 60 * 1000)
    const durationHours = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60))

    let totalStationsNeeded = 0
    let totalJudgesNeeded = 0
    for (const ed of evDiscs) {
      const disc = ed.discipline ?? disciplines.find(d => d.id === ed.discipline_id)
      const participantsPerHour = disc?.participants_per_hour ?? 10
      const judgesPerStation = disc?.judges_per_station ?? 1
      const registeredCount = regDisciplines.filter(rd => rd.event_discipline_id === ed.id).length
      // How many participant-hours needed
      const hoursNeeded = registeredCount / participantsPerHour
      // How many stations needed to fit in event duration
      const stationsNeeded = Math.ceil(hoursNeeded / durationHours)
      totalStationsNeeded += stationsNeeded
      totalJudgesNeeded += stationsNeeded * judgesPerStation
    }
    const assigned = getEventJudges(eventId).length
    const missing = Math.max(0, totalJudgesNeeded - assigned)
    return { recommended: totalJudgesNeeded, assigned, missing, totalStations: totalStationsNeeded }
  }

  return {
    permSearchQuery,
    setPermSearchQuery,
    notifyJudge,
    assignJudge,
    removeJudge,
    promoteToJudge,
    changeRole,
    filterByPermSearch,
    getStaffingByDisciplines,
    getStaffingByRegistrations,
  }
}
