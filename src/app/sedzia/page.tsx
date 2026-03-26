'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { Crosshair, Camera, Upload, Check, LogOut, Search, User, Target, AlertTriangle, List, Hash } from 'lucide-react'
import Link from 'next/link'
import type { Member } from '@/types/database'

type Step = 'login' | 'select-event' | 'select-member' | 'select-discipline' | 'photo' | 'review' | 'done'

interface AssignedEvent {
  id: string
  event_id: string
  event: { id: string; title: string; start_date: string; end_date: string | null }
  memberCount?: number
  scoredCount?: number
}

interface EventDisciplineRow {
  id: string
  discipline_id: string
  discipline: { id: string; name: string; scoring_type?: string } | null
}

export default function JudgePage() {
  const supabase = createSupabaseBrowser()
  const { member: authMember, loading: authLoading } = useAuth()
  const [step, setStep] = useState<Step>('login')
  const [judge, setJudge] = useState<Member | null>(null)
  const [autoLoginDone, setAutoLoginDone] = useState(false)

  // Assigned events
  const [assignedEvents, setAssignedEvents] = useState<AssignedEvent[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')

  // Restore judge session from sessionStorage on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('judge_session')
      if (saved) {
        const { judgeData, eventId } = JSON.parse(saved)
        if (judgeData) {
          setJudge(judgeData as Member)
          setAutoLoginDone(true)
          if (eventId) {
            setSelectedEventId(eventId)
            selectEvent(eventId, judgeData as Member)
          } else {
            loadAssignedEvents(judgeData as Member)
          }
        }
      }
    } catch {}
  }, [])

  // Members & disciplines
  const [members, setMembers] = useState<Member[]>([])
  const [eventDisciplines, setEventDisciplines] = useState<EventDisciplineRow[]>([])
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [selectedDiscipline, setSelectedDiscipline] = useState<EventDisciplineRow | null>(null)
  const [memberSearch, setMemberSearch] = useState('')

  // Already scored disciplines per member
  const [scoredDisciplines, setScoredDisciplines] = useState<Map<string, Set<string>>>(new Map())

  // Photo
  const [photo, setPhoto] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Result form
  const [entryMode, setEntryMode] = useState<'quick' | 'shots'>('quick')
  const [shotsCount, setShotsCount] = useState('10')
  const [shots, setShots] = useState<string[]>([])
  const [activeShotIdx, setActiveShotIdx] = useState<number | null>(null)
  const [totalScore, setTotalScore] = useState('')
  const [maxScore, setMaxScore] = useState('')
  const [tensCount, setTensCount] = useState('')
  const [xsCount, setXsCount] = useState('')
  const [misses, setMisses] = useState('0')
  const [comment, setComment] = useState('')
  const [timeSeconds, setTimeSeconds] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Load assigned events for a judge
  const loadAssignedEvents = useCallback(async (judgeData: Member) => {
    const { data: ejData } = await supabase
      .from('event_judges')
      .select('id, event_id, status, event:events(id, title, start_date, end_date, is_published)')
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

    // Fetch member counts & scored counts for each event
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
        // Count members who have ALL disciplines scored
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

  // Auto-login — run every time authMember becomes available while on login screen
  useEffect(() => {
    if (authLoading || step !== 'login') return
    if (authMember && (authMember.role === 'judge' || authMember.role === 'admin')) {
      setJudge(authMember)
      setAutoLoginDone(true)
      try { sessionStorage.setItem('judge_session', JSON.stringify({ judgeData: authMember })) } catch {}
      loadAssignedEvents(authMember)
    } else if (!authLoading && !autoLoginDone) {
      setAutoLoginDone(true)
    }
  }, [authMember, authLoading, autoLoginDone, step, loadAssignedEvents])

  async function selectEvent(eventId: string, judgeOverride?: Member) {
    setSelectedEventId(eventId)
    const j = judgeOverride ?? judge
    if (j) {
      try { sessionStorage.setItem('judge_session', JSON.stringify({ judgeData: j, eventId })) } catch {}
    }
    const [regsRes, edRes, resultsRes] = await Promise.all([
      supabase
        .from('event_registrations')
        .select('member:members(*)')
        .eq('event_id', eventId)
        .neq('status', 'cancelled'),
      supabase.from('event_disciplines').select('id, discipline_id, discipline:disciplines(id, name, scoring_type)').eq('event_id', eventId),
      supabase.from('results').select('member_id, discipline_id').eq('event_id', eventId),
    ])

    const registeredMembers = ((regsRes.data ?? []) as any[])
      .map(r => r.member)
      .filter(Boolean)
      .sort((a: Member, b: Member) => a.full_name.localeCompare(b.full_name))
    setMembers(registeredMembers as Member[])

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
    return eventDisciplines.filter(ed => {
      return !scored.has(ed.discipline_id)
    })
  }

  function hasTarget(ed: EventDisciplineRow | null): boolean {
    return ed?.discipline?.scoring_type !== 'shotgun'
  }

  function selectMember(m: Member) {
    setSelectedMember(m)
    const available = getAvailableDisciplines(m.id)
    if (available.length === 1) {
      setSelectedDiscipline(available[0])
      setStep(hasTarget(available[0]) ? 'photo' : 'review')
    } else if (available.length === 0) {
      setSelectedDiscipline(null)
      setStep('photo')
    } else {
      setStep('select-discipline')
    }
  }

  function selectDisc(ed: EventDisciplineRow) {
    setSelectedDiscipline(ed)
    setStep(hasTarget(ed) ? 'photo' : 'review')
  }

  function compressImage(dataUrl: string, maxWidth: number, quality: number): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.width, h = img.height
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth }
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = dataUrl
    })
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const raw = ev.target?.result as string
      // Compress: max 1200px wide, 60% quality → ~100-300KB instead of 5-12MB
      const compressed = await compressImage(raw, 1200, 0.6)
      setPhoto(compressed)
      setStep('review')
    }
    reader.readAsDataURL(file)
  }

  // ---- Shots mode helpers ----
  function initShots(count: number) {
    setShots(Array(count).fill(''))
  }

  function updateShot(index: number, value: string) {
    // Allow empty, 0-10, or decimal 0.0-10.9
    const num = parseFloat(value)
    if (value !== '' && (isNaN(num) || num < 0 || num > 10.9)) return
    setShots(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  // Calculate stats from individual shots
  function calcFromShots(): { total: number; tens: number; xs: number; missCount: number; filledCount: number } {
    let total = 0, tens = 0, missCount = 0, filledCount = 0
    for (const s of shots) {
      if (s === '') continue
      const val = parseFloat(s)
      filledCount++
      total += val
      if (val >= 10) tens++
      if (val === 0) missCount++
    }
    return { total: Math.round(total * 10) / 10, tens, xs: 0, missCount, filledCount }
  }

  // ---- Validation ----
  function getValidationErrors(): string[] {
    const errors: string[] = []
    const total = parseFloat(totalScore)
    const max = parseFloat(maxScore)
    const tens = parseInt(tensCount) || 0
    const xs = parseInt(xsCount) || 0

    if (totalScore && maxScore && total > max) {
      errors.push(`Wynik (${total}) przekracza max (${max})`)
    }
    if (xsCount && tensCount && xs > tens) {
      errors.push(`X-ki (${xs}) nie mogą przekraczać dziesiątek (${tens})`)
    }
    if (totalScore && tensCount && tens * 10 > total) {
      errors.push(`${tens} dziesiątek = min. ${tens * 10} pkt, ale wynik to ${total}`)
    }
    if (totalScore && maxScore && max > 0) {
      const maxTens = Math.floor(max / 10)
      if (tens > maxTens) {
        errors.push(`Dziesiątki (${tens}) przekraczają max możliwych (${maxTens})`)
      }
    }
    return errors
  }

  // Apply shots calculation to form fields
  function applyShotsCalc() {
    const calc = calcFromShots()
    if (calc.filledCount > 0) {
      setTotalScore(String(calc.total))
      setTensCount(String(calc.tens))
      setMisses(String(calc.missCount))
      const sc = parseInt(shotsCount) || shots.length
      setMaxScore(String(sc * 10))
    }
  }

  // Upload photo in background and update result row
  async function uploadPhotoInBackground(resultMemberId: string, photoData: string) {
    try {
      const fileName = `targets/${resultMemberId}/${Date.now()}.jpg`
      const base64 = photoData.split(',')[1]
      const byteCharacters = atob(base64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/jpeg' })
      const { data: uploadData } = await supabase.storage.from('targets').upload(fileName, blob)
      if (uploadData) {
        const url = supabase.storage.from('targets').getPublicUrl(fileName).data.publicUrl
        // Update the most recent result for this member
        await supabase.from('results')
          .update({ target_image_url: url })
          .eq('member_id', resultMemberId)
          .order('created_at', { ascending: false })
          .limit(1)
      }
    } catch (err) {
      console.error('Photo upload failed:', err)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Ensure shots calc is applied before submit
    if (entryMode === 'shots') applyShotsCalc()
    if (!selectedMember || !totalScore) return

    const errors = getValidationErrors()
    if (errors.length > 0) {
      if (!window.confirm(`Uwaga — znaleziono problemy:\n\n${errors.join('\n')}\n\nCzy mimo to zapisać wynik?`)) {
        return
      }
    }

    setSubmitting(true)

    const disciplineId = selectedDiscipline?.discipline_id ?? selectedDiscipline?.discipline?.id ?? null

    // Build shots array from individual entries
    const shotsArray = entryMode === 'shots' && shots.some(s => s !== '')
      ? shots.map(s => s === '' ? 0 : parseFloat(s))
      : null

    // Save via server API (avoids Safari cross-origin fetch issues)
    const payload = {
      member_id: selectedMember.id,
      judge_id: judge!.id,
      event_id: selectedEventId || null,
      discipline_id: disciplineId,
      total_score: totalScore,
      max_score: maxScore || null,
      tens_count: tensCount || '0',
      xs_count: xsCount || '0',
      misses: misses || '0',
      shots: shotsArray,
      judge_comment: comment || null,
      time_seconds: timeSeconds || null,
    }

    let lastErr = ''
    let lastCode = ''
    let ok = false
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch('/api/results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (res.ok) { ok = true; break }
        lastErr = json.error || 'Nieznany błąd'
        lastCode = json.code || ''
        if (lastCode === '23505') break
      } catch (e: any) {
        lastErr = e.message || 'Błąd sieci'
      }
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
    }

    setSubmitting(false)
    if (!ok) {
      if (lastCode === '23505') {
        alert('Wynik dla tej dyscypliny został już zapisany dla tego zawodnika.')
      } else {
        alert('Błąd zapisu: ' + lastErr)
      }
      return
    }

    if (disciplineId) {
      setScoredDisciplines(prev => {
        const next = new Map(prev)
        const memberId = selectedMember.id
        if (!next.has(memberId)) next.set(memberId, new Set())
        next.get(memberId)!.add(disciplineId)
        return next
      })
    }

    // Upload photo in background — don't block the UI
    if (photo && selectedMember) {
      uploadPhotoInBackground(selectedMember.id, photo)
    }

    setStep('done')
  }

  function resetForm() {
    setPhoto(null)
    setEntryMode('quick')
    setShotsCount('10')
    setShots([])
    setActiveShotIdx(null)
    setTotalScore('')
    setMaxScore('')
    setTensCount('')
    setXsCount('')
    setMisses('0')
    setTimeSeconds('')
    setComment('')
  }

  function reset() {
    setSelectedMember(null)
    setSelectedDiscipline(null)
    setMemberSearch('')
    resetForm()
    setStep('select-member')
  }

  const filteredMembers = members.filter(m =>
    m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.license_number?.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.qr_code?.toLowerCase().includes(memberSearch.toLowerCase())
  )

  const inputClass = "w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
  const inputSmClass = "w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-primary"

  const selectedEventTitle = assignedEvents.find(e => (e.event as any).id === selectedEventId)?.event?.title

  const validationErrors = getValidationErrors()

  // LOGIN
  if (step === 'login') {
    if (authLoading || !autoLoginDone) {
      return <div className="p-16 text-center text-muted">Ładowanie...</div>
    }
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Crosshair className="w-12 h-12 text-primary mx-auto mb-3" />
          <h1 className="text-2xl font-bold mb-2">Panel sędziego</h1>
          <p className="text-muted mb-6">Zaloguj się na swoje konto, aby uzyskać dostęp do panelu sędziego.</p>
          <Link
            href="/logowanie"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors"
          >
            Zaloguj się
          </Link>
          <p className="text-xs text-muted mt-4">Dostęp mają tylko członkowie z rolą sędziego lub administratora.</p>
        </div>
      </div>
    )
  }

  // SELECT EVENT
  if (step === 'select-event') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Wybierz zawody</h1>
            <p className="text-sm text-muted">Zalogowany: {judge?.full_name}</p>
          </div>
          <button onClick={() => { setJudge(null); setStep('login'); try { sessionStorage.removeItem('judge_session') } catch {} }} className="text-muted hover:text-foreground transition-colors" title="Wyloguj z panelu sędziego">
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {assignedEvents.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-muted mb-2">Nie masz przypisanych aktualnych zawodów.</p>
            <p className="text-sm text-muted">Skontaktuj się z administratorem, aby zostać przypisanym do wydarzenia.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignedEvents.map(ej => {
              const ev = ej.event as any
              const isToday = new Date(ev.start_date).toDateString() === new Date().toDateString()
              const mc = ej.memberCount ?? 0
              const sc = ej.scoredCount ?? 0
              const allDone = mc > 0 && sc >= mc
              return (
                <button
                  key={ej.id}
                  onClick={() => selectEvent(ev.id)}
                  className={`w-full bg-card border rounded-xl p-5 transition-colors text-left ${allDone ? 'border-success/30 opacity-60' : 'border-border hover:border-primary/30'}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isToday && <span className="text-xs px-2 py-0.5 rounded-full bg-success/20 text-success font-medium">Dziś</span>}
                      <div>
                        <div className="font-semibold">{ev.title}</div>
                        <div className="text-sm text-muted">
                          {new Date(ev.start_date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      {mc === 0 ? (
                        <span className="text-xs text-muted">Brak zawodników</span>
                      ) : allDone ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-success/20 text-success font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          {sc}/{mc}
                        </span>
                      ) : (
                        <div>
                          <div className="text-sm font-semibold">{sc}/{mc}</div>
                          <div className="text-xs text-muted">ocenionych</div>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // SELECT MEMBER
  if (step === 'select-member') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Wybierz zawodnika</h1>
            <p className="text-sm text-muted">{judge?.full_name} &middot; {selectedEventTitle}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep('select-event')} className="text-sm text-muted hover:text-foreground transition-colors px-3 py-1 border border-border rounded-lg">
              Zmień zawody
            </button>
            <button onClick={() => { setJudge(null); setStep('login'); try { sessionStorage.removeItem('judge_session') } catch {} }} className="text-muted hover:text-foreground transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="relative mb-4">
          <Search className="w-5 h-5 text-muted absolute left-3 top-3" />
          <input
            type="text"
            value={memberSearch}
            onChange={e => setMemberSearch(e.target.value)}
            placeholder="Szukaj po nazwisku, licencji lub kodzie QR..."
            className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
          />
        </div>

        {members.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <User className="w-10 h-10 text-muted mx-auto mb-3" />
            <p className="text-muted font-medium mb-1">Brak zawodników do oceny</p>
            <p className="text-sm text-muted">Nie ma zarejestrowanych zawodników na te zawody.</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <p className="text-muted">Brak wyników dla &ldquo;{memberSearch}&rdquo;</p>
          </div>
        ) : null}

        <div className="space-y-2">
          {filteredMembers.map(m => {
            const available = getAvailableDisciplines(m.id)
            const allDone = eventDisciplines.length > 0 && available.length === 0
            return (
              <button
                key={m.id}
                onClick={() => !allDone && selectMember(m)}
                disabled={allDone}
                className={`w-full bg-card border rounded-xl p-4 transition-colors text-left flex items-center gap-4 ${
                  allDone ? 'border-success/30 opacity-60 cursor-default' : 'border-border hover:border-primary/30'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                  {m.full_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{m.full_name}</div>
                  <div className="text-xs text-muted">{m.license_number} &middot; {m.club_name}</div>
                </div>
                {allDone ? (
                  <span className="text-xs px-2 py-1 rounded-full bg-success/20 text-success font-medium flex-shrink-0 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Wszystkie
                  </span>
                ) : eventDisciplines.length > 0 && available.length < eventDisciplines.length ? (
                  <span className="text-xs text-muted flex-shrink-0">
                    {eventDisciplines.length - available.length}/{eventDisciplines.length}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // SELECT DISCIPLINE
  if (step === 'select-discipline') {
    const available = selectedMember ? getAvailableDisciplines(selectedMember.id) : []
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Wybierz dyscyplinę</h1>
            <p className="text-sm text-muted">{selectedMember?.full_name} &middot; {selectedEventTitle}</p>
          </div>
          <button
            onClick={() => { setSelectedMember(null); setStep('select-member') }}
            className="text-sm text-muted hover:text-foreground transition-colors px-3 py-1 border border-border rounded-lg"
          >
            Zmień zawodnika
          </button>
        </div>

        <div className="space-y-2">
          {available.map(ed => (
            <button
              key={ed.id}
              onClick={() => selectDisc(ed)}
              className="w-full bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors text-left flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Target className="w-5 h-5 text-primary" />
              </div>
              <div className="font-medium">{ed.discipline?.name ?? 'Dyscyplina'}</div>
            </button>
          ))}
        </div>

        {eventDisciplines.length > available.length && (
          <div className="mt-6">
            <p className="text-xs text-muted mb-2">Wyniki zapisane:</p>
            <div className="flex flex-wrap gap-2">
              {eventDisciplines
                .filter(ed => !available.includes(ed))
                .map(ed => (
                  <span key={ed.id} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-success/10 text-success">
                    <Check className="w-3 h-3" />
                    {ed.discipline?.name}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  // PHOTO
  if (step === 'photo') {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <User className="w-10 h-10 text-primary mx-auto mb-2" />
          <h2 className="text-xl font-bold mb-1">{selectedMember?.full_name}</h2>
          <p className="text-sm text-muted mb-1">{selectedMember?.license_number}</p>
          <p className="text-sm text-primary font-medium mb-8">{selectedDiscipline?.discipline?.name}</p>

          <h3 className="text-lg font-semibold mb-4">Zdjęcie tarczy (opcjonalne)</h3>

          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />

          <div className="space-y-3">
            <button onClick={() => fileRef.current?.click()} className="w-full bg-primary text-background font-semibold py-3 rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2">
              <Camera className="w-5 h-5" />
              Zrób zdjęcie tarczy
            </button>
            <button onClick={() => {
              setEntryMode('shots')
              if (shots.length === 0) initShots(parseInt(shotsCount) || 10)
              setActiveShotIdx(0)
              setStep('review')
            }} className="w-full border border-border text-foreground font-semibold py-3 rounded-lg hover:bg-card-hover transition-colors">
              Pomiń — wpisz wynik ręcznie
            </button>
            <button onClick={() => {
              if (selectedMember && getAvailableDisciplines(selectedMember.id).length > 1) {
                setStep('select-discipline')
              } else {
                setSelectedMember(null)
                setStep('select-member')
              }
            }} className="text-sm text-muted hover:text-foreground transition-colors">
              Wróć
            </button>
          </div>
        </div>
      </div>
    )
  }

  // REVIEW & SUBMIT
  if (step === 'review') {
    const shotsCalc = entryMode === 'shots' ? calcFromShots() : null
    const isShotgun = selectedDiscipline?.discipline?.scoring_type === 'shotgun'

    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold">{selectedMember?.full_name}</h2>
              <p className="text-sm text-muted">{selectedMember?.license_number}</p>
              <p className="text-sm text-primary font-medium">{selectedDiscipline?.discipline?.name}</p>
            </div>
          </div>

          {photo && (
            <div className="mb-4">
              <img src={photo} alt="Tarcza" className="w-full rounded-lg border border-border" />
            </div>
          )}

          {/* === SHOTGUN MODE === */}
          {isShotgun ? (
            <form className="space-y-4">
              {/* Time input - main field */}
              <div>
                <label className="text-sm text-muted mb-1 block">Czas surowy (sekundy)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={timeSeconds}
                  onChange={e => setTimeSeconds(e.target.value)}
                  placeholder="np. 4.32"
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-2xl text-center font-mono focus:outline-none focus:border-primary"
                />
              </div>

              {/* Misses */}
              <div>
                <label className="text-sm text-muted mb-2 block">Pudła (za każde +5 sekund)</label>
                <div className="flex gap-2 justify-center">
                  {[0, 1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMisses(String(n))}
                      className={`w-12 h-12 rounded-xl border-2 text-lg font-bold transition-all ${
                        parseInt(misses) === n
                          ? n === 0 ? 'bg-green-500/25 border-green-500 text-green-400' : 'bg-danger/25 border-danger text-danger'
                          : 'bg-background border-border text-muted'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calculated result */}
              {timeSeconds && (
                <div className="p-4 rounded-lg bg-background border border-border text-center">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted mb-1">Czas</div>
                      <div className="font-mono font-bold">{parseFloat(timeSeconds).toFixed(2)}s</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted mb-1">Kara</div>
                      <div className="font-mono font-bold text-danger">+{(parseInt(misses) || 0) * 5}s</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted mb-1">Wynik</div>
                      <div className="font-mono font-bold text-lg text-primary">
                        {(parseFloat(timeSeconds) + (parseInt(misses) || 0) * 5).toFixed(2)}s
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Comment */}
              <div>
                <label className="text-sm text-muted mb-1 block">Komentarz sędziego</label>
                <textarea rows={2} value={comment} onChange={e => setComment(e.target.value)} placeholder="Uwagi..." className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary resize-none" />
              </div>

              <button
                type="button"
                disabled={submitting || !timeSeconds}
                onClick={async () => {
                  if (submitting || !selectedMember || !timeSeconds) return
                  const rawTime = parseFloat(timeSeconds)
                  const missCount = parseInt(misses) || 0
                  const finalTime = rawTime + missCount * 5
                  setSubmitting(true)

                  const disciplineId = selectedDiscipline?.discipline_id ?? selectedDiscipline?.discipline?.id ?? null
                  const shotgunPayload = {
                    member_id: selectedMember.id,
                    judge_id: judge!.id,
                    event_id: selectedEventId || null,
                    discipline_id: disciplineId,
                    total_score: finalTime,
                    max_score: 5,
                    tens_count: 0, xs_count: 0,
                    misses: missCount,
                    shots: null,
                    judge_comment: comment || null,
                    time_seconds: rawTime,
                  }
                  let sgOk = false
                  let sgErr = '', sgCode = ''
                  for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                      const res = await fetch('/api/results', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(shotgunPayload),
                      })
                      const json = await res.json()
                      if (res.ok) { sgOk = true; break }
                      sgErr = json.error || 'Nieznany błąd'
                      sgCode = json.code || ''
                      if (sgCode === '23505') break
                    } catch (e: any) {
                      sgErr = e.message || 'Błąd sieci'
                    }
                    await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
                  }
                  setSubmitting(false)
                  if (!sgOk) { alert(sgCode === '23505' ? 'Wynik już zapisany dla tej dyscypliny.' : 'Błąd zapisu: ' + sgErr); return }
                  if (disciplineId) {
                    setScoredDisciplines(prev => {
                      const next = new Map(prev)
                      if (!next.has(selectedMember.id)) next.set(selectedMember.id, new Set())
                      next.get(selectedMember.id)!.add(disciplineId)
                      return next
                    })
                  }
                  // Upload photo in background
                  if (photo && selectedMember) {
                    uploadPhotoInBackground(selectedMember.id, photo)
                  }
                  setStep('done')
                }}
                className="w-full bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl py-3 font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {submitting ? 'Zapisywanie...' : `Zapisz wynik (${timeSeconds ? (parseFloat(timeSeconds) + (parseInt(misses) || 0) * 5).toFixed(2) : '0'}s)`}
              </button>
            </form>
          ) : (
          <>
          {/* Entry mode toggle */}
          <div className="flex bg-background rounded-lg border border-border p-1 mb-5">
            <button
              type="button"
              onClick={() => setEntryMode('quick')}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-md transition-colors ${
                entryMode === 'quick' ? 'bg-primary/10 text-primary font-medium' : 'text-muted hover:text-foreground'
              }`}
            >
              <Hash className="w-3.5 h-3.5" />
              Szybki wpis
            </button>
            <button
              type="button"
              onClick={() => {
                setEntryMode('shots')
                if (shots.length === 0) initShots(parseInt(shotsCount) || 10)
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-md transition-colors ${
                entryMode === 'shots' ? 'bg-primary/10 text-primary font-medium' : 'text-muted hover:text-foreground'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Strzały
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* ---- SHOTS MODE ---- */}
            {entryMode === 'shots' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm text-muted">Liczba strzałów</label>
                  <div className="flex items-center gap-2">
                    {[10, 20, 30, 40, 60].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setShotsCount(String(n))
                          initShots(n)
                        }}
                        className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                          parseInt(shotsCount) === n
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted hover:text-foreground'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Shots grid - grouped in series of 10 */}
                <p className="text-xs text-muted mb-2">Kliknij strzał i wybierz punkty (0-10):</p>
                <div className="space-y-3">
                  {Array.from({ length: Math.ceil(shots.length / 10) }, (_, seriesIdx) => {
                    const seriesShots = shots.slice(seriesIdx * 10, (seriesIdx + 1) * 10)
                    const seriesTotal = seriesShots.reduce((s, v) => s + (v === '' ? 0 : parseFloat(v)), 0)
                    const seriesTens = seriesShots.filter(v => v !== '' && parseFloat(v) >= 10).length
                    return (
                      <div key={seriesIdx}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted font-medium">Seria {seriesIdx + 1}</span>
                          <span className="text-xs text-muted">
                            {Math.round(seriesTotal * 10) / 10} pkt
                            {seriesTens > 0 && <span className="text-primary ml-1">({seriesTens}×10)</span>}
                          </span>
                        </div>
                        <div className="grid grid-cols-10 gap-1">
                          {seriesShots.map((val, shotIdx) => {
                            const globalIdx = seriesIdx * 10 + shotIdx
                            const numVal = val === '' ? null : parseFloat(val)
                            // Color by score value
                            let cellClass = 'bg-background border-border text-muted'
                            if (numVal !== null) {
                              if (numVal >= 10) cellClass = 'bg-primary/25 border-primary text-primary font-bold'
                              else if (numVal >= 9) cellClass = 'bg-primary/15 border-primary/70 text-primary font-bold'
                              else if (numVal >= 8) cellClass = 'bg-green-500/20 border-green-500/50 text-green-400 font-semibold'
                              else if (numVal >= 6) cellClass = 'bg-blue-500/20 border-blue-500/50 text-blue-400 font-semibold'
                              else if (numVal >= 1) cellClass = 'bg-orange-500/20 border-orange-500/50 text-orange-400 font-medium'
                              else cellClass = 'bg-danger/20 border-danger/50 text-danger font-medium'
                            }
                            return (
                              <button
                                key={globalIdx}
                                type="button"
                                onClick={() => setActiveShotIdx(activeShotIdx === globalIdx ? null : globalIdx)}
                                className={`w-full text-center text-sm py-1.5 rounded border transition-all ${cellClass} ${activeShotIdx === globalIdx ? 'ring-2 ring-primary scale-105' : ''}`}
                              >
                                <div className="text-[9px] text-muted/50 leading-none mb-0.5">{globalIdx + 1}</div>
                                <div className="leading-none">{numVal !== null ? numVal : '-'}</div>
                              </button>
                            )
                          })}
                        </div>
                        {/* Score picker for active shot in this series */}
                        {activeShotIdx !== null && activeShotIdx >= seriesIdx * 10 && activeShotIdx < (seriesIdx + 1) * 10 && (
                          <div className="mt-1.5 p-2 rounded-lg bg-card border border-primary/30">
                            <div className="text-xs text-muted mb-1.5 text-center">Strzał {activeShotIdx + 1} — wybierz punkty:</div>
                            <div className="flex gap-1 justify-center flex-wrap">
                              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => {
                                const isActive = shots[activeShotIdx] === String(score)
                                let btnColor = 'bg-background border-border text-muted hover:border-primary/50'
                                if (isActive) {
                                  if (score >= 10) btnColor = 'bg-primary/30 border-primary text-primary font-bold'
                                  else if (score >= 9) btnColor = 'bg-primary/20 border-primary/70 text-primary font-bold'
                                  else if (score >= 8) btnColor = 'bg-green-500/25 border-green-500 text-green-400 font-semibold'
                                  else if (score >= 6) btnColor = 'bg-blue-500/25 border-blue-500 text-blue-400 font-semibold'
                                  else if (score >= 1) btnColor = 'bg-orange-500/25 border-orange-500 text-orange-400 font-semibold'
                                  else btnColor = 'bg-danger/25 border-danger text-danger font-semibold'
                                }
                                return (
                                  <button
                                    key={score}
                                    type="button"
                                    onClick={() => {
                                      updateShot(activeShotIdx, String(score))
                                      // Auto-advance to next empty shot
                                      const nextEmpty = shots.findIndex((s, i) => i > activeShotIdx && s === '')
                                      setActiveShotIdx(nextEmpty >= 0 ? nextEmpty : null)
                                      applyShotsCalc()
                                    }}
                                    className={`w-9 h-9 rounded-lg border text-sm transition-all ${btnColor}`}
                                  >
                                    {score}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Auto-calculated summary from shots */}
                {shotsCalc && shotsCalc.filledCount > 0 && (
                  <div className="mt-3 p-3 rounded-lg bg-background border border-border">
                    <div className="grid grid-cols-3 gap-3 text-center text-sm">
                      <div>
                        <div className="text-xs text-muted mb-0.5">Suma</div>
                        <div className="font-bold text-lg">{shotsCalc.total}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted mb-0.5">10-tki</div>
                        <div className="font-bold text-lg text-primary">{shotsCalc.tens}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted mb-0.5">Pudła</div>
                        <div className="font-bold text-lg">{shotsCalc.missCount}</div>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
                      <label className="text-xs text-muted">X-ki (środek):</label>
                      <input type="number" min="0" value={xsCount} onChange={e => setXsCount(e.target.value)} placeholder="0" className="w-20 bg-background border border-border rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-primary" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ---- QUICK MODE ---- */}
            {entryMode === 'quick' && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-sm text-muted block mb-1">Wynik *</label>
                    <input type="number" step="any" min="0" value={totalScore} onChange={e => setTotalScore(e.target.value)} placeholder="np. 95" required className={inputClass} />
                  </div>
                  <div className="text-2xl text-muted pt-5">/</div>
                  <div className="w-20">
                    <label className="text-sm text-muted block mb-1">Max</label>
                    <input
                      type="number"
                      min="0"
                      value={maxScore}
                      onChange={e => setMaxScore(e.target.value)}
                      placeholder="100"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-muted block mb-1">Dziesiątki (10)</label>
                    <input type="number" min="0" value={tensCount} onChange={e => setTensCount(e.target.value)} placeholder="0" className={inputSmClass} />
                  </div>
                  <div>
                    <label className="text-sm text-muted block mb-1">X-ki (środek)</label>
                    <input type="number" min="0" value={xsCount} onChange={e => setXsCount(e.target.value)} placeholder="0" className={inputSmClass} />
                  </div>
                </div>
              </>
            )}

            {/* Validation warnings */}
            {validationErrors.length > 0 && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-warning space-y-0.5">
                    {validationErrors.map((err, i) => (
                      <p key={i}>{err}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm text-muted block mb-1">Komentarz sędziego</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2} placeholder="Uwagi..." className={inputClass + ' resize-none'} />
            </div>

            <button
              type="submit"
              disabled={submitting || !totalScore}
              className="w-full bg-primary text-background font-semibold py-3 rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting ? 'Zapisywanie...' : (
                <>
                  <Upload className="w-4 h-4" />
                  Zapisz wynik
                  {totalScore && <span className="opacity-70">({totalScore} pkt)</span>}
                </>
              )}
            </button>
          </form>
          </>
          )}
        </div>
      </div>
    )
  }

  // DONE
  const doneDiscName = selectedDiscipline?.discipline?.name
  const formattedScore = totalScore + (xsCount && parseInt(xsCount) > 0 ? `-${xsCount}x` : '')

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="bg-card border border-border rounded-xl p-8">
        <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-success" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Wynik zapisany!</h2>
        <p className="text-muted mb-1">
          {selectedMember?.full_name} — <span className="font-mono font-bold text-foreground">{formattedScore}</span> pkt
        </p>
        <p className="text-sm text-primary mb-1">{doneDiscName}</p>
        {parseInt(tensCount) > 0 && (
          <p className="text-xs text-muted">
            Dziesiątki: {tensCount}{xsCount && parseInt(xsCount) > 0 ? ` (w tym ${xsCount} X)` : ''}
          </p>
        )}
        <p className="text-sm text-muted mt-4 mb-6">Wynik jest widoczny w profilu zawodnika i w rankingach.</p>
        <div className="space-y-3">
          {selectedMember && getAvailableDisciplines(selectedMember.id).length > 0 && (
            <button
              onClick={() => {
                resetForm()
                const available = getAvailableDisciplines(selectedMember.id)
                if (available.length === 1) {
                  setSelectedDiscipline(available[0])
                  setStep('photo')
                } else {
                  setStep('select-discipline')
                }
              }}
              className="w-full bg-primary/10 text-primary font-semibold py-3 rounded-lg hover:bg-primary/20 transition-colors flex items-center justify-center gap-2"
            >
              <Target className="w-4 h-4" />
              Następna dyscyplina ({selectedMember?.full_name})
            </button>
          )}
          <button onClick={reset} className="w-full bg-primary text-background font-semibold py-3 rounded-lg hover:bg-primary-dark transition-colors">
            Kolejny zawodnik
          </button>
        </div>
      </div>
    </div>
  )
}
