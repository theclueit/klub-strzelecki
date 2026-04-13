'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { KeyRound, Eye, EyeOff, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const supabase = createSupabaseBrowser()
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })
  }, [supabase.auth])

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków.')
      return
    }

    if (password !== confirmPassword) {
      setError('Hasła nie są identyczne.')
      return
    }

    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(true)
    setTimeout(() => {
      router.push('/kalendarz')
    }, 3000)
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <CheckCircle className="w-12 h-12 text-success mx-auto mb-3" />
          <h1 className="text-2xl font-bold mb-2">Hasło zmienione</h1>
          <p className="text-sm text-muted mb-6">Twoje hasło zostało pomyślnie zaktualizowane. Za chwilę zostaniesz przekierowany.</p>
          <Link
            href="/kalendarz"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors"
          >
            Przejdź do kalendarza
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="bg-card border border-border rounded-xl p-8">
        <div className="text-center mb-8">
          <KeyRound className="w-12 h-12 text-primary mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Nowe hasło</h1>
          <p className="text-sm text-muted mt-1">Ustaw nowe hasło do swojego konta</p>
        </div>

        {!sessionReady ? (
          <div className="text-center">
            <p className="text-sm text-muted">Weryfikacja linku resetującego...</p>
          </div>
        ) : (
          <form onSubmit={handlePasswordReset} className="space-y-5">
            <div>
              <label className="text-sm text-muted block mb-1">Nowe hasło</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Minimum 6 znaków"
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 pr-12 text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm text-muted block mb-1">Powtórz hasło</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Powtórz nowe hasło"
                className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
              />
            </div>

            {error && (
              <div className="bg-danger/10 border border-danger/30 rounded-lg p-3">
                <p className="text-sm text-danger">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-background font-semibold py-3 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {loading ? 'Zapisywanie...' : 'Ustaw nowe hasło'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
