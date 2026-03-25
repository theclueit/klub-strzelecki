'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase'
import { Check, X, Loader2 } from 'lucide-react'
import Link from 'next/link'

export default function JudgeConfirmPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted">Ładowanie...</div>}>
      <JudgeConfirmContent />
    </Suspense>
  )
}

function JudgeConfirmContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const supabase = createSupabaseBrowser()

  const [status, setStatus] = useState<'loading' | 'success' | 'already' | 'error'>('loading')
  const [eventName, setEventName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setErrorMsg('Brak tokenu potwierdzenia.')
      return
    }
    confirm()
  }, [token])

  async function confirm() {
    // Find event_judge by token
    const { data: ej, error: ejErr } = await supabase
      .from('event_judges')
      .select('*, event:events!event_id(title)')
      .eq('confirmation_token', token)
      .single()

    if (ejErr || !ej) {
      setStatus('error')
      setErrorMsg('Nieprawidłowy lub wygasły link potwierdzenia.')
      return
    }

    setEventName((ej.event as any)?.title ?? '')

    if (ej.status === 'confirmed') {
      setStatus('already')
      return
    }

    // Update status to confirmed
    const { error: updateErr } = await supabase
      .from('event_judges')
      .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
      .eq('id', ej.id)

    if (updateErr) {
      setStatus('error')
      setErrorMsg('Błąd potwierdzenia: ' + updateErr.message)
      return
    }

    setStatus('success')
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
            <h1 className="text-xl font-bold mb-2">Potwierdzanie...</h1>
            <p className="text-sm text-muted">Proszę czekać.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-success" />
            </div>
            <h1 className="text-xl font-bold mb-2">Potwierdzono!</h1>
            <p className="text-sm text-muted mb-2">
              Twój udział jako sędzia w wydarzeniu został potwierdzony.
            </p>
            {eventName && (
              <p className="text-sm font-semibold text-foreground mb-6">
                {eventName}
              </p>
            )}
            <Link
              href="/sedzia"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors"
            >
              Przejdź do panelu sędziego
            </Link>
          </>
        )}

        {status === 'already' && (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-xl font-bold mb-2">Już potwierdzone</h1>
            <p className="text-sm text-muted mb-2">
              Twój udział w tym wydarzeniu został już wcześniej potwierdzony.
            </p>
            {eventName && (
              <p className="text-sm font-semibold text-foreground mb-6">
                {eventName}
              </p>
            )}
            <Link
              href="/sedzia"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors"
            >
              Przejdź do panelu sędziego
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 rounded-full bg-danger/20 flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-danger" />
            </div>
            <h1 className="text-xl font-bold mb-2">Błąd</h1>
            <p className="text-sm text-muted mb-6">{errorMsg}</p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 border border-border rounded-lg hover:bg-card-hover transition-colors text-sm"
            >
              Wróć na stronę główną
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
