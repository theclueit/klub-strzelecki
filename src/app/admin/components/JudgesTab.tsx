'use client'

import { Shield, Crosshair, ClipboardList, Target, Users } from 'lucide-react'
import type { Member } from '@/types/database'
import type { EventRow, EventJudge } from '@/types/admin'

export interface JudgesTabProps {
  allMembers: Member[]
  events: EventRow[]
  eventJudges: EventJudge[]
  permSearchQuery: string
  setPermSearchQuery: (q: string) => void
  filterByPermSearch: (members: Member[]) => Member[]
  changeRole: (memberId: string, role: string) => void
  onUpdateInstructorLicense: (memberId: string, value: string | null) => void
  onUpdateShootingLeader: (memberId: string, checked: boolean) => void
  inputClass: string
}

export default function JudgesTab({
  allMembers,
  events,
  eventJudges,
  permSearchQuery,
  setPermSearchQuery,
  filterByPermSearch,
  changeRole,
  onUpdateInstructorLicense,
  onUpdateShootingLeader,
  inputClass,
}: JudgesTabProps) {
  return (
        <div>
          <h2 className="text-lg font-semibold mb-4">Uprawnienia i role ({allMembers.length} członków)</h2>

          {/* Wyszukiwarka */}
          <div className="mb-6">
            <input
              type="text"
              placeholder="Szukaj po imieniu, nazwisku, emailu lub licencji..."
              value={permSearchQuery}
              onChange={e => setPermSearchQuery(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Sekcja: Administratorzy */}
          {(() => {
            const admins = filterByPermSearch(allMembers.filter(m => m.role === 'admin' || m.role === 'superadmin'))
            return admins.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Administratorzy ({admins.length})
                </h3>
                <div className="bg-card border border-primary/20 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {admins.map(m => (
                        <tr key={m.id} className="border-b border-border/50 last:border-0">
                          <td className="px-4 py-3 font-medium">{m.full_name}</td>
                          <td className="px-4 py-3 text-muted">{m.email}</td>
                          <td className="px-4 py-3 text-muted">{m.license_number || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.role === 'superadmin' ? 'bg-red-500/20 text-red-400' : 'bg-primary/20 text-primary'}`}>{m.role === 'superadmin' ? 'Superadmin' : 'Admin'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          {/* Sekcja: Sędziowie */}
          {(() => {
            const judgesList = filterByPermSearch(allMembers.filter(m => m.role === 'judge' || (m.judge_license_number && ['admin', 'superadmin'].includes(m.role))))
            return (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-blue-500" />
                  Sędziowie ({judgesList.length})
                </h3>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  {judgesList.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-muted">Brak sędziów. Zmień rolę członka poniżej.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-xs text-muted">
                          <th className="text-left px-4 py-2">Imię i nazwisko</th>
                          <th className="text-left px-4 py-2">Licencja sędziowska</th>
                          <th className="text-left px-4 py-2">Klasa</th>
                          <th className="text-left px-4 py-2">Przypisane zawody</th>
                          <th className="text-left px-4 py-2 w-28">Rola</th>
                        </tr>
                      </thead>
                      <tbody>
                        {judgesList.map(j => {
                          const assignedEvents = eventJudges
                            .filter(ej => ej.judge_id === j.id)
                            .map(ej => events.find(ev => ev.id === ej.event_id))
                            .filter(Boolean)
                          return (
                            <tr key={j.id} className="border-b border-border/50 last:border-0 hover:bg-card-hover">
                              <td className="px-4 py-2.5 font-medium">{j.full_name}</td>
                              <td className="px-4 py-2.5 text-muted">{j.judge_license_number || '-'}</td>
                              <td className="px-4 py-2.5 text-muted">{j.judge_class || '-'}</td>
                              <td className="px-4 py-2.5 text-muted text-xs">
                                {assignedEvents.length === 0 ? '-' : assignedEvents.map(e => e!.title).join(', ')}
                              </td>
                              <td className="px-4 py-2.5">
                                {['admin', 'superadmin'].includes(j.role) ? (
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${j.role === 'superadmin' ? 'bg-red-500/20 text-red-400' : 'bg-primary/20 text-primary'}`}>
                                    {j.role === 'superadmin' ? 'Superadmin' : 'Admin'}
                                  </span>
                                ) : (
                                  <select
                                    value={j.role}
                                    onChange={(e) => changeRole(j.id, e.target.value)}
                                    className="bg-background border border-border rounded px-2 py-1 text-xs"
                                  >
                                    <option value="member">Członek</option>
                                    <option value="judge">Sędzia</option>
                                    <option value="registrar">Rejestrator</option>
                                    <option value="range_registrar">Rej. strzelnica</option>
                                    <option value="instructor">Instruktor</option>
                                  </select>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Sekcja: Rejestratorzy */}
          {(() => {
            const registrars = filterByPermSearch(allMembers.filter(m => m.role === 'registrar'))
            return registrars.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-green-500" />
                  Rejestratorzy ({registrars.length})
                </h3>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted">
                        <th className="text-left px-4 py-2">Imię i nazwisko</th>
                        <th className="text-left px-4 py-2">Email</th>
                        <th className="text-left px-4 py-2 w-28">Rola</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrars.map(m => (
                        <tr key={m.id} className="border-b border-border/50 last:border-0 hover:bg-card-hover">
                          <td className="px-4 py-2.5 font-medium">{m.full_name}</td>
                          <td className="px-4 py-2.5 text-muted">{m.email}</td>
                          <td className="px-4 py-2.5">
                            <select
                              value={m.role}
                              onChange={(e) => changeRole(m.id, e.target.value)}
                              className="bg-background border border-border rounded px-2 py-1 text-xs"
                            >
                              <option value="member">Członek</option>
                              <option value="judge">Sędzia</option>
                              <option value="registrar">Rejestrator</option>
                                  <option value="range_registrar">Rej. strzelnica</option>
                                  <option value="instructor">Instruktor</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          {/* Sekcja: Rejestratorzy strzelnicowi */}
          {(() => {
            const rangeRegs = filterByPermSearch(allMembers.filter(m => m.role === 'range_registrar'))
            return rangeRegs.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-orange-500" />
                  Rejestratorzy strzelnicowi ({rangeRegs.length})
                </h3>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted">
                        <th className="text-left px-4 py-2">Imię i nazwisko</th>
                        <th className="text-left px-4 py-2">Email</th>
                        <th className="text-left px-4 py-2 w-28">Rola</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rangeRegs.map(m => (
                        <tr key={m.id} className="border-b border-border/50 last:border-0 hover:bg-card-hover">
                          <td className="px-4 py-2.5 font-medium">{m.full_name}</td>
                          <td className="px-4 py-2.5 text-muted">{m.email}</td>
                          <td className="px-4 py-2.5">
                            <select
                              value={m.role}
                              onChange={(e) => changeRole(m.id, e.target.value)}
                              className="bg-background border border-border rounded px-2 py-1 text-xs"
                            >
                              <option value="member">Członek</option>
                              <option value="judge">Sędzia</option>
                              <option value="registrar">Rejestrator</option>
                              <option value="range_registrar">Rej. strzelnica</option>
                                  <option value="instructor">Instruktor</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          {/* Sekcja: Instruktorzy */}
          {(() => {
            const instructors = filterByPermSearch(allMembers.filter(m => m.role === 'instructor'))
            return instructors.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-500" />
                  Instruktorzy ({instructors.length})
                </h3>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted">
                        <th className="text-left px-4 py-2">Imię i nazwisko</th>
                        <th className="text-left px-4 py-2">Email</th>
                        <th className="text-left px-4 py-2">Licencja instruktora</th>
                        <th className="text-left px-4 py-2">Prow. strzelanie</th>
                        <th className="text-left px-4 py-2 w-28">Rola</th>
                      </tr>
                    </thead>
                    <tbody>
                      {instructors.map(m => (
                        <tr key={m.id} className="border-b border-border/50 last:border-0 hover:bg-card-hover">
                          <td className="px-4 py-2.5 font-medium">{m.full_name}</td>
                          <td className="px-4 py-2.5 text-muted">{m.email}</td>
                          <td className="px-4 py-2.5">
                            <input
                              type="text"
                              defaultValue={(m as any).instructor_license || ''}
                              placeholder="Nr licencji..."
                              onBlur={(e) => {
                                const val = e.target.value.trim()
                                onUpdateInstructorLicense(m.id, val || null)
                              }}
                              className="bg-background border border-border rounded px-2 py-1 text-xs w-full max-w-[140px]"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                defaultChecked={(m as any).has_shooting_leader || false}
                                onChange={(e) => {
                                  onUpdateShootingLeader(m.id, e.target.checked)
                                }}
                                className="w-3.5 h-3.5 accent-green-500"
                              />
                              <span className="text-xs text-muted">Prow. strzelanie</span>
                            </label>
                          </td>
                          <td className="px-4 py-2.5">
                            <select
                              value={m.role}
                              onChange={(e) => changeRole(m.id, e.target.value)}
                              className="bg-background border border-border rounded px-2 py-1 text-xs"
                            >
                              <option value="member">Członek</option>
                              <option value="judge">Sędzia</option>
                              <option value="registrar">Rejestrator</option>
                              <option value="range_registrar">Rej. strzelnica</option>
                              <option value="instructor">Instruktor</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}

          {/* Sekcja: Członkowie (bez specjalnych uprawnień) */}
          {(() => {
            const members = filterByPermSearch(allMembers.filter(m => m.role === 'member'))
            return (
              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted" />
                  Członkowie ({members.length})
                </h3>
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-muted">
                        <th className="text-left px-4 py-2">Imię i nazwisko</th>
                        <th className="text-left px-4 py-2">Email</th>
                        <th className="text-left px-4 py-2">Licencja</th>
                        <th className="text-left px-4 py-2 w-28">Rola</th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map(m => (
                        <tr key={m.id} className="border-b border-border/50 last:border-0 hover:bg-card-hover">
                          <td className="px-4 py-2.5 font-medium">{m.full_name}</td>
                          <td className="px-4 py-2.5 text-muted">{m.email}</td>
                          <td className="px-4 py-2.5 text-muted">{m.license_number || '-'}</td>
                          <td className="px-4 py-2.5">
                            <select
                              value={m.role}
                              onChange={(e) => changeRole(m.id, e.target.value)}
                              className="bg-background border border-border rounded px-2 py-1 text-xs"
                            >
                              <option value="member">Członek</option>
                              <option value="judge">Sędzia</option>
                              <option value="registrar">Rejestrator</option>
                                  <option value="range_registrar">Rej. strzelnica</option>
                                  <option value="instructor">Instruktor</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })()}
        </div>
  )
}
