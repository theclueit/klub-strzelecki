import { useState, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'

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

export function useTargetPhoto(supabase: SupabaseClient) {
  const [photo, setPhoto] = useState<string | null>(null)
  const [aiAnalysis, setAiAnalysis] = useState<any>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function analyzeTargetPhoto(imageData: string, disciplineName: string | null) {
    setAiLoading(true)
    try {
      const res = await fetch('/api/analyze-target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: imageData,
          discipline_name: disciplineName,
          shots_count: null,
        }),
      })
      const json = await res.json()
      if (json.ok && json.analysis) {
        setAiAnalysis(json.analysis)
      }
    } catch (err) {
      console.error('AI analysis failed:', err)
    } finally {
      setAiLoading(false)
    }
  }

  function handlePhotoChange(
    e: React.ChangeEvent<HTMLInputElement>,
    disciplineName: string | null,
    onPhotoReady: () => void,
  ) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const raw = ev.target?.result as string
      const compressed = await compressImage(raw, 1200, 0.6)
      setPhoto(compressed)
      setAiAnalysis(null)
      onPhotoReady()
      analyzeTargetPhoto(compressed, disciplineName)
    }
    reader.readAsDataURL(file)
  }

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

  function resetPhoto() {
    setPhoto(null)
    setAiAnalysis(null)
    setAiLoading(false)
  }

  return {
    photo,
    aiAnalysis,
    aiLoading,
    fileRef,
    handlePhotoChange,
    uploadPhotoInBackground,
    applyAiSuggestion: aiAnalysis,
    resetPhoto,
  }
}
