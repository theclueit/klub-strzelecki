'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import type { Discipline } from '@/types/database'

interface UseDisciplineManagementParams {
  loadAll: () => Promise<void>
}

export function useDisciplineManagement({ loadAll }: UseDisciplineManagementParams) {
  const supabase = createSupabaseBrowser()

  const [showDisciplineForm, setShowDisciplineForm] = useState(false)
  const [editingDiscipline, setEditingDiscipline] = useState<Discipline | null>(null)
  const [disciplineForm, setDisciplineForm] = useState({
    name: '', description: '', target_type: '' as string, category: 'discipline' as string, default_price_pln: '0',
    own_weapon_price_pln: '0', stations_count: '0', judges_per_station: '0', participants_per_hour: '0',
    caliber: '', shots_count: '60', ammo_per_pack: '50', targets_per_competitor: '0', distance_m: '', target_name: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function openNewDiscipline() {
    setEditingDiscipline(null)
    setDisciplineForm({ name: '', description: '', target_type: '', category: 'discipline', default_price_pln: '0', own_weapon_price_pln: '0', stations_count: '0', judges_per_station: '0', participants_per_hour: '0', caliber: '', shots_count: '60', ammo_per_pack: '50', targets_per_competitor: '0', distance_m: '', target_name: '' })
    setShowDisciplineForm(true)
    setError('')
  }

  function openEditDiscipline(d: Discipline) {
    setEditingDiscipline(d)
    setDisciplineForm({
      name: d.name,
      description: d.description ?? '',
      target_type: d.target_type ?? '',
      category: d.category ?? 'discipline',
      default_price_pln: String(d.default_price_pln ?? 0),
      own_weapon_price_pln: String(d.own_weapon_price_pln ?? 0),
      stations_count: String(d.stations_count ?? 0),
      judges_per_station: String(d.judges_per_station ?? 0),
      participants_per_hour: String(d.participants_per_hour ?? 0),
      caliber: d.caliber ?? '',
      shots_count: String(d.shots_count ?? 60),
      ammo_per_pack: String(d.ammo_per_pack ?? 50),
      targets_per_competitor: String(d.targets_per_competitor ?? 0),
      distance_m: d.distance_m ? String(d.distance_m) : '',
      target_name: d.target_name ?? '',
    })
    setShowDisciplineForm(true)
    setError('')
  }

  async function saveDiscipline(e: React.FormEvent) {
    e.preventDefault()

    if ((parseFloat(disciplineForm.default_price_pln) || 0) === 0) {
      if (!confirm('Cena domyślna wynosi 0 zł. Czy na pewno chcesz zapisać?')) return
    }

    setSaving(true)
    setError('')

    const payload = {
      name: disciplineForm.name,
      description: disciplineForm.description || null,
      target_type: disciplineForm.target_type || null,
      category: disciplineForm.category || 'discipline',
      default_price_pln: parseFloat(disciplineForm.default_price_pln) || 0,
      own_weapon_price_pln: parseFloat(disciplineForm.own_weapon_price_pln) || 0,
      stations_count: parseInt(disciplineForm.stations_count) || 0,
      judges_per_station: parseInt(disciplineForm.judges_per_station) || 0,
      participants_per_hour: parseInt(disciplineForm.participants_per_hour) || 0,
      caliber: disciplineForm.caliber || null,
      shots_count: parseInt(disciplineForm.shots_count) || 60,
      ammo_per_pack: parseInt(disciplineForm.ammo_per_pack) || 50,
      targets_per_competitor: parseInt(disciplineForm.targets_per_competitor) || 0,
      distance_m: disciplineForm.distance_m ? parseInt(disciplineForm.distance_m) : null,
      target_name: disciplineForm.target_name || null,
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
    if (!confirm('Na pewno usunac te dyscypline?')) return
    const { error: err } = await supabase.from('disciplines').delete().eq('id', id)
    if (err) { alert('Nie mozna usunac — dyscyplina jest przypisana do wydarzen lub wynikow.'); return }
    loadAll()
  }

  return {
    showDisciplineForm,
    setShowDisciplineForm,
    editingDiscipline,
    setEditingDiscipline,
    disciplineForm,
    setDisciplineForm,
    saving,
    setSaving,
    error,
    setError,
    openNewDiscipline,
    openEditDiscipline,
    saveDiscipline,
    deleteDiscipline,
  }
}
