'use client'

import { Plus, Trash2, Pencil, Save, X, ChevronDown, ChevronUp, ClipboardList, Bell, Clock, Printer, MapPin, Zap, Package, Target, Trophy, Hash, Camera } from 'lucide-react'
import type { Discipline, EventDiscipline, EventDisciplineSlot } from '@/types/database'
import type { EventRow, ShootingLane } from '@/types/admin'

const TIME_OPTIONS: string[] = []
for (let h = 6; h <= 22; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`)
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`)
}

function TimeSelect({ value, onChange, className, required }: { value: string; onChange: (v: string) => void; className?: string; required?: boolean }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={className} required={required}>
      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
    </select>
  )
}

export interface EventsTabProps {
  events: EventRow[]
  disciplines: Discipline[]
  shootingLanes: ShootingLane[]
  expandedEvent: string | null
  slotManagedEvent: string | null
  showEventForm: boolean
  editingEvent: EventRow | null
  eventForm: {
    title: string
    description: string
    event_type: string
    start_day: string
    start_time: string
    end_day: string
    end_time: string
    location: string
    address: string
    max_participants: string
    is_published: boolean
    allow_target_photos: boolean
  }
  editingEventDisciplines: { discipline_id: string; price_pln: string; own_weapon_price_pln: string }[]
  eventLaneIds: string[]
  newSlotForm: { event_discipline_id: string; start_time: string; end_time: string; max_participants: string }
  saving: boolean
  error: string
  inputClass: string
  eventTypeLabels: Record<string, string>

  // Setters
  setExpandedEvent: (id: string | null) => void
  setSlotManagedEvent: (id: string | null) => void
  setShowEventForm: (show: boolean) => void
  setEventForm: React.Dispatch<React.SetStateAction<{
    title: string
    description: string
    event_type: string
    start_day: string
    start_time: string
    end_day: string
    end_time: string
    location: string
    address: string
    max_participants: string
    is_published: boolean
    allow_target_photos: boolean
  }>>
  setEditingEventDisciplines: React.Dispatch<React.SetStateAction<{ discipline_id: string; price_pln: string; own_weapon_price_pln: string }[]>>
  setEventLaneIds: React.Dispatch<React.SetStateAction<string[]>>
  setNewSlotForm: React.Dispatch<React.SetStateAction<{ event_discipline_id: string; start_time: string; end_time: string; max_participants: string }>>

  // Event actions
  openNewEvent: () => void
  openEditEvent: (ev: EventRow) => void
  deleteEvent: (id: string) => void
  saveEvent: (e: React.FormEvent) => void
  addDisciplineToEvent: () => void
  removeDisciplineFromEvent: (idx: number) => void
  updateEventDiscipline: (idx: number, field: string, value: string) => void

  // Data accessors
  getEventDiscs: (eventId: string) => (EventDiscipline & { discipline?: Discipline })[]
  getEventJudges: (eventId: string) => { id: string; full_name: string; judge_license_number: string | null }[]
  getAvailableJudges: (eventId: string) => { id: string; full_name: string; judge_license_number: string | null }[]
  getEventTotalRegs: (eventId: string) => number
  getEventDiscRegCounts: (eventId: string) => { name: string; count: number }[]
  getStaffingByDisciplines: (eventId: string) => { recommended: number; assigned: number; missing: number; totalStations: number } | null
  getStaffingByRegistrations: (eventId: string) => { recommended: number; assigned: number; missing: number; totalStations: number } | null
  getSlotsForEventDiscipline: (eventDisciplineId: string) => EventDisciplineSlot[]
  getSlotRegistrationCount: (slotId: string) => number
  getFilteredDisciplines: () => Discipline[]
  getEventRevenue: (eventId: string) => { lines: { name: string; total: number; ownCount: number; clubCount: number }[]; grandTotal: number }
  getEventMaterials: (eventId: string) => {
    lines: {
      discipline: string
      participants: number
      caliber: string
      shotsCount: number
      ammoTotal: number
      ammoPacks: number
      ammoPerPack: number
      targetName: string
      targetsTotal: number
    }[]
    totals: {
      byCaliberAmmo: Map<string, { total: number; packs: number; perPack: number }>
      byTargetTarcze: Map<string, number>
      weaponsNeeded: Map<string, number>
    }
  }

