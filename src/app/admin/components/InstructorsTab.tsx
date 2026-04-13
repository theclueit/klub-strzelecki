'use client'

import { Plus, Check, X, Trash2 } from 'lucide-react'
import type { Member } from '@/types/database'
import type { InstructorAvailability } from '@/types/admin'

export interface InstructorsTabProps {
  instructorAvailability: InstructorAvailability[]
  instructorsList: { id: string; full_name: string }[]
  allMembers: Member[]
  setShowInstructorScheduleForm: (v: boolean) => void
  setInstructorScheduleForm: (fn: (f: any) => any) => void
  toggleInstructorAvailability: (id: string, isActive: boolean) => void
  deleteInstructorAvailability: (id: string) => void
}

export default function InstructorsTab({
  instructorAvailability,
  instructorsList,
  allMembers,
  setShowInstructorScheduleForm,
  setInstructorScheduleForm,
  toggleInstructorAvailability,
  deleteInstructorAvailability,
}: InstructorsTabProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Grafik instruktorów</h2>
        <button
          onClick={() => {
            setInstructorScheduleForm(() => ({ instructor_id: instructorsList[0]?.id || '', day_of_week: '1', start_time: '09:00', end_time: '17:00' }))
            setShowInstructorScheduleForm(true)
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors"
        >
          <Plus className="w-4 h-4" />
          Dodaj dostępność
        </button>
      </div>

      {instructorAvailability.length === 0 ? (
        <p className="text-muted text-sm py-4">Brak zdefiniowanego grafiku instruktorów.</p>
      ) : (
        <div className="space-y-3">
          {(() => {
            const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota']
            const grouped = new Map<string, typeof instructorAvailability>()
            for (const avail of instructorAvailability) {
              const name = (avail.instructor as any)?.full_name || 'Nieznany'
              if (!grouped.has(name)) grouped.set(name, [])
              grouped.get(name)!.push(avail)
            }
            return Array.from(grouped.entries()).map(([name, avails]) => (
              <div key={name} className="bg-card border border-border rounded-xl p-4">
                <h4 className="font-semibold text-sm mb-2">{name}</h4>
                <div className="flex flex-wrap gap-2">
                  {avails.sort((a, b) => a.day_of_week - b.day_of_week).map(avail => (
                    <div
                      key={avail.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-colors ${
                        avail.is_active
                          ? 'border-green-500/30 bg-green-500/5 text-green-400'
                          : 'border-border bg-background text-muted line-through'
                      }`}
                    >
                      <span className="font-medium">{dayNames[avail.day_of_week]}</span>
                      <span>{avail.start_time.slice(0, 5)}–{avail.end_time.slice(0, 5)}</span>
                      <button
                        onClick={() => toggleInstructorAvailability(avail.id, !avail.is_active)}
                        className="ml-1 p-0.5 rounded hover:bg-background"
                        title={avail.is_active ? 'Wyłącz' : 'Włącz'}
                      >
                        {avail.is_active ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => deleteInstructorAvailability(avail.id)}
                        className="p-0.5 rounded hover:bg-background text-red-500"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          })()}
        </div>
      )}

      {/* Lista instruktorów */}
      <div className="border-t border-border pt-6 mt-6">
        <h3 className="text-lg font-semibold mb-4">Instruktorzy ({allMembers.filter(m => m.role === 'instructor').length})</h3>
        {(() => {
          const instructors = allMembers.filter(m => m.role === 'instructor')
          return instructors.length === 0 ? (
            <p className="text-muted text-sm">Brak instruktorów. Zmień rolę członka na &quot;Instruktor&quot; w zakładce Uprawnienia.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {instructors.map(i => (
                <div key={i.id} className="bg-card border border-border rounded-xl p-4">
                  <p className="font-semibold text-sm">{i.full_name}</p>
                  <p className="text-xs text-muted">{i.email}</p>
                  <p className="text-xs text-muted mt-1">{i.phone || 'Brak telefonu'}</p>
                </div>
              ))}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
