import { useState } from 'react'
import type { Member } from '@/types/database'
import type { EventDisciplineRow } from './types'

export function useScoreForm() {
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

  function initShots(count: number) {
    setShots(Array(count).fill(''))
  }

  function updateShot(index: number, value: string) {
    value = value.replace(',', '.')
    const num = parseFloat(value)
    if (value !== '' && (isNaN(num) || num < 0 || num > 10.9)) return
    setShots(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

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

  function applyAiSuggestion(aiAnalysis: any) {
    if (!aiAnalysis) return
    if (aiAnalysis.total_score !== undefined) setTotalScore(String(aiAnalysis.total_score))
    if (aiAnalysis.tens_count !== undefined) setTensCount(String(aiAnalysis.tens_count))
    if (aiAnalysis.xs_count !== undefined) setXsCount(String(aiAnalysis.xs_count))
    if (aiAnalysis.misses !== undefined) setMisses(String(aiAnalysis.misses))
    if (aiAnalysis.shots_detected) setMaxScore(String(aiAnalysis.shots_detected * 10))
  }

  async function submitScore(
    selectedMember: Member,
    judge: Member,
    selectedEventId: string,
    selectedDiscipline: EventDisciplineRow | null,
    onSuccess: () => void,
  ) {
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
    const shotsArray = entryMode === 'shots' && shots.some(s => s !== '')
      ? shots.map(s => s === '' ? 0 : parseFloat(s))
      : null

    const payload = {
      member_id: selectedMember.id,
      judge_id: judge.id,
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

    onSuccess()
  }

  async function submitShotgunScore(
    selectedMember: Member,
    judge: Member,
    selectedEventId: string,
    selectedDiscipline: EventDisciplineRow | null,
    onSuccess: () => void,
  ) {
    if (!selectedMember || !timeSeconds) return
    setSubmitting(true)

    const rawTime = parseFloat(timeSeconds)
    const missCount = parseInt(misses) || 0
    const finalTime = rawTime + missCount * 5
    const disciplineId = selectedDiscipline?.discipline_id ?? selectedDiscipline?.discipline?.id ?? null

    const payload = {
      member_id: selectedMember.id,
      judge_id: judge.id,
      event_id: selectedEventId || null,
      discipline_id: disciplineId,
      total_score: finalTime,
      max_score: 5,
      tens_count: 0,
      xs_count: 0,
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
          body: JSON.stringify(payload),
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
    if (!sgOk) {
      alert(sgCode === '23505' ? 'Wynik już zapisany dla tej dyscypliny.' : 'Błąd zapisu: ' + sgErr)
      return
    }

    onSuccess()
  }

  function resetForm() {
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

  return {
    entryMode, setEntryMode,
    shotsCount, setShotsCount,
    shots, activeShotIdx, setActiveShotIdx,
    totalScore, setTotalScore,
    maxScore, setMaxScore,
    tensCount, setTensCount,
    xsCount, setXsCount,
    misses, setMisses,
    comment, setComment,
    timeSeconds, setTimeSeconds,
    submitting,
    initShots,
    updateShot,
    calcFromShots,
    getValidationErrors,
    applyShotsCalc,
    applyAiSuggestion,
    submitScore,
    submitShotgunScore,
    resetForm,
  }
}
