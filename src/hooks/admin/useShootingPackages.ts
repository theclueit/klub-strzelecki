'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import type { ShootingPackage } from '@/types/admin'

interface UseShootingPackagesParams {
  shootingPackages: ShootingPackage[]
  loadShootingPackages: () => void
}

export function useShootingPackages({ shootingPackages, loadShootingPackages }: UseShootingPackagesParams) {
  const supabase = createSupabaseBrowser()

  const [showPackageForm, setShowPackageForm] = useState(false)
  const [editingPackage, setEditingPackage] = useState<any | null>(null)
  const [packageForm, setPackageForm] = useState({ name: '', description: '', weapon_id: '', ammo_count: '50', duration_minutes: '60', price_pln: '0', is_active: true })

  function openNewPackage() {
    setEditingPackage(null)
    setPackageForm({ name: '', description: '', weapon_id: '', ammo_count: '50', duration_minutes: '60', price_pln: '0', is_active: true })
    setShowPackageForm(true)
  }

  function openEditPackage(pkg: any) {
    setEditingPackage(pkg)
    setPackageForm({
      name: pkg.name,
      description: pkg.description || '',
      weapon_id: pkg.weapon_id || '',
      ammo_count: String(pkg.ammo_count),
      duration_minutes: String(pkg.duration_minutes),
      price_pln: String(pkg.price_pln),
      is_active: pkg.is_active,
    })
    setShowPackageForm(true)
  }

  async function savePackage() {
    const payload = {
      name: packageForm.name,
      description: packageForm.description || null,
      weapon_id: packageForm.weapon_id || null,
      ammo_count: parseInt(packageForm.ammo_count) || 0,
      duration_minutes: parseInt(packageForm.duration_minutes) || 60,
      price_pln: parseFloat(packageForm.price_pln) || 0,
      is_active: packageForm.is_active,
    }
    if (editingPackage) {
      await supabase.from('shooting_packages').update(payload).eq('id', editingPackage.id)
    } else {
      await supabase.from('shooting_packages').insert(payload)
    }
    setShowPackageForm(false)
    loadShootingPackages()
  }

  async function deletePackage(id: string) {
    if (!confirm('Usunąć pakiet?')) return
    await supabase.from('shooting_packages').delete().eq('id', id)
    loadShootingPackages()
  }

  async function togglePackageActive(id: string, active: boolean) {
    await supabase.from('shooting_packages').update({ is_active: !active }).eq('id', id)
    loadShootingPackages()
  }

  return {
    showPackageForm, setShowPackageForm,
    editingPackage, setEditingPackage,
    packageForm, setPackageForm,
    openNewPackage,
    openEditPackage,
    savePackage,
    deletePackage,
    togglePackageActive,
  }
}
