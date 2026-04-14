'use client'

import React from 'react'
import {
  Package, Plus, AlertTriangle, Crosshair, CircleDot, Zap, Boxes,
  ChevronDown, ChevronUp, MapPin, ArrowDownUp, History, Pencil, Trash2,
  Save, X,
} from 'lucide-react'
import type { InventoryItem, InventoryTransaction } from '@/types/admin'

interface InventoryForm {
  name: string
  category: string
  description: string
  caliber: string
  quantity: string
  unit: string
  purchase_price_pln: string
  sell_price_pln: string
  purchase_date: string
  supplier: string
  min_stock_level: string
  location: string
}

interface StockAdjustForm {
  type: 'in' | 'out'
  quantity: string
  note: string
}

export interface InventoryTabProps {
  inventoryItems: InventoryItem[]
  inventoryFilter: string
  setInventoryFilter: (filter: string) => void
  collapsedGroups: Set<string>
  setCollapsedGroups: React.Dispatch<React.SetStateAction<Set<string>>>
  showInventoryForm: boolean
  setShowInventoryForm: (show: boolean) => void
  editingInventory: InventoryItem | null
  inventoryForm: InventoryForm
  setInventoryForm: React.Dispatch<React.SetStateAction<InventoryForm>>
  saveInventory: (e: React.FormEvent) => void
  openAddInventory: () => void
  openEditInventory: (item: InventoryItem) => void
  deleteInventory: (id: string) => void
  showStockAdjust: InventoryItem | null
  setShowStockAdjust: (item: InventoryItem | null) => void
  stockAdjustForm: StockAdjustForm
  setStockAdjustForm: React.Dispatch<React.SetStateAction<StockAdjustForm>>
  saveStockAdjust: (e: React.FormEvent) => void
  showTransactionHistory: string | null
  setShowTransactionHistory: (id: string | null) => void
  transactions: InventoryTransaction[]
  loadTransactions: (itemId: string) => void
  inputClass: string
}

