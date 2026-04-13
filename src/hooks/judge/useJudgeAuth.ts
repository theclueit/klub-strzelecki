import { useState, useEffect, useCallback } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import type { Member } from '@/types/database'
import type { Step, AssignedEvent, EventDisciplineRow } from './types'

export function useJudgeAuth() {
  const supabase = createSupabaseBrowser()
  const { member: authMember, loading: authLoading } = useAuth()
  const [step, setStep] = useState<Step>('login')
  const [judge, setJudge] = useState<Member | null>(null)
  const [autoLoginDone, setAutoLoginDone] = useState(false)

  const [assignedEvents, setAssignedEvents] = useState<AssignedEvent[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [allowTargetPhotos, setAllowTargetPhotos] = useState(true)

  const [members, setMembers] = useState<Member[]>([])
  const [eventDisciplines, setEventDisciplines] = useState<EventDisciplineRow[]>([])
  const [scoredDisciplines, setScoredDisciplines] = useState<Map<string, Set<string>>>(new Map())
  const [startNumbers, setStartNumbers] = useState<Map<string, number>>(new Map())

  const loadAssignedEvents = useCallback(async (judgeData: Member) => {
    const { data: ejData } = await supabase
      .from('event_judges')
      .select('id, event_id, status, event:events(id, title, start_date, end_date, is_published, allow_target_photos)')
      .eq('judge_id', judgeData.id)

    const now = new Date()
    const relevant = ((ejData ?? []) as any[]).filter(ej => {
      const ev = ej.event
      if (!ev) return false
      if (ej.status !== 'pending' && ej.status !== 'confirmed') return false
      if (!ev.is_published) return false
      const endDate = ev.end_date || ev.start_date
      return new Date(endDate) >= new Date(now.toDateString())
    })

    const enriched: AssignedEvent[] = await Promise.all(
      relevant.map(async (ej: any) => {
        const ev = ej.event as any
        const [regsRes, resultsRes, edRes] = await Promise.all([
          supabase.from('event_registrations').select('member_id', { count: 'exact', head: true }).eq('event_id', ev.id).neq('status', 'cancelled'),
          supabase.from('results').select('member_id, discipline_id').eq('event_id', ev.id),
          supabase.from('event_disciplines').select('discipline_id').eq('event_id', ev.id),
        ])
        const memberCount = regsRes.count ?? 0
        const discCount = (edRes.data ?? []).length
        const scored = new Map<string, Set<string>>()
        for (const r of (resultsRes.data ?? []) as { member_id: string; discipline_id: string | null }[]) {
          if (!r.discipline_id) continue
          if (!scored.has(r.member_id)) scored.set(r.member_id, new Set())
          scored.get(r.member_id)!.add(r.discipline_id)
        }
        let fullyScored = 0
        if (discCount > 0) {
          scored.forEach(discs => { if (discs.size >= discCount) fullyScored++ })
        }
        return { ...ej, memberCount, scoredCount: fullyScored }
      })
    )

    setAssignedEvents(enriched)
    setStep('select-event')
  }, [supabase])

  useEffect(() => {
    if (authLoading || step !== 'login') return
    if (authMember && (authMember.role === 'judge' || authMember.role === 'admin' || authMember.role === 'superadmin')) {
      setJudge(authMember)
      setAutoLoginDone(true)
      loadAssignedEvents(authMember)
    } else if (!authLoading && !autoLoginDone) {
      setAutoLoginDone(true)
    }
  }, [authMember, authLoading, autoLoginDone, step, loadAssignedEvents])

  async function selectEvent(eventId: string) {
    setSelectedEventId(eventId)
    const selectedEv = assignedEvents.find(e => (e.event as any).id === eventId)
    setAllowTargetPhotos((selectedEv?.event as any)?.allow_target_photos ?? true)

    const [regsRes, edRes, resultsRes] = await Promise.all([
      supabase
        .from('event_registrations')
        .select('member:members(*), start_number')
        .eq('event_id', eventId)
        .neq('status', 'cancelled'),
      supabase.from('event_disciplines').select('id, discipline_id, discipline:disciplines(id, name, scoring_type)').eq('event_id', eventId),
      supabase.from('results').select('member_id, discipline_id').eq('event_id', eventId),
    ])

    const regs = (regsRes.data ?? []) as any[]
    const registeredMembers = regs
      .map(r => r.member)
      .filter(Boolean)
      .sort((a: Member, b: Member) => a.full_name.localeCompare(b.full_name))
    setMembers(registeredMembers as Member[])

    const snMap = new Map<string, number>()
    for (const r of regs) {
      if (r.member?.id && r.start_number) {
        snMap.set(r.member.id, r.start_number)
      }
    }
    setStartNumbers(snMap)

    const eds = (edRes.data ?? []) as unknown as EventDisciplineRow[]
    setEventDisciplines(eds)

    const scored = new Map<string, Set<string>>()
    for (const r of (resultsRes.data ?? []) as { member_id: string; discipline_id: string | null }[]) {
      if (!r.discipline_id) continue
      if (!scored.has(r.member_id)) scored.set(r.member_id, new Set())
      scored.get(r.member_id)!.add(r.discipline_id)
    }
    setScoredDisciplines(scored)
    setStep('select-member')
  }

  function getAvailableDisciplines(memberId: string): EventDisciplineRow[] {
    const scored = scoredDisciplines.get(memberId)
    if (!scored) return eventDisciplines
    return eventDisciplines.filter(ed => !scored.has(ed.discipline_id))
  }

  function canShowPhoto(ed: EventDisciplineRow | null): boolean {
    return allowTargetPhotos && ed?.discipline?.scoring_type !== 'shotgun'
  }

  const selectedEventTitle = assignedEvents.find(e => (e.event as any).id === selectedEventId)?.event?.title

  return {
    supabase,
    authMember,
    authLoading,
    step,
    setStep,
    judge,
    autoLoginDone,
    assignedEvents,
    selectedEventId,
    allowTargetPhotos,
    members,
    eventDisciplines,
    scoredDisciplines,
    setScoredDisciplines,
    startNumbers,
    selectEvent,
    getAvailableDisciplines,
    canShowPhoto,
    selectedEventTitle,
  }
}
