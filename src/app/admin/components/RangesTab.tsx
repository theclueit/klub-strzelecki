'use client'

import { Plus, Pencil, Trash2, Save, Ban, Crosshair, Package, Target } from 'lucide-react'
import type { EventRow, ShootingLane, LaneReservation, RangeWeapon, ShootingPackage, InventoryItem } from '@/types/admin'

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

export interface RangesTabProps {
  // Sub-tab state
  rangeSubTab: 'lanes' | 'packages' | 'weapons'
  setRangeSubTab: (v: 'lanes' | 'packages' | 'weapons') => void

  // Shooting lanes
  shootingLanes: ShootingLane[]
  showLaneForm: boolean
  setShowLaneForm: (v: boolean) => void
  editingLane: ShootingLane | null
  laneForm: any
  setLaneForm: (fn: (f: any) => any) => void
  openNewLane: () => void
  openEditLane: (lane: ShootingLane) => void
  saveLane: () => void
  deleteLane: (id: string) => void

  // Lane reservations
  laneReservations: LaneReservation[]
  laneResDate: string
  setLaneResDate: (v: string) => void
  laneResFilter: string
  setLaneResFilter: (v: string) => void
  toggleResPaid: (id: string, paid: boolean) => void
  cancelReservation: (id: string) => void

  // Event block
  showEventBlockForm: boolean
  setShowEventBlockForm: (v: boolean) => void
  eventBlockForm: any
  setEventBlockForm: (fn: (f: any) => any) => void
  blockLaneForEvent: () => void
  events: EventRow[]

  // Packages
  shootingPackages: ShootingPackage[]
  showPackageForm: boolean
  setShowPackageForm: (v: boolean) => void
  editingPackage: ShootingPackage | null
  packageForm: any
  setPackageForm: (fn: (f: any) => any) => void
  openNewPackage: () => void
  openEditPackage: (pkg: ShootingPackage) => void
  savePackage: () => void
  deletePackage: (id: string) => void
  togglePackageActive: (id: string, isActive: boolean) => void

  // Weapons
  rangeWeapons: RangeWeapon[]
  showWeaponForm: boolean
  setShowWeaponForm: (v: boolean) => void
  editingWeapon: RangeWeapon | null
  setEditingWeapon: (v: RangeWeapon | null) => void
  weaponForm: any
  setWeaponForm: (fn: (f: any) => any) => void
  saveWeapon: () => void
  deleteWeapon: (id: string) => void
  updateWeaponStatus: (id: string, status: string) => void
  inventoryItems: InventoryItem[]

  // Instructor schedule modal
  instructorsList: { id: string; full_name: string }[]
  showInstructorScheduleForm: boolean
  setShowInstructorScheduleForm: (v: boolean) => void
  instructorScheduleForm: any
  setInstructorScheduleForm: (fn: (f: any) => any) => void
  saveInstructorSchedule: () => void
}

