'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import type { InventoryItem, InventoryTransaction, EventRow, RegDiscipline } from '@/types/admin'
import type { Discipline, EventDiscipline, Member } from '@/types/database'

interface MaterialLine {
  discipline: string
  participants: number
  caliber: string
  ammoTotal: number
  ammoPacks: number
  ammoPerPack: number
  targetsTotal: number
  targetName: string
  shotsCount: number
}

interface UseInventoryManagementParams {
  inventoryItems: InventoryItem[]
  eventDisciplines: (EventDiscipline & { discipline?: Discipline })[]
  regDisciplines: RegDiscipline[]
  disciplines: Discipline[]
  loadAll: () => Promise<void>
  getEventDiscs: (eventId: string) => (EventDiscipline & { discipline?: Discipline })[]
  member: Member | null
}

export function useInventoryManagement({
  inventoryItems,
  eventDisciplines,
  regDisciplines,
  disciplines,
  loadAll,
  getEventDiscs,
  member,
}: UseInventoryManagementParams) {
  const supabase = createSupabaseBrowser()

  const [showInventoryForm, setShowInventoryForm] = useState(false)
  const [editingInventory, setEditingInventory] = useState<InventoryItem | null>(null)
  const [inventoryFilter, setInventoryFilter] = useState<string>('all')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [inventoryForm, setInventoryForm] = useState({
    name: '', category: 'ammunition', description: '', caliber: '', quantity: '0', unit: 'szt.',
    purchase_price_pln: '0', sell_price_pln: '', purchase_date: '', supplier: '', min_stock_level: '0', location: '',
  })

  // Inventory transactions
  const [showTransactionHistory, setShowTransactionHistory] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([])
  const [showStockAdjust, setShowStockAdjust] = useState<InventoryItem | null>(null)
  const [stockAdjustForm, setStockAdjustForm] = useState({ type: 'in' as 'in' | 'out', quantity: '', note: '' })

  function getEventMaterials(eventId: string): { lines: MaterialLine[]; totals: { byCaliberAmmo: Map<string, { total: number; packs: number; perPack: number }>; byTargetTarcze: Map<string, number>; weaponsNeeded: Map<string, number> } } {
    const evDiscs = getEventDiscs(eventId)
    const lines: MaterialLine[] = []
    const byCaliberAmmo = new Map<string, { total: number; packs: number; perPack: number }>()
    const byTargetTarcze = new Map<string, number>()
    const weaponsNeeded = new Map<string, number>()

    for (const ed of evDiscs) {
      const d = ed.discipline as any
      if (!d || d.category !== 'discipline') continue
      const participants = regDisciplines.filter(rd => rd.event_discipline_id === ed.id).length
      if (participants === 0) continue

      const caliber = d.caliber || '?'
      const shotsCount = d.shots_count || 60
      const targetsPerComp = d.targets_per_competitor || 0
      const ammoPerPack = d.ammo_per_pack || 50
      const targetName = d.target_name || d.target_type || '?'

      const ammoTotal = participants * shotsCount
      const ammoPacks = Math.ceil(ammoTotal / ammoPerPack)
      const targetsTotal = participants * targetsPerComp

      lines.push({
        discipline: d.name,
        participants,
        caliber,
        ammoTotal,
        ammoPacks,
        ammoPerPack,
        targetsTotal,
        targetName,
        shotsCount,
      })

      // Aggregate by caliber
      const prev = byCaliberAmmo.get(caliber) || { total: 0, packs: 0, perPack: ammoPerPack }
      prev.total += ammoTotal
      prev.packs = Math.ceil(prev.total / prev.perPack)
      byCaliberAmmo.set(caliber, prev)

      // Aggregate targets
      byTargetTarcze.set(targetName, (byTargetTarcze.get(targetName) || 0) + targetsTotal)

      // Weapons needed (non-own-weapon participants need club weapons)
      weaponsNeeded.set(caliber, (weaponsNeeded.get(caliber) || 0) + participants)
    }

    return { lines, totals: { byCaliberAmmo, byTargetTarcze, weaponsNeeded } }
  }

  function openAddInventory() {
    setEditingInventory(null)
    setInventoryForm({ name: '', category: 'ammunition', description: '', caliber: '', quantity: '0', unit: 'szt.', purchase_price_pln: '0', sell_price_pln: '', purchase_date: '', supplier: '', min_stock_level: '0', location: '' })
    setShowInventoryForm(true)
  }

  function openEditInventory(item: InventoryItem) {
    setEditingInventory(item)
    setInventoryForm({
      name: item.name, category: item.category, description: item.description || '', caliber: item.caliber || '',
      quantity: String(item.quantity), unit: item.unit, purchase_price_pln: String(item.purchase_price_pln),
      sell_price_pln: item.sell_price_pln != null ? String(item.sell_price_pln) : '',
      purchase_date: item.purchase_date || '', supplier: item.supplier || '', min_stock_level: String(item.min_stock_level),
      location: item.location || '',
    })
    setShowInventoryForm(true)
  }

  async function saveInventory(e: React.FormEvent) {
    e.preventDefault()
    const sellPrice = inventoryForm.sell_price_pln ? parseFloat(inventoryForm.sell_price_pln) : null
    const payload = {
      name: inventoryForm.name,
      category: inventoryForm.category,
      description: inventoryForm.description || null,
      caliber: inventoryForm.caliber || null,
      quantity: parseInt(inventoryForm.quantity) || 0,
      unit: inventoryForm.unit,
      purchase_price_pln: parseFloat(inventoryForm.purchase_price_pln) || 0,
      sell_price_pln: sellPrice,
      purchase_date: inventoryForm.purchase_date || null,
      supplier: inventoryForm.supplier || null,
      min_stock_level: parseInt(inventoryForm.min_stock_level) || 0,
      location: inventoryForm.location || null,
    }
    if (editingInventory) {
      await supabase.from('inventory_items').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingInventory.id)
    } else {
      await supabase.from('inventory_items').insert(payload)
    }
    setShowInventoryForm(false)
    loadAll()
  }

  async function deleteInventory(id: string) {
    if (!confirm('Usunąć pozycję z magazynu?')) return
    await supabase.from('inventory_items').delete().eq('id', id)
    loadAll()
  }

  async function loadTransactions(itemId: string) {
    setShowTransactionHistory(itemId)
    const { data } = await supabase
      .from('inventory_transactions')
      .select('*, performer:members!inventory_transactions_performed_by_fkey(full_name), event:events!inventory_transactions_event_id_fkey(title)')
      .eq('inventory_item_id', itemId)
      .order('created_at', { ascending: false })
    setTransactions((data ?? []) as InventoryTransaction[])
  }

  async function saveStockAdjust(e: React.FormEvent) {
    e.preventDefault()
    if (!showStockAdjust || !member) return
    const qty = parseInt(stockAdjustForm.quantity)
    if (!qty || qty <= 0) return
    const item = showStockAdjust
    const newQty = stockAdjustForm.type === 'in' ? item.quantity + qty : Math.max(0, item.quantity - qty)
    await supabase.from('inventory_transactions').insert({
      inventory_item_id: item.id,
      type: stockAdjustForm.type,
      quantity: qty,
      note: stockAdjustForm.note || null,
      performed_by: member.id,
    })
    await supabase.from('inventory_items').update({ quantity: newQty, updated_at: new Date().toISOString() }).eq('id', item.id)
    setShowStockAdjust(null)
    loadAll()
  }

  async function settleEventMaterials(eventId: string) {
    // Check if already settled
    const { data: existing } = await supabase.from('inventory_transactions').select('id').eq('event_id', eventId).eq('type', 'event_out').limit(1)
    if (existing && existing.length > 0) {
      alert('Te zawody zostały już rozliczone.')
      return
    }
    if (!confirm('Rozliczyć materiały dla tych zawodów? Ilości zostaną automatycznie odjęte z magazynu.')) return
    const summary = getEventMaterials(eventId)
    if (!summary) return
    const errors: string[] = []
    // Deduct ammunition by caliber
    for (const [caliber, info] of summary.totals.byCaliberAmmo.entries()) {
      if (!caliber || caliber === '-') continue
      const matchingItems = inventoryItems.filter(i => i.category === 'ammunition' && i.caliber === caliber)
      if (matchingItems.length === 0) { errors.push(`Brak amunicji ${caliber} w magazynie`); continue }
      let remaining = info.total
      for (const item of matchingItems) {
        if (remaining <= 0) break
        const deduct = Math.min(remaining, item.quantity)
        await supabase.from('inventory_transactions').insert({
          inventory_item_id: item.id, type: 'event_out', quantity: deduct,
          note: `Zużycie na zawodach`, event_id: eventId, performed_by: member?.id,
        })
        await supabase.from('inventory_items').update({ quantity: item.quantity - deduct, updated_at: new Date().toISOString() }).eq('id', item.id)
        remaining -= deduct
      }
      if (remaining > 0) errors.push(`Brakuje ${remaining} szt. amunicji ${caliber}`)
    }
    // Deduct targets
    for (const [targetName, qty] of summary.totals.byTargetTarcze.entries()) {
      if (!targetName || targetName === '-') continue
      const matchingItems = inventoryItems.filter(i => i.category === 'targets' && i.name.toLowerCase().includes(targetName.toLowerCase()))
      if (matchingItems.length === 0) { errors.push(`Brak tarcz "${targetName}" w magazynie`); continue }
      let remaining = qty
      for (const item of matchingItems) {
        if (remaining <= 0) break
        const deduct = Math.min(remaining, item.quantity)
        await supabase.from('inventory_transactions').insert({
          inventory_item_id: item.id, type: 'event_out', quantity: deduct,
          note: `Zużycie na zawodach`, event_id: eventId, performed_by: member?.id,
        })
        await supabase.from('inventory_items').update({ quantity: item.quantity - deduct, updated_at: new Date().toISOString() }).eq('id', item.id)
        remaining -= deduct
      }
      if (remaining > 0) errors.push(`Brakuje ${remaining} szt. tarcz "${targetName}"`)
    }
    if (errors.length > 0) alert('Rozliczono z uwagami:\n' + errors.join('\n'))
    else alert('Materiały rozliczone pomyślnie!')
    loadAll()
  }

  return {
    // State
    showInventoryForm,
    setShowInventoryForm,
    editingInventory,
    setEditingInventory,
    inventoryFilter,
    setInventoryFilter,
    collapsedGroups,
    setCollapsedGroups,
    inventoryForm,
    setInventoryForm,
    showTransactionHistory,
    setShowTransactionHistory,
    transactions,
    setTransactions,
    showStockAdjust,
    setShowStockAdjust,
    stockAdjustForm,
    setStockAdjustForm,

    // Functions
    openAddInventory,
    openEditInventory,
    saveInventory,
    deleteInventory,
    loadTransactions,
    saveStockAdjust,
    settleEventMaterials,
    getEventMaterials,
  }
}
