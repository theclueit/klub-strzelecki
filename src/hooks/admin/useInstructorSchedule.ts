'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import type { InstructorAvailability } from '@/types/admin'

export function useInstructorSchedule() {
  const supabase = createSupabaseBrowser()

  const [instructorAvailability, setInstructorAvailability] = useState<InstructorAvailability[]>([])
  const [instructorsList, setInstructorsList] = useState<{ id: string; full_name: string }[]>([])
  const [showInstructorScheduleForm, setShowInstructorScheduleForm] = useState(false)
  const [instructorScheduleForm, setInstructorScheduleForm] = useState({ instructor_id: '', day_of_week: '1', start_time: '09:00', end_time: '17:00' })

  async function loadInstructorSchedule() {
    const [availRes, instrRes] = await Promise.all([
      supabase.from('instructor_availability').select('*, instructor:members!instructor_availability_instructor_id_fkey(full_name)').order('instructor_id').order('day_of_week'),
      supabase.from('members').select('id, full_name').in('role', ['instructor', 'admin']).eq('is_active', true).order('full_name'),
    ])
    setInstructorAvailability((availRes.data ?? []) as any[])
    setInstructorsList((instrRes.data ?? []) as any[])
  }

  async function saveInstructorSchedule() {
    const { instructor_id, day_of_week, start_time, end_time } = instructorScheduleForm
    if (!instructor_id) return
    await supabase.from('instructor_availability').insert({
      instructor_id,
      day_of_week: parseInt(day_of_week),
      start_time,
      end_time,
      is_active: true,
    })
    setShowInstructorScheduleForm(false)
    loadInstructorSchedule()
  }

  async function deleteInstructorAvailability(id: string) {
    if (!confirm('Usunąć ten wpis dostępności?')) return
    await supabase.from('instructor_availability').delete().eq('id', id)
    loadInstructorSchedule()
  }

  async function toggleInstructorAvailability(id: string, isActive: boolean) {
    await supabase.from('instructor_availability').update({ is_active: isActive }).eq('id', id)
    loadInstructorSchedule()
  }

  return {
    instructorAvailability,
    instructorsList,
    showInstructorScheduleForm,
    setShowInstructorScheduleForm,
    instructorScheduleForm,
    setInstructorScheduleForm,
    loadInstructorSchedule,
    saveInstructorSchedule,
    deleteInstructorAvailability,
    toggleInstructorAvailability,
  }
}