export default function InventoryTab({
  inventoryItems,
  inventoryFilter,
  setInventoryFilter,
  collapsedGroups,
  setCollapsedGroups,
  showInventoryForm,
  setShowInventoryForm,
  editingInventory,
  inventoryForm,
  setInventoryForm,
  saveInventory,
  openAddInventory,
  openEditInventory,
  deleteInventory,
  showStockAdjust,
  setShowStockAdjust,
  stockAdjustForm,
  setStockAdjustForm,
  saveStockAdjust,
  showTransactionHistory,
  setShowTransactionHistory,
  transactions,
  loadTransactions,
  inputClass,
}: InventoryTabProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          Magazyn ({inventoryItems.length})
        </h2>
        <button onClick={openAddInventory} className="flex items-center gap-2 bg-primary text-background px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors">
          <Plus className="w-4 h-4" />
          Dodaj pozycję
        </button>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { key: 'all', label: 'Wszystko', count: inventoryItems.length },
          { key: 'ammunition', label: 'Amunicja', count: inventoryItems.filter(i => i.category === 'ammunition').length },
          { key: 'targets', label: 'Tarcze / Rzutki', count: inventoryItems.filter(i => i.category === 'targets').length },
          { key: 'weapons', label: 'Broń', count: inventoryItems.filter(i => i.category === 'weapons').length },
          { key: 'other', label: 'Inne', count: inventoryItems.filter(i => i.category === 'other').length },
        ].filter(f => f.count > 0 || f.key === 'all').map(f => (
          <button key={f.key} onClick={() => setInventoryFilter(f.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${inventoryFilter === f.key ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted hover:text-foreground'}`}>
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Low stock warnings */}
      {(() => {
        const lowStock = inventoryItems.filter(i => i.min_stock_level > 0 && i.quantity <= i.min_stock_level)
        if (lowStock.length === 0) return null
        return (
          <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 mb-4">
            <p className="text-sm text-warning font-medium flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4" />
              Niski stan magazynowy ({lowStock.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {lowStock.map(i => (
                <span key={i.id} className="text-xs px-2 py-1 rounded-full bg-warning/20 text-warning">
                  {i.name}: {i.quantity} {i.unit} (min. {i.min_stock_level})
                </span>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted mb-1">Wartość amunicji</p>
          <p className="text-lg font-bold">
            {inventoryItems.filter(i => i.category === 'ammunition').reduce((s, i) => s + i.quantity * Number(i.purchase_price_pln), 0).toLocaleString('pl', { minimumFractionDigits: 2 })} zł
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted mb-1">Wartość broni</p>
          <p className="text-lg font-bold">
            {inventoryItems.filter(i => i.category === 'weapons').reduce((s, i) => s + i.quantity * Number(i.purchase_price_pln), 0).toLocaleString('pl', { minimumFractionDigits: 2 })} zł
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted mb-1">Wartość całkowita</p>
          <p className="text-lg font-bold text-primary">
            {inventoryItems.reduce((s, i) => s + i.quantity * Number(i.purchase_price_pln), 0).toLocaleString('pl', { minimumFractionDigits: 2 })} zł
          </p>
        </div>
      </div>

      {/* Items grouped by caliber/type */}
      {(() => {
        const filtered = inventoryItems.filter(i => inventoryFilter === 'all' || i.category === inventoryFilter)
        if (filtered.length === 0) return <p className="text-muted text-center py-8">Brak pozycji w magazynie.</p>

        const catLabels: Record<string, string> = { ammunition: 'Amunicja', targets: 'Tarcze', weapons: 'Broń', other: 'Inne' }
        const catColors: Record<string, string> = { ammunition: 'bg-orange-500/20 text-orange-400', targets: 'bg-blue-500/20 text-blue-400', weapons: 'bg-purple-500/20 text-purple-400', other: 'bg-gray-500/20 text-gray-400' }
        const catIcons: Record<string, React.ReactNode> = {
          ammunition: <Crosshair className="w-4 h-4 text-orange-400" />,
          targets: <CircleDot className="w-4 h-4 text-blue-400" />,
          weapons: <Zap className="w-4 h-4 text-purple-400" />,
          other: <Boxes className="w-4 h-4 text-gray-400" />,
        }

        // Group by caliber (or category for items without caliber)
        const groups = new Map<string, InventoryItem[]>()
        for (const item of filtered) {
          const key = item.caliber || catLabels[item.category] || 'Inne'
          if (!groups.has(key)) groups.set(key, [])
          groups.get(key)!.push(item)
        }

        return Array.from(groups.entries()).map(([groupKey, items]) => {
          const groupTotal = items.reduce((s, i) => s + i.quantity * Number(i.purchase_price_pln), 0)
          const groupQty = items.reduce((s, i) => s + i.quantity, 0)
          const isCollapsed = collapsedGroups.has(groupKey)
          const lowCount = items.filter(i => i.min_stock_level > 0 && i.quantity <= i.min_stock_level).length
          const groupCat = items[0]?.category || 'other'
          return (
            <div key={groupKey} className="mb-4 bg-card border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => setCollapsedGroups(prev => {
                  const next = new Set(prev)
                  if (next.has(groupKey)) next.delete(groupKey)
                  else next.add(groupKey)
                  return next
                })}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-card-hover transition-colors"
              >
                <div className="flex items-center gap-2">
                  {catIcons[groupCat] || catIcons.other}
                  <span className="text-sm font-bold">{groupKey}</span>
                  <span className="text-xs text-muted font-normal">({items.length} {items.length === 1 ? 'pozycja' : 'pozycji'})</span>
                  {lowCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning font-medium">{lowCount} niski stan</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted">
                    {groupQty.toLocaleString('pl')} szt. &middot; <span className="text-primary font-semibold">{groupTotal.toLocaleString('pl', { minimumFractionDigits: 2 })} zł</span>
                  </span>
                  {isCollapsed ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronUp className="w-4 h-4 text-muted" />}
                </div>
              </button>
              {!isCollapsed && (
                <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
                  {items.map(item => {
                    const isLow = item.min_stock_level > 0 && item.quantity <= item.min_stock_level
                    const value = item.quantity * Number(item.purchase_price_pln)
                    return (
                      <div key={item.id} className={`bg-background border rounded-xl p-4 flex items-center gap-4 ${isLow ? 'border-warning/50' : 'border-border/50'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catColors[item.category] || catColors.other}`}>
                              {catLabels[item.category] || item.category}
                            </span>
                            {isLow && <span className="text-xs px-2 py-0.5 rounded-full bg-warning/20 text-warning font-medium">Niski stan!</span>}
                          </div>
                          <h3 className="font-semibold text-sm">{item.name}</h3>
                          <div className="text-xs text-muted mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                            <span>Stan: <span className="text-foreground font-medium">{item.quantity.toLocaleString('pl')} {item.unit}</span></span>
                            <span>Cena zakupu: <span className="text-foreground">{Number(item.purchase_price_pln).toFixed(2)} zł/{item.unit}</span></span>
                            {item.sell_price_pln != null && <span>Cena sprzedaży: <span className="text-foreground">{Number(item.sell_price_pln).toFixed(2)} zł/{item.unit}</span></span>}
                            <span>Wartosc: <span className="text-foreground font-medium">{value.toLocaleString('pl', { minimumFractionDigits: 2 })} zł</span></span>
                            {item.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{item.location}</span>}
                            {item.purchase_date && <span>Zakup: {new Date(item.purchase_date).toLocaleDateString('pl')}</span>}
                            {item.supplier && <span>Dostawca: {item.supplier}</span>}
                            {item.min_stock_level > 0 && <span>Min. stan: {item.min_stock_level} {item.unit}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => { setShowStockAdjust(item); setStockAdjustForm({ type: 'in', quantity: '', note: '' }) }} className="p-2 text-muted hover:text-success rounded-lg hover:bg-card-hover" title="Wydaj / Przyjmij">
                            <ArrowDownUp className="w-4 h-4" />
                          </button>
                          <button onClick={() => loadTransactions(item.id)} className="p-2 text-muted hover:text-primary rounded-lg hover:bg-card-hover" title="Historia">
                            <History className="w-4 h-4" />
                          </button>
                          <button onClick={() => openEditInventory(item)} className="p-2 text-muted hover:text-primary rounded-lg hover:bg-card-hover" title="Edytuj">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => deleteInventory(item.id)} className="p-2 text-muted hover:text-danger rounded-lg hover:bg-card-hover" title="Usuń">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })
      })()}

      {/* Inventory Form Modal */}
      {showInventoryForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">{editingInventory ? 'Edytuj pozycję' : 'Nowa pozycja magazynowa'}</h2>
            <form onSubmit={saveInventory} className="space-y-4">
              <div>
                <label className="text-xs text-muted block mb-1">Nazwa *</label>
                <input required value={inventoryForm.name} onChange={e => setInventoryForm(f => ({ ...f, name: e.target.value }))} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted block mb-1">Kategoria</label>
                  <select value={inventoryForm.category} onChange={e => setInventoryForm(f => ({ ...f, category: e.target.value }))} className={inputClass}>
                    <option value="ammunition">Amunicja</option>
                    <option value="targets">Tarcze / Rzutki</option>
                    <option value="weapons">Broń</option>
                    <option value="other">Inne</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Kaliber</label>
                  <input value={inventoryForm.caliber} onChange={e => setInventoryForm(f => ({ ...f, caliber: e.target.value }))} placeholder="np. .22 LR" className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-muted block mb-1">Ilość *</label>
                  <input type="number" min="0" required value={inventoryForm.quantity} onChange={e => setInventoryForm(f => ({ ...f, quantity: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Jednostka</label>
                  <input value={inventoryForm.unit} onChange={e => setInventoryForm(f => ({ ...f, unit: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Min. stan</label>
                  <input type="number" min="0" value={inventoryForm.min_stock_level} onChange={e => setInventoryForm(f => ({ ...f, min_stock_level: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted block mb-1">Cena zakupu (zł/szt)</label>
                  <input type="number" step="0.01" min="0" value={inventoryForm.purchase_price_pln} onChange={e => setInventoryForm(f => ({ ...f, purchase_price_pln: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Cena sprzedaży (zł/szt)</label>
                  <input type="number" step="0.01" min="0" value={inventoryForm.sell_price_pln} onChange={e => setInventoryForm(f => ({ ...f, sell_price_pln: e.target.value }))} className={inputClass} placeholder="opcjonalne" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted block mb-1">Data zakupu</label>
                  <input type="date" value={inventoryForm.purchase_date} onChange={e => setInventoryForm(f => ({ ...f, purchase_date: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted block mb-1">Dostawca</label>
                  <input value={inventoryForm.supplier} onChange={e => setInventoryForm(f => ({ ...f, supplier: e.target.value }))} placeholder="np. Kolter Wrocław" className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Lokalizacja</label>
                  <input value={inventoryForm.location} onChange={e => setInventoryForm(f => ({ ...f, location: e.target.value }))} placeholder="np. Magazyn A, Szafa 3" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Opis</label>
                <textarea value={inventoryForm.description} onChange={e => setInventoryForm(f => ({ ...f, description: e.target.value }))} rows={2} className={inputClass + ' resize-none'} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-primary text-background font-semibold py-2 rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  {editingInventory ? 'Zapisz zmiany' : 'Dodaj'}
                </button>
                <button type="button" onClick={() => setShowInventoryForm(false)} className="flex-1 border border-border text-foreground font-semibold py-2 rounded-lg hover:bg-card-hover transition-colors">
                  Anuluj
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction History Modal */}
      {showTransactionHistory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Historia wydań — {inventoryItems.find(i => i.id === showTransactionHistory)?.name}
              </h2>
              <button onClick={() => setShowTransactionHistory(null)} className="p-2 text-muted hover:text-foreground rounded-lg hover:bg-card-hover">
                <X className="w-5 h-5" />
              </button>
            </div>
            {transactions.length === 0 ? (
              <p className="text-muted text-center py-8">Brak historii transakcji.</p>
            ) : (
              <div className="space-y-2">
                {transactions.map(tx => {
                  const typeLabels: Record<string, string> = { in: 'Przyjęcie', out: 'Wydanie', event_out: 'Zawody' }
                  const typeColors: Record<string, string> = { in: 'bg-success/20 text-success', out: 'bg-orange-500/20 text-orange-400', event_out: 'bg-blue-500/20 text-blue-400' }
                  return (
                    <div key={tx.id} className="flex items-center gap-3 bg-background border border-border/50 rounded-lg p-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[tx.type] || ''}`}>
                        {tx.type === 'in' ? '+' : '-'}{tx.quantity} {inventoryItems.find(i => i.id === showTransactionHistory)?.unit || 'szt.'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColors[tx.type] || ''}`}>
                        {typeLabels[tx.type] || tx.type}
                      </span>
                      <div className="flex-1 min-w-0">
                        {tx.note && <span className="text-sm">{tx.note}</span>}
                        {tx.event && <span className="text-xs text-muted ml-2">({tx.event.title})</span>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs text-muted">{new Date(tx.created_at).toLocaleDateString('pl')} {new Date(tx.created_at).toLocaleTimeString('pl', { hour: '2-digit', minute: '2-digit' })}</div>
                        {tx.performer && <div className="text-xs text-muted">{tx.performer.full_name}</div>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showStockAdjust && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-1 flex items-center gap-2">
              <ArrowDownUp className="w-5 h-5 text-primary" />
              Wydanie / Przyjęcie
            </h2>
            <p className="text-sm text-muted mb-4">{showStockAdjust.name} — stan: {showStockAdjust.quantity} {showStockAdjust.unit}</p>
            <form onSubmit={saveStockAdjust} className="space-y-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setStockAdjustForm(f => ({ ...f, type: 'in' }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${stockAdjustForm.type === 'in' ? 'border-success bg-success/10 text-success' : 'border-border text-muted hover:text-foreground'}`}>
                  + Przyjęcie
                </button>
                <button type="button" onClick={() => setStockAdjustForm(f => ({ ...f, type: 'out' }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${stockAdjustForm.type === 'out' ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-border text-muted hover:text-foreground'}`}>
                  - Wydanie
                </button>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Ilość *</label>
                <input type="number" min="1" required value={stockAdjustForm.quantity} onChange={e => setStockAdjustForm(f => ({ ...f, quantity: e.target.value }))} className={inputClass} placeholder="Wpisz ilość" />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Notatka</label>
                <input value={stockAdjustForm.note} onChange={e => setStockAdjustForm(f => ({ ...f, note: e.target.value }))} className={inputClass} placeholder="np. Zakup, wydanie na trening" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 bg-primary text-background font-semibold py-2 rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2">
                  <Save className="w-4 h-4" />
                  Zapisz
                </button>
                <button type="button" onClick={() => setShowStockAdjust(null)} className="flex-1 border border-border text-foreground font-semibold py-2 rounded-lg hover:bg-card-hover transition-colors">
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
