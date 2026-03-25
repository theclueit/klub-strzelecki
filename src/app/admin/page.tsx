'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { Shield, Calendar, Target, Users, Plus, Trash2, Pencil, Save, X, UserPlus, ChevronDown, ChevronUp, ClipboardList, Check, Ban, Tag } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Discipline, Member, EventDiscipline } from '@/types/database'

interface EventRow {
  id: string
  title: string
  description: string | null
  event_type: string
  discipline_id: string | null
  start_date: string
  end_date: string | null
  location: string | null
  max_participants: number | null
  price_pln: number
  is_published: boolean
}

interface EventJudge {
  id: string
  event_id: string
  judge_id: string
}

interface GuestReg {
  id: string
  event_id: string
  full_name: string
  email: string
  phone: string | null
  experience: string | null
  has_license: boolean
  license_number: string | null
  message: string | null
  registered_at: string
  status: string
}

interface RegDiscipline {
  id: string
  event_discipline_id: string
  member_registration_id: string | null
  guest_registration_id: string | null
}

type Tab = 'events' | 'disciplines' | 'judges' | 'registrations'

export default function AdminPage() {
  const { member, loading } = useAuth()
  const router = useRouter()
  const supabase = createSupabaseBrowser()

  const [tab, setTab] = useState<Tab>('events')
  const [events, setEvents] = useState<EventRow[]>([])
  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [judges, setJudges] = useState<Member[]>([])
  const [eventJudges, setEventJudges] = useState<EventJudge[]>([])
  const [allMembers, setAllMembers] = useState<Member[]>([])
  const [guestRegs, setGuestRegs] = useState<GuestReg[]>([])
  const [memberRegs, setMemberRegs] = useState<{ id: string; event_id: string; member_id: string; registered_at: string; status: string; member?: Member }[]>([])
  const [eventDisciplines, setEventDisciplines] = useState<(EventDiscipline & { discipline?: Discipline })[]>([])
  const [regDisciplines, setRegDisciplines] = useState<RegDiscipline[]>([])

  // Modals
  const [showEventForm, setShowEventForm] = useState(false)
  const [showDisciplineForm, setShowDisciplineForm] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventRow | null>(null)
  const [editingDiscipline, setEditingDiscipline] = useState<Discipline | null>(null)
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)

  // Form states
  const [eventForm, setEventForm] = useState({
    title: '', description: '', event_type: 'competition' as string,
    start_date: '', end_date: '', location: '',
    max_participants: '', is_published: true,
  })
  const [disciplineForm, setDisciplineForm] = useState({
    name: '', description: '', target_type: '' as string,
  })
  // Event disciplines management
  const [editingEventDisciplines, setEditingEventDisciplines] = useState<{ discipline_id: string; price_pln: string }[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading && (!member || member.role !== 'admin')) {
      router.push('/')
      return
    }
    if (member?.role === 'admin') loadAll()
  }, [member, loading])

  async function loadAll() {
    const [evRes, discRes, judgesRes, ejRes, membersRes, guestRes, memberRegsRes, edRes, rdRes] = await Promise.all([
      supabase.from('events').select('*').order('start_date', { ascending: false }),
      supabase.from('disciplines').select('*').order('name'),
      supabase.from('members').select('*').in('role', ['judge', 'admin']).order('full_name'),
      supabase.from('event_judges').select('*'),
      supabase.from('members').select('*').eq('is_active', true).order('full_name'),
      supabase.from('guest_registrations').select('*').order('registered_at', { ascending: false }),
      supabase.from('event_registrations').select('*, member:members(full_name, email, license_number)').order('registered_at', { ascending: false }),
      supabase.from('event_disciplines').select('*, discipline:disciplines(*)').order('price_pln'),
      supabase.from('registration_disciplines').select('*'),
    ])
    setEvents((evRes.data ?? []) as EventRow[])
    setDisciplines((discRes.data ?? []) as Discipline[])
    setJudges((judgesRes.data ?? []) as Member[])
    setEventJudges((ejRes.data ?? []) as EventJudge[])
    setAllMembers((membersRes.data ?? []) as Member[])
    setGuestRegs((guestRes.data ?? []) as GuestReg[])
    setMemberRegs((memberRegsRes.data ?? []) as any[])
    setEventDisciplines((edRes.data ?? []) as any[])
    setRegDisciplines((rdRes.data ?? []) as RegDiscipline[])
  }

  // ---- EVENTS ----
  function getEventDiscs(eventId: string) {
    return eventDisciplines.filter(ed => ed.event_id === eventId)
  }

  function openNewEvent() {
    setEditingEvent(null)
    setEventForm({
      title: '', description: '', event_type: 'competition',
      start_date: '', end_date: '',
      location: 'Strzelnica klubowa', max_participants: '30', is_published: true,
    })
    setEditingEventDisciplines([])
    setShowEventForm(true)
    setError('')
  }

  function openEditEvent(ev: EventRow) {
    setEditingEvent(ev)
    setEventForm({
      title: ev.title,
      description: ev.description ?? '',
      event_type: ev.event_type,
      start_date: ev.start_date ? new Date(ev.start_date).toISOString().slice(0, 16) : '',
      end_date: ev.end_date ? new Date(ev.end_date).toISOString().slice(0, 16) : '',
      location: ev.location ?? '',
      max_participants: ev.max_participants?.toString() ?? '',
      is_published: ev.is_published,
    })
    // Load existing event disciplines into form
    const existing = getEventDiscs(ev.id)
    setEditingEventDisciplines(existing.map(ed => ({
      discipline_id: ed.discipline_id,
      price_pln: ed.price_pln.toString(),
    })))
    setShowEventForm(true)
    setError('')
  }

  function addDisciplineToEvent() {
    // Find first discipline not yet added
    const used = new Set(editingEventDisciplines.map(d => d.discipline_id))
    const available = disciplines.filter(d => !used.has(d.id))
    if (available.length === 0) return
    setEditingEventDisciplines(prev => [...prev, { discipline_id: available[0].id, price_pln: '0' }])
  }

  function removeDisciplineFromEvent(index: number) {
    setEditingEventDisciplines(prev => prev.filter((_, i) => i !== index))
  }

  function updateEventDiscipline(index: number, field: 'discipline_id' | 'price_pln', value: string) {
    setEditingEventDisciplines(prev => prev.map((d, i) => i === index ? { ...d, [field]: value } : d))
  }

  async function saveEvent(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      title: eventForm.title,
      description: eventForm.description || null,
      event_type: eventForm.event_type,
      discipline_id: null,
      start_date: new Date(eventForm.start_date).toISOString(),
      end_date: eventForm.end_date ? new Date(eventForm.end_date).toISOString() : null,
      location: eventForm.location || null,
      max_participants: eventForm.max_participants ? parseInt(eventForm.max_participants) : null,
      price_pln: 0,
      is_published: eventForm.is_published,
    }

    let eventId: string
    if (editingEvent) {
      const { error: err } = await supabase.from('events').update(payload).eq('id', editingEvent.id)
      if (err) { setError(err.message); setSaving(false); return }
      eventId = editingEvent.id
    } else {
      const { data, error: err } = await supabase.from('events').insert(payload).select('id').single()
      if (err || !data) { setError(err?.message ?? 'Błąd tworzenia wydarzenia'); setSaving(false); return }
      eventId = data.id
    }

    // Sync event_disciplines: delete old, insert new
    await supabase.from('event_disciplines').delete().eq('event_id', eventId)

    if (editingEventDisciplines.length > 0) {
      const rows = editingEventDisciplines.map(d => ({
        event_id: eventId,
        discipline_id: d.discipline_id,
        price_pln: parseFloat(d.price_pln) || 0,
      }))
      const { error: edErr } = await supabase.from('event_disciplines').insert(rows)
      if (edErr) { setError('Wydarzenie zapisane, ale błąd dyscyplin: ' + edErr.message); setSaving(false); loadAll(); return }
    }

    // If event just got published, notify all unnotified judges
    const wasPublished = editingEvent ? !editingEvent.is_published && eventForm.is_published : false
    if (wasPublished || (!editingEvent && eventForm.is_published)) {
      const { data: ejRows } = await supabase
        .from('event_judges')
        .select('id')
        .eq('event_id', eventId)
        .is('notified_at', null)
      if (ejRows) {
        for (const ej of ejRows) {
          notifyJudge(ej.id)
        }
      }
    }

    setSaving(false)
    setShowEventForm(false)
    loadAll()
  }

  async function deleteEvent(id: string) {
    if (!confirm('Na pewno usunąć to wydarzenie?')) return
    await supabase.from('events').delete().eq('id', id)
    loadAll()
  }

  // ---- DISCIPLINES ----
  function openNewDiscipline() {
    setEditingDiscipline(null)
    setDisciplineForm({ name: '', description: '', target_type: '' })
    setShowDisciplineForm(true)
    setError('')
  }

  function openEditDiscipline(d: Discipline) {
    setEditingDiscipline(d)
    setDisciplineForm({
      name: d.name,
      description: d.description ?? '',
      target_type: d.target_type ?? '',
    })
    setShowDisciplineForm(true)
    setError('')
  }

  async function saveDiscipline(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      name: disciplineForm.name,
      description: disciplineForm.description || null,
      target_type: disciplineForm.target_type || null,
    }

    let err
    if (editingDiscipline) {
      ({ error: err } = await supabase.from('disciplines').update(payload).eq('id', editingDiscipline.id))
    } else {
      ({ error: err } = await supabase.from('disciplines').insert(payload))
    }

    setSaving(false)
    if (err) { setError(err.message); return }
    setShowDisciplineForm(false)
    loadAll()
  }

  async function deleteDiscipline(id: string) {
    if (!confirm('Na pewno usunąć tę dyscyplinę?')) return
    const { error: err } = await supabase.from('disciplines').delete().eq('id', id)
    if (err) { alert('Nie można usunąć — dyscyplina jest przypisana do wydarzeń lub wyników.'); return }
    loadAll()
  }

  // ---- JUDGES ASSIGNMENT ----
  async function notifyJudge(eventJudgeId: string) {
    try {
      await fetch('/api/judge-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_judge_id: eventJudgeId }),
      })
    } catch {
      // Notification is best-effort; don't block the UI
    }
  }

  async function assignJudge(eventId: string, judgeId: string) {
    const { data } = await supabase.from('event_judges').insert({ event_id: eventId, judge_id: judgeId }).select('id').single()
    // If event is published, send email notification immediately
    const ev = events.find(e => e.id === eventId)
    if (data && ev?.is_published) {
      notifyJudge(data.id)
    }
    loadAll()
  }

  async function removeJudge(eventId: string, judgeId: string) {
    await supabase.from('event_judges').delete().eq('event_id', eventId).eq('judge_id', judgeId)
    loadAll()
  }

  async function promoteToJudge(memberId: string) {
    await supabase.from('members').update({ role: 'judge' }).eq('id', memberId)
    loadAll()
  }

  function getEventJudges(eventId: string) {
    return eventJudges
      .filter(ej => ej.event_id === eventId)
      .map(ej => judges.find(j => j.id === ej.judge_id))
      .filter(Boolean) as Member[]
  }

  function getAvailableJudges(eventId: string) {
    const assigned = new Set(eventJudges.filter(ej => ej.event_id === eventId).map(ej => ej.judge_id))
    return judges.filter(j => !assigned.has(j.id))
  }

  // ---- HELPERS for registrations tab ----
  function getRegDisciplineNames(regId: string, type: 'member' | 'guest') {
    const rds = regDisciplines.filter(rd =>
      type === 'member' ? rd.member_registration_id === regId : rd.guest_registration_id === regId
    )
    return rds.map(rd => {
      const ed = eventDisciplines.find(e => e.id === rd.event_discipline_id)
      return ed?.discipline?.name ?? '?'
    })
  }

  function getRegTotal(regId: string, type: 'member' | 'guest') {
    const rds = regDisciplines.filter(rd =>
      type === 'member' ? rd.member_registration_id === regId : rd.guest_registration_id === regId
    )
    return rds.reduce((sum, rd) => {
      const ed = eventDisciplines.find(e => e.id === rd.event_discipline_id)
      return sum + (ed ? Number(ed.price_pln) : 0)
    }, 0)
  }

  if (loading) return <div className="p-8 text-center text-muted">Ładowanie...</div>
  if (!member || member.role !== 'admin') return null

  const eventTypeLabels: Record<string, string> = {
    competition: 'Zawody', training: 'Trening', course: 'Kurs', other: 'Inne',
  }

  const inputClass = "w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:border-primary text-sm"

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="w-8 h-8 text-primary" />
        <h1 className="text-3xl font-bold">Panel administracyjny</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-border overflow-x-auto">
        {[
          { key: 'events' as Tab, label: 'Zawody / Wydarzenia', icon: Calendar },
          { key: 'disciplines' as Tab, label: 'Dyscypliny', icon: Target },
          { key: 'registrations' as Tab, label: 'Zgłoszenia', icon: ClipboardList },
          { key: 'judges' as Tab, label: 'Sędziowie', icon: Users },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ============ EVENTS TAB ============ */}
      {tab === 'events' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Wszystkie wydarzenia ({events.length})</h2>
            <button onClick={openNewEvent} className="flex items-center gap-2 px-4 py-2 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors">
              <Plus className="w-4 h-4" />
              Nowe wydarzenie
            </button>
          </div>

          <div className="space-y-3">
            {events.map(ev => {
              const evDiscs = getEventDiscs(ev.id)
              const assigned = getEventJudges(ev.id)
              const available = getAvailableJudges(ev.id)
              const isExpanded = expandedEvent === ev.id
              const totalPrice = evDiscs.reduce((s, d) => s + Number(d.price_pln), 0)

              return (
                <div key={ev.id} className="bg-card border border-border rounded-xl">
                  <div className="p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                          {eventTypeLabels[ev.event_type]}
                        </span>
                        {evDiscs.map(ed => (
                          <span key={ed.id} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium">
                            {ed.discipline?.name} — {Number(ed.price_pln).toFixed(0)} zł
                          </span>
                        ))}
                        {!ev.is_published && <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning">Ukryte</span>}
                      </div>
                      <h3 className="font-semibold">{ev.title}</h3>
                      <p className="text-xs text-muted">
                        {new Date(ev.start_date).toLocaleDateString('pl')} &middot; {ev.location}
                        {evDiscs.length > 0 && ` · ${evDiscs.length} dyscyplin`}
                        {totalPrice > 0 && ` · suma: ${totalPrice.toFixed(0)} zł`}
                        {ev.max_participants && ` · max ${ev.max_participants} os.`}
                      </p>
                      {assigned.length > 0 && (
                        <p className="text-xs text-muted mt-1">
                          Sędziowie: {assigned.map(j => j.full_name).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setExpandedEvent(isExpanded ? null : ev.id)} className="p-2 text-muted hover:text-foreground rounded-lg hover:bg-card-hover" title="Sędziowie">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <button onClick={() => openEditEvent(ev)} className="p-2 text-muted hover:text-primary rounded-lg hover:bg-card-hover" title="Edytuj">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteEvent(ev.id)} className="p-2 text-muted hover:text-danger rounded-lg hover:bg-card-hover" title="Usuń">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Judge assignment panel */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-border">
                      <p className="text-sm font-medium mb-2">Przypisani sędziowie:</p>
                      {assigned.length === 0 ? (
                        <p className="text-xs text-muted mb-2">Brak przypisanych sędziów.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {assigned.map(j => (
                            <span key={j.id} className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium">
                              {j.full_name}
                              <button onClick={() => removeJudge(ev.id, j.id)} className="hover:text-danger">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      {available.length > 0 && (
                        <div>
                          <p className="text-xs text-muted mb-1">Dodaj sędziego:</p>
                          <div className="flex flex-wrap gap-1">
                            {available.map(j => (
                              <button
                                key={j.id}
                                onClick={() => assignJudge(ev.id, j.id)}
                                className="inline-flex items-center gap-1 px-3 py-1 border border-border text-xs rounded-full hover:border-primary hover:text-primary transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                {j.full_name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Event Form Modal */}
          {showEventForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <h2 className="text-lg font-bold mb-4">{editingEvent ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'}</h2>
                <form onSubmit={saveEvent} className="space-y-4">
                  <div>
                    <label className="text-xs text-muted block mb-1">Nazwa *</label>
                    <input required value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Opis</label>
                    <textarea value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} rows={2} className={inputClass + ' resize-none'} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">Typ</label>
                      <select value={eventForm.event_type} onChange={e => setEventForm(f => ({ ...f, event_type: e.target.value }))} className={inputClass}>
                        <option value="competition">Zawody</option>
                        <option value="training">Trening</option>
                        <option value="course">Kurs</option>
                        <option value="other">Inne</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Max uczestników</label>
                      <input type="number" value={eventForm.max_participants} onChange={e => setEventForm(f => ({ ...f, max_participants: e.target.value }))} className={inputClass} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">Start *</label>
                      <input required type="datetime-local" value={eventForm.start_date} onChange={e => setEventForm(f => ({ ...f, start_date: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Koniec</label>
                      <input type="datetime-local" value={eventForm.end_date} onChange={e => setEventForm(f => ({ ...f, end_date: e.target.value }))} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Lokalizacja</label>
                    <input value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} className={inputClass} />
                  </div>

                  {/* ---- Disciplines with prices ---- */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium flex items-center gap-1">
                        <Target className="w-4 h-4 text-primary" />
                        Dyscypliny i ceny
                      </label>
                      <button
                        type="button"
                        onClick={addDisciplineToEvent}
                        disabled={editingEventDisciplines.length >= disciplines.length}
                        className="flex items-center gap-1 text-xs px-2 py-1 text-primary hover:bg-primary/10 rounded transition-colors disabled:opacity-30"
                      >
                        <Plus className="w-3 h-3" />
                        Dodaj dyscyplinę
                      </button>
                    </div>

                    {editingEventDisciplines.length === 0 ? (
                      <p className="text-xs text-muted py-2">Brak dyscyplin. Dodaj dyscyplinę, aby ustawić cenę startu.</p>
                    ) : (
                      <div className="space-y-2">
                        {editingEventDisciplines.map((ed, idx) => {
                          const usedIds = editingEventDisciplines.filter((_, i) => i !== idx).map(d => d.discipline_id)
                          return (
                            <div key={idx} className="flex items-center gap-2">
                              <select
                                value={ed.discipline_id}
                                onChange={e => updateEventDiscipline(idx, 'discipline_id', e.target.value)}
                                className={inputClass + ' flex-1'}
                              >
                                {disciplines.filter(d => !usedIds.includes(d.id) || d.id === ed.discipline_id).map(d => (
                                  <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                              </select>
                              <div className="relative w-28 flex-shrink-0">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={ed.price_pln}
                                  onChange={e => updateEventDiscipline(idx, 'price_pln', e.target.value)}
                                  className={inputClass + ' pr-8'}
                                  placeholder="0"
                                />
                                <span className="absolute right-3 top-2.5 text-xs text-muted">zł</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeDisciplineFromEvent(idx)}
                                className="p-2 text-muted hover:text-danger rounded hover:bg-card-hover flex-shrink-0"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )
                        })}
                        {editingEventDisciplines.length > 1 && (
                          <p className="text-xs text-muted text-right">
                            Suma za wszystkie dyscypliny: <span className="font-semibold text-foreground">
                              {editingEventDisciplines.reduce((s, d) => s + (parseFloat(d.price_pln) || 0), 0).toFixed(0)} zł
                            </span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={eventForm.is_published} onChange={e => setEventForm(f => ({ ...f, is_published: e.target.checked }))} className="w-4 h-4 accent-primary" />
                    <span className="text-sm">Opublikowane (widoczne w kalendarzu)</span>
                  </label>

                  {error && <p className="text-sm text-danger">{error}</p>}

                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark disabled:opacity-50">
                      <Save className="w-4 h-4" />
                      {saving ? 'Zapisywanie...' : 'Zapisz'}
                    </button>
                    <button type="button" onClick={() => setShowEventForm(false)} className="px-4 py-2.5 border border-border text-sm rounded-lg hover:bg-card-hover">
                      Anuluj
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ DISCIPLINES TAB ============ */}
      {tab === 'disciplines' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Dyscypliny ({disciplines.length})</h2>
            <button onClick={openNewDiscipline} className="flex items-center gap-2 px-4 py-2 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors">
              <Plus className="w-4 h-4" />
              Nowa dyscyplina
            </button>
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-sm text-muted">
                  <th className="text-left px-4 py-3">Nazwa</th>
                  <th className="text-left px-4 py-3">Opis</th>
                  <th className="text-left px-4 py-3">Typ tarczy</th>
                  <th className="text-right px-4 py-3 w-24">Akcje</th>
                </tr>
              </thead>
              <tbody>
                {disciplines.map(d => (
                  <tr key={d.id} className="border-b border-border/50 hover:bg-card-hover">
                    <td className="px-4 py-3 font-medium text-sm">{d.name}</td>
                    <td className="px-4 py-3 text-sm text-muted">{d.description ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-muted">{d.target_type ?? '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditDiscipline(d)} className="p-1.5 text-muted hover:text-primary rounded hover:bg-card-hover">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteDiscipline(d.id)} className="p-1.5 text-muted hover:text-danger rounded hover:bg-card-hover">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Discipline Form Modal */}
          {showDisciplineForm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
                <h2 className="text-lg font-bold mb-4">{editingDiscipline ? 'Edytuj dyscyplinę' : 'Nowa dyscyplina'}</h2>
                <form onSubmit={saveDiscipline} className="space-y-4">
                  <div>
                    <label className="text-xs text-muted block mb-1">Nazwa *</label>
                    <input required value={disciplineForm.name} onChange={e => setDisciplineForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Opis</label>
                    <textarea value={disciplineForm.description} onChange={e => setDisciplineForm(f => ({ ...f, description: e.target.value }))} rows={2} className={inputClass + ' resize-none'} />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Typ tarczy</label>
                    <select value={disciplineForm.target_type} onChange={e => setDisciplineForm(f => ({ ...f, target_type: e.target.value }))} className={inputClass}>
                      <option value="">Brak</option>
                      <option value="pistol_10m">Pistolet 10m</option>
                      <option value="pistol_25m">Pistolet 25m</option>
                      <option value="pistol_50m">Pistolet 50m</option>
                      <option value="rifle">Karabin</option>
                      <option value="ipsc">IPSC</option>
                      <option value="benchrest">Benchrest</option>
                      <option value="other">Inne</option>
                    </select>
                  </div>

                  {error && <p className="text-sm text-danger">{error}</p>}

                  <div className="flex gap-2">
                    <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark disabled:opacity-50">
                      <Save className="w-4 h-4" />
                      {saving ? 'Zapisywanie...' : 'Zapisz'}
                    </button>
                    <button type="button" onClick={() => setShowDisciplineForm(false)} className="px-4 py-2.5 border border-border text-sm rounded-lg hover:bg-card-hover">
                      Anuluj
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============ JUDGES TAB ============ */}
      {tab === 'judges' && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Sędziowie ({judges.length})</h2>

          <div className="bg-card border border-border rounded-xl overflow-hidden mb-8">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-sm text-muted">
                  <th className="text-left px-4 py-3">Nazwisko</th>
                  <th className="text-left px-4 py-3">Licencja</th>
                  <th className="text-left px-4 py-3">Rola</th>
                  <th className="text-left px-4 py-3">Przypisane zawody</th>
                </tr>
              </thead>
              <tbody>
                {judges.map(j => {
                  const assignedEvents = eventJudges
                    .filter(ej => ej.judge_id === j.id)
                    .map(ej => events.find(ev => ev.id === ej.event_id))
                    .filter(Boolean)
                  return (
                    <tr key={j.id} className="border-b border-border/50 hover:bg-card-hover">
                      <td className="px-4 py-3 font-medium text-sm">{j.full_name}</td>
                      <td className="px-4 py-3 text-sm text-muted">{j.license_number}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${j.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-blue-500/20 text-blue-400'}`}>
                          {j.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted">
                        {assignedEvents.length === 0 ? '-' : assignedEvents.map(e => e!.title).join(', ')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <h3 className="text-md font-semibold mb-3">Awansuj członka na sędziego</h3>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
              {allMembers.filter(m => m.role === 'member').map(m => (
                <button
                  key={m.id}
                  onClick={() => promoteToJudge(m.id)}
                  className="flex items-center gap-3 px-3 py-2 border border-border rounded-lg hover:border-primary/30 transition-colors text-left text-sm"
                >
                  <UserPlus className="w-4 h-4 text-muted flex-shrink-0" />
                  <div>
                    <div className="font-medium">{m.full_name}</div>
                    <div className="text-xs text-muted">{m.license_number}</div>
                  </div>
                </button>
              ))}
            </div>
            {allMembers.filter(m => m.role === 'member').length === 0 && (
              <p className="text-sm text-muted">Wszyscy członkowie mają już rolę sędziego lub admina.</p>
            )}
          </div>
        </div>
      )}

      {/* ============ REGISTRATIONS TAB ============ */}
      {tab === 'registrations' && (
        <div>
          <h2 className="text-lg font-semibold mb-4">
            Zgłoszenia na wydarzenia
          </h2>

          {events.map(ev => {
            const evMemberRegs = memberRegs.filter(r => r.event_id === ev.id)
            const evGuestRegs = guestRegs.filter(r => r.event_id === ev.id)
            const total = evMemberRegs.length + evGuestRegs.length
            if (total === 0) return null

            return (
              <div key={ev.id} className="mb-6">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  {ev.title}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                    {total} {total === 1 ? 'zgłoszenie' : total < 5 ? 'zgłoszenia' : 'zgłoszeń'}
                  </span>
                </h3>

                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted">
                        <th className="text-left px-4 py-2">Typ</th>
                        <th className="text-left px-4 py-2">Nazwisko</th>
                        <th className="text-left px-4 py-2">Dyscypliny</th>
                        <th className="text-left px-4 py-2">Kwota</th>
                        <th className="text-left px-4 py-2">Status</th>
                        <th className="text-right px-4 py-2">Akcje</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evMemberRegs.map(r => {
                        const discNames = getRegDisciplineNames(r.id, 'member')
                        const total = getRegTotal(r.id, 'member')
                        return (
                          <tr key={r.id} className="border-b border-border/50 hover:bg-card-hover text-sm">
                            <td className="px-4 py-2">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">Członek</span>
                            </td>
                            <td className="px-4 py-2 font-medium">{(r.member as any)?.full_name ?? '-'}</td>
                            <td className="px-4 py-2 text-muted text-xs">{discNames.length > 0 ? discNames.join(', ') : '-'}</td>
                            <td className="px-4 py-2 text-muted">{total > 0 ? `${total.toFixed(0)} zł` : '-'}</td>
                            <td className="px-4 py-2">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-success/20 text-success">{r.status}</span>
                            </td>
                            <td className="px-4 py-2 text-right">-</td>
                          </tr>
                        )
                      })}
                      {evGuestRegs.map(r => {
                        const discNames = getRegDisciplineNames(r.id, 'guest')
                        const total = getRegTotal(r.id, 'guest')
                        return (
                          <tr key={r.id} className="border-b border-border/50 hover:bg-card-hover text-sm">
                            <td className="px-4 py-2">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">Gość</span>
                            </td>
                            <td className="px-4 py-2 font-medium">
                              {r.full_name}
                              {r.has_license && <span className="text-xs text-muted ml-1">(lic: {r.license_number})</span>}
                            </td>
                            <td className="px-4 py-2 text-muted text-xs">{discNames.length > 0 ? discNames.join(', ') : '-'}</td>
                            <td className="px-4 py-2 text-muted">{total > 0 ? `${total.toFixed(0)} zł` : '-'}</td>
                            <td className="px-4 py-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                r.status === 'confirmed' ? 'bg-success/20 text-success' :
                                r.status === 'cancelled' ? 'bg-danger/20 text-danger' :
                                'bg-warning/20 text-warning'
                              }`}>{r.status === 'pending' ? 'oczekuje' : r.status === 'confirmed' ? 'potwierdzony' : 'anulowany'}</span>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {r.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={async () => { await supabase.from('guest_registrations').update({ status: 'confirmed' }).eq('id', r.id); loadAll() }}
                                      className="p-1.5 text-muted hover:text-success rounded hover:bg-card-hover" title="Potwierdź"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={async () => { await supabase.from('guest_registrations').update({ status: 'cancelled' }).eq('id', r.id); loadAll() }}
                                      className="p-1.5 text-muted hover:text-danger rounded hover:bg-card-hover" title="Odrzuć"
                                    >
                                      <Ban className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                                {r.status !== 'pending' && (
                                  <button
                                    onClick={async () => { await supabase.from('guest_registrations').update({ status: 'pending' }).eq('id', r.id); loadAll() }}
                                    className="p-1.5 text-xs text-muted hover:text-foreground rounded hover:bg-card-hover"
                                  >
                                    Cofnij
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {evGuestRegs.some(r => r.message) && (
                  <div className="mt-2 space-y-1">
                    {evGuestRegs.filter(r => r.message).map(r => (
                      <p key={r.id} className="text-xs text-muted italic px-2">
                        {r.full_name}: &ldquo;{r.message}&rdquo;
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {events.every(ev => {
            const total = memberRegs.filter(r => r.event_id === ev.id).length + guestRegs.filter(r => r.event_id === ev.id).length
            return total === 0
          }) && (
            <p className="text-muted">Brak zgłoszeń na żadne wydarzenie.</p>
          )}
        </div>
      )}
    </div>
  )
}
