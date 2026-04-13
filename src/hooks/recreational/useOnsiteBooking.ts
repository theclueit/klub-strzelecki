import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { formatDate } from '@/lib/date'
import type { RecPackage } from './types'

export function useOnsiteBooking(packages: RecPackage[]) {
  const { member } = useAuth()
  const supabase = createSupabaseBrowser()

  const isRangeStaff = member && ['admin', 'registrar', 'range_registrar'].includes(member.role)

  const [showOnsite, setShowOnsite] = useState(false)
  const [onsiteWeapons, setOnsiteWeapons] = useState<{ id: string; name: string; type: string; caliber: string }[]>([])
  const [onsiteInstructors, setOnsiteInstructors] = useState<{ id: string; full_name: string }[]>([])
  const [onsiteLoading, setOnsiteLoading] = useState(false)
  const [onsiteSaving, setOnsiteSaving] = useState(false)
  const [onsiteSuccess, setOnsiteSuccess] = useState('')
  const [onsiteForm, setOnsiteForm] = useState({
    package_id: '', weapon_id: '', instructor_id: '',
    start_time: '10:00', duration_minutes: '60',
    ammo_count: '50', price_pln: '0',
    guest_name: '', guest_phone: '', guest_address: '', guest_document: '', guest_email: '',
    targets: '', notes: '',
  })

  async function openOnsiteBooking() {
    setOnsiteLoading(true)
    setOnsiteSuccess('')
    setOnsiteForm({
      package_id: '', weapon_id: '', instructor_id: '',
      start_time: '10:00', duration_minutes: '60',
      ammo_count: '50', price_pln: '0',
      guest_name: '', guest_phone: '', guest_address: '', guest_document: '', guest_email: '',
      targets: '', notes: '',
    })
    setShowOnsite(true)
    const [weaponsRes, instructorsRes] = await Promise.all([
      supabase.from('range_weapons').select('id, name, type, caliber').eq('status', 'in_stock').order('type').order('name'),
      supabase.from('members').select('id, full_name').in('role', ['instructor', 'admin']).eq('is_active', true).order('full_name'),
    ])
    setOnsiteWeapons(weaponsRes.data ?? [])
    setOnsiteInstructors(instructorsRes.data ?? [])
    setOnsiteLoading(false)
  }

  function handlePackageSelect(pkgId: string) {
    const pkg = packages.find(p => p.id === pkgId)
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

  async function handleOnsiteSubmit() {
    if (!member) return
    if (!onsiteForm.weapon_id || !onsiteForm.instructor_id) {
      alert('Wybierz broń i instruktora')
      return
    }
    if (!onsiteForm.guest_name || !onsiteForm.guest_address || !onsiteForm.guest_document || !onsiteForm.guest_email) {
      alert('Podaj imię i nazwisko, adres, numer dokumentu oraz email klienta')
      return
    }
    setOnsiteSaving(true)
    try {
      const today = formatDate(new Date())
      const res = await fetch('/api/recreational/onsite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weapon_id: onsiteForm.weapon_id,
          instructor_id: onsiteForm.instructor_id,
          date: today,
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
    } catch (err: any) {
      alert('Błąd: ' + (err.message || 'Spróbuj ponownie'))
    } finally {
      setOnsiteSaving(false)
    }
  }

  function resetOnsiteForNextClient() {
    setOnsiteSuccess('')
    setOnsiteForm(f => ({ ...f, guest_name: '', guest_phone: '', guest_address: '', guest_document: '', guest_email: '', targets: '', notes: '' }))
  }

  return {
    isRangeStaff,
    showOnsite, setShowOnsite,
    onsiteWeapons, onsiteInstructors,
    onsiteLoading, onsiteSaving, onsiteSuccess,
    onsiteForm, setOnsiteForm,
    openOnsiteBooking,
    handlePackageSelect,
    handleOnsiteSubmit,
    resetOnsiteForNextClient,
  }
}
