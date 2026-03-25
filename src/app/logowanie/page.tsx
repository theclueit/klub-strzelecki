'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { LogIn, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createSupabaseBrowser()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (authError) {
      if (authError.message.includes('Invalid login')) {
        setError('Nieprawidłowy email lub hasło.')
      } else if (authError.message.includes('Email not confirmed')) {
        setError('Email nie został potwierdzony. Sprawdź skrzynkę pocztową.')
      } else {
        setError(authError.message)
      }
      return
    }

    router.push('/kalendarz')
    router.refresh()
  }

  if (user) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-card border border-border rounded-xl p-8">
          <h2 className="text-xl font-bold mb-2">Jesteś zalogowany</h2>
          <p className="text-sm text-muted mb-6">Możesz przejść do kalendarza i zapisać się na zawody.</p>
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
          <LogIn className="w-12 h-12 text-primary mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Logowanie</h1>
          <p className="text-sm text-muted mt-1">Zaloguj się do portalu klubowego</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="text-sm text-muted block mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="jan@example.com"
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-sm text-muted block mb-1">Hasło</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Twoje hasło"
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
            {loading ? 'Logowanie...' : 'Zaloguj się'}
          </button>

          <p className="text-sm text-muted text-center">
            Nie masz konta?{' '}
            <Link href="/dolacz" className="text-primary hover:underline">Zarejestruj się</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
