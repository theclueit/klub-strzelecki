'use client'

import { Plus, Pencil, Trash2, X, Save, DollarSign, Package } from 'lucide-react'
import type { Discipline } from '@/types/database'
import type { FormEvent, Dispatch, SetStateAction } from 'react'

export interface DisciplineFormData {
  name: string
  description: string
  target_type: string
  category: string
  default_price_pln: string
  own_weapon_price_pln: string
  stations_count: string
  judges_per_station: string
  participants_per_hour: string
  caliber: string
  shots_count: string
  ammo_per_pack: string
  targets_per_competitor: string
  distance_m: string
  target_name: string
}

export interface DisciplinesTabProps {
  disciplines: Discipline[]
  openNewDiscipline: () => void
  openEditDiscipline: (d: Discipline) => void
  deleteDiscipline: (id: string) => void
  showDisciplineForm: boolean
  setShowDisciplineForm: (v: boolean) => void
  editingDiscipline: Discipline | null
  disciplineForm: DisciplineFormData
  setDisciplineForm: Dispatch<SetStateAction<DisciplineFormData>>
  saveDiscipline: (e: FormEvent) => void
  saving: boolean
  error: string
  inputClass: string
}

export default function DisciplinesTab({
  disciplines,
  openNewDiscipline,
  openEditDiscipline,
  deleteDiscipline,
  showDisciplineForm,
  setShowDisciplineForm,
  editingDiscipline,
  disciplineForm,
  setDisciplineForm,
  saveDiscipline,
  saving,
  error,
  inputClass,
}: DisciplinesTabProps) {
  return (
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
              <th className="text-left px-4 py-3">Kategoria</th>
              <th className="text-left px-4 py-3">Kaliber</th>
              <th className="text-right px-4 py-3">Strzałów</th>
              <th className="text-right px-4 py-3">Cena</th>
              <th className="text-right px-4 py-3">Stanowiska</th>
              <th className="text-right px-4 py-3 w-24">Akcje</th>
            </tr>
          </thead>
          <tbody>
            {disciplines.map(d => (
              <tr key={d.id} className="border-b border-border/50 hover:bg-card-hover">
                <td className="px-4 py-3 text-sm">
                  <span className="font-medium">{d.name}</span>
                  {d.distance_m ? <span className="text-muted text-xs ml-1.5">({d.distance_m}m)</span> : null}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${d.category === 'service' ? 'bg-blue-500/20 text-blue-400' : 'bg-primary/20 text-primary'}`}>
                    {d.category === 'service' ? 'Usługa' : 'Dyscyplina'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-muted">{d.caliber ?? '-'}</td>
                <td className="px-4 py-3 text-right text-sm">{d.category === 'discipline' ? <>{d.shots_count}<span className="text-muted text-xs ml-0.5">/{d.ammo_per_pack}pacz</span></> : '-'}</td>
                <td className="px-4 py-3 text-right text-sm">{Number(d.default_price_pln).toFixed(0)} zł</td>
                <td className="px-4 py-3 text-right text-sm">{d.stations_count}</td>
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
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h2 className="text-lg font-bold">{editingDiscipline ? 'Edytuj dyscyplinę' : 'Nowa dyscyplina'}</h2>
              <button type="button" onClick={() => setShowDisciplineForm(false)} className="p-1.5 text-muted hover:text-foreground rounded-lg hover:bg-card-hover"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={saveDiscipline} className="overflow-y-auto flex-1 px-6 py-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {/* Left column: basic info */}
                <div className="col-span-2 grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted block mb-1">Nazwa *</label>
                    <input required value={disciplineForm.name} onChange={e => setDisciplineForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">Kategoria</label>
                      <select value={disciplineForm.category} onChange={e => setDisciplineForm(f => ({ ...f, category: e.target.value }))} className={inputClass}>
                        <option value="discipline">Dyscyplina</option>
                        <option value="service">Usługa</option>
                      </select>
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
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="text-xs text-muted block mb-1">Opis</label>
                  <textarea value={disciplineForm.description} onChange={e => setDisciplineForm(f => ({ ...f, description: e.target.value }))} rows={2} className={inputClass + ' resize-none'} />
                </div>

                {/* Pricing row */}
                <div className="col-span-2">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Ceny</p>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-muted block mb-1">Cena domyślna (zł)</label>
                      <input type="number" step="0.01" min="0" value={disciplineForm.default_price_pln} onChange={e => setDisciplineForm(f => ({ ...f, default_price_pln: e.target.value }))} className={inputClass} placeholder="0" />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Własna broń (zł)</label>
                      <input type="number" step="0.01" min="0" value={disciplineForm.own_weapon_price_pln} onChange={e => setDisciplineForm(f => ({ ...f, own_weapon_price_pln: e.target.value }))} className={inputClass} placeholder="0" />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Stanowiska</label>
                      <input type="number" min="0" value={disciplineForm.stations_count} onChange={e => setDisciplineForm(f => ({ ...f, stations_count: e.target.value }))} className={inputClass} />
                    </div>
                    <div>
                      <label className="text-xs text-muted block mb-1">Zaw./godz.</label>
                      <input type="number" min="0" value={disciplineForm.participants_per_hour} onChange={e => setDisciplineForm(f => ({ ...f, participants_per_hour: e.target.value }))} className={inputClass} />
                    </div>
                  </div>
                </div>

                {/* Ammo & materials — only for discipline category */}
                {disciplineForm.category === 'discipline' && (
                  <div className="col-span-2">
                    <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5"><Package className="w-3.5 h-3.5" /> Amunicja i materiały</p>
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div>
                        <label className="text-xs text-muted block mb-1">Kaliber</label>
                        <input value={disciplineForm.caliber} onChange={e => setDisciplineForm(f => ({ ...f, caliber: e.target.value }))} className={inputClass} placeholder="9x19mm" />
                      </div>
                      <div>
                        <label className="text-xs text-muted block mb-1">Dystans (m)</label>
                        <input type="number" min="0" value={disciplineForm.distance_m} onChange={e => setDisciplineForm(f => ({ ...f, distance_m: e.target.value }))} className={inputClass} placeholder="25" />
                      </div>
                      <div>
                        <label className="text-xs text-muted block mb-1">Strzałów/os.</label>
                        <input type="number" min="0" value={disciplineForm.shots_count} onChange={e => setDisciplineForm(f => ({ ...f, shots_count: e.target.value }))} className={inputClass} />
                      </div>
                      <div>
                        <label className="text-xs text-muted block mb-1">Szt./paczka</label>
                        <input type="number" min="1" value={disciplineForm.ammo_per_pack} onChange={e => setDisciplineForm(f => ({ ...f, ammo_per_pack: e.target.value }))} className={inputClass} />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      <div className="col-span-2">
                        <label className="text-xs text-muted block mb-1">Nazwa tarczy</label>
                        <input value={disciplineForm.target_name} onChange={e => setDisciplineForm(f => ({ ...f, target_name: e.target.value }))} className={inputClass} placeholder="np. TP-4" />
                      </div>
                      <div>
                        <label className="text-xs text-muted block mb-1">Tarcz/os.</label>
                        <input type="number" min="0" value={disciplineForm.targets_per_competitor} onChange={e => setDisciplineForm(f => ({ ...f, targets_per_competitor: e.target.value }))} className={inputClass} />
                      </div>
                      <div>
                        <label className="text-xs text-muted block mb-1">Sędz./stan.</label>
                        <input type="number" min="0" value={disciplineForm.judges_per_station} onChange={e => setDisciplineForm(f => ({ ...f, judges_per_station: e.target.value }))} className={inputClass} />
                      </div>
                    </div>
                    <p className="text-xs text-muted mt-2">Zapotrzebowanie na amunicję i tarcze obliczane automatycznie na podstawie zapisanych uczestników.</p>
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-danger mt-3">{error}</p>}
            </form>
            <div className="flex gap-2 px-6 py-4 border-t border-border shrink-0">
              <button onClick={saveDiscipline} disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark disabled:opacity-50">
                <Save className="w-4 h-4" />
                {saving ? 'Zapisywanie...' : 'Zapisz'}
              </button>
              <button type="button" onClick={() => setShowDisciplineForm(false)} className="px-4 py-2.5 border border-border text-sm rounded-lg hover:bg-card-hover">
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
