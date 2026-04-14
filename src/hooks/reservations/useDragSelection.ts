'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import type { Reservation } from './types'

interface UseDragSelectionParams {
  slots: string[]
  slotMap: Record<string, Reservation>
  isPast: boolean
  openBookingFromSelection: (start: { sn: number; slotIdx: number }, end: { sn: number; slotIdx: number }) => void
}

/**
 * Click-move-click slot selection:
 * 1. Click a slot → marks start, selection follows mouse
 * 2. Move mouse over slots → highlights range
 * 3. Click again → finalizes selection, opens booking
 */
export function useDragSelection({ slots, slotMap, isPast, openBookingFromSelection }: UseDragSelectionParams) {
  const [dragStart, setDragStart] = useState<{ sn: number; slotIdx: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ sn: number; slotIdx: number } | null>(null)
  const isSelecting = useRef(false)

  const openBookingRef = useRef(openBookingFromSelection)
  openBookingRef.current = openBookingFromSelection

  const dragSelection = useMemo(() => {
    if (!dragStart || !dragEnd) return null
    return {
      minSn: Math.min(dragStart.sn, dragEnd.sn),
      maxSn: Math.max(dragStart.sn, dragEnd.sn),
      minSlot: Math.min(dragStart.slotIdx, dragEnd.slotIdx),
      maxSlot: Math.max(dragStart.slotIdx, dragEnd.slotIdx),
    }
  }, [dragStart, dragEnd])

  const isInDragSelection = (sn: number, slotIdx: number) => {
    if (!dragSelection) return false
    return sn >= dragSelection.minSn && sn <= dragSelection.maxSn &&
      slotIdx >= dragSelection.minSlot && slotIdx <= dragSelection.maxSlot
  }

  const clearSelection = useCallback(() => {
    isSelecting.current = false
    setDragStart(null)
    setDragEnd(null)
  }, [])

  // Called on pointerdown — unused for click-move-click but kept for API compat
  const handlePointerDown = (_sn: number, _slotIdx: number, _pointerType: string) => {
    // No-op: selection is handled entirely by handleSlotClick
  }

  // Called on pointer enter — updates end of selection while mouse moves
  const handleDragMove = (sn: number, slotIdx: number) => {
    if (!isSelecting.current) return
    setDragEnd({ sn, slotIdx })
  }

  // Called on pointerup — unused
  const handleDragEnd = useCallback(() => {}, [])

  // Main handler: click-move-click
  const handleSlotClick = (sn: number, slotIdx: number) => {
    if (isPast) return

    if (!isSelecting.current) {
      // First click — start selection
      isSelecting.current = true
      setDragStart({ sn, slotIdx })
      setDragEnd({ sn, slotIdx })
    } else {
      // Second click — finalize and open booking
      const start = dragStart
      const end = { sn, slotIdx }
      isSelecting.current = false
      setDragStart(null)
      setDragEnd(null)
      if (start) {
        openBookingRef.current(start, end)
      }
    }
  }

  return {
    dragStart,
    setDragStart,
    dragEnd,
    setDragEnd,
    dragSelection,
    isInDragSelection,
    handlePointerDown,
    handleDragMove,
    handleDragEnd,
    handleSlotClick,
    clearSelection,
  }
}
