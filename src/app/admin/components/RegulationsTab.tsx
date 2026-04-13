'use client'

import { Clock, Pencil } from 'lucide-react'
import type { Regulation } from '@/types/admin'

export interface RegulationsTabProps {
  regulations: Regulation[]
  regulationHistory: Regulation[]
  setRegulationHistory: (v: Regulation[]) => void
  editingRegulation: Regulation | null
  setEditingRegulation: (v: Regulation | null) => void
  regContent: string
  setRegContent: (v: string) => void
  historySlug: string | null
  setHistorySlug: (v: string | null) => void
  savingReg: boolean
  setSavingReg: (v: boolean) => void
  member: { id: string } | null
  supabase: any
  loadAll: () => void
}

export default function RegulationsTab({
  regulations,
  regulationHistory,
  setRegulationHistory,
  editingRegulation,
  setEditingRegulation,
  regContent,
  setRegContent,
  historySlug,
  setHistorySlug,
  savingReg,
  setSavingReg,
  member,
  supabase,
  loadAll,
}: RegulationsTabProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Regulaminy i zasady</h2>
      </div>

      {/* Active regulations list */}
      <div className="space-y-3">
        {regulations.map(reg => (
          <div key={reg.id} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">{reg.title}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">v{reg.version}</span>
                  <span>Slug: {reg.slug}</span>
                  <span>Ostatnia zmiana: {new Date(reg.updated_at).toLocaleDateString('pl-PL')}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    setHistorySlug(historySlug === reg.slug ? null : reg.slug)
                    if (historySlug !== reg.slug) {
                      const { data } = await supabase
                        .from('regulations')
                        .select('*')
                        .eq('slug', reg.slug)
                        .order('version', { ascending: false })
                      setRegulationHistory((data ?? []) as Regulation[])
                    }
                  }}
                  className="px-3 py-1.5 text-xs rounded border border-border hover:bg-card-hover transition-colors"
                >
                  <Clock className="w-3.5 h-3.5 inline mr-1" />
                  Historia
                </button>
                <button
                  onClick={() => {
                    setEditingRegulation(reg)
                    setRegContent(reg.content)
                  }}
                  className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5 inline mr-1" />
                  Edytuj
                </button>
              </div>
            </div>

            {/* Version history */}
            {historySlug === reg.slug && (
              <div className="mt-4 border-t border-border pt-4">
                <h4 className="text-sm font-medium mb-2">Historia wersji</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {regulationHistory.map(ver => (
                    <div key={ver.id} className={`flex items-center justify-between p-2 rounded text-xs ${ver.is_active ? 'bg-primary/10 border border-primary/30' : 'bg-background'}`}>
                      <div>
                        <span className="font-medium">v{ver.version}</span>
                        <span className="text-muted ml-2">{new Date(ver.created_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        {ver.is_active && <span className="ml-2 text-primary font-medium">(aktualna)</span>}
                      </div>
                      {!ver.is_active && (
                        <button
                          onClick={async () => {
                            if (!confirm(`Przywrócić wersję ${ver.version}?`)) return
                            setSavingReg(true)
                            await supabase.from('regulations').update({ is_active: false }).eq('slug', reg.slug).eq('is_active', true)
                            await supabase.from('regulations').insert({
                              slug: reg.slug,
                              title: reg.title,
                              content: ver.content,
                              version: reg.version + 1,
                              is_active: true,
                              created_by: member?.id || null,
                            })
                            setSavingReg(false)
                            setHistorySlug(null)
                            loadAll()
                          }}
                          className="px-2 py-1 rounded border border-border hover:bg-card-hover transition-colors"
                          disabled={savingReg}
                        >
                          Przywróć
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inline editor */}
            {editingRegulation?.id === reg.id && (
              <div className="mt-4 border-t border-border pt-4">
                <textarea
                  value={regContent}
                  onChange={e => setRegContent(e.target.value)}
                  rows={15}
                  className="w-full p-3 bg-background border border-border rounded-lg text-sm font-mono resize-y"
                  placeholder="Treść regulaminu (HTML dozwolony)..."
                />
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-muted">Zapisanie utworzy nową wersję (v{reg.version + 1})</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setEditingRegulation(null); setRegContent('') }}
                      className="px-3 py-1.5 text-xs rounded border border-border hover:bg-card-hover transition-colors"
                    >
                      Anuluj
                    </button>
                    <button
                      onClick={async () => {
                        if (regContent.trim() === reg.content.trim()) {
                          alert('Nie wprowadzono żadnych zmian.')
                          return
                        }
                        setSavingReg(true)
                        await supabase.from('regulations').update({ is_active: false }).eq('id', reg.id)
                        await supabase.from('regulations').insert({
                          slug: reg.slug,
                          title: reg.title,
                          content: regContent,
                          version: reg.version + 1,
                          is_active: true,
                          created_by: member?.id || null,
                        })
                        setSavingReg(false)
                        setEditingRegulation(null)
                        setRegContent('')
                        loadAll()
                      }}
                      disabled={savingReg}
                      className="px-4 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {savingReg ? 'Zapisywanie...' : 'Zapisz nową wersję'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}

        {regulations.length === 0 && (
          <p className="text-muted text-center py-8">Brak regulaminów w bazie danych.</p>
        )}
      </div>
    </div>
  )
}