export default function RangesTab({
  rangeSubTab,
  setRangeSubTab,
  shootingLanes,
  showLaneForm,
  setShowLaneForm,
  editingLane,
  laneForm,
  setLaneForm,
  openNewLane,
  openEditLane,
  saveLane,
  deleteLane,
  laneReservations,
  laneResDate,
  setLaneResDate,
  laneResFilter,
  setLaneResFilter,
  toggleResPaid,
  cancelReservation,
  showEventBlockForm,
  setShowEventBlockForm,
  eventBlockForm,
  setEventBlockForm,
  blockLaneForEvent,
  events,
  shootingPackages,
  showPackageForm,
  setShowPackageForm,
  editingPackage,
  packageForm,
  setPackageForm,
  openNewPackage,
  openEditPackage,
  savePackage,
  deletePackage,
  togglePackageActive,
  rangeWeapons,
  showWeaponForm,
  setShowWeaponForm,
  editingWeapon,
  setEditingWeapon,
  weaponForm,
  setWeaponForm,
  saveWeapon,
  deleteWeapon,
  updateWeaponStatus,
  inventoryItems,
  instructorsList,
  showInstructorScheduleForm,
  setShowInstructorScheduleForm,
  instructorScheduleForm,
  setInstructorScheduleForm,
  saveInstructorSchedule,
}: RangesTabProps) {
  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6 border-b border-border">
        {[
          { key: 'lanes' as const, label: 'Osie i rezerwacje', icon: Crosshair },
          { key: 'packages' as const, label: 'Pakiety', icon: Package },
          { key: 'weapons' as const, label: 'Broń klubowa', icon: Target },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setRangeSubTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              rangeSubTab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Sub-tab: Osie i rezerwacje */}
      {rangeSubTab === 'lanes' && (
      <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Osie strzeleckie ({shootingLanes.length})</h2>
        <div className="flex gap-2">
          <button onClick={() => { setShowEventBlockForm(true); setEventBlockForm(() => ({ lane_id: shootingLanes[0]?.id || '', event_id: '', date: '', start_time: '08:00', end_time: '20:00', stations: '' })) }} className="flex items-center gap-2 px-4 py-2 border border-border text-sm font-medium rounded-lg hover:bg-card transition-colors">
            <Ban className="w-4 h-4" />
            Zablokuj na zawody
          </button>
          <button onClick={openNewLane} className="flex items-center gap-2 px-4 py-2 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors">
            <Plus className="w-4 h-4" />
            Dodaj oś
          </button>
        </div>
      </div>

      {/* Lista osi */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {shootingLanes.map(lane => (
          <div key={lane.id} className={`bg-card border rounded-xl p-4 ${lane.is_active ? 'border-border' : 'border-red-500/30 opacity-60'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">{lane.name}</h3>
              <div className="flex gap-1">
                <button onClick={() => openEditLane(lane)} className="p-1.5 rounded hover:bg-background"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => deleteLane(lane.id)} className="p-1.5 rounded hover:bg-background text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </div>
            <div className="space-y-1 text-sm text-muted">
              <p>Długość: <span className="text-foreground font-medium">{lane.length_m}m</span></p>
              <p>Stanowiska: <span className="text-foreground font-medium">{lane.stations_count}</span></p>
              <p>Godziny: <span className="text-foreground font-medium">{(lane as any).open_time?.slice(0,5) || '08:00'} – {(lane as any).close_time?.slice(0,5) || '20:00'}</span></p>
              <p>Cena: <span className="text-foreground font-medium">{lane.price_per_hour_pln > 0 ? `${lane.price_per_hour_pln} zł/h` : 'bezpłatne'}</span></p>
              {lane.description && <p className="text-xs">{lane.description}</p>}
              {!lane.is_active && <span className="inline-block px-2 py-0.5 bg-red-500/10 text-red-500 text-xs rounded">Nieaktywna</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Rezerwacje na dany dzień */}
      <div className="border-t border-border pt-6">
        <h3 className="text-lg font-semibold mb-4">Rezerwacje</h3>
        <div className="flex gap-3 mb-4">
          <input
            type="date"
            value={laneResDate}
            onChange={e => setLaneResDate(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded-lg text-sm"
          />
          <select
            value={laneResFilter}
            onChange={e => setLaneResFilter(e.target.value)}
            className="px-3 py-2 bg-card border border-border rounded-lg text-sm"
          >
            <option value="all">Wszystkie osie</option>
            {shootingLanes.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        {laneReservations.length === 0 ? (
          <p className="text-muted text-sm py-4">Brak rezerwacji na wybrany dzień.</p>
        ) : (
          <div className="space-y-2">
            {laneReservations.map(res => (
              <div key={res.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-8 rounded-full ${res.event_id ? 'bg-blue-500' : res.paid ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <div>
                    <div className="font-medium text-sm">
                      {(res.lane as any)?.name || 'Tor'} · Stanowisko {res.station_number}
                    </div>
                    <div className="text-xs text-muted">
                      {res.start_time.slice(0, 5)} – {res.end_time.slice(0, 5)}
                      {' · '}
                      {res.event_id
                        ? <span className="text-blue-500">{(res.event as any)?.title || 'Zawody'}</span>
                        : (res.member as any)?.full_name || res.guest_name || 'Anonim'
                      }
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!res.event_id && (
                    <button
                      onClick={() => toggleResPaid(res.id, !res.paid)}
                      className={`px-2.5 py-1 rounded text-xs font-medium ${
                        res.paid ? 'bg-green-500/10 text-green-500' : 'bg-yellow-500/10 text-yellow-500'
                      }`}
                    >
                      {res.paid ? '✓ Opłacone' : '○ Nieopłacone'}
                    </button>
                  )}
                  {res.event_id && (
                    <span className="px-2.5 py-1 rounded text-xs font-medium bg-blue-500/10 text-blue-500">Zawody</span>
                  )}
                  <button onClick={() => cancelReservation(res.id)} className="p-1.5 rounded hover:bg-background text-red-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      </div>
      )}

      {/* Sub-tab: Pakiety */}
      {rangeSubTab === 'packages' && (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Pakiety strzeleckie ({shootingPackages.length})</h3>
          <button onClick={openNewPackage} className="px-3 py-1.5 bg-primary text-background text-xs font-semibold rounded-lg hover:bg-primary-dark">+ Dodaj pakiet</button>
        </div>
        {shootingPackages.length === 0 ? (
          <p className="text-muted text-sm">Brak pakietów. Dodaj pierwszy.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {shootingPackages.map(pkg => (
              <div key={pkg.id} className={`bg-card border rounded-xl p-4 ${pkg.is_active ? 'border-border' : 'border-border/30 opacity-60'}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-sm">{pkg.name}</h4>
                    <p className="text-xs text-muted">{rangeWeapons.find(w => w.id === pkg.weapon_id)?.name || '—'}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${pkg.is_active ? 'bg-green-500/20 text-green-400' : 'bg-zinc-500/20 text-zinc-400'}`}>
                    {pkg.is_active ? 'Aktywny' : 'Nieaktywny'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted mb-2">
                  <span>{pkg.ammo_count} szt.</span>
                  <span>{pkg.duration_minutes} min</span>
                  <span className="font-semibold text-primary">{Number(pkg.price_pln).toFixed(0)} zł</span>
                </div>
                {pkg.description && <p className="text-xs text-muted mb-2 line-clamp-2">{pkg.description}</p>}
                <div className="flex gap-1">
                  <button onClick={() => openEditPackage(pkg)} className="text-xs px-2 py-1 border border-border rounded hover:bg-background">Edytuj</button>
                  <button onClick={() => togglePackageActive(pkg.id, pkg.is_active)} className="text-xs px-2 py-1 border border-border rounded hover:bg-background">
                    {pkg.is_active ? 'Dezaktywuj' : 'Aktywuj'}
                  </button>
                  <button onClick={() => deletePackage(pkg.id)} className="text-xs px-2 py-1 border border-red-500/30 text-red-400 rounded hover:bg-red-500/10">Usuń</button>
                </div>
              </div>
            ))}
          </div>
        )}

      {/* Modal pakietu */}
      {showPackageForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">{editingPackage ? 'Edytuj pakiet' : 'Nowy pakiet'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-muted mb-1">Nazwa *</label>
                <input value={packageForm.name} onChange={e => setPackageForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" placeholder="np. Pistolet 9mm Standard" />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Broń</label>
                <select value={packageForm.weapon_id} onChange={e => setPackageForm(f => ({ ...f, weapon_id: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  <option value="">— brak —</option>
                  {rangeWeapons.filter(w => w.status === 'in_stock').map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.caliber})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-muted mb-1">Amunicja (szt.)</label>
                  <input type="number" value={packageForm.ammo_count} onChange={e => setPackageForm(f => ({ ...f, ammo_count: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">Czas (min)</label>
                  <input type="number" value={packageForm.duration_minutes} onChange={e => setPackageForm(f => ({ ...f, duration_minutes: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">Cena (zł)</label>
                  <input type="number" step="0.01" value={packageForm.price_pln} onChange={e => setPackageForm(f => ({ ...f, price_pln: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Opis</label>
                <textarea value={packageForm.description} onChange={e => setPackageForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none" placeholder="Opis pakietu..." />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={packageForm.is_active} onChange={e => setPackageForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                Aktywny (widoczny dla klientów)
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowPackageForm(false)} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-background">Anuluj</button>
              <button onClick={savePackage} disabled={!packageForm.name} className="flex-1 px-4 py-2.5 bg-primary text-background rounded-lg text-sm font-semibold hover:bg-primary-dark disabled:opacity-50">
                {editingPackage ? 'Zapisz' : 'Dodaj'}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
      )}

      {/* Sub-tab: Broń klubowa */}
      {rangeSubTab === 'weapons' && (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Broń klubowa ({rangeWeapons.length})</h3>
          <button
            onClick={() => {
              setEditingWeapon(null)
              setWeaponForm(() => ({ name: '', type: 'pistol', caliber: '', description: '', status: 'draft', inventory_ammo_id: '' }))
              setShowWeaponForm(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Dodaj broń
          </button>
        </div>

        {rangeWeapons.length === 0 ? (
          <p className="text-muted text-sm py-4">Brak broni. Dodaj broń, aby przypisać ją do pakietów strzeleckich.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {rangeWeapons.map(w => {
              const statusColors: Record<string, string> = {
                draft: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
                in_stock: 'bg-green-500/10 text-green-500 border-green-500/30',
                maintenance: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30',
                decommissioned: 'bg-red-500/10 text-red-500 border-red-500/30',
              }
              const statusLabels: Record<string, string> = {
                draft: 'Planowana',
                in_stock: 'Na stanie',
                maintenance: 'Serwis',
                decommissioned: 'Wycofana',
              }
              const typeLabels: Record<string, string> = { pistol: 'Pistolet', rifle: 'Karabin', shotgun: 'Strzelba', other: 'Inne' }

              return (
                <div key={w.id} className={`bg-card border rounded-xl p-4 ${w.status === 'in_stock' ? 'border-green-500/20' : w.status === 'decommissioned' ? 'border-red-500/20 opacity-50' : 'border-border'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-sm">{w.name}</h4>
                      <p className="text-xs text-muted">{typeLabels[w.type] || w.type} · {w.caliber}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingWeapon(w)
                          setWeaponForm(() => ({
                            name: w.name, type: w.type, caliber: w.caliber,
                            description: w.description || '', status: w.status,
                            inventory_ammo_id: w.inventory_ammo_id || '',
                          }))
                          setShowWeaponForm(true)
                        }}
                        className="p-1.5 rounded hover:bg-background"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteWeapon(w.id)} className="p-1.5 rounded hover:bg-background text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {w.description && <p className="text-xs text-muted mb-2">{w.description}</p>}
                  <div className="flex items-center gap-2">
                    <select
                      value={w.status}
                      onChange={e => updateWeaponStatus(w.id, e.target.value)}
                      className={`text-xs px-2 py-1 rounded-lg border font-medium ${statusColors[w.status] || 'border-border'}`}
                    >
                      <option value="draft">Planowana</option>
                      <option value="in_stock">Na stanie</option>
                      <option value="maintenance">Serwis</option>
                      <option value="decommissioned">Wycofana</option>
                    </select>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      {/* Modal: nowa/edycja broń */}
      {showWeaponForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowWeaponForm(false)}>
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editingWeapon ? 'Edytuj broń' : 'Nowa broń'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-muted mb-1">Nazwa</label>
                <input value={weaponForm.name} onChange={e => setWeaponForm(f => ({ ...f, name: e.target.value }))} placeholder="np. Glock 17 Gen5" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-muted mb-1">Typ</label>
                  <select value={weaponForm.type} onChange={e => setWeaponForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                    <option value="pistol">Pistolet</option>
                    <option value="rifle">Karabin</option>
                    <option value="shotgun">Strzelba</option>
                    <option value="other">Inne</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">Kaliber</label>
                  <input value={weaponForm.caliber} onChange={e => setWeaponForm(f => ({ ...f, caliber: e.target.value }))} placeholder="np. 9x19mm" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Status</label>
                <select value={weaponForm.status} onChange={e => setWeaponForm(f => ({ ...f, status: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  <option value="draft">Planowana (nie widoczna w ofercie)</option>
                  <option value="in_stock">Na stanie (dostępna)</option>
                  <option value="maintenance">Serwis (tymczasowo niedostępna)</option>
                  <option value="decommissioned">Wycofana</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Powiązana amunicja z magazynu</label>
                <select value={weaponForm.inventory_ammo_id} onChange={e => setWeaponForm(f => ({ ...f, inventory_ammo_id: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  <option value="">— Brak —</option>
                  {inventoryItems.filter(i => i.category === 'ammunition').map(i => (
                    <option key={i.id} value={i.id}>{i.name} ({i.caliber || '-'}) · {i.quantity} {i.unit}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Opis (opcjonalnie)</label>
                <input value={weaponForm.description} onChange={e => setWeaponForm(f => ({ ...f, description: e.target.value }))} placeholder="np. Broń krótka, ramka polimerowa" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowWeaponForm(false)} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-background">Anuluj</button>
              <button onClick={saveWeapon} disabled={!weaponForm.name || !weaponForm.caliber} className="flex-1 px-4 py-2.5 bg-primary text-background rounded-lg text-sm font-semibold hover:bg-primary-dark disabled:opacity-50">
                <Save className="w-4 h-4 inline mr-1" />
                {editingWeapon ? 'Zapisz' : 'Dodaj'}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
      )}

      {/* Modal: nowy wpis grafiku instruktora */}
      {showInstructorScheduleForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowInstructorScheduleForm(false)}>
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Dodaj dostępność instruktora</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-muted mb-1">Instruktor</label>
                <select
                  value={instructorScheduleForm.instructor_id}
                  onChange={e => setInstructorScheduleForm(f => ({ ...f, instructor_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                >
                  {instructorsList.map(i => (
                    <option key={i.id} value={i.id}>{i.full_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Dzień tygodnia</label>
                <select
                  value={instructorScheduleForm.day_of_week}
                  onChange={e => setInstructorScheduleForm(f => ({ ...f, day_of_week: e.target.value }))}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                >
                  <option value="1">Poniedziałek</option>
                  <option value="2">Wtorek</option>
                  <option value="3">Środa</option>
                  <option value="4">Czwartek</option>
                  <option value="5">Piątek</option>
                  <option value="6">Sobota</option>
                  <option value="0">Niedziela</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-muted mb-1">Od</label>
                  <TimeSelect value={instructorScheduleForm.start_time} onChange={v => setInstructorScheduleForm(f => ({ ...f, start_time: v }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">Do</label>
                  <TimeSelect value={instructorScheduleForm.end_time} onChange={v => setInstructorScheduleForm(f => ({ ...f, end_time: v }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowInstructorScheduleForm(false)} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-background">Anuluj</button>
              <button
                onClick={saveInstructorSchedule}
                disabled={!instructorScheduleForm.instructor_id}
                className="flex-1 px-4 py-2.5 bg-primary text-background rounded-lg text-sm font-semibold hover:bg-primary-dark disabled:opacity-50"
              >
                <Save className="w-4 h-4 inline mr-1" />
                Dodaj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: nowa/edycja osi */}
      {showLaneForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowLaneForm(false)}>
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editingLane ? 'Edytuj oś' : 'Nowa oś strzelecka'}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-muted mb-1">Nazwa</label>
                <input value={laneForm.name} onChange={e => setLaneForm(f => ({ ...f, name: e.target.value }))} placeholder="np. Oś 25m" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-muted mb-1">Długość (m)</label>
                  <input type="number" value={laneForm.length_m} onChange={e => setLaneForm(f => ({ ...f, length_m: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">Liczba stanowisk</label>
                  <input type="number" value={laneForm.stations_count} onChange={e => setLaneForm(f => ({ ...f, stations_count: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-muted mb-1">Otwarcie</label>
                  <TimeSelect value={laneForm.open_time} onChange={v => setLaneForm(f => ({ ...f, open_time: v }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">Zamknięcie</label>
                  <TimeSelect value={laneForm.close_time} onChange={v => setLaneForm(f => ({ ...f, close_time: v }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Cena za godzinę (zł)</label>
                <input type="number" step="0.01" value={laneForm.price_per_hour_pln} onChange={e => setLaneForm(f => ({ ...f, price_per_hour_pln: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Min. wyprzedzenie rezerwacji online</label>
                <select value={laneForm.min_advance_minutes} onChange={e => setLaneForm(f => ({ ...f, min_advance_minutes: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  <option value="0">Bez ograniczeń</option>
                  <option value="30">30 minut</option>
                  <option value="60">1 godzina</option>
                  <option value="120">2 godziny</option>
                  <option value="180">3 godziny</option>
                  <option value="360">6 godzin</option>
                  <option value="720">12 godzin</option>
                  <option value="1440">24 godziny (dzień wcześniej)</option>
                </select>
                <p className="text-[10px] text-muted mt-1">Sloty bliższe niż ten czas są dostępne tylko dla rejestratora na miejscu</p>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Opis (opcjonalnie)</label>
                <input value={laneForm.description} onChange={e => setLaneForm(f => ({ ...f, description: e.target.value }))} placeholder="np. Broń krótka, pneumatyczna" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={laneForm.is_active} onChange={e => setLaneForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                Aktywna (widoczna w rezerwacjach)
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowLaneForm(false)} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-background">Anuluj</button>
              <button onClick={saveLane} disabled={!laneForm.name} className="flex-1 px-4 py-2.5 bg-primary text-background rounded-lg text-sm font-semibold hover:bg-primary-dark disabled:opacity-50">
                <Save className="w-4 h-4 inline mr-1" />
                {editingLane ? 'Zapisz' : 'Dodaj'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: blokada na zawody */}
      {showEventBlockForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEventBlockForm(false)}>
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Zablokuj oś na zawody</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-muted mb-1">Oś</label>
                <select value={eventBlockForm.lane_id} onChange={e => setEventBlockForm(f => ({ ...f, lane_id: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  {shootingLanes.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Wydarzenie</label>
                <select value={eventBlockForm.event_id} onChange={e => setEventBlockForm(f => ({ ...f, event_id: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm">
                  <option value="">Wybierz...</option>
                  {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title} ({ev.start_date})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Data</label>
                <input type="date" value={eventBlockForm.date} onChange={e => setEventBlockForm(f => ({ ...f, date: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-muted mb-1">Od</label>
                  <TimeSelect value={eventBlockForm.start_time} onChange={v => setEventBlockForm(f => ({ ...f, start_time: v }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-muted mb-1">Do</label>
                  <TimeSelect value={eventBlockForm.end_time} onChange={v => setEventBlockForm(f => ({ ...f, end_time: v }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Stanowiska (puste = wszystkie)</label>
                <input value={eventBlockForm.stations} onChange={e => setEventBlockForm(f => ({ ...f, stations: e.target.value }))} placeholder="np. 1,2,3 lub puste dla wszystkich" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowEventBlockForm(false)} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:bg-background">Anuluj</button>
              <button onClick={blockLaneForEvent} disabled={!eventBlockForm.event_id || !eventBlockForm.date} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                <Ban className="w-4 h-4 inline mr-1" />
                Zablokuj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
