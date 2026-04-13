'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import type { RangeWeapon, ShootingPackage, Instructor } from './types'

interface UseOnsiteBookingParams {
  selectedDate: string
  member: any
  loadReservations: () => void
}

export function useOnsiteBooking({ selectedDate, member, loadReservations }: UseOnsiteBookingParams) {
  const supabase = createSupabaseBrowser()

  const [showOnsiteBooking, setShowOnsiteBooking] = useState(false)
  const [onsiteWeapons, setOnsiteWeapons] = useState<RangeWeapon[]>([])
  const [onsitePackages, setOnsitePackages] = useState<ShootingPackage[]>([])
  const [onsiteInstructors, setOnsiteInstructors] = useState<Instructor[]>([])
  const [onsiteLoading, setOnsiteLoading] = useState(false)
  const [onsiteSaving, setOnsiteSaving] = useState(false)
  const [onsiteSuccess, setOnsiteSuccess] = useState('')
  const [onsiteForm, setOnsiteForm] = useState({
    package_id: '',
    weapon_id: '',
    instructor_id: '',
    start_time: '10:00',
    duration_minutes: '60',
    ammo_count: '50',
    price_pln: '0',
    guest_name: '',
    guest_phone: '',
    guest_address: '',
    guest_document: '',
    guest_email: '',
    targets: '',
    notes: '',
  })

  const openOnsiteBooking = async () => {
    setOnsiteLoading(true)
    setOnsiteSuccess('')
    setOnsiteForm({
      package_id: '', weapon_id: '', instructor_id: '',
      start_time: '10:00', duration_minutes: '60',
      ammo_count: '50', price_pln: '0',
      guest_name: '', guest_phone: '', guest_address: '', guest_document: '', guest_email: '',
      targets: '', notes: '',
    })
    setShowOnsiteBooking(true)

    // Load weapons, packages, instructors
    const [weaponsRes, pkgsRes, instructorsRes] = await Promise.all([
      supabase.from('range_weapons').select('id, name, type, caliber, status').eq('status', 'in_stock').order('type').order('name'),
      supabase.from('shooting_packages').select('id, name, weapon_id, ammo_count, duration_minutes, price_pln').eq('is_active', true).order('name'),
      supabase.from('members').select('id, full_name').eq('role', 'instructor').eq('is_active', true).order('full_name'),
    ])

    // Also include admins as instructors
    const { data: admins } = await supabase.from('members').select('id, full_name').eq('role', 'admin').eq('is_active', true)
    const allInstructors = [...(instructorsRes.data ?? []), ...(admins ?? [])]
    const unique = Array.from(new Map(allInstructors.map(i => [i.id, i])).values())

    setOnsiteWeapons((weaponsRes.data ?? []) as RangeWeapon[])
    setOnsitePackages((pkgsRes.data ?? []) as ShootingPackage[])
    setOnsiteInstructors(unique as Instructor[])
    setOnsiteLoading(false)
  }

  const handlePackageSelect = (pkgId: string) => {
    const pkg = onsitePackages.find(p => p.id === pkgId)
    if (pkg) {
      setOnsiteForm(f => ({
        ...f,
        package_id: pkgId,
        weapon_id: pkg.weapon_id,
        ammo_count: String(pkg.ammo_count),
        duration_minutes: String(pkg.duration_minutes),
        price_pln: String(pkg.price_pln),
      }))
    } else {
      setOnsiteForm(f => ({ ...f, package_id: '' }))
    }
  }

  const handleOnsiteSubmit = async () => {
    if (!member) return
    if (!onsiteForm.weapon_id || !onsiteForm.instructor_id) {
      alert('Wybierz broń i instruktora')
      return
    }
    if (!onsiteForm.guest_name || !onsiteForm.guest_address || !onsiteForm.guest_document || !onsiteForm.guest_email) {
      alert('Podaj imię i nazwisko, adres zamieszkania, numer dokumentu oraz email klienta')
      return
    }

    setOnsiteSaving(true)
    try {
      const res = await fetch('/api/recreational/onsite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weapon_id: onsiteForm.weapon_id,
          instructor_id: onsiteForm.instructor_id,
          date: selectedDate,
          start_time: onsiteForm.start_time,
          duration_minutes: parseInt(onsiteForm.duration_minutes),
          ammo_count: parseInt(onsiteForm.ammo_count),
          price_pln: parseFloat(onsiteForm.price_pln),
          guest_name: onsiteForm.guest_name,
          guest_phone: onsiteForm.guest_phone,
          guest_address: onsiteForm.guest_address,
          guest_document: onsiteForm.guest_document,
          guest_email: onsiteForm.guest_email,
          notes: [onsiteForm.targets ? `Tarcze: ${onsiteForm.targets}` : '', onsiteForm.notes].filter(Boolean).join(' | '),
          registrar_id: member.id,
          package_id: onsiteForm.package_id || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert('Błąd: ' + (data.error || 'Nieznany błąd'))
        return
      }
      setOnsiteSuccess(`Zarezerwowano: ${onsiteForm.guest_name}, ${data.weapon_name || 'broń'}, ${onsiteForm.ammo_count} szt. amunicji, ${onsiteForm.price_pln} zł`)
      loadReservations()
    } catch (err: any) {
      alert('Błąd: ' + (err.message || 'Spróbuj ponownie'))
    } finally {
      setOnsiteSaving(false)
    }
  }

  return {
    showOnsiteBooking,
    setShowOnsiteBooking,
    onsiteWeapons,
    onsitePackages,
    onsiteInstructors,
    onsiteLoading,
    onsiteSaving,
    onsiteSuccess,
    setOnsiteSuccess,
    onsiteForm,
    setOnsiteForm,
    openOnsiteBooking,
    handlePackageSelect,
    handleOnsiteSubmit,
  }
}
