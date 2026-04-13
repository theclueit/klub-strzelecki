'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import type { OnlineUser } from '@/types/admin'

export function useOnlineUsers() {
  const supabase = createSupabaseBrowser()

  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])
  const [showOnlineList, setShowOnlineList] = useState(false)

  async function loadOnlineUsers() {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('members')
      .select('id, full_name, role, last_seen_at')
      .gte('last_seen_at', fiveMinAgo)
      .order('last_seen_at', { ascending: false })
    setOnlineUsers((data ?? []) as OnlineUser[])
  }

  return {
    onlineUsers,
    showOnlineList,
    setShowOnlineList,
    loadOnlineUsers,
  }
}
