'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { User, Save, ArrowLeft, Check } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Member } from '@/types/database'

export default function ProfilePage() {
  const { member, loading, user } = useAuth()
  const router = useRouter()
  const supabase = createSupabaseBrowser()

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    license_number: '',
    club_name: '',
    judge_class: '',
    is_range_officer: false,
    has_weapons_permit: false,
    is_sports_instructor: false,
    range_officer_number: '',
    shooting_patent_number: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/logowanie')
      return
    }
    if (member) {
      setForm({
        full_name: member.full_name,
        phone: member.phone ?? '',
        license_number: member.license_number ?? '',
        club_name: member.club_name ?? 'Klub Strzelecki Cel',
        judge_class: member.judge_class ?? '',
        is_range_officer: member.is_range_officer,
        has_weapons_permit: member.has_weapons_permit,
        is_sports_instructor: member.is_sports_instructor,
        range_officer_number: member.range_officer_number ?? '',
        shooting_patent_number: member.shooting_patent_number ?? '',
      })
    }
  }, [member, loading, user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!member) return
    setSaving(true)
    setError('')
    setSaved(false)

    const { error: dbError } = await supabase
      .from('members')
      .update({
        full_name: form.full_name,
        phone: form.phone || null,
        license_number: form.license_number || null,
        club_name: form.club_name || 'Klub Strzelecki Cel',
        judge_class: form.judge_class || null,
        is_range_officer: form.is_range_officer,
        has_weapons_permit: form.has_weapons_permit,
        is_sports_instructor: form.is_sports_instructor,
        range_officer_number: form.range_officer_number || null,
        shooting_patent_number: form.shooting_patent_number || null,
      })
      .eq('id', member.id)

    setSaving(false)
    if (dbError) {
      setError('Błąd zapisu: ' + dbError.message)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) return <div className="p-8 text-center text-muted">Ładowanie...</div>
  if (!member) return null

  const inputClass = "w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-primary"

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <Link href="/" className="inline-flex items-center gap-2 text-muted hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Strona główna
      </Link>

      <div className="bg-card border border-border rounded-xl p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl mx-auto mb-3">
            {member.full_name.charAt(0)}
          </div>
          <h1 className="text-2xl font-bold">Mój profil</h1>
          <p className="text-sm text-muted mt-1">{member.email}</p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
              Klasa {member.class}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted/20 text-muted font-medium">
              {member.role}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-sm text-muted block mb-1">Imię i nazwisko</label>
            <input type="text" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className={inputClass} />
          </div>

          <div>
            <label className="text-sm text-muted block mb-1">Telefon</label>
            <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+48 123 456 789" className={inputClass} />
          </div>

          <div>
            <label className="text-sm text-muted block mb-1">Numer licencji</label>
            <input type="text" value={form.license_number} onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))} placeholder="PL-2024-XXX" className={inputClass} />
          </div>

          <div>
            <label className="text-sm text-muted block mb-1">Klub strzelecki</label>
            <input type="text" value={form.club_name} onChange={e => setForm(f => ({ ...f, club_name: e.target.value }))} className={inputClass} />
          </div>

          {(member.role === 'judge' || member.role === 'admin') && (
            <div>
              <label className="text-sm text-muted block mb-1">Klasa sędziowska</label>
              <select value={form.judge_class} onChange={e => setForm(f => ({ ...f, judge_class: e.target.value }))} className={inputClass}>
                <option value="">Brak</option>
                <option value="klubowa">Klubowa</option>
                <option value="okręgowa">Okręgowa</option>
                <option value="państwowa">Państwowa</option>
                <option value="międzynarodowa">Międzynarodowa</option>
              </select>
            </div>
          )}

          <div className="space-y-3 pt-2 border-t border-border">
            <p className="text-sm font-medium">Uprawnienia i certyfikaty</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.has_weapons_permit} onChange={e => setForm(f => ({ ...f, has_weapons_permit: e.target.checked }))} className="w-4 h-4 accent-primary" />
              <span className="text-sm">Pozwolenie na posiadanie broni</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_range_officer} onChange={e => setForm(f => ({ ...f, is_range_officer: e.target.checked }))} className="w-4 h-4 accent-primary" />
              <span className="text-sm">Prowadzący strzelanie</span>
            </label>
            {form.is_range_officer && (
              <div className="ml-6">
                <label className="text-xs text-muted block mb-1">Numer prowadzącego strzelanie</label>
                <input type="text" value={form.range_officer_number} onChange={e => setForm(f => ({ ...f, range_officer_number: e.target.value }))} placeholder="np. PS-2024-001" className={inputClass} />
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_sports_instructor} onChange={e => setForm(f => ({ ...f, is_sports_instructor: e.target.checked }))} className="w-4 h-4 accent-primary" />
              <span className="text-sm">Instruktor strzelectwa sportowego</span>
            </label>
          </div>

          <div className="pt-2 border-t border-border">
            <label className="text-sm text-muted block mb-1">Numer patentu strzeleckiego</label>
            <input type="text" value={form.shooting_patent_number} onChange={e => setForm(f => ({ ...f, shooting_patent_number: e.target.value }))} placeholder="np. PAT-2024-001" className={inputClass} />
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg p-3">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-primary text-background font-semibold py-3 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4" />
                Zapisano!
              </>
            ) : saving ? 'Zapisywanie...' : (
              <>
                <Save className="w-4 h-4" />
                Zapisz zmiany
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
