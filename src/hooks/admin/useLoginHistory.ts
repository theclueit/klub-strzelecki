'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import type { LoginEntry } from '@/types/admin'

export function useLoginHistory() {
  const supabase = createSupabaseBrowser()

  const [loginHistory, setLoginHistory] = useState<LoginEntry[]>([])
  const [loginHistoryLoading, setLoginHistoryLoading] = useState(false)
  const [showLoginHistory, setShowLoginHistory] = useState(false)

  async function loadLoginHistory() {
    setLoginHistoryLoading(true)
    const { data } = await supabase
      .from('login_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    setLoginHistory((data ?? []) as LoginEntry[])
    setLoginHistoryLoading(false)
  }

  return {
    loginHistory,
    loginHistoryLoading,
    showLoginHistory,
    setShowLoginHistory,
    loadLoginHistory,
  }
}
