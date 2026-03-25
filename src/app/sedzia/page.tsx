'use client'

import { useState, useRef, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { Crosshair, Camera, Upload, Check, LogIn, LogOut, Search, User } from 'lucide-react'
import type { Member, Discipline } from '@/types/database'

type Step = 'login' | 'select-event' | 'scan' | 'photo' | 'review' | 'done'

interface AssignedEvent {
  id: string
  event_id: string
  event: { id: string; title: string; start_date: string; end_date: string | null }
}

interface EventDisciplineRow {
  id: string
  discipline_id: string
  discipline: { id: string; name: string } | null
}

export default function JudgePage() {
  const supabase = createSupabaseBrowser()
  const [step, setStep] = useState<Step>('login')
  const [judge, setJudge] = useState<Member | null>(null)
  const [pin, setPin] = useState('')
  const [loginError, setLoginError] = useState('')

  // Assigned events
  const [assignedEvents, setAssignedEvents] = useState<AssignedEvent[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')

  // Members & disciplines
  const [members, setMembers] = useState<Member[]>([])
  const [eventDisciplines, setEventDisciplines] = useState<EventDisciplineRow[]>([])
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>('')
  const [memberSearch, setMemberSearch] = useState('')

  // Photo
  const [photo, setPhoto] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Result
  const [totalScore, setTotalScore] = useState('')
  const [maxScore, setMaxScore] = useState('100')
  const [tensCount, setTensCount] = useState('')
  const [misses, setMisses] = useState('0')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')

    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('license_number', pin)
      .in('role', ['judge', 'admin'])
      .single()

    if (error || !data) {
      setLoginError('Nieprawidłowy PIN lub brak uprawnień sędziego.')
      return
    }

    setJudge(data as Member)

    // Load assigned events for this judge (only current/future, confirmed or pending)
    const now = new Date().toISOString()
    const { data: ejData } = await supabase
      .from('event_judges')
      .select('id, event_id, event:events!event_id(id, title, start_date, end_date)')
      .eq('judge_id', data.id)
      .in('status', ['pending', 'confirmed'])

    // Filter to events that haven't ended
    const relevant = ((ejData ?? []) as any[]).filter(ej => {
      const ev = ej.event
      if (!ev) return false
      const endDate = ev.end_date || ev.start_date
      return new Date(endDate) >= new Date(new Date().toDateString())
    })

    setAssignedEvents(relevant)
    setStep('select-event')
  }

  async function selectEvent(eventId: string) {
    setSelectedEventId(eventId)

    // Load members and event disciplines
    const [membersRes, edRes] = await Promise.all([
      supabase.from('members').select('*').eq('is_active', true).order('full_name'),
      supabase.from('event_disciplines').select('id, discipline_id, discipline:disciplines(id, name)').eq('event_id', eventId),
    ])
    setMembers((membersRes.data ?? []) as Member[])
    const eds = (edRes.data ?? []) as unknown as EventDisciplineRow[]
    setEventDisciplines(eds)
    if (eds.length > 0 && eds[0].discipline) {
      setSelectedDiscipline(eds[0].discipline.id)
    }
    setStep('scan')
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setPhoto(ev.target?.result as string)
      setStep('review')
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMember || !totalScore) return
    setSubmitting(true)

    let targetImageUrl: string | null = null
    if (photo) {
      const fileName = `targets/${selectedMember.id}/${Date.now()}.jpg`
      const base64 = photo.split(',')[1]
      const byteCharacters = atob(base64)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: 'image/jpeg' })

      const { data: uploadData } = await supabase.storage
        .from('targets')
        .upload(fileName, blob)

      if (uploadData) {
        const { data: urlData } = supabase.storage.from('targets').getPublicUrl(fileName)
        targetImageUrl = urlData.publicUrl
      }
    }

    const { error } = await supabase.from('results').insert({
      member_id: selectedMember.id,
      judge_id: judge!.id,
      event_id: selectedEventId || null,
      discipline_id: selectedDiscipline || null,
      total_score: parseInt(totalScore),
      max_score: parseInt(maxScore) || null,
      tens_count: parseInt(tensCount) || 0,
      misses: parseInt(misses) || 0,
      judge_comment: comment || null,
      target_image_url: targetImageUrl,
    })

    setSubmitting(false)
    if (error) {
      alert('Błąd zapisu: ' + error.message)
      return
    }
    setStep('done')
  }

  function reset() {
    setSelectedMember(null)
    setMemberSearch('')
    setPhoto(null)
    setTotalScore('')
    setMaxScore('100')
    setTensCount('')
    setMisses('0')
    setComment('')
    setStep('scan')
  }

  const filteredMembers = members.filter(m =>
    m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.license_number?.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.qr_code?.toLowerCase().includes(memberSearch.toLowerCase())
  )

  const inputClass = "w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-primary"

  // LOGIN
  if (step === 'login') {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-card border border-border rounded-xl p-8">
          <div className="text-center mb-6">
            <Crosshair className="w-12 h-12 text-primary mx-auto mb-3" />
            <h1 className="text-2xl font-bold">Panel sędziego</h1>
            <p className="text-sm text-muted mt-1">Zaloguj się numerem licencji</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="text"
              value={pin}
              onChange={e => setPin(e.target.value)}
              placeholder="Numer licencji (np. PL-2024-001)"
              className={inputClass}
            />
            {loginError && <p className="text-sm text-danger">{loginError}</p>}
            <button
              type="submit"
              className="w-full bg-primary text-background font-semibold py-3 rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Zaloguj
            </button>
          </form>
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
          <button onClick={() => { setJudge(null); setStep('login') }} className="text-muted hover:text-foreground transition-colors">
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
              return (
                <button
                  key={ej.id}
                  onClick={() => selectEvent(ev.id)}
                  className="w-full bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {isToday && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-success/20 text-success font-medium">Dziś</span>
                    )}
                    <div>
                      <div className="font-semibold">{ev.title}</div>
                      <div className="text-sm text-muted">
                        {new Date(ev.start_date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
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
  if (step === 'scan') {
    const selectedEventTitle = assignedEvents.find(e => (e.event as any).id === selectedEventId)?.event?.title
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
            <button onClick={() => { setJudge(null); setStep('login') }} className="text-muted hover:text-foreground transition-colors">
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

        <div className="space-y-2">
          {filteredMembers.map(m => (
            <button
              key={m.id}
              onClick={() => { setSelectedMember(m); setStep('photo') }}
              className="w-full bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors text-left flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                {m.full_name.charAt(0)}
              </div>
              <div>
                <div className="font-medium">{m.full_name}</div>
                <div className="text-xs text-muted">{m.license_number} &middot; {m.club_name}</div>
              </div>
            </button>
          ))}
        </div>
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
          <p className="text-sm text-muted mb-8">{selectedMember?.license_number}</p>

          <h3 className="text-lg font-semibold mb-4">Zdjęcie tarczy (opcjonalne)</h3>

          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" />

          <div className="space-y-3">
            <button onClick={() => fileRef.current?.click()} className="w-full bg-primary text-background font-semibold py-3 rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2">
              <Camera className="w-5 h-5" />
              Zrób zdjęcie tarczy
            </button>
            <button onClick={() => setStep('review')} className="w-full border border-border text-foreground font-semibold py-3 rounded-lg hover:bg-card-hover transition-colors">
              Pomiń — wpisz wynik ręcznie
            </button>
            <button onClick={() => { setSelectedMember(null); setStep('scan') }} className="text-sm text-muted hover:text-foreground transition-colors">
              Zmień zawodnika
            </button>
          </div>
        </div>
      </div>
    )
  }

  // REVIEW & SUBMIT
  if (step === 'review') {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-card border border-border rounded-xl p-8">
          <h2 className="text-xl font-bold mb-1">{selectedMember?.full_name}</h2>
          <p className="text-sm text-muted mb-6">{selectedMember?.license_number}</p>

          {photo && (
            <div className="mb-6">
              <img src={photo} alt="Tarcza" className="w-full rounded-lg border border-border" />
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-muted block mb-1">Dyscyplina</label>
              <select
                value={selectedDiscipline}
                onChange={e => setSelectedDiscipline(e.target.value)}
                className={inputClass}
              >
                {eventDisciplines.map(ed => (
                  <option key={ed.id} value={ed.discipline?.id ?? ed.discipline_id}>{ed.discipline?.name ?? 'Dyscyplina'}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted block mb-1">Wynik *</label>
                <input type="number" value={totalScore} onChange={e => setTotalScore(e.target.value)} placeholder="np. 95" required className={inputClass} />
              </div>
              <div>
                <label className="text-sm text-muted block mb-1">Max punktów</label>
                <input type="number" value={maxScore} onChange={e => setMaxScore(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-muted block mb-1">Dziesiątki</label>
                <input type="number" value={tensCount} onChange={e => setTensCount(e.target.value)} placeholder="0" className={inputClass} />
              </div>
              <div>
                <label className="text-sm text-muted block mb-1">Pudła</label>
                <input type="number" value={misses} onChange={e => setMisses(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div>
              <label className="text-sm text-muted block mb-1">Komentarz sędziego</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3} placeholder="Uwagi do strzelania..." className={inputClass + ' resize-none'} />
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
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // DONE
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="bg-card border border-border rounded-xl p-8">
        <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
          <Check className="w-8 h-8 text-success" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Wynik zapisany!</h2>
        <p className="text-muted mb-2">
          {selectedMember?.full_name} — <span className="font-mono font-bold text-foreground">{totalScore}</span> pkt
        </p>
        <p className="text-sm text-muted mb-6">Wynik jest widoczny w profilu zawodnika i w rankingach.</p>
        <button onClick={reset} className="w-full bg-primary text-background font-semibold py-3 rounded-lg hover:bg-primary-dark transition-colors">
          Kolejny zawodnik
        </button>
      </div>
    </div>
  )
}
