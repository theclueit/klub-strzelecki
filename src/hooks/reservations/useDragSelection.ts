'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import type { Reservation } from './types'

interface UseDragSelectionParams {
  slots: string[]
  slotMap: Record<string, Reservation>
  isPast: boolean
  openBookingFromSelection: (start: { sn: number; slotIdx: number }, end: { sn: number; slotIdx: number }) => void
}

export function useDragSelection({ slots, slotMap, isPast, openBookingFromSelection }: UseDragSelectionParams) {
  const [dragStart, setDragStart] = useState<{ sn: number; slotIdx: number } | null>(null)
  const [dragEnd, setDragEnd] = useState<{ sn: number; slotIdx: number } | null>(null)
  const isDragging = useRef(false)
  // Tracks whether the last interaction was a mouse drag — used to skip the
  // click event that fires right after mouseup so we don't double-trigger.
  const skipNextClick = useRef(false)
  const dragStartRef = useRef(dragStart)
  const dragEndRef = useRef(dragEnd)
  dragStartRef.current = dragStart
  dragEndRef.current = dragEnd

  // Keep a stable ref to openBookingFromSelection to avoid stale closures
  const openBookingRef = useRef(openBookingFromSelection)
  openBookingRef.current = openBookingFromSelection

  // Drag selection: compute rectangle of selected cells
  const dragSelection = useMemo(() => {
    if (!dragStart || !dragEnd) return null
    const minSn = Math.min(dragStart.sn, dragEnd.sn)
    const maxSn = Math.max(dragStart.sn, dragEnd.sn)
    const minSlot = Math.min(dragStart.slotIdx, dragEnd.slotIdx)
    const maxSlot = Math.max(dragStart.slotIdx, dragEnd.slotIdx)
    return { minSn, maxSn, minSlot, maxSlot }
  }, [dragStart, dragEnd])

  const isInDragSelection = (sn: number, slotIdx: number) => {
    if (!dragSelection) return false
    return sn >= dragSelection.minSn && sn <= dragSelection.maxSn &&
      slotIdx >= dragSelection.minSlot && slotIdx <= dragSelection.maxSlot
  }

  const clearDrag = useCallback(() => {
    isDragging.current = false
    dragStartRef.current = null
    dragEndRef.current = null
    setDragStart(null)
    setDragEnd(null)
  }, [])

  const handlePointerDown = (sn: number, slotIdx: number, pointerType: string) => {
    if (isPast) return
    if (pointerType === 'mouse') {
      // Desktop: start drag — update refs immediately for mouseup handler
      const pos = { sn, slotIdx }
      isDragging.current = true
      dragStartRef.current = pos
      dragEndRef.current = pos
      setDragStart(pos)
      setDragEnd(pos)
    }
    // Touch: do nothing here — onClick will handle tap-to-select
  }

  const handleDragMove = (sn: number, slotIdx: number) => {
    if (!isDragging.current) return
    const pos = { sn, slotIdx }
    dragEndRef.current = pos
    setDragEnd(pos)
  }

  const handleDragEnd = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false

    const start = dragStartRef.current
    const end = dragEndRef.current

    // Clear visual selection immediately
    dragStartRef.current = null
    dragEndRef.current = null
    setDragStart(null)
    setDragEnd(null)

    // Block the click event that fires right after mouseup
    skipNextClick.current = true

    if (!start || !end) return

    // Open booking (uses ref to avoid stale closure)
    openBookingRef.current(start, end)
  }, [clearDrag])

  // Click handler: tap-to-select (primarily for touch, also works as fallback)
  // 1st click = start, 2nd click = end -> open booking
  const handleSlotClick = (sn: number, slotIdx: number) => {
    if (isPast) return
    // Skip if this click came from a mouse drag-end (already handled by handleDragEnd)
    if (skipNextClick.current) {
      skipNextClick.current = false
      return
    }

    if (!dragStart) {
      // First tap — mark start
      setDragStart({ sn, slotIdx })
      setDragEnd({ sn, slotIdx })
    } else {
      // Second tap — mark end and open booking
      const start = dragStart
      const end = { sn, slotIdx }
      setDragStart(null)
      setDragEnd(null)
      openBookingRef.current(start, end)
    }
  }

  // Global pointerup listener to end drag (desktop only)
  // Must use pointerup — not mouseup — because e.preventDefault() on
  // pointerdown suppresses all compatibility mouse events (mouseup, click).
  useEffect(() => {
    const onUp = () => {
      if (isDragging.current) handleDragEnd()
    }
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [handleDragEnd])

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
  }
}
