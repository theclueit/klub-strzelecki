'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { UserPlus, Check, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function JoinPage() {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    discipline: '',
    experience: '',
    has_license: false,
    license_number: '',
    accepts_rules: false,
    accepts_legal: false,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  function update(field: string, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.accepts_rules || !form.accepts_legal) {
      setError('Musisz zaakceptować regulamin i zgodę prawną.')
      return
    }

    setSubmitting(true)

    const { error: dbError } = await supabase.from('members').insert({
      full_name: form.full_name,
      email: form.email,
      phone: form.phone || null,
      license_number: form.has_license ? form.license_number : null,
      class: 'III',
      role: 'member',
      qr_code: `QR-${Date.now()}`,
    })

    setSubmitting(false)

    if (dbError) {
      if (dbError.code === '23505') {
        setError('Ten email lub numer licencji jest już zarejestrowany.')
      } else {
        setError('Błąd rejestracji: ' + dbError.message)
      }
      return
    }

    setDone(true)
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <div className="bg-card border border-border rounded-xl p-8">
          <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Wniosek złożony!</h2>
          <p className="text-muted mb-2">Dziękujemy, {form.full_name}!</p>
          <p className="text-sm text-muted mb-6">
            Twój wniosek o członkostwo zostanie rozpatrzony przez zarząd klubu.
            Informacja o decyzji zostanie wysłana na adres {form.email}.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors"
          >
            Wróć na stronę główną
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <Link href="/" className="inline-flex items-center gap-2 text-muted hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Strona główna
      </Link>

      <div className="bg-card border border-border rounded-xl p-8">
        <div className="text-center mb-8">
          <UserPlus className="w-12 h-12 text-primary mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Dołącz do klubu</h1>
          <p className="text-sm text-muted mt-1">Wypełnij formularz członkowski</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div>
            <label className="text-sm text-muted block mb-1">Imię i nazwisko *</label>
            <input
              type="text"
              required
              value={form.full_name}
              onChange={e => update('full_name', e.target.value)}
              placeholder="Jan Kowalski"
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-sm text-muted block mb-1">Email *</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={e => update('email', e.target.value)}
              placeholder="jan@example.com"
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="text-sm text-muted block mb-1">Telefon</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => update('phone', e.target.value)}
              placeholder="+48 123 456 789"
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
            />
          </div>

          {/* Discipline interest */}
          <div>
            <label className="text-sm text-muted block mb-1">Interesująca dyscyplina</label>
            <select
              value={form.discipline}
              onChange={e => update('discipline', e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">Wybierz...</option>
              <option value="pistol_10m">Pistolet 10m</option>
              <option value="pistol_25m">Pistolet 25m</option>
              <option value="pistol_50m">Pistolet 50m</option>
              <option value="rifle">Karabin</option>
              <option value="ipsc">IPSC</option>
              <option value="benchrest">Benchrest</option>
            </select>
          </div>

          {/* Experience */}
          <div>
            <label className="text-sm text-muted block mb-1">Doświadczenie strzeleckie</label>
            <select
              value={form.experience}
              onChange={e => update('experience', e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:border-primary"
            >
              <option value="">Wybierz...</option>
              <option value="none">Brak — chcę zacząć</option>
              <option value="beginner">Początkujący (do 1 roku)</option>
              <option value="intermediate">Średniozaawansowany (1-3 lata)</option>
              <option value="advanced">Zaawansowany (3+ lat)</option>
            </select>
          </div>

          {/* License */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.has_license}
                onChange={e => update('has_license', e.target.checked)}
                className="w-4 h-4 accent-primary"
              />
              <span className="text-sm">Posiadam pozwolenie na broń</span>
            </label>
            {form.has_license && (
              <input
                type="text"
                value={form.license_number}
                onChange={e => update('license_number', e.target.value)}
                placeholder="Numer licencji (np. PL-2024-XXX)"
                className="w-full bg-background border border-border rounded-lg px-4 py-3 mt-2 text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
              />
            )}
          </div>

          {/* Consents */}
          <div className="space-y-3 pt-2 border-t border-border">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.accepts_rules}
                onChange={e => update('accepts_rules', e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-primary"
              />
              <span className="text-sm text-muted">
                Akceptuję regulamin klubu strzeleckiego i zobowiązuję się do przestrzegania
                zasad bezpieczeństwa na strzelnicy. *
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.accepts_legal}
                onChange={e => update('accepts_legal', e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-primary"
              />
              <span className="text-sm text-muted">
                Wyrażam zgodę na przetwarzanie moich danych osobowych w celu realizacji
                członkostwa w klubie (RODO, art. 6 ust. 1 lit. a). *
              </span>
            </label>
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg p-3">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-primary text-background font-semibold py-3 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {submitting ? 'Wysyłanie...' : 'Złóż wniosek o członkostwo'}
          </button>
        </form>
      </div>
    </div>
  )
}
