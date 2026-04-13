'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
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
  const pointerIsMouse = useRef(false)
  const dragStartRef = useRef(dragStart)
  const dragEndRef = useRef(dragEnd)
  dragStartRef.current = dragStart
  dragEndRef.current = dragEnd

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

  const handlePointerDown = (sn: number, slotIdx: number, pointerType: string) => {
    if (isPast) return
    if (pointerType === 'mouse') {
      // Desktop: start drag — update refs immediately for mouseup handler
      const pos = { sn, slotIdx }
      pointerIsMouse.current = true
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

  const handleDragEnd = () => {
    if (!isDragging.current) return
    isDragging.current = false

    const start = dragStartRef.current
    const end = dragEndRef.current
    if (!start || !end) return

    // Open booking from drag selection
    openBookingFromSelection(start, end)
    dragStartRef.current = null
    dragEndRef.current = null
    setDragStart(null)
    setDragEnd(null)
    // Block the upcoming click event from re-triggering
    pointerIsMouse.current = true
    setTimeout(() => { pointerIsMouse.current = false }, 50)
  }

  // Click handler: tap-to-select (primarily for touch, also works as fallback)
  // 1st click = start, 2nd click = end -> open booking
  const handleSlotClick = (sn: number, slotIdx: number) => {
    if (isPast) return
    // Skip if this click came from a mouse drag-end (already handled)
    if (pointerIsMouse.current) {
      pointerIsMouse.current = false
      return
    }

    if (!dragStart) {
      // First tap — mark start
      setDragStart({ sn, slotIdx })
      setDragEnd({ sn, slotIdx })
    } else {
      // Second tap — mark end and open booking
      const end = { sn, slotIdx }
      openBookingFromSelection(dragStart, end)
      setDragStart(null)
      setDragEnd(null)
    }
  }

  // Global mouseup listener to end drag (desktop only)
  useEffect(() => {
    const onUp = () => {
      if (isDragging.current) handleDragEnd()
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [slots, slotMap])

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
