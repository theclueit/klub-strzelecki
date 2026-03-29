'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { User, Save, ArrowLeft, Check, Award, Calendar, Clock, MapPin, Pencil, ChevronDown, ChevronUp, ExternalLink, Phone, Hash, Shield, Crosshair, Plus, Trash2, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Member, MemberWeapon } from '@/types/database'

function Section({ title, icon: Icon, defaultOpen = false, badge, children }: { title: string; icon: any; defaultOpen?: boolean; badge?: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-card-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary" />
          <span className="font-semibold">{title}</span>
          {badge && <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning font-medium">{badge}</span>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
      </button>
      {open && <div className="px-6 pb-5 border-t border-border pt-4">{children}</div>}
    </div>
  )
}

export default function ProfilePage() {
  const { member, loading, user } = useAuth()
  const router = useRouter()
  const supabase = createSupabaseBrowser()

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    license_number: '',
    club_name: '',
    judge_class: '',
    judge_license_number: '',
    is_range_officer: false,
    has_weapons_permit: false,
    is_sports_instructor: false,
    range_officer_number: '',
    shooting_patent_number: '',
    // New sign-in sheet fields
    pesel: '',
    date_of_birth: '',
    address: '',
    id_document_number: '',
    id_document_type: 'dowod_osobisty',
    weapon_permit_number: '',
    weapon_permit_issuing_authority: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [discStats, setDiscStats] = useState<Record<string, { name: string; count: number; best: number; avg: number }>>({})
  const [totalShots, setTotalShots] = useState(0)
  const [myRegistrations, setMyRegistrations] = useState<any[]>([])

  // Weapons
  const [weapons, setWeapons] = useState<MemberWeapon[]>([])
  const [showWeaponForm, setShowWeaponForm] = useState(false)
  const [editingWeapon, setEditingWeapon] = useState<MemberWeapon | null>(null)
  const [weaponForm, setWeaponForm] = useState({ name: '', type: 'pistolet', caliber: '', serial_number: '', permit_number: '' })
  const [weaponSaving, setWeaponSaving] = useState(false)

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
        judge_license_number: member.judge_license_number ?? '',
        is_range_officer: member.is_range_officer,
        has_weapons_permit: member.has_weapons_permit,
        is_sports_instructor: member.is_sports_instructor,
        range_officer_number: member.range_officer_number ?? '',
        shooting_patent_number: member.shooting_patent_number ?? '',
        pesel: member.pesel ?? '',
        date_of_birth: member.date_of_birth ?? '',
        address: member.address ?? '',
        id_document_number: member.id_document_number ?? '',
        id_document_type: member.id_document_type ?? 'dowod_osobisty',
        weapon_permit_number: member.weapon_permit_number ?? '',
        weapon_permit_issuing_authority: member.weapon_permit_issuing_authority ?? '',
      })
      // Load weapons
      supabase.from('member_weapons').select('*').eq('member_id', member.id).eq('is_active', true).order('created_at').then(({ data }) => {
        setWeapons((data ?? []) as MemberWeapon[])
      })
      supabase
        .from('results')
        .select('total_score, discipline:disciplines(name)')
        .eq('member_id', member.id)
        .then(({ data: results }) => {
          if (!results) return
          setTotalShots(results.length)
          const stats: Record<string, { name: string; count: number; best: number; avg: number }> = {}
          results.forEach((r: any) => {
            const dName = r.discipline?.name ?? 'Inne'
            if (!stats[dName]) stats[dName] = { name: dName, count: 0, best: 0, avg: 0 }
            stats[dName].count++
            stats[dName].best = Math.max(stats[dName].best, r.total_score)
            stats[dName].avg += r.total_score
          })
          Object.values(stats).forEach(d => { d.avg = d.count > 0 ? Math.round(d.avg / d.count) : 0 })
          setDiscStats(stats)
        })
      supabase
        .from('event_registrations')
        .select('id, event_id, registered_at, status, event:events(id, title, start_date, end_date, location, address, event_type)')
        .eq('member_id', member.id)
        .order('registered_at', { ascending: false })
        .then(async ({ data: regs }) => {
          if (!regs || regs.length === 0) { setMyRegistrations([]); return }
          const regIds = regs.map(r => r.id)
          const { data: rdData } = await supabase
            .from('registration_disciplines')
            .select('id, member_registration_id, event_discipline_id, event_discipline_slot_id')
            .in('member_registration_id', regIds)
          const { data: edData } = await supabase
            .from('event_disciplines')
            .select('id, discipline:disciplines(name)')
          const { data: slotData } = await supabase
            .from('event_discipline_slots')
            .select('id, start_time, end_time')

          const edMap = new Map((edData ?? []).map((ed: any) => [ed.id, ed.discipline?.name ?? '?']))
          const slotMap = new Map((slotData ?? []).map((s: any) => [s.id, s]))

          const enriched = regs.map((r: any) => {
            const rds = (rdData ?? []).filter((rd: any) => rd.member_registration_id === r.id)
            const disciplines = rds.map((rd: any) => {
              const slot = rd.event_discipline_slot_id ? slotMap.get(rd.event_discipline_slot_id) : null
              return {
                name: edMap.get(rd.event_discipline_id) ?? '?',
                slot: slot ? { start: slot.start_time, end: slot.end_time } : null,
              }
            })
            return { ...r, disciplines }
          })
          setMyRegistrations(enriched)
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
        judge_license_number: form.judge_license_number || null,
        is_range_officer: form.is_range_officer,
        has_weapons_permit: form.has_weapons_permit,
        is_sports_instructor: form.is_sports_instructor,
        range_officer_number: form.range_officer_number || null,
        shooting_patent_number: form.shooting_patent_number || null,
        pesel: form.pesel || null,
        date_of_birth: form.date_of_birth || null,
        address: form.address || null,
        id_document_number: form.id_document_number || null,
        id_document_type: form.id_document_type || 'dowod_osobisty',
        weapon_permit_number: form.weapon_permit_number || null,
        weapon_permit_issuing_authority: form.weapon_permit_issuing_authority || null,
        data_confirmed_at: new Date().toISOString(),
      })
      .eq('id', member.id)

    setSaving(false)
    if (dbError) {
      setError('Blad zapisu: ' + dbError.message)
      return
    }
    setSaved(true)
    setTimeout(() => { setSaved(false); setEditing(false) }, 1500)
  }

  // Weapons CRUD
  function openAddWeapon() {
    setEditingWeapon(null)
    setWeaponForm({ name: '', type: 'pistolet', caliber: '', serial_number: '', permit_number: '' })
    setShowWeaponForm(true)
  }
  function openEditWeapon(w: MemberWeapon) {
    setEditingWeapon(w)
    setWeaponForm({ name: w.name, type: w.type, caliber: w.caliber, serial_number: w.serial_number, permit_number: w.permit_number ?? '' })
    setShowWeaponForm(true)
  }
  async function saveWeapon(e: React.FormEvent) {
    e.preventDefault()
    if (!member) return
    setWeaponSaving(true)
    const payload = {
      member_id: member.id,
      name: weaponForm.name,
      type: weaponForm.type,
      caliber: weaponForm.caliber,
      serial_number: weaponForm.serial_number,
      permit_number: weaponForm.permit_number || null,
    }
    if (editingWeapon) {
      await supabase.from('member_weapons').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingWeapon.id)
    } else {
      await supabase.from('member_weapons').insert(payload)
    }
    setWeaponSaving(false)
    setShowWeaponForm(false)
    const { data } = await supabase.from('member_weapons').select('*').eq('member_id', member.id).eq('is_active', true).order('created_at')
    setWeapons((data ?? []) as MemberWeapon[])
  }
  async function deleteWeapon(id: string) {
    if (!confirm('Usunac bron z listy?')) return
    await supabase.from('member_weapons').update({ is_active: false }).eq('id', id)
    setWeapons(prev => prev.filter(w => w.id !== id))
  }

  if (loading) return <div className="p-8 text-center text-muted">Ladowanie...</div>
  if (!member) return null

  const inputClass = "w-full bg-background border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted focus:outline-none focus:border-primary"

  const badges: { label: string; color: string }[] = []
  if (member.role === 'judge' || member.role === 'admin' || member.role === 'superadmin') {
    badges.push({ label: member.judge_class ? `Sedzia ${member.judge_class}` : 'Sedzia', color: 'bg-primary/20 text-primary' })
  }
  if (member.is_range_officer) badges.push({ label: 'Prowadzacy strzelanie', color: 'bg-blue-500/20 text-blue-400' })
  if (member.has_weapons_permit) badges.push({ label: 'Pozwolenie na bron', color: 'bg-success/20 text-success' })
  if (member.is_sports_instructor) badges.push({ label: 'Instruktor strzelectwa', color: 'bg-yellow-500/20 text-yellow-400' })

  // Check if profile is complete for sign-in sheet
  const missingFields: string[] = []
  if (!member.pesel) missingFields.push('PESEL')
  if (!member.date_of_birth) missingFields.push('Data urodzenia')
  if (!member.id_document_number) missingFields.push('Nr dokumentu')
  if (!member.address) missingFields.push('Adres')
  if (member.has_weapons_permit && !member.weapon_permit_number) missingFields.push('Nr pozwolenia na bron')

  const docTypeLabels: Record<string, string> = {
    dowod_osobisty: 'Dowod osobisty',
    paszport: 'Paszport',
    karta_pobytu: 'Karta pobytu',
  }

  const upcomingRegs = myRegistrations.filter((r: any) => {
    const ev = r.event
    if (!ev) return false
    return new Date(ev.end_date || ev.start_date) >= new Date()
  })
  const pastRegs = myRegistrations.filter((r: any) => {
    const ev = r.event
    if (!ev) return false
    return new Date(ev.end_date || ev.start_date) < new Date()
  })

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <Link href="/" className="inline-flex items-center gap-2 text-muted hover:text-foreground mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Strona glowna
      </Link>

      {/* Incomplete profile warning */}
      {missingFields.length > 0 && !editing && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 mb-4">
          <p className="text-sm text-warning font-medium mb-1">Uzupelnij profil przed zawodami</p>
          <p className="text-xs text-warning/80 mb-2">
            Na listy do podpisu na strzelnicy wymagane sa: {missingFields.join(', ')}
          </p>
          <button onClick={() => setEditing(true)} className="text-xs text-warning font-semibold underline hover:no-underline">
            Uzupelnij teraz
          </button>
        </div>
      )}

      {/* Profile header */}
      <div className="bg-card border border-border rounded-xl p-8 mb-4">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl flex-shrink-0">
            {member.full_name.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">{member.full_name}</h1>
              {!editing && (
                <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-xs text-muted hover:text-primary px-3 py-1.5 border border-border rounded-lg hover:bg-card-hover transition-colors">
                  <Pencil className="w-3.5 h-3.5" />
                  Edytuj
                </button>
              )}
            </div>
            <p className="text-sm text-muted">{member.email}</p>
            {badges.length > 0 && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">Klasa {member.class}</span>
                {badges.map(b => (
                  <span key={b.label} className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.color}`}>{b.label}</span>
                ))}
              </div>
            )}
            {member.data_confirmed_at && (
              <p className="text-xs text-muted mt-1">
                Dane potwierdzone: {new Date(member.data_confirmed_at).toLocaleDateString('pl')}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {/* View mode - data in collapsible sections */}
        {!editing && (
          <>
            <Section title="Dane osobowe i kontaktowe" icon={Phone} defaultOpen={false} badge={(!member.pesel || !member.address || !member.date_of_birth) ? 'Uzupelnij' : undefined}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <p className="text-xs text-muted">Imie i nazwisko</p>
                  <p className="text-sm font-medium">{member.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Telefon</p>
                  <p className="text-sm font-medium">{member.phone || <span className="text-muted italic">nie podano</span>}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">E-mail</p>
                  <p className="text-sm font-medium">{member.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Klub strzelecki</p>
                  <p className="text-sm font-medium">{member.club_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">PESEL</p>
                  <p className="text-sm font-medium">{member.pesel || <span className="text-muted italic">nie podano</span>}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Data urodzenia</p>
                  <p className="text-sm font-medium">{member.date_of_birth ? new Date(member.date_of_birth).toLocaleDateString('pl') : <span className="text-muted italic">nie podano</span>}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted">Adres zamieszkania</p>
                  <p className="text-sm font-medium">{member.address || <span className="text-muted italic">nie podano</span>}</p>
                </div>
              </div>
            </Section>

            <Section title="Dokument tozsamosci" icon={FileText} defaultOpen={false} badge={!member.id_document_number ? 'Uzupelnij' : undefined}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <p className="text-xs text-muted">Typ dokumentu</p>
                  <p className="text-sm font-medium">{docTypeLabels[member.id_document_type ?? ''] ?? 'Dowod osobisty'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Numer dokumentu</p>
                  <p className="text-sm font-medium">{member.id_document_number || <span className="text-muted italic">nie podano</span>}</p>
                </div>
              </div>
            </Section>

            <Section title="Numery i identyfikatory" icon={Hash} defaultOpen={false}>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <p className="text-xs text-muted">Nr licencji zawodniczej</p>
                  <p className="text-sm font-medium">{member.license_number || <span className="text-muted italic">nie podano</span>}</p>
                </div>
                {(member.role === 'judge' || member.role === 'admin' || member.role === 'superadmin') && (
                  <div>
                    <p className="text-xs text-muted">Nr licencji sedziowskiej</p>
                    <p className="text-sm font-medium">{member.judge_license_number || <span className="text-muted italic">nie podano</span>}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted">Nr prowadzacego strzelanie</p>
                  <p className="text-sm font-medium">{member.range_officer_number || <span className="text-muted italic">nie podano</span>}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Nr patentu strzeleckiego</p>
                  <p className="text-sm font-medium">{member.shooting_patent_number || <span className="text-muted italic">nie podano</span>}</p>
                </div>
                {(member.role === 'judge' || member.role === 'admin' || member.role === 'superadmin') && member.judge_class && (
                  <div>
                    <p className="text-xs text-muted">Klasa sedziowska</p>
                    <p className="text-sm font-medium">{member.judge_class}</p>
                  </div>
                )}
              </div>
            </Section>

            <Section title="Uprawnienia i pozwolenie na bron" icon={Shield} defaultOpen={false} badge={member.has_weapons_permit && !member.weapon_permit_number ? 'Uzupelnij' : undefined}>
              <div className="flex flex-wrap gap-3 mb-3">
                <div className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full ${member.has_weapons_permit ? 'bg-success' : 'bg-muted/30'}`} />
                  <span className={member.has_weapons_permit ? '' : 'text-muted'}>Pozwolenie na bron</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full ${member.is_range_officer ? 'bg-success' : 'bg-muted/30'}`} />
                  <span className={member.is_range_officer ? '' : 'text-muted'}>Prowadzacy strzelanie</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full ${member.is_sports_instructor ? 'bg-success' : 'bg-muted/30'}`} />
                  <span className={member.is_sports_instructor ? '' : 'text-muted'}>Instruktor strzelectwa</span>
                </div>
              </div>
              {member.has_weapons_permit && (
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-3 border-t border-border/50">
                  <div>
                    <p className="text-xs text-muted">Nr pozwolenia na bron</p>
                    <p className="text-sm font-medium">{member.weapon_permit_number || <span className="text-muted italic">nie podano</span>}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Organ wydajacy</p>
                    <p className="text-sm font-medium">{member.weapon_permit_issuing_authority || <span className="text-muted italic">nie podano</span>}</p>
                  </div>
                </div>
              )}
            </Section>

            {/* Own weapons */}
            <Section title={`Moja bron (${weapons.length})`} icon={Crosshair} defaultOpen={false}>
              {weapons.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm text-muted mb-3">Nie dodano jeszcze broni.</p>
                  {member.has_weapons_permit && (
                    <p className="text-xs text-muted mb-3">Dodaj bron, aby dane byly automatycznie uzupelniane na listach do podpisu.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 mb-3">
                  {weapons.map(w => (
                    <div key={w.id} className="flex items-center justify-between bg-background/50 border border-border/50 rounded-lg px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">{w.name}</p>
                        <p className="text-xs text-muted">
                          {w.type} &middot; {w.caliber} &middot; S/N: {w.serial_number}
                          {w.permit_number && <> &middot; Pozw: {w.permit_number}</>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditWeapon(w)} className="p-1.5 text-muted hover:text-primary rounded hover:bg-card-hover">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteWeapon(w.id)} className="p-1.5 text-muted hover:text-danger rounded hover:bg-card-hover">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={openAddWeapon} className="flex items-center gap-2 text-sm text-primary hover:text-primary-dark transition-colors">
                <Plus className="w-4 h-4" />
                Dodaj bron
              </button>
            </Section>
          </>
        )}

        {/* Edit form */}
        {editing && (
          <div className="bg-card border border-primary/30 rounded-xl p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              Edytuj profil
            </h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <Section title="Dane osobowe i kontaktowe" icon={Phone} defaultOpen={true}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted block mb-1">Imie i nazwisko *</label>
                    <input type="text" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Telefon</label>
                    <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+48 123 456 789" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">PESEL</label>
                    <input type="text" value={form.pesel} onChange={e => setForm(f => ({ ...f, pesel: e.target.value.replace(/\D/g, '').slice(0, 11) }))} placeholder="12345678901" maxLength={11} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Data urodzenia</label>
                    <input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))} className={inputClass} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-xs text-muted block mb-1">Adres zamieszkania</label>
                  <input type="text" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="ul. Strzelecka 1, 00-001 Warszawa" className={inputClass} />
                </div>
                <div className="mt-3">
                  <label className="text-xs text-muted block mb-1">Klub strzelecki</label>
                  <input type="text" value={form.club_name} onChange={e => setForm(f => ({ ...f, club_name: e.target.value }))} className={inputClass} />
                </div>
              </Section>

              <Section title="Dokument tozsamosci" icon={FileText} defaultOpen={!member.id_document_number}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted block mb-1">Typ dokumentu</label>
                    <select value={form.id_document_type} onChange={e => setForm(f => ({ ...f, id_document_type: e.target.value }))} className={inputClass}>
                      <option value="dowod_osobisty">Dowod osobisty</option>
                      <option value="paszport">Paszport</option>
                      <option value="karta_pobytu">Karta pobytu</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Numer dokumentu</label>
                    <input type="text" value={form.id_document_number} onChange={e => setForm(f => ({ ...f, id_document_number: e.target.value }))} placeholder="ABC 123456" className={inputClass} />
                  </div>
                </div>
              </Section>

              <Section title="Numery i identyfikatory" icon={Hash} defaultOpen={false}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted block mb-1">Nr licencji zawodniczej</label>
                    <input type="text" value={form.license_number} onChange={e => setForm(f => ({ ...f, license_number: e.target.value }))} placeholder="PL-2024-XXX" className={inputClass} />
                  </div>
                  {(member.role === 'judge' || member.role === 'admin' || member.role === 'superadmin') && (
                    <div>
                      <label className="text-xs text-muted block mb-1">Nr licencji sedziowskiej</label>
                      <input type="text" value={form.judge_license_number} onChange={e => setForm(f => ({ ...f, judge_license_number: e.target.value }))} placeholder="np. LS-2024-001" className={inputClass} />
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-muted block mb-1">Nr prowadzacego strzelanie</label>
                    <input type="text" value={form.range_officer_number} onChange={e => setForm(f => ({ ...f, range_officer_number: e.target.value }))} placeholder="np. PS-2024-001" className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Nr patentu strzeleckiego</label>
                    <input type="text" value={form.shooting_patent_number} onChange={e => setForm(f => ({ ...f, shooting_patent_number: e.target.value }))} placeholder="np. PAT-2024-001" className={inputClass} />
                  </div>
                </div>
                {(member.role === 'judge' || member.role === 'admin' || member.role === 'superadmin') && (
                  <div className="mt-3">
                    <label className="text-xs text-muted block mb-1">Klasa sedziowska</label>
                    <select value={form.judge_class} onChange={e => setForm(f => ({ ...f, judge_class: e.target.value }))} className={inputClass}>
                      <option value="">Brak</option>
                      <option value="klubowa">Klubowa</option>
                      <option value="okregowa">Okregowa</option>
                      <option value="panstwowa">Panstwowa</option>
                      <option value="miedzynarodowa">Miedzynarodowa</option>
                    </select>
                  </div>
                )}
              </Section>

              <Section title="Uprawnienia i pozwolenie na bron" icon={Shield} defaultOpen={false}>
                <div className="flex flex-wrap gap-4 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.has_weapons_permit} onChange={e => setForm(f => ({ ...f, has_weapons_permit: e.target.checked }))} className="w-4 h-4 accent-primary" />
                    <span className="text-sm">Pozwolenie na bron</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_range_officer} onChange={e => setForm(f => ({ ...f, is_range_officer: e.target.checked }))} className="w-4 h-4 accent-primary" />
                    <span className="text-sm">Prowadzacy strzelanie</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_sports_instructor} onChange={e => setForm(f => ({ ...f, is_sports_instructor: e.target.checked }))} className="w-4 h-4 accent-primary" />
                    <span className="text-sm">Instruktor strzelectwa</span>
                  </label>
                </div>
                {form.has_weapons_permit && (
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/50">
                    <div>
                      <label className="text-xs text-muted block mb-1">Nr pozwolenia na bron</label>
                      <input type="text" value={form.weapon_permit_number} onChange={e => setForm(f => ({ ...f, weapon_permit_number: e.target.value }))} placeholder="np. PA-1234/2024" className={inputClass} />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Organ wydajacy pozwolenie</label>
                      <input type="text" value={form.weapon_permit_issuing_authority} onChange={e => setForm(f => ({ ...f, weapon_permit_issuing_authority: e.target.value }))} placeholder="np. KWP Warszawa" className={inputClass} />
                    </div>
                  </div>
                )}
              </Section>

              {error && (
                <div className="bg-danger/10 border border-danger/30 rounded-lg p-3">
                  <p className="text-sm text-danger">{error}</p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-primary text-background font-semibold py-2.5 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saved ? <><Check className="w-4 h-4" /> Zapisano!</> : saving ? 'Zapisywanie...' : <><Save className="w-4 h-4" /> Zapisz i potwierdz dane</>}
                </button>
                <button type="button" onClick={() => setEditing(false)} className="px-4 py-2.5 border border-border rounded-lg hover:bg-card-hover text-sm">
                  Anuluj
                </button>
              </div>
            </form>
          </div>
        )}

        {/* My registrations */}
        <Section title={`Moje zapisy (${myRegistrations.length})`} icon={Calendar} defaultOpen={true}>
          {myRegistrations.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted mb-3">Nie masz jeszcze zapisow na wydarzenia.</p>
              <Link href="/kalendarz" className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary-dark transition-colors">
                <Calendar className="w-4 h-4" />
                Przejdz do kalendarza
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingRegs.map((reg: any) => {
                const ev = reg.event
                if (!ev) return null
                return (
                  <div key={reg.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-sm">{ev.title}</h3>
                      <div className="flex items-center gap-2">
                        <Link href="/kalendarz" className="text-xs text-primary hover:text-primary-dark flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />
                          Zmien
                        </Link>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-success/20 text-success font-medium">Zapisany</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted mb-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(ev.start_date), 'd MMMM yyyy, HH:mm', { locale: pl })}
                      </span>
                      {ev.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {ev.location}
                        </span>
                      )}
                    </div>
                    {reg.disciplines.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {reg.disciplines.map((d: any, i: number) => (
                          <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            {d.name}
                            {d.slot && (
                              <span className="text-primary/70 flex items-center gap-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                {format(new Date(d.slot.start), 'HH:mm')}-{format(new Date(d.slot.end), 'HH:mm')}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {pastRegs.length > 0 && (
                <div className="pt-2 border-t border-border/50">
                  <p className="text-xs text-muted mb-2">Zakonczone:</p>
                  {pastRegs.map((reg: any) => {
                    const ev = reg.event
                    if (!ev) return null
                    return (
                      <div key={reg.id} className="flex items-center justify-between py-1.5 text-xs text-muted opacity-60">
                        <span>{ev.title}</span>
                        <span>{format(new Date(ev.start_date), 'd MMM yyyy', { locale: pl })}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </Section>

        {/* License renewal summary */}
        <Section title="Podsumowanie do licencji" icon={Award}>
          {Object.keys(discStats).length === 0 ? (
            <p className="text-sm text-muted text-center py-4">Brak wynikow. Pojawi sie po pierwszych zawodach.</p>
          ) : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-xs text-muted">
                    <th className="text-left py-2">Dyscyplina</th>
                    <th className="text-right py-2">Starty</th>
                    <th className="text-right py-2">Najlepszy</th>
                    <th className="text-right py-2">Srednia</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(discStats).map(d => (
                    <tr key={d.name} className="border-b border-border/50">
                      <td className="py-2 font-medium text-sm">{d.name}</td>
                      <td className="py-2 text-right text-sm">{d.count}</td>
                      <td className="py-2 text-right font-mono font-bold">{d.best}</td>
                      <td className="py-2 text-right font-mono text-muted">{d.avg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-muted mt-2">
                Laczna liczba startow: {totalShots} | Sezon: {new Date().getFullYear()}
              </p>
            </>
          )}
        </Section>
      </div>

      {/* Weapon form modal */}
      {showWeaponForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">{editingWeapon ? 'Edytuj bron' : 'Dodaj bron'}</h2>
            <form onSubmit={saveWeapon} className="space-y-3">
              <div>
                <label className="text-xs text-muted block mb-1">Nazwa broni *</label>
                <input required value={weaponForm.name} onChange={e => setWeaponForm(f => ({ ...f, name: e.target.value }))} placeholder="np. Glock 17 Gen5" className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted block mb-1">Rodzaj broni</label>
                  <select value={weaponForm.type} onChange={e => setWeaponForm(f => ({ ...f, type: e.target.value }))} className={inputClass}>
                    <option value="pistolet">Pistolet</option>
                    <option value="rewolwer">Rewolwer</option>
                    <option value="karabinek">Karabinek</option>
                    <option value="karabin">Karabin</option>
                    <option value="strzelba">Strzelba</option>
                    <option value="pistolet_pneumatyczny">Pistolet pneumatyczny</option>
                    <option value="karabinek_pneumatyczny">Karabinek pneumatyczny</option>
                    <option value="inne">Inne</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Kaliber *</label>
                  <input required value={weaponForm.caliber} onChange={e => setWeaponForm(f => ({ ...f, caliber: e.target.value }))} placeholder="np. 9x19mm" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Numer seryjny *</label>
                <input required value={weaponForm.serial_number} onChange={e => setWeaponForm(f => ({ ...f, serial_number: e.target.value }))} placeholder="Nr seryjny broni" className={inputClass} />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Nr pozwolenia (jesli inny)</label>
                <input value={weaponForm.permit_number} onChange={e => setWeaponForm(f => ({ ...f, permit_number: e.target.value }))} placeholder="Nr pozwolenia na te bron" className={inputClass} />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={weaponSaving} className="flex-1 bg-primary text-background font-semibold py-2.5 rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  {editingWeapon ? 'Zapisz' : 'Dodaj'}
                </button>
                <button type="button" onClick={() => setShowWeaponForm(false)} className="px-4 py-2.5 border border-border rounded-lg hover:bg-card-hover text-sm">
                  Anuluj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