  // Judge actions
  assignJudge: (eventId: string, judgeId: string) => void
  removeJudge: (eventId: string, judgeId: string) => void

  // Slot actions
  autoGenerateSlots: (eventId: string) => void
  addSlotManual: () => void
  deleteSlot: (slotId: string) => void

  // Print / preview actions
  viewEventResults: (eventId: string) => void
  openAttendancePreview: (eventId: string) => void
  printStartNumbers: (eventId: string) => void
  printMetryczki: (eventId: string) => void

  // Inventory actions
  settleEventMaterials: (eventId: string) => void
}

export default function EventsTab(props: EventsTabProps) {
  const {
    events, disciplines, shootingLanes, expandedEvent, slotManagedEvent,
    showEventForm, editingEvent, eventForm, editingEventDisciplines, eventLaneIds,
    newSlotForm, saving, error, inputClass, eventTypeLabels,
    setExpandedEvent, setSlotManagedEvent, setShowEventForm, setEventForm,
    setEditingEventDisciplines, setEventLaneIds, setNewSlotForm,
    openNewEvent, openEditEvent, deleteEvent, saveEvent,
    addDisciplineToEvent, removeDisciplineFromEvent, updateEventDiscipline,
    getEventDiscs, getEventJudges, getAvailableJudges, getEventTotalRegs,
    getEventDiscRegCounts, getStaffingByDisciplines, getStaffingByRegistrations,
    getSlotsForEventDiscipline, getSlotRegistrationCount, getFilteredDisciplines,
    getEventRevenue, getEventMaterials,
    assignJudge, removeJudge,
    autoGenerateSlots, addSlotManual, deleteSlot,
    viewEventResults, openAttendancePreview, printStartNumbers, printMetryczki,
    settleEventMaterials,
  } = props

  return (
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
              const staffByDisc = ev.event_type === 'competition' ? getStaffingByDisciplines(ev.id) : null
              const staffByRegs = ev.event_type === 'competition' ? getStaffingByRegistrations(ev.id) : null
              const isSlotManaged = slotManagedEvent === ev.id

              return (
                <div key={ev.id} className="bg-card border border-border rounded-xl">
                  <div className="p-4 flex items-center gap-4">
                    {/* Published status dot */}
                    <div className="flex-shrink-0">
                      <span
                        className={`inline-block w-3 h-3 rounded-full ${ev.is_published ? 'bg-green-500' : 'bg-red-500'}`}
                        title={ev.is_published ? 'Opublikowane' : 'Ukryte'}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                          {eventTypeLabels[ev.event_type]}
                        </span>
                        {evDiscs.map(ed => (
                          <span key={ed.id} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-medium">
                            {ed.discipline?.name} — {Number(ed.price_pln).toFixed(0)} zl
                          </span>
                        ))}
                      </div>
                      <h3 className="font-semibold">{ev.title}</h3>
                      <p className="text-xs text-muted">
                        {new Date(ev.start_date).toLocaleDateString('pl')} &middot; {ev.location}
                        {ev.address && ` · ${ev.address}`}
                        {evDiscs.length > 0 && ` · ${evDiscs.length} dyscyplin`}
                        {staffByDisc && ` · ${staffByDisc.totalStations} stanowisk · ${staffByDisc.recommended} sędziów wg dyscyplin`}
                        {totalPrice > 0 && ` · suma: ${totalPrice.toFixed(0)} zł`}
                        {ev.max_participants && ` · max ${ev.max_participants} os.`}
                      </p>
                      {ev.event_type !== 'course' && assigned.length > 0 && (
                        <p className="text-xs text-muted mt-1">
                          Sędziowie: {assigned.map(j => j.full_name).join(', ')}
                        </p>
                      )}
                      {/* Registration counts + both staffing suggestions */}
                      {evDiscs.length > 0 && (() => {
                        const discRegs = getEventDiscRegCounts(ev.id)
                        const total = getEventTotalRegs(ev.id)
                        return (
                          <>
                            <p className="text-xs text-muted mt-1">
                              Zapisanych: <span className="text-foreground font-medium">{total}</span>
                              {discRegs.length > 0 && (
                                <span> ({discRegs.map(d => `${d.name}: ${d.count}`).join(', ')})</span>
                              )}
                            </p>
                            {staffByDisc && (
                              <p className="text-xs mt-0.5">
                                <span className="text-muted">Wg dyscyplin: </span>
                                <span className={staffByDisc.missing > 0 ? 'text-red-400 font-medium' : 'text-green-400'}>
                                  {staffByDisc.assigned}/{staffByDisc.recommended} sędziów
                                  {staffByDisc.missing > 0 && ` (brakuje ${staffByDisc.missing})`}
                                </span>
                              </p>
                            )}
                            {staffByRegs && (
                              <p className="text-xs mt-0.5">
                                <span className="text-muted">Wg zapisanych: </span>
                                <span className={staffByRegs.missing > 0 ? 'text-yellow-400 font-medium' : 'text-green-400'}>
                                  {staffByRegs.assigned}/{staffByRegs.recommended} sędziów ({staffByRegs.totalStations} stanowisk potrzeba)
                                  {staffByRegs.missing > 0 && ` (brakuje ${staffByRegs.missing})`}
                                </span>
                              </p>
                            )}
                            {/* Revenue summary */}
                            {(() => {
                              const rev = getEventRevenue(ev.id)
                              if (rev.grandTotal === 0) return null
                              return (
                                <p className="text-xs mt-0.5">
                                  <span className="text-muted">Przychód: </span>
                                  <span className="text-green-400 font-bold">{rev.grandTotal.toLocaleString('pl')} zł</span>
                                  <span className="text-muted ml-1">
                                    ({rev.lines.map(l => `${l.name.split('—')[0].trim()}: ${l.total.toLocaleString('pl')} zł`).join(', ')})
                                  </span>
                                </p>
                              )
                            })()}
                          </>
                        )
                      })()}
                    </div>
                    <div className="flex items-center gap-1">
                      {getEventTotalRegs(ev.id) > 0 && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Wysłać przypomnienie o "${ev.title}" do wszystkich zapisanych?`)) return
                            const res = await fetch('/api/email/event-reminder', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ event_id: ev.id }),
                            })
                            const data = await res.json()
                            if (data.success) alert(`Wysłano ${data.sent} przypomnień.`)
                            else alert('Błąd: ' + (data.error || 'Nieznany'))
                          }}
                          className="p-2 text-muted hover:text-yellow-400 rounded-lg hover:bg-card-hover"
                          title="Wyślij przypomnienie email"
                        >
                          <Bell className="w-4 h-4" />
                        </button>
                      )}
                      {getEventTotalRegs(ev.id) > 0 && (
                        <button
                          onClick={() => viewEventResults(ev.id)}
                          className="p-2 text-muted hover:text-blue-400 rounded-lg hover:bg-card-hover"
                          title="Podgląd wyników z tarczami"
                        >
                          <Camera className="w-4 h-4" />
                        </button>
                      )}
                      {getEventTotalRegs(ev.id) > 0 && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Wysłać wyniki z "${ev.title}" do wszystkich zawodników?`)) return
                            const res = await fetch('/api/email/result-notify', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ event_id: ev.id }),
                            })
                            const data = await res.json()
                            if (data.success) alert(`Wysłano ${data.sent} powiadomień o wynikach.`)
                            else alert('Błąd: ' + (data.error || 'Nieznany'))
                          }}
                          className="p-2 text-muted hover:text-green-400 rounded-lg hover:bg-card-hover"
                          title="Wyślij wyniki email"
                        >
                          <Trophy className="w-4 h-4" />
                        </button>
                      )}
                      {getEventTotalRegs(ev.id) > 0 && (
                        <>
                          <button
                            onClick={() => openAttendancePreview(ev.id)}
                            className="p-2 text-muted hover:text-primary rounded-lg hover:bg-card-hover"
                            title="Lista do podpisu"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => printStartNumbers(ev.id)}
                            className="p-2 text-muted hover:text-primary rounded-lg hover:bg-card-hover"
                            title="Drukuj numery startowe"
                          >
                            <Hash className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => printMetryczki(ev.id)}
                            className="p-2 text-muted hover:text-primary rounded-lg hover:bg-card-hover"
                            title="Drukuj metryczki (drukarka termiczna)"
                          >
                            <ClipboardList className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {evDiscs.length > 0 && ev.event_type !== 'course' && (
                        <button
                          onClick={() => setSlotManagedEvent(isSlotManaged ? null : ev.id)}
                          className="p-2 text-muted hover:text-primary rounded-lg hover:bg-card-hover"
                          title="Zarzadzaj slotami"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                      )}
                      {ev.event_type !== 'course' && (
                        <button onClick={() => setExpandedEvent(isExpanded ? null : ev.id)} className="p-2 text-muted hover:text-foreground rounded-lg hover:bg-card-hover" title="Sedziowie">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                      <button onClick={() => openEditEvent(ev)} className="p-2 text-muted hover:text-primary rounded-lg hover:bg-card-hover" title="Edytuj">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteEvent(ev.id)} className="p-2 text-muted hover:text-danger rounded-lg hover:bg-card-hover" title="Usun">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Slot management panel */}
                  {isSlotManaged && (
                    <div className="px-4 pb-4 pt-2 border-t border-border">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium flex items-center gap-2">
                          <Clock className="w-4 h-4 text-primary" />
                          Zarzadzanie slotami
                        </p>
                        <button
                          onClick={() => autoGenerateSlots(ev.id)}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                        >
                          <Zap className="w-3 h-3" />
                          Auto-generuj sloty
                        </button>
                      </div>

                      {evDiscs.map(ed => {
                        const slots = getSlotsForEventDiscipline(ed.id)
                        return (
                          <div key={ed.id} className="mb-4">
                            <p className="text-xs font-medium text-blue-400 mb-2">
                              {ed.discipline?.name ?? 'Dyscyplina'}
                            </p>
                            {slots.length === 0 ? (
                              <p className="text-xs text-muted mb-2">Brak slotow dla tej dyscypliny.</p>
                            ) : (
                              <div className="space-y-1 mb-2">
                                {slots.map(slot => {
                                  const regCount = getSlotRegistrationCount(slot.id)
                                  return (
                                    <div key={slot.id} className="flex items-center justify-between bg-background/50 border border-border/50 rounded-lg px-3 py-2">
                                      <div className="text-xs">
                                        <span className="font-medium">
                                          {new Date(slot.start_time).toLocaleString('pl', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="text-muted mx-1">—</span>
                                        <span className="font-medium">
                                          {new Date(slot.end_time).toLocaleString('pl', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="text-muted ml-2">
                                          max: {slot.max_participants}
                                        </span>
                                        <span className={`ml-2 ${regCount >= slot.max_participants ? 'text-red-400' : 'text-green-400'}`}>
                                          ({regCount}/{slot.max_participants} zapisanych)
                                        </span>
                                      </div>
                                      <button
                                        onClick={() => deleteSlot(slot.id)}
                                        className="p-1 text-muted hover:text-danger rounded hover:bg-card-hover"
                                        title="Usun slot"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* Manual slot add */}
                      <div className="border-t border-border/50 pt-3 mt-3">
                        <p className="text-xs font-medium mb-2">Dodaj slot recznie</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <select
                            value={newSlotForm.event_discipline_id}
                            onChange={e => setNewSlotForm(f => ({ ...f, event_discipline_id: e.target.value }))}
                            className={inputClass + ' text-xs'}
                          >
                            <option value="">Dyscyplina...</option>
                            {evDiscs.map(ed => (
                              <option key={ed.id} value={ed.id}>{ed.discipline?.name}</option>
                            ))}
                          </select>
                          <input
                            type="datetime-local"
                            value={newSlotForm.start_time}
                            onChange={e => setNewSlotForm(f => ({ ...f, start_time: e.target.value }))}
                            className={inputClass + ' text-xs'}
                            placeholder="Start"
                          />
                          <input
                            type="datetime-local"
                            value={newSlotForm.end_time}
                            onChange={e => setNewSlotForm(f => ({ ...f, end_time: e.target.value }))}
                            className={inputClass + ' text-xs'}
                            placeholder="Koniec"
                          />
                          <div className="flex gap-2">
                            <input
                              type="number"
                              min="1"
                              value={newSlotForm.max_participants}
                              onChange={e => setNewSlotForm(f => ({ ...f, max_participants: e.target.value }))}
                              className={inputClass + ' text-xs w-20'}
                              placeholder="Max"
                            />
                            <button
                              onClick={addSlotManual}
                              className="flex items-center gap-1 px-3 py-2 bg-primary text-background text-xs font-semibold rounded-lg hover:bg-primary-dark transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              Dodaj
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Judge assignment panel */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-border">
                      <p className="text-sm font-medium mb-2">Przypisani sedziowie:</p>
                      {assigned.length === 0 ? (
                        <p className="text-xs text-muted mb-2">Brak przypisanych sedziow.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {assigned.map(j => (
                            <span key={j.id} className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary text-xs rounded-full font-medium">
                              {j.full_name} {j.judge_license_number ? `(${j.judge_license_number})` : ''}
                              <button onClick={() => removeJudge(ev.id, j.id)} className="hover:text-danger">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      {available.length > 0 && (
                        <div>
                          <p className="text-xs text-muted mb-1">Dodaj sedziego:</p>
                          <div className="flex flex-wrap gap-1">
                            {available.map(j => (
                              <button
                                key={j.id}
                                onClick={() => assignJudge(ev.id, j.id)}
                                className="inline-flex items-center gap-1 px-3 py-1 border border-border text-xs rounded-full hover:border-primary hover:text-primary transition-colors"
                              >
                                <Plus className="w-3 h-3" />
                                {j.full_name} {j.judge_license_number ? `(${j.judge_license_number})` : ''}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* === MATERIALS SUMMARY === */}
                      {(() => {
                        const mats = getEventMaterials(ev.id)
                        if (mats.lines.length === 0) return null
                        return (
                          <div className="mt-4 pt-4 border-t border-border">
                            <p className="text-sm font-medium mb-3 flex items-center gap-2">
                              <ClipboardList className="w-4 h-4 text-primary" />
                              Podsumowanie materiałów
                            </p>

                            {/* Per-discipline table */}
                            <div className="overflow-x-auto mb-4">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-muted border-b border-border">
                                    <th className="text-left py-1.5 pr-2 font-medium">Dyscyplina</th>
                                    <th className="text-right py-1.5 px-2 font-medium">Zawodnicy</th>
                                    <th className="text-left py-1.5 px-2 font-medium">Kaliber</th>
                                    <th className="text-right py-1.5 px-2 font-medium">Strzały</th>
                                    <th className="text-right py-1.5 px-2 font-medium">Amunicja (szt)</th>
                                    <th className="text-right py-1.5 px-2 font-medium">Paczki</th>
                                    <th className="text-left py-1.5 px-2 font-medium">Tarcza</th>
                                    <th className="text-right py-1.5 pl-2 font-medium">Tarcze (szt)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {mats.lines.map((l, idx) => (
                                    <tr key={idx} className="border-b border-border/50">
                                      <td className="py-1.5 pr-2 font-medium text-foreground">{l.discipline}</td>
                                      <td className="text-right py-1.5 px-2">{l.participants}</td>
                                      <td className="py-1.5 px-2 text-muted">{l.caliber}</td>
                                      <td className="text-right py-1.5 px-2">{l.shotsCount}/os</td>
                                      <td className="text-right py-1.5 px-2 font-semibold text-foreground">{l.ammoTotal.toLocaleString('pl')}</td>
                                      <td className="text-right py-1.5 px-2 text-primary font-semibold">{l.ammoPacks} ×{l.ammoPerPack}</td>
                                      <td className="py-1.5 px-2 text-muted truncate max-w-[160px]" title={l.targetName}>{l.targetName}</td>
                                      <td className="text-right py-1.5 pl-2 font-semibold text-foreground">{l.targetsTotal.toLocaleString('pl')}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Aggregated totals */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {/* Ammo by caliber */}
                              <div className="bg-background/50 border border-border/50 rounded-lg p-3">
                                <p className="text-xs text-muted font-medium mb-2">🔫 Amunicja wg kalibru</p>
                                {Array.from(mats.totals.byCaliberAmmo.entries()).map(([cal, v]) => (
                                  <div key={cal} className="flex justify-between text-xs mb-1">
                                    <span className="text-muted">{cal}</span>
                                    <span className="font-semibold">{v.total.toLocaleString('pl')} szt <span className="text-primary">({v.packs} paczek ×{v.perPack})</span></span>
                                  </div>
                                ))}
                              </div>

                              {/* Targets */}
                              <div className="bg-background/50 border border-border/50 rounded-lg p-3">
                                <p className="text-xs text-muted font-medium mb-2">🎯 Tarcze / rzutki</p>
                                {Array.from(mats.totals.byTargetTarcze.entries()).map(([name, count]) => (
                                  <div key={name} className="flex justify-between text-xs mb-1 gap-2">
                                    <span className="text-muted truncate" title={name}>{name}</span>
                                    <span className="font-semibold flex-shrink-0">{count.toLocaleString('pl')} szt</span>
                                  </div>
                                ))}
                              </div>

                              {/* Weapons needed */}
                              <div className="bg-background/50 border border-border/50 rounded-lg p-3">
                                <p className="text-xs text-muted font-medium mb-2">🔧 Broń klubowa (max jednocześnie)</p>
                                {Array.from(mats.totals.weaponsNeeded.entries()).map(([cal, count]) => (
                                  <div key={cal} className="flex justify-between text-xs mb-1">
                                    <span className="text-muted">{cal}</span>
                                    <span className="font-semibold">{count} zawodników</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="mt-4 pt-3 border-t border-border/50">
                              <button onClick={() => settleEventMaterials(ev.id)} className="flex items-center gap-2 bg-primary/10 text-primary border border-primary/30 px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors">
                                <Package className="w-4 h-4" />
                                Rozlicz materiały z magazynu
                              </button>
                            </div>
                          </div>
                        )
                      })()}
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
                      <label className="text-xs text-muted block mb-1">Max uczestnikow</label>
                      <input type="number" value={eventForm.max_participants} onChange={e => setEventForm(f => ({ ...f, max_participants: e.target.value }))} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Data i godzina rozpoczęcia *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input required type="date" value={eventForm.start_day} onChange={e => {
                        setEventForm(f => ({ ...f, start_day: e.target.value, end_day: f.end_day || e.target.value }))
                      }} className={inputClass} />
                      <TimeSelect required value={eventForm.start_time} onChange={v => setEventForm(f => ({ ...f, start_time: v }))} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Data i godzina zakończenia</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" value={eventForm.end_day} min={eventForm.start_day} onChange={e => setEventForm(f => ({ ...f, end_day: e.target.value }))} className={inputClass} />
                      <TimeSelect value={eventForm.end_time} onChange={v => setEventForm(f => ({ ...f, end_time: v }))} className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Lokalizacja</label>
                    <input value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Adres</label>
                    <textarea
                      value={eventForm.address}
                      onChange={e => setEventForm(f => ({ ...f, address: e.target.value }))}
                      rows={2}
                      className={inputClass + ' resize-none'}
                      placeholder="ul. Strzelecka 1, 00-001 Warszawa"
                    />
                  </div>
                  {/* Staffing suggestion based on disciplines - only for competitions */}
                  {eventForm.event_type === 'competition' && editingEventDisciplines.length > 0 && (() => {
                    let totalStations = 0
                    let totalJudges = 0
                    for (const ed of editingEventDisciplines) {
                      const disc = disciplines.find(d => d.id === ed.discipline_id)
                      const stations = disc?.stations_count ?? 1
                      const judgesPerStation = disc?.judges_per_station ?? 1
                      totalStations += stations
                      totalJudges += stations * judgesPerStation
                    }
                    return (
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-3 py-2">
                        <p className="text-xs text-blue-400">
                          Łącznie {totalStations} stanowisk · wymaganych {totalJudges} sędziów/prowadzących strzelanie (wg dyscyplin)
                        </p>
                      </div>
                    )
                  })()}

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
                        Dodaj dyscypline
                      </button>
                    </div>

                    {editingEventDisciplines.length === 0 ? (
                      <p className="text-xs text-muted py-2">Brak dyscyplin. Dodaj dyscypline, aby ustawic cene startu.</p>
                    ) : (
                      <div className="space-y-2">
                        {editingEventDisciplines.map((ed, idx) => {
                          const usedIds = editingEventDisciplines.filter((_, i) => i !== idx).map(d => d.discipline_id)
                          return (
                            <div key={idx} className="space-y-1">
                              <div className="flex items-center gap-2">
                                <select
                                  value={ed.discipline_id}
                                  onChange={e => updateEventDiscipline(idx, 'discipline_id', e.target.value)}
                                  className={inputClass + ' flex-1'}
                                >
                                  {getFilteredDisciplines().filter(d => !usedIds.includes(d.id) || d.id === ed.discipline_id).map(d => (
                                    <option key={d.id} value={d.id}>{d.name}{d.category === 'service' ? ' (usługa)' : ''}</option>
                                  ))}
                                </select>
                                <div className="relative w-24 flex-shrink-0">
                                  <input type="number" step="0.01" min="0" value={ed.price_pln} onChange={e => updateEventDiscipline(idx, 'price_pln', e.target.value)} className={inputClass + ' pr-8'} placeholder="0" title="Cena" />
                                  <span className="absolute right-3 top-2.5 text-xs text-muted">zł</span>
                                </div>
                                <div className="relative w-24 flex-shrink-0">
                                  <input type="number" step="0.01" min="0" value={ed.own_weapon_price_pln} onChange={e => updateEventDiscipline(idx, 'own_weapon_price_pln', e.target.value)} className={inputClass + ' pr-8'} placeholder="0" title="Cena z własną bronią" />
                                  <span className="absolute right-3 top-2.5 text-[9px] text-muted">wł.b.</span>
                                </div>
                                <button type="button" onClick={() => removeDisciplineFromEvent(idx)} className="p-2 text-muted hover:text-danger rounded hover:bg-card-hover flex-shrink-0">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                        {editingEventDisciplines.length > 1 && (
                          <p className="text-xs text-muted text-right">
                            Suma za wszystkie dyscypliny: <span className="font-semibold text-foreground">
                              {editingEventDisciplines.reduce((s, d) => s + (parseFloat(d.price_pln) || 0), 0).toFixed(0)} zl
                            </span>
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ---- Lane blocking for events ---- */}
                  {shootingLanes.length > 0 && (
                    <div>
                      <label className="text-sm font-medium flex items-center gap-1 mb-2">
                        <MapPin className="w-4 h-4 text-primary" />
                        Blokada osi na wydarzenie
                      </label>
                      <p className="text-xs text-muted mb-2">Wybrane osie zostaną automatycznie zarezerwowane na czas wydarzenia.</p>
                      <div className="space-y-1.5">
                        {shootingLanes.filter(l => l.is_active).map(lane => (
                          <label key={lane.id} className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-lg border border-border hover:bg-card-hover transition-colors">
                            <input
                              type="checkbox"
                              checked={eventLaneIds.includes(lane.id)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setEventLaneIds(prev => [...prev, lane.id])
                                } else {
                                  setEventLaneIds(prev => prev.filter(id => id !== lane.id))
                                }
                              }}
                              className="w-4 h-4 accent-primary"
                            />
                            <span className="text-sm">{lane.name}</span>
                            <span className="text-xs text-muted ml-auto">{lane.length_m}m · {lane.stations_count} stanowisk</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={eventForm.is_published} onChange={e => setEventForm(f => ({ ...f, is_published: e.target.checked }))} className="w-4 h-4 accent-primary" />
                    <span className="text-sm">Opublikowane (widoczne w kalendarzu)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={eventForm.allow_target_photos} onChange={e => setEventForm(f => ({ ...f, allow_target_photos: e.target.checked }))} className="w-4 h-4 accent-primary" />
                    <span className="text-sm">Zezwól na zdjęcia tarczy (sędzia może fotografować tarcze)</span>
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
  )
}
