'use client'

import { useState, useCallback } from 'react'
import { Crosshair, Camera, Upload, Check, LogOut, Search, User, Target, AlertTriangle, List, Hash } from 'lucide-react'
import Link from 'next/link'
import type { Member } from '@/types/database'
import { useJudgeAuth, useQrScanner, useTargetPhoto, useScoreForm } from '@/hooks/judge'
import type { EventDisciplineRow } from '@/hooks/judge'

export default function JudgePage() {
  const auth = useJudgeAuth()
  const scoreForm = useScoreForm()
  const targetPhoto = useTargetPhoto(auth.supabase)

  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [selectedDiscipline, setSelectedDiscipline] = useState<EventDisciplineRow | null>(null)

  function selectMember(m: Member) {
    setSelectedMember(m)
    const available = auth.getAvailableDisciplines(m.id)
    if (available.length === 1) {
      setSelectedDiscipline(available[0])
      auth.setStep(auth.canShowPhoto(available[0]) ? 'photo' : 'review')
    } else if (available.length === 0) {
      setSelectedDiscipline(null)
      auth.setStep('photo')
    } else {
      auth.setStep('select-discipline')
    }
  }

  function selectDisc(ed: EventDisciplineRow) {
    setSelectedDiscipline(ed)
    auth.setStep(auth.canShowPhoto(ed) ? 'photo' : 'review')
  }

  const selectMemberCb = useCallback((m: Member) => selectMember(m), [auth.eventDisciplines, auth.scoredDisciplines])

  const qr = useQrScanner(auth.members, auth.startNumbers, selectMemberCb)

  function handleScoreSuccess() {
    const disciplineId = selectedDiscipline?.discipline_id ?? selectedDiscipline?.discipline?.id ?? null
    if (disciplineId && selectedMember) {
      auth.setScoredDisciplines(prev => {
        const next = new Map(prev)
        if (!next.has(selectedMember.id)) next.set(selectedMember.id, new Set())
        next.get(selectedMember.id)!.add(disciplineId)
        return next
      })
    }
    if (targetPhoto.photo && selectedMember) {
      targetPhoto.uploadPhotoInBackground(selectedMember.id, targetPhoto.photo)
    }
    auth.setStep('done')
  }

  function reset() {
    setSelectedMember(null)
    setSelectedDiscipline(null)
    qr.setMemberSearch('')
    qr.setStartNumberInput('')
    qr.stopQrScanner()
    scoreForm.resetForm()
    targetPhoto.resetPhoto()
    auth.setStep('select-member')
  }

  function resetForm() {
    scoreForm.resetForm()
    targetPhoto.resetPhoto()
  }

  const inputClass = "w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
  const inputSmClass = "w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm placeholder:text-muted focus:outline-none focus:border-primary"

  const validationErrors = scoreForm.getValidationErrors()

  // LOGIN
  if (auth.step === 'login') {
    if (auth.authLoading || !auth.autoLoginDone || (auth.authMember && (auth.authMember.role === 'judge' || auth.authMember.role === 'admin' || auth.authMember.role === 'superadmin'))) {
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
  if (auth.step === 'select-event') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Wybierz zawody</h1>
            <p className="text-sm text-muted">Zalogowany: {auth.judge?.full_name}</p>
          </div>
          <Link href="/" className="text-muted hover:text-foreground transition-colors" title="Wróć na stronę główną">
            <LogOut className="w-5 h-5" />
          </Link>
        </div>

        {auth.assignedEvents.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-muted mb-2">Nie masz przypisanych aktualnych zawodów.</p>
            <p className="text-sm text-muted">Skontaktuj się z administratorem, aby zostać przypisanym do wydarzenia.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {auth.assignedEvents.map(ej => {
              const ev = ej.event as any
              const isToday = new Date(ev.start_date).toDateString() === new Date().toDateString()
              const mc = ej.memberCount ?? 0
              const sc = ej.scoredCount ?? 0
              const allDone = mc > 0 && sc >= mc
              return (
                <button
                  key={ej.id}
                  onClick={() => auth.selectEvent(ev.id)}
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
  if (auth.step === 'select-member') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Wybierz zawodnika</h1>
            <p className="text-sm text-muted">{auth.judge?.full_name} &middot; {auth.selectedEventTitle}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => auth.setStep('select-event')} className="text-sm text-muted hover:text-foreground transition-colors px-3 py-1 border border-border rounded-lg">
              Zmień zawody
            </button>
            <Link href="/" className="text-muted hover:text-foreground transition-colors" title="Wróć na stronę główną">
              <LogOut className="w-5 h-5" />
            </Link>
          </div>
        </div>

        {/* Quick entry: start number or QR scan */}
        <div className="bg-card border border-primary/30 rounded-xl p-4 mb-4">
          <div className="flex gap-2">
            <form onSubmit={qr.handleStartNumberSubmit} className="flex-1 flex gap-2">
              <div className="relative flex-1">
                <Hash className="w-4 h-4 text-muted absolute left-3 top-3" />
                <input
                  type="number"
                  inputMode="numeric"
                  value={qr.startNumberInput}
                  onChange={e => qr.setStartNumberInput(e.target.value)}
                  placeholder="Nr startowy"
                  className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:border-primary text-lg font-mono"
                />
              </div>
              <button type="submit" className="px-4 py-2.5 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors">
                OK
              </button>
            </form>
            <button
              onClick={qr.showQrScanner ? qr.stopQrScanner : qr.startQrScanner}
              className={`px-4 py-2.5 border rounded-lg transition-colors flex items-center gap-2 ${
                qr.showQrScanner ? 'border-danger text-danger' : 'border-border text-foreground hover:border-primary/30'
              }`}
            >
              <Camera className="w-5 h-5" />
              <span className="text-sm hidden sm:inline">{qr.showQrScanner ? 'Zamknij' : 'Skanuj QR'}</span>
            </button>
          </div>

          {qr.showQrScanner && (
            <div className="mt-3">
              <video ref={qr.qrVideoRef} className="w-full rounded-lg border border-border" style={{ maxHeight: 240 }} playsInline muted />
              <p className="text-xs text-muted mt-1 text-center">Skieruj kamerę na kod QR zawodnika</p>
            </div>
          )}
        </div>

        <div className="relative mb-4">
          <Search className="w-5 h-5 text-muted absolute left-3 top-3" />
          <input
            type="text"
            value={qr.memberSearch}
            onChange={e => qr.setMemberSearch(e.target.value)}
            placeholder="Szukaj po nazwisku, licencji, numerze startowym..."
            className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
          />
        </div>

        {auth.members.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <User className="w-10 h-10 text-muted mx-auto mb-3" />
            <p className="text-muted font-medium mb-1">Brak zawodników do oceny</p>
            <p className="text-sm text-muted">Nie ma zarejestrowanych zawodników na te zawody.</p>
          </div>
        ) : qr.filteredMembers.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center">
            <p className="text-muted">Brak wyników dla &ldquo;{qr.memberSearch}&rdquo;</p>
          </div>
        ) : null}

        <div className="space-y-2">
          {qr.filteredMembers.map(m => {
            const available = auth.getAvailableDisciplines(m.id)
            const allDone = auth.eventDisciplines.length > 0 && available.length === 0
            const sn = auth.startNumbers.get(m.id)
            return (
              <button
                key={m.id}
                onClick={() => !allDone && selectMember(m)}
                disabled={allDone}
                className={`w-full bg-card border rounded-xl p-4 transition-colors text-left flex items-center gap-4 ${
                  allDone ? 'border-success/30 opacity-60 cursor-default' : 'border-border hover:border-primary/30'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold font-mono flex-shrink-0 text-lg">
                  {sn ?? '–'}
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
                ) : auth.eventDisciplines.length > 0 && available.length < auth.eventDisciplines.length ? (
                  <span className="text-xs text-muted flex-shrink-0">
                    {auth.eventDisciplines.length - available.length}/{auth.eventDisciplines.length}
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
  if (auth.step === 'select-discipline') {
    const available = selectedMember ? auth.getAvailableDisciplines(selectedMember.id) : []
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Wybierz dyscyplinę</h1>
            <p className="text-sm text-muted">{selectedMember?.full_name} &middot; {auth.selectedEventTitle}</p>
          </div>
          <button
            onClick={() => { setSelectedMember(null); auth.setStep('select-member') }}
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

        {auth.eventDisciplines.length > available.length && (
          <div className="mt-6">
            <p className="text-xs text-muted mb-2">Wyniki zapisane:</p>
            <div className="flex flex-wrap gap-2">
              {auth.eventDisciplines
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
  if (auth.step === 'photo') {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <User className="w-10 h-10 text-primary mx-auto mb-2" />
          <h2 className="text-xl font-bold mb-1">{selectedMember?.full_name}</h2>
          <p className="text-sm text-muted mb-1">{selectedMember?.license_number}</p>
          <p className="text-sm text-primary font-medium mb-8">{selectedDiscipline?.discipline?.name}</p>

          <h3 className="text-lg font-semibold mb-4">Zdjęcie tarczy (opcjonalne)</h3>

          <input ref={targetPhoto.fileRef} type="file" accept="image/*" capture="environment" onChange={e => targetPhoto.handlePhotoChange(e, selectedDiscipline?.discipline?.name ?? null, () => auth.setStep('review'))} className="hidden" />

          <div className="space-y-3">
            <button onClick={() => targetPhoto.fileRef.current?.click()} className="w-full bg-primary text-background font-semibold py-3 rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2">
              <Camera className="w-5 h-5" />
              Zrób zdjęcie tarczy
            </button>
            <button onClick={() => {
              scoreForm.setEntryMode('shots')
              if (scoreForm.shots.length === 0) scoreForm.initShots(parseInt(scoreForm.shotsCount) || 10)
              scoreForm.setActiveShotIdx(0)
              auth.setStep('review')
            }} className="w-full border border-border text-foreground font-semibold py-3 rounded-lg hover:bg-card-hover transition-colors">
              Pomiń — wpisz wynik ręcznie
            </button>
            <button onClick={() => {
              if (selectedMember && auth.getAvailableDisciplines(selectedMember.id).length > 1) {
                auth.setStep('select-discipline')
              } else {
                setSelectedMember(null)
                auth.setStep('select-member')
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
  if (auth.step === 'review') {
    const shotsCalc = scoreForm.entryMode === 'shots' ? scoreForm.calcFromShots() : null
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

          {targetPhoto.photo && (
            <div className="mb-4">
              <img src={targetPhoto.photo} alt="Tarcza" className="w-full rounded-lg border border-border" />
              {targetPhoto.aiLoading && (
                <div className="mt-2 text-sm text-muted flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Analiza AI tarczy...
                </div>
              )}
              {targetPhoto.aiAnalysis && !targetPhoto.aiLoading && (
                <div className="mt-3 bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-primary">Sugestia AI</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      targetPhoto.aiAnalysis.confidence === 'high' ? 'bg-success/20 text-success' :
                      targetPhoto.aiAnalysis.confidence === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-danger/20 text-danger'
                    }`}>
                      {targetPhoto.aiAnalysis.confidence === 'high' ? 'Wysoka pewność' :
                       targetPhoto.aiAnalysis.confidence === 'medium' ? 'Średnia pewność' : 'Niska pewność'}
                    </span>
                  </div>
                  {targetPhoto.aiAnalysis.total_score !== undefined && (
                    <div className="text-sm mb-1">Wynik: <span className="font-mono font-bold">{targetPhoto.aiAnalysis.total_score}</span></div>
                  )}
                  {targetPhoto.aiAnalysis.shots_detected !== undefined && (
                    <div className="text-sm mb-1">Trafienia: {targetPhoto.aiAnalysis.shots_detected} | 10ki: {targetPhoto.aiAnalysis.tens_count ?? 0} | Pudła: {targetPhoto.aiAnalysis.misses ?? 0}</div>
                  )}
                  {targetPhoto.aiAnalysis.notes && (
                    <div className="text-xs text-muted mt-1">{targetPhoto.aiAnalysis.notes}</div>
                  )}
                  <button
                    type="button"
                    onClick={() => scoreForm.applyAiSuggestion(targetPhoto.aiAnalysis)}
                    className="mt-2 w-full text-sm px-3 py-1.5 bg-primary text-background rounded-lg hover:bg-primary-dark transition-colors font-medium"
                  >
                    Zastosuj sugestię AI
                  </button>
                </div>
              )}
            </div>
          )}

          {/* === SHOTGUN MODE === */}
          {isShotgun ? (
            <form className="space-y-4">
              <div>
                <label className="text-sm text-muted mb-1 block">Czas surowy (sekundy)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={scoreForm.timeSeconds}
                  onChange={e => scoreForm.setTimeSeconds(e.target.value.replace(',', '.'))}
                  placeholder="np. 4.32"
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 text-2xl text-center font-mono focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-sm text-muted mb-2 block">Pudła (za każde +5 sekund)</label>
                <div className="flex gap-2 justify-center">
                  {[0, 1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => scoreForm.setMisses(String(n))}
                      className={`w-12 h-12 rounded-xl border-2 text-lg font-bold transition-all ${
                        parseInt(scoreForm.misses) === n
                          ? n === 0 ? 'bg-green-500/25 border-green-500 text-green-400' : 'bg-danger/25 border-danger text-danger'
                          : 'bg-background border-border text-muted'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {scoreForm.timeSeconds && (
                <div className="p-4 rounded-lg bg-background border border-border text-center">
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted mb-1">Czas</div>
                      <div className="font-mono font-bold">{parseFloat(scoreForm.timeSeconds).toFixed(2)}s</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted mb-1">Kara</div>
                      <div className="font-mono font-bold text-danger">+{(parseInt(scoreForm.misses) || 0) * 5}s</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted mb-1">Wynik</div>
                      <div className="font-mono font-bold text-lg text-primary">
                        {(parseFloat(scoreForm.timeSeconds) + (parseInt(scoreForm.misses) || 0) * 5).toFixed(2)}s
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm text-muted mb-1 block">Komentarz sędziego</label>
                <textarea rows={2} value={scoreForm.comment} onChange={e => scoreForm.setComment(e.target.value)} placeholder="Uwagi..." className="w-full bg-background border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary resize-none" />
              </div>

              <button
                type="button"
                disabled={scoreForm.submitting || !scoreForm.timeSeconds}
                onClick={() => {
                  if (!selectedMember || !auth.judge) return
                  scoreForm.submitShotgunScore(selectedMember, auth.judge, auth.selectedEventId, selectedDiscipline, handleScoreSuccess)
                }}
                className="w-full bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl py-3 font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {scoreForm.submitting ? 'Zapisywanie...' : `Zapisz wynik (${scoreForm.timeSeconds ? (parseFloat(scoreForm.timeSeconds) + (parseInt(scoreForm.misses) || 0) * 5).toFixed(2) : '0'}s)`}
              </button>
            </form>
          ) : (
          <>
          {/* Entry mode toggle */}
          <div className="flex bg-background rounded-lg border border-border p-1 mb-5">
            <button
              type="button"
              onClick={() => scoreForm.setEntryMode('quick')}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-md transition-colors ${
                scoreForm.entryMode === 'quick' ? 'bg-primary/10 text-primary font-medium' : 'text-muted hover:text-foreground'
              }`}
            >
              <Hash className="w-3.5 h-3.5" />
              Szybki wpis
            </button>
            <button
              type="button"
              onClick={() => {
                scoreForm.setEntryMode('shots')
                if (scoreForm.shots.length === 0) scoreForm.initShots(parseInt(scoreForm.shotsCount) || 10)
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 text-sm py-2 rounded-md transition-colors ${
                scoreForm.entryMode === 'shots' ? 'bg-primary/10 text-primary font-medium' : 'text-muted hover:text-foreground'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Strzały
            </button>
          </div>

          <form onSubmit={e => {
            e.preventDefault()
            if (!selectedMember || !auth.judge) return
            scoreForm.submitScore(selectedMember, auth.judge, auth.selectedEventId, selectedDiscipline, handleScoreSuccess)
          }} className="space-y-4">

            {/* ---- SHOTS MODE ---- */}
            {scoreForm.entryMode === 'shots' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm text-muted">Liczba strzałów</label>
                  <div className="flex items-center gap-2">
                    {[10, 20, 30, 40, 60].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          scoreForm.setShotsCount(String(n))
                          scoreForm.initShots(n)
                        }}
                        className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                          parseInt(scoreForm.shotsCount) === n
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted hover:text-foreground'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-muted mb-2">Kliknij strzał i wybierz punkty (0-10):</p>
                <div className="space-y-3">
                  {Array.from({ length: Math.ceil(scoreForm.shots.length / 10) }, (_, seriesIdx) => {
                    const seriesShots = scoreForm.shots.slice(seriesIdx * 10, (seriesIdx + 1) * 10)
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
                                onClick={() => scoreForm.setActiveShotIdx(scoreForm.activeShotIdx === globalIdx ? null : globalIdx)}
                                className={`w-full text-center text-sm py-1.5 rounded border transition-all ${cellClass} ${scoreForm.activeShotIdx === globalIdx ? 'ring-2 ring-primary scale-105' : ''}`}
                              >
                                <div className="text-[9px] text-muted/50 leading-none mb-0.5">{globalIdx + 1}</div>
                                <div className="leading-none">{numVal !== null ? numVal : '-'}</div>
                              </button>
                            )
                          })}
                        </div>
                        {scoreForm.activeShotIdx !== null && scoreForm.activeShotIdx >= seriesIdx * 10 && scoreForm.activeShotIdx < (seriesIdx + 1) * 10 && (
                          <div className="mt-1.5 p-2 rounded-lg bg-card border border-primary/30">
                            <div className="text-xs text-muted mb-1.5 text-center">Strzał {scoreForm.activeShotIdx + 1} — wybierz punkty:</div>
                            <div className="flex gap-1 justify-center flex-wrap">
                              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => {
                                const isActive = scoreForm.shots[scoreForm.activeShotIdx!] === String(score)
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
                                      scoreForm.updateShot(scoreForm.activeShotIdx!, String(score))
                                      const nextEmpty = scoreForm.shots.findIndex((s, i) => i > scoreForm.activeShotIdx! && s === '')
                                      scoreForm.setActiveShotIdx(nextEmpty >= 0 ? nextEmpty : null)
                                      scoreForm.applyShotsCalc()
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
                      <input type="text" inputMode="numeric" value={scoreForm.xsCount} onChange={e => scoreForm.setXsCount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" className="w-20 bg-background border border-border rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-primary" />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ---- QUICK MODE ---- */}
            {scoreForm.entryMode === 'quick' && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="text-sm text-muted block mb-1">Wynik *</label>
                    <input type="text" inputMode="decimal" value={scoreForm.totalScore} onChange={e => scoreForm.setTotalScore(e.target.value.replace(',', '.'))} placeholder="np. 95" required className={inputClass} />
                  </div>
                  <div className="text-2xl text-muted pt-5">/</div>
                  <div className="w-20">
                    <label className="text-sm text-muted block mb-1">Max</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={scoreForm.maxScore}
                      onChange={e => scoreForm.setMaxScore(e.target.value.replace(',', '.'))}
                      placeholder="100"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-muted block mb-1">Dziesiątki (10)</label>
                    <input type="text" inputMode="numeric" value={scoreForm.tensCount} onChange={e => scoreForm.setTensCount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" className={inputSmClass} />
                  </div>
                  <div>
                    <label className="text-sm text-muted block mb-1">X-ki (środek)</label>
                    <input type="text" inputMode="numeric" value={scoreForm.xsCount} onChange={e => scoreForm.setXsCount(e.target.value.replace(/[^0-9]/g, ''))} placeholder="0" className={inputSmClass} />
                  </div>
                </div>
              </>
            )}

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
              <textarea value={scoreForm.comment} onChange={e => scoreForm.setComment(e.target.value)} rows={2} placeholder="Uwagi..." className={inputClass + ' resize-none'} />
            </div>

            <button
              type="submit"
              disabled={scoreForm.submitting || !scoreForm.totalScore}
              className="w-full bg-primary text-background font-semibold py-3 rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {scoreForm.submitting ? 'Zapisywanie...' : (
                <>
                  <Upload className="w-4 h-4" />
                  Zapisz wynik
                  {scoreForm.totalScore && <span className="opacity-70">({scoreForm.totalScore} pkt)</span>}
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
  const formattedScore = scoreForm.totalScore + (scoreForm.xsCount && parseInt(scoreForm.xsCount) > 0 ? `-${scoreForm.xsCount}x` : '')

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
        {parseInt(scoreForm.tensCount) > 0 && (
          <p className="text-xs text-muted">
            Dziesiątki: {scoreForm.tensCount}{scoreForm.xsCount && parseInt(scoreForm.xsCount) > 0 ? ` (w tym ${scoreForm.xsCount} X)` : ''}
          </p>
        )}
        <p className="text-sm text-muted mt-4 mb-6">Wynik jest widoczny w profilu zawodnika i w rankingach.</p>
        <div className="space-y-3">
          {selectedMember && auth.getAvailableDisciplines(selectedMember.id).length > 0 && (
            <button
              onClick={() => {
                resetForm()
                const available = auth.getAvailableDisciplines(selectedMember.id)
                if (available.length === 1) {
                  setSelectedDiscipline(available[0])
                  auth.setStep('photo')
                } else {
                  auth.setStep('select-discipline')
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
