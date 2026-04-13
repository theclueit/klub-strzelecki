'use client'

import { Zap, UserPlus, Printer, DollarSign, Check, Ban, Camera, Hash, ClipboardList } from 'lucide-react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Discipline, EventDiscipline, EventDisciplineSlot, Event } from '@/types/database'
import type { GuestReg, MemberReg, RegDiscipline } from '@/types/admin'

export interface OnsiteGuestForm {
  full_name: string
  email: string
  phone: string
  has_license: boolean
  license_number: string
  club_name: string
}

export interface LastOnsiteReg {
  memberId: string
  memberName: string
  eventId: string
  eventTitle: string
  discName: string
  discScoringType: string
  discShotsCount: number
  regId: string
}

export interface RegistrationsTabProps {
  // Data
  events: Event[]
  disciplines: Discipline[]
  memberRegs: MemberReg[]
  guestRegs: GuestReg[]
  eventDisciplines: EventDiscipline[]
  regDisciplines: RegDiscipline[]
  allMembers: { id: string; full_name: string; license_number: string | null }[]
  memberTargetMap: Map<string, boolean>
  filteredOnsiteMembers: { id: string; full_name: string; license_number: string | null }[]
  inputClass: string
  supabase: SupabaseClient

  // Onsite registration state
  onsiteMode: 'member' | 'guest'
  setOnsiteMode: (mode: 'member' | 'guest') => void
  onsiteEventId: string
  setOnsiteEventId: (id: string) => void
  onsiteDisciplineId: string
  setOnsiteDisciplineId: (id: string) => void
  onsiteSlotId: string
  setOnsiteSlotId: (id: string) => void
  onsiteMemberId: string
  setOnsiteMemberId: (id: string) => void
  onsiteMemberSearch: string
  setOnsiteMemberSearch: (search: string) => void
  onsiteSaving: boolean
  onsiteMessage: string
  setOnsiteMessage: (msg: string) => void
  onsiteGuestForm: OnsiteGuestForm
  setOnsiteGuestForm: React.Dispatch<React.SetStateAction<OnsiteGuestForm>>
  lastOnsiteReg: LastOnsiteReg | null
  setLastOnsiteReg: (reg: LastOnsiteReg | null) => void

  // Onsite registration actions
  getEventsHappeningNow: () => Event[]
  quickRegisterOnsite: () => void
  quickRegisterGuestOnsite: () => void

  // Data helpers
  getEventDiscs: (eventId: string) => (EventDiscipline & { discipline?: Discipline })[]
  getSlotsForEventDiscipline: (eventDisciplineId: string) => EventDisciplineSlot[]
  getSlotRegistrationCount: (slotId: string) => number
  getRegDisciplineNames: (regId: string, type: 'member' | 'guest') => string[]
  getRegTotal: (regId: string, type: 'member' | 'guest') => number
  loadAll: () => void

  // Printing
  printSingleMetryczka: (reg: LastOnsiteReg, startNumber?: string) => void
  printAllMetryczki: (reg: LastOnsiteReg) => void
  openAttendancePreview: (eventId: string) => void
  viewEventResults: (eventId: string) => void
  viewMemberTargets: (memberId: string, eventId: string, memberName: string) => void
}

