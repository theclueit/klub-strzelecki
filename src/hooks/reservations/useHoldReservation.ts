'use client'

import { useState, useEffect, useCallback } from 'react'

interface UseHoldReservationParams {
  loadReservations: () => void
  setShowBooking: (val: null) => void
}

export function useHoldReservation({ loadReservations, setShowBooking }: UseHoldReservationParams) {
  const [holdToken, setHoldToken] = useState<string | null>(null)
  const [holdExpiresAt, setHoldExpiresAt] = useState<Date | null>(null)
  const [holdTimeLeft, setHoldTimeLeft] = useState(0) // seconds
  const [holdExtending, setHoldExtending] = useState(false)
  const [showExtendPrompt, setShowExtendPrompt] = useState(false)

  // Hold countdown timer
  useEffect(() => {
    if (!holdExpiresAt || !holdToken) return
    const tick = () => {
      const left = Math.max(0, Math.round((holdExpiresAt.getTime() - Date.now()) / 1000))
      setHoldTimeLeft(left)
      if (left <= 30 && left > 0 && !showExtendPrompt) {
        setShowExtendPrompt(true)
      }
      if (left <= 0) {
        // Hold expired — close modal and reload
        setHoldToken(null)
        setHoldExpiresAt(null)
        setShowBooking(null)
        setShowExtendPrompt(false)
        loadReservations()
      }
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [holdExpiresAt, holdToken, showExtendPrompt])

  // Release hold when modal closes without booking
  const releaseHold = useCallback(async () => {
    if (!holdToken) return
    try {
      await fetch('/api/reservations/hold', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hold_token: holdToken }),
      })
    } catch {}
    setHoldToken(null)
    setHoldExpiresAt(null)
    setShowExtendPrompt(false)
    loadReservations()
  }, [holdToken])

  // Extend hold
  const extendHold = useCallback(async () => {
    if (!holdToken) return
    setHoldExtending(true)
    try {
      const res = await fetch('/api/reservations/hold', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hold_token: holdToken }),
      })
      const data = await res.json()
      if (res.ok) {
        setHoldExpiresAt(new Date(data.expires_at))
        setShowExtendPrompt(false)
      } else {
        // Hold expired server-side
        setHoldToken(null)
        setHoldExpiresAt(null)
        setShowBooking(null)
        setShowExtendPrompt(false)
        loadReservations()
      }
    } catch {}
    setHoldExtending(false)
  }, [holdToken])

  return {
    holdToken,
    setHoldToken,
    holdExpiresAt,
    setHoldExpiresAt,
    holdTimeLeft,
    setHoldTimeLeft,
    holdExtending,
    showExtendPrompt,
    setShowExtendPrompt,
    releaseHold,
    extendHold,
  }
}
