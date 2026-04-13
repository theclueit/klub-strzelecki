'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import type { RangeWeapon } from '@/types/admin'

interface UseRangeWeaponsParams {
  rangeWeapons: RangeWeapon[]
  loadRangeWeapons: () => void
}

export function useRangeWeapons({ rangeWeapons, loadRangeWeapons }: UseRangeWeaponsParams) {
  const supabase = createSupabaseBrowser()

  const [showWeaponForm, setShowWeaponForm] = useState(false)
  const [editingWeapon, setEditingWeapon] = useState<any | null>(null)
  const [weaponForm, setWeaponForm] = useState({ name: '', type: 'pistol', caliber: '', description: '', status: 'draft', inventory_ammo_id: '' })

  async function saveWeapon() {
    const payload = {
      name: weaponForm.name,
      type: weaponForm.type,
      caliber: weaponForm.caliber,
      description: weaponForm.description || null,
      status: weaponForm.status,
      is_active: weaponForm.status === 'in_stock',
      inventory_ammo_id: weaponForm.inventory_ammo_id || null,
    }
    if (editingWeapon) {
      await supabase.from('range_weapons').update(payload).eq('id', editingWeapon.id)
    } else {
      await supabase.from('range_weapons').insert(payload)
    }
    setShowWeaponForm(false)
    loadRangeWeapons()
  }

  async function deleteWeapon(id: string) {
    if (!confirm('Usunąć tę broń?')) return
    await supabase.from('range_weapons').delete().eq('id', id)
    loadRangeWeapons()
  }

  async function updateWeaponStatus(id: string, status: string) {
    await supabase.from('range_weapons').update({ status, is_active: status === 'in_stock' }).eq('id', id)
    loadRangeWeapons()
  }

  return {
    showWeaponForm, setShowWeaponForm,
    editingWeapon, setEditingWeapon,
    weaponForm, setWeaponForm,
    saveWeapon,
    deleteWeapon,
    updateWeaponStatus,
  }
}
