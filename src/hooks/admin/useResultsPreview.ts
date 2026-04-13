'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import type { EventRow } from '@/types/admin'

interface UseResultsPreviewParams {
  events: EventRow[]
}

export function useResultsPreview({ events }: UseResultsPreviewParams) {
  const supabase = createSupabaseBrowser()

  const [resultsPreview, setResultsPreview] = useState<{ eventId: string; eventTitle: string; results: any[] } | null>(null)
  const [resultsLightbox, setResultsLightbox] = useState<string | null>(null)

  async function viewEventResults(eventId: string) {
    const ev = events.find(e => e.id === eventId)
    if (!ev) return
    const { data } = await supabase
      .from('results')
      .select('id, total_score, max_score, tens_count, misses, time_seconds, target_image_url, shot_at, member:members!results_member_id_fkey(id, full_name), discipline:disciplines(name, scoring_type)')
      .eq('event_id', eventId)
      .order('shot_at', { ascending: false })
    setResultsPreview({ eventId, eventTitle: ev.title, results: data ?? [] })
  }

  async function viewMemberTargets(memberId: string, eventId: string, memberName: string) {
    const { data } = await supabase
      .from('results')
      .select('id, total_score, max_score, tens_count, misses, time_seconds, target_image_url, discipline:disciplines(name, scoring_type)')
      .eq('member_id', memberId)
      .eq('event_id', eventId)
      .order('shot_at', { ascending: false })
    if (!data || data.length === 0) {
      alert(`Brak wyników dla ${memberName} w tym wydarzeniu`)
      return
    }
    const withImages = data.filter((r: any) => r.target_image_url)
    if (withImages.length === 0) {
      alert(`${memberName} nie ma zdjęć tarcz w tym wydarzeniu`)
      return
    }
    setResultsPreview({ eventId, eventTitle: memberName, results: data })
  }

  return {
    resultsPreview,
    setResultsPreview,
    resultsLightbox,
    setResultsLightbox,
    viewEventResults,
    viewMemberTargets,
  }
}
