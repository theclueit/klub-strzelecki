import { useState, useRef, useCallback } from 'react'
import type { Member } from '@/types/database'

export function useQrScanner(
  members: Member[],
  startNumbers: Map<string, number>,
  onMemberFound: (member: Member) => void,
) {
  const [showQrScanner, setShowQrScanner] = useState(false)
  const [startNumberInput, setStartNumberInput] = useState('')
  const [memberSearch, setMemberSearch] = useState('')
  const qrVideoRef = useRef<HTMLVideoElement>(null)
  const qrStreamRef = useRef<MediaStream | null>(null)

  const findByStartNumber = useCallback((num: number) => {
    const memberId = Array.from(startNumbers.entries()).find(([, sn]) => sn === num)?.[0]
    if (!memberId) return
    const m = members.find(m => m.id === memberId)
    if (m) onMemberFound(m)
  }, [members, startNumbers, onMemberFound])

  function handleStartNumberSubmit(e: React.FormEvent) {
    e.preventDefault()
    const num = parseInt(startNumberInput)
    if (!num) return
    findByStartNumber(num)
    setStartNumberInput('')
  }

  function handleQrResult(value: string) {
    stopQrScanner()
    const startMatch = value.match(/START-[^-]+-(\d+)/)
    if (startMatch) {
      findByStartNumber(parseInt(startMatch[1]))
      return
    }
    const num = parseInt(value)
    if (!isNaN(num)) {
      findByStartNumber(num)
      return
    }
    const m = members.find(m => m.qr_code === value || m.license_number === value)
    if (m) onMemberFound(m)
  }

  async function startQrScanner() {
    setShowQrScanner(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      qrStreamRef.current = stream
      if (qrVideoRef.current) {
        qrVideoRef.current.srcObject = stream
        qrVideoRef.current.play()
      }
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
        const scanLoop = async () => {
          if (!qrVideoRef.current || !qrStreamRef.current) return
          try {
            const codes = await detector.detect(qrVideoRef.current)
            if (codes.length > 0) {
              handleQrResult(codes[0].rawValue)
              return
            }
          } catch {}
          if (qrStreamRef.current) requestAnimationFrame(scanLoop)
        }
        qrVideoRef.current?.addEventListener('loadeddata', () => {
          requestAnimationFrame(scanLoop)
        }, { once: true })
      }
    } catch (err) {
      console.error('Camera error:', err)
      setShowQrScanner(false)
    }
  }

  function stopQrScanner() {
    if (qrStreamRef.current) {
      qrStreamRef.current.getTracks().forEach(t => t.stop())
      qrStreamRef.current = null
    }
    setShowQrScanner(false)
  }

  const filteredMembers = members.filter(m =>
    m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.license_number?.toLowerCase().includes(memberSearch.toLowerCase()) ||
    m.qr_code?.toLowerCase().includes(memberSearch.toLowerCase()) ||
    (startNumbers.get(m.id)?.toString() ?? '').includes(memberSearch)
  )

  return {
    showQrScanner,
    startNumberInput,
    setStartNumberInput,
    memberSearch,
    setMemberSearch,
    qrVideoRef,
    filteredMembers,
    handleStartNumberSubmit,
    startQrScanner,
    stopQrScanner,
  }
}