export default function RegistrationsTab({
  events,
  disciplines,
  memberRegs,
  guestRegs,
  eventDisciplines,
  regDisciplines,
  allMembers,
  memberTargetMap,
  filteredOnsiteMembers,
  inputClass,
  supabase,
  onsiteMode,
  setOnsiteMode,
  onsiteEventId,
  setOnsiteEventId,
  onsiteDisciplineId,
  setOnsiteDisciplineId,
  onsiteSlotId,
  setOnsiteSlotId,
  onsiteMemberId,
  setOnsiteMemberId,
  onsiteMemberSearch,
  setOnsiteMemberSearch,
  onsiteSaving,
  onsiteMessage,
  setOnsiteMessage,
  onsiteGuestForm,
  setOnsiteGuestForm,
  lastOnsiteReg,
  setLastOnsiteReg,
  getEventsHappeningNow,
  quickRegisterOnsite,
  quickRegisterGuestOnsite,
  getEventDiscs,
  getSlotsForEventDiscipline,
  getSlotRegistrationCount,
  getRegDisciplineNames,
  getRegTotal,
  loadAll,
  printSingleMetryczka,
  printAllMetryczki,
  openAttendancePreview,
  viewEventResults,
  viewMemberTargets,
}: RegistrationsTabProps) {
  return (
        <div>
          <h2 className="text-lg font-semibold mb-4">
            Zgloszenia na wydarzenia
          </h2>

          {/* On-site registration section */}
          {(() => {
            const happeningNow = getEventsHappeningNow()
            if (happeningNow.length === 0) return null
            return (
              <div className="bg-card border border-primary/30 rounded-xl p-4 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    Rejestracja na miejscu
                  </h3>
                  <div className="flex bg-background rounded-lg p-0.5 border border-border">
                    <button
                      onClick={() => { setOnsiteMode('member'); setOnsiteMessage('') }}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${onsiteMode === 'member' ? 'bg-primary text-background font-semibold' : 'text-muted hover:text-foreground'}`}
                    >
                      Czlonek
                    </button>
                    <button
                      onClick={() => { setOnsiteMode('guest'); setOnsiteMessage('') }}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${onsiteMode === 'guest' ? 'bg-primary text-background font-semibold' : 'text-muted hover:text-foreground'}`}
                    >
                      Gosc
                    </button>
                  </div>
                </div>

                {/* Row 1: Event + Discipline + Slot (shared) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-muted block mb-1">Wydarzenie</label>
                    <select
                      value={onsiteEventId}
                      onChange={e => {
                        setOnsiteEventId(e.target.value)
                        setOnsiteDisciplineId('')
                        setOnsiteSlotId('')
                      }}
                      className={inputClass + ' text-xs'}
                    >
                      <option value="">Wybierz...</option>
                      {happeningNow.map(ev => (
                        <option key={ev.id} value={ev.id}>{ev.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Dyscyplina</label>
                    <select
                      value={onsiteDisciplineId}
                      onChange={e => {
                        setOnsiteDisciplineId(e.target.value)
                        setOnsiteSlotId('')
                      }}
                      className={inputClass + ' text-xs'}
                      disabled={!onsiteEventId}
                    >
                      <option value="">Wybierz...</option>
                      {onsiteEventId && getEventDiscs(onsiteEventId).map(ed => (
                        <option key={ed.id} value={ed.id}>{ed.discipline?.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Slot (opcjonalnie)</label>
                    <select
                      value={onsiteSlotId}
                      onChange={e => setOnsiteSlotId(e.target.value)}
                      className={inputClass + ' text-xs'}
                      disabled={!onsiteDisciplineId}
                    >
                      <option value="">Bez slotu</option>
                      {onsiteDisciplineId && getSlotsForEventDiscipline(onsiteDisciplineId).map(slot => {
                        const regCount = getSlotRegistrationCount(slot.id)
                        return (
                          <option key={slot.id} value={slot.id} disabled={regCount >= slot.max_participants}>
                            {new Date(slot.start_time).toLocaleTimeString('pl', { hour: '2-digit', minute: '2-digit' })}
                            -{new Date(slot.end_time).toLocaleTimeString('pl', { hour: '2-digit', minute: '2-digit' })}
                            {' '}({regCount}/{slot.max_participants})
                          </option>
                        )
                      })}
                    </select>
                  </div>
                </div>

                {/* Row 2: Member or Guest specific */}
                {onsiteMode === 'member' ? (
                  <div className="relative">
                    <label className="text-xs text-muted block mb-1">Czlonek</label>
                    <input
                      type="text"
                      value={onsiteMemberSearch}
                      onChange={e => {
                        setOnsiteMemberSearch(e.target.value)
                        setOnsiteMemberId('')
                      }}
                      className={inputClass + ' text-xs'}
                      placeholder="Wyszukaj po nazwisku lub licencji..."
                    />
                    {onsiteMemberId && (
                      <p className="text-xs text-green-400 mt-1">
                        Wybrano: {allMembers.find(m => m.id === onsiteMemberId)?.full_name}
                      </p>
                    )}
                    {filteredOnsiteMembers.length > 0 && !onsiteMemberId && (
                      <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredOnsiteMembers.map(m => (
                          <button
                            key={m.id}
                            onClick={() => {
                              setOnsiteMemberId(m.id)
                              setOnsiteMemberSearch(m.full_name)
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-card-hover text-xs border-b border-border/30 last:border-b-0"
                          >
                            <span className="font-medium">{m.full_name}</span>
                            {m.license_number && <span className="text-muted ml-2">({m.license_number})</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">Imie i nazwisko *</label>
                      <input
                        type="text"
                        value={onsiteGuestForm.full_name}
                        onChange={e => setOnsiteGuestForm(f => ({ ...f, full_name: e.target.value }))}
                        className={inputClass + ' text-xs'}
                        placeholder="Jan Kowalski"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Klub (opcjonalnie)</label>
                      <input
                        type="text"
                        value={onsiteGuestForm.club_name}
                        onChange={e => setOnsiteGuestForm(f => ({ ...f, club_name: e.target.value }))}
                        className={inputClass + ' text-xs'}
                        placeholder="Nazwa klubu"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Email (opcjonalnie)</label>
                      <input
                        type="email"
                        value={onsiteGuestForm.email}
                        onChange={e => setOnsiteGuestForm(f => ({ ...f, email: e.target.value }))}
                        className={inputClass + ' text-xs'}
                        placeholder="jan@example.com"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Telefon (opcjonalnie)</label>
                      <input
                        type="tel"
                        value={onsiteGuestForm.phone}
                        onChange={e => setOnsiteGuestForm(f => ({ ...f, phone: e.target.value }))}
                        className={inputClass + ' text-xs'}
                        placeholder="+48 123 456 789"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Pozwolenie na bron</label>
                      <div className="flex items-center gap-3 mt-1">
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={onsiteGuestForm.has_license}
                            onChange={e => setOnsiteGuestForm(f => ({ ...f, has_license: e.target.checked }))}
                            className="rounded border-border"
                          />
                          Posiada
                        </label>
                        {onsiteGuestForm.has_license && (
                          <input
                            type="text"
                            value={onsiteGuestForm.license_number}
                            onChange={e => setOnsiteGuestForm(f => ({ ...f, license_number: e.target.value }))}
                            className={inputClass + ' text-xs flex-1'}
                            placeholder="Nr pozwolenia"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <button
                    onClick={onsiteMode === 'member' ? quickRegisterOnsite : quickRegisterGuestOnsite}
                    disabled={onsiteSaving || !onsiteEventId || !onsiteDisciplineId || (onsiteMode === 'member' ? !onsiteMemberId : !onsiteGuestForm.full_name)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-background text-xs font-semibold rounded-lg hover:bg-primary-dark disabled:opacity-50 transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    {onsiteSaving ? 'Rejestrowanie...' : onsiteMode === 'member' ? 'Zarejestruj czlonka' : 'Zarejestruj goscia'}
                  </button>
                  {onsiteMessage && (
                    <p className={`text-xs ${onsiteMessage.includes('\u2705') ? 'text-green-400' : 'text-danger'}`}>
                      {onsiteMessage}
                    </p>
                  )}
                </div>

                {/* Po rejestracji: drukuj metryczke */}
                {lastOnsiteReg && (
                  <div className="mt-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-xs text-green-400 font-medium mb-2">
                      Zarejestrowano: {lastOnsiteReg.memberName} — {lastOnsiteReg.discName}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => printSingleMetryczka(lastOnsiteReg)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border text-xs rounded-lg hover:border-primary hover:text-primary transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Drukuj metryczke
                      </button>
                      <button
                        onClick={() => printAllMetryczki(lastOnsiteReg)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border text-xs rounded-lg hover:border-primary hover:text-primary transition-colors"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Drukuj wszystkie dyscypliny
                      </button>
                      <button
                        onClick={() => setLastOnsiteReg(null)}
                        className="text-xs text-muted hover:text-foreground px-2 py-1.5"
                      >
                        Zamknij
                      </button>
                    </div>
                  </div>
                )}

                {/* Lista zarejestrowanych na biezace zawody */}
                {onsiteEventId && (() => {
                  const evMRegs = memberRegs.filter(r => r.event_id === onsiteEventId && r.status !== 'cancelled')
                  const evGRegs = guestRegs.filter(r => r.event_id === onsiteEventId && r.status !== 'cancelled')
                  const allRegs = [
                    ...evMRegs.map(r => ({ id: r.id, name: (r.member as any)?.full_name ?? '?', type: 'member' as const, paid: (r as any).paid, startNumber: r.start_number, memberId: (r.member as any)?.id })),
                    ...evGRegs.map(r => ({ id: r.id, name: r.full_name, type: 'guest' as const, paid: false, startNumber: null, memberId: '' })),
                  ]
                  if (allRegs.length === 0) return null
                  return (
                    <div className="mt-4 border-t border-border pt-3">
                      <p className="text-xs font-semibold text-muted mb-2">Zarejestrowani ({allRegs.length}):</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {allRegs.map(reg => {
                          const discIds = reg.type === 'member'
                            ? regDisciplines.filter(rd => rd.member_registration_id === reg.id).map(rd => rd.event_discipline_id)
                            : regDisciplines.filter(rd => rd.guest_registration_id === reg.id).map(rd => rd.event_discipline_id)
                          const discNames = discIds.map(did => {
                            const ed = eventDisciplines.find(e => e.id === did)
                            return ed ? (disciplines.find(d => d.id === ed.discipline_id)?.name ?? '') : ''
                          }).filter(Boolean)

                          return (
                            <div key={reg.id} className="flex items-center justify-between text-xs px-2 py-1.5 rounded hover:bg-card-hover">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${reg.type === 'member' ? 'bg-primary/20 text-primary' : 'bg-blue-500/20 text-blue-400'}`}>
                                  {reg.startNumber ?? (reg.type === 'member' ? 'CZL' : 'G')}
                                </span>
                                <span className="font-medium truncate">{reg.name}</span>
                                <span className="text-muted truncate">{discNames.join(', ')}</span>
                                {reg.paid && <span className="shrink-0 text-[10px] px-1 py-0.5 rounded bg-success/20 text-success">PLN</span>}
                              </div>
                              <button
                                onClick={() => {
                                  const evDiscs = getEventDiscs(onsiteEventId)
                                  const applicableDiscs = discIds.length > 0 ? evDiscs.filter(ed => discIds.includes(ed.id)) : evDiscs
                                  const competitionDiscs = applicableDiscs.filter(ed => {
                                    const disc = disciplines.find(d => d.id === ed.discipline_id)
                                    return disc && disc.category === 'discipline'
                                  })
                                  if (competitionDiscs.length === 0) return
                                  const firstDisc = disciplines.find(d => d.id === competitionDiscs[0].discipline_id)
                                  const sn = reg.startNumber ? String(reg.startNumber).padStart(4, '0') : '0000'
                                  const regData = {
                                    memberId: reg.memberId ?? '',
                                    memberName: reg.name,
                                    eventId: onsiteEventId,
                                    eventTitle: events.find(e => e.id === onsiteEventId)?.title ?? '',
                                    discName: firstDisc?.name ?? '',
                                    discScoringType: firstDisc?.scoring_type ?? 'points',
                                    discShotsCount: firstDisc?.shots_count ?? 10,
                                    regId: reg.id,
                                  }
                                  competitionDiscs.length === 1 ? printSingleMetryczka(regData, sn) : printAllMetryczki(regData)
                                }}
                                className="shrink-0 p-1 text-muted hover:text-primary rounded hover:bg-card-hover"
                                title="Drukuj metryczki"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })()}

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
                    {total} {total === 1 ? 'zgloszenie' : total < 5 ? 'zgloszenia' : 'zgloszen'}
                  </span>
                  <button
                    onClick={() => openAttendancePreview(ev.id)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors ml-2 font-medium"
                    title="Lista do podpisu na strzelnicy"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Lista do podpisu
                  </button>
                  <button
                    onClick={() => viewEventResults(ev.id)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors font-medium"
                    title="Podglad wynikow i tarcz"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Wyniki / Tarcze
                  </button>
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
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">Czlonek</span>
                            </td>
                            <td className="px-4 py-2 font-medium">{(r.member as any)?.full_name ?? '-'}</td>
                            <td className="px-4 py-2 text-muted text-xs">{discNames.length > 0 ? discNames.join(', ') : '-'}</td>
                            <td className="px-4 py-2 text-muted">{total > 0 ? `${total.toFixed(0)} zl` : '-'}</td>
                            <td className="px-4 py-2">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-success/20 text-success">{r.status}</span>
                              {(r as any).paid
                                ? <span className="text-xs px-2 py-0.5 rounded-full bg-success/20 text-success ml-1">Oplacono</span>
                                : total > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning ml-1">Nieoplacono</span>
                              }
                            </td>
                            <td className="px-4 py-2 text-right">
                              <div className="flex items-center justify-end gap-1 flex-wrap">
                                {!(r as any).paid && total > 0 && (
                                  <button
                                    onClick={async () => {
                                      if (!confirm(`Zaplacono gotowka: ${(r.member as any)?.full_name} — ${total.toFixed(0)} zl?`)) return
                                      await supabase.from('event_registrations').update({ paid: true }).eq('id', r.id)
                                      loadAll()
                                    }}
                                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-success/10 text-success border border-success/30 rounded-lg hover:bg-success/20 transition-colors font-medium"
                                  >
                                    <DollarSign className="w-3 h-3" />
                                    Gotowka {total.toFixed(0)} zl
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    const member = (r.member as any)
                                    const discIds = regDisciplines.filter(rd => rd.member_registration_id === r.id).map(rd => rd.event_discipline_id)
                                    const evDiscs = getEventDiscs(ev.id)
                                    const applicableDiscs = discIds.length > 0 ? evDiscs.filter(ed => discIds.includes(ed.id)) : evDiscs
                                    const competitionDiscs = applicableDiscs.filter(ed => {
                                      const disc = disciplines.find(d => d.id === ed.discipline_id)
                                      return disc && disc.category === 'discipline'
                                    })
                                    if (competitionDiscs.length === 0) return alert('Brak dyscyplin do wydruku')
                                    const sn = r.start_number ? String(r.start_number).padStart(4, '0') : '0000'
                                    const firstDisc = disciplines.find(d => d.id === competitionDiscs[0].discipline_id)
                                    const regData = {
                                      memberId: member?.id ?? '',
                                      memberName: member?.full_name ?? '?',
                                      eventId: ev.id,
                                      eventTitle: ev.title,
                                      discName: firstDisc?.name ?? '',
                                      discScoringType: firstDisc?.scoring_type ?? 'points',
                                      discShotsCount: firstDisc?.shots_count ?? 10,
                                      regId: r.id,
                                    }
                                    if (competitionDiscs.length === 1) {
                                      printSingleMetryczka(regData, sn)
                                    } else {
                                      printAllMetryczki(regData)
                                    }
                                  }}
                                  className="flex items-center gap-1 text-xs px-2 py-1.5 border border-border rounded-lg hover:border-primary hover:text-primary transition-colors"
                                  title="Drukuj metryczki"
                                >
                                  <Printer className="w-3 h-3" />
                                </button>
                                {memberTargetMap.has(`${(r.member as any)?.id}:${ev.id}`) && (
                                <button
                                  onClick={() => viewMemberTargets((r.member as any)?.id, ev.id, (r.member as any)?.full_name ?? '?')}
                                  className="flex items-center gap-1 text-xs px-2 py-1.5 border border-blue-400/30 text-blue-400 rounded-lg hover:border-blue-400 hover:bg-blue-400/10 transition-colors"
                                  title="Podglad tarcz"
                                >
                                  <Camera className="w-3 h-3" />
                                </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {evGuestRegs.map(r => {
                        const discNames = getRegDisciplineNames(r.id, 'guest')
                        const total = getRegTotal(r.id, 'guest')
                        return (
                          <tr key={r.id} className="border-b border-border/50 hover:bg-card-hover text-sm">
                            <td className="px-4 py-2">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">Gosc</span>
                            </td>
                            <td className="px-4 py-2 font-medium">
                              {r.full_name}
                              {r.has_license && <span className="text-xs text-muted ml-1">(lic: {r.license_number})</span>}
                            </td>
                            <td className="px-4 py-2 text-muted text-xs">{discNames.length > 0 ? discNames.join(', ') : '-'}</td>
                            <td className="px-4 py-2 text-muted">{total > 0 ? `${total.toFixed(0)} zl` : '-'}</td>
                            <td className="px-4 py-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                r.status === 'confirmed' ? 'bg-success/20 text-success' :
                                r.status === 'cancelled' ? 'bg-danger/20 text-danger' :
                                'bg-warning/20 text-warning'
                              }`}>{r.status === 'pending' ? 'oczekuje' : r.status === 'confirmed' ? 'potwierdzony' : 'anulowany'}</span>
                            </td>
                            <td className="px-4 py-2 text-right">
                              <div className="flex items-center justify-end gap-1 flex-wrap">
                                {r.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={async () => { await supabase.from('guest_registrations').update({ status: 'confirmed' }).eq('id', r.id); loadAll() }}
                                      className="p-1.5 text-muted hover:text-success rounded hover:bg-card-hover" title="Potwierdz"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={async () => { await supabase.from('guest_registrations').update({ status: 'cancelled' }).eq('id', r.id); loadAll() }}
                                      className="p-1.5 text-muted hover:text-danger rounded hover:bg-card-hover" title="Odrzuc"
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
                                <button
                                  onClick={() => {
                                    const discIds = regDisciplines.filter(rd => rd.guest_registration_id === r.id).map(rd => rd.event_discipline_id)
                                    const evDiscs = getEventDiscs(ev.id)
                                    const applicableDiscs = discIds.length > 0 ? evDiscs.filter(ed => discIds.includes(ed.id)) : evDiscs
                                    const competitionDiscs = applicableDiscs.filter(ed => {
                                      const disc = disciplines.find(d => d.id === ed.discipline_id)
                                      return disc && disc.category === 'discipline'
                                    })
                                    if (competitionDiscs.length === 0) return alert('Brak dyscyplin do wydruku')
                                    const firstDisc = disciplines.find(d => d.id === competitionDiscs[0].discipline_id)
                                    const regData = {
                                      memberId: '',
                                      memberName: r.full_name,
                                      eventId: ev.id,
                                      eventTitle: ev.title,
                                      discName: firstDisc?.name ?? '',
                                      discScoringType: firstDisc?.scoring_type ?? 'points',
                                      discShotsCount: firstDisc?.shots_count ?? 10,
                                      regId: r.id,
                                    }
                                    if (competitionDiscs.length === 1) {
                                      printSingleMetryczka(regData, '0000')
                                    } else {
                                      printAllMetryczki(regData)
                                    }
                                  }}
                                  className="p-1.5 text-muted hover:text-primary rounded hover:bg-card-hover"
                                  title="Drukuj metryczki"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
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
            <p className="text-muted">Brak zgloszen na zadne wydarzenie.</p>
          )}
        </div>
  )
}
