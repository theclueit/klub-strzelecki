'use client'

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { Member } from '@/types/database'

interface AuthContext {
  user: User | null
  member: Member | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContext>({
  user: null,
  member: null,
  loading: true,
  signOut: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [member, setMember] = useState<Member | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createSupabaseBrowser()

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadMember(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        loadMember(session.user.id)
        if (event === 'SIGNED_IN') {
          logLoginEvent(session.user, 'login')
        }
      } else {
        if (event === 'SIGNED_OUT') {
          logLoginEvent(null, 'logout')
        }
        setMember(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Heartbeat: update last_seen_at every 60s while member is logged in
  useEffect(() => {
    if (!member) return
    const ping = () => supabase.from('members').update({ last_seen_at: new Date().toISOString() }).eq('id', member.id).then(() => {})
    ping()
    const interval = setInterval(ping, 60_000)
    return () => clearInterval(interval)
  }, [member?.id])

  // Log login/logout events to server
  const loggedSessionRef = useRef<string | null>(null)
  async function logLoginEvent(authUser: User | null, eventType: 'login' | 'logout') {
    // Prevent duplicate logs for the same session
    if (eventType === 'login' && authUser) {
      if (loggedSessionRef.current === authUser.id) return
      loggedSessionRef.current = authUser.id
    }
    try {
      await fetch('/api/auth/log-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth_id: authUser?.id || null,
          email: authUser?.email || null,
          event_type: eventType,
        }),
      })
    } catch {}
  }

  async function loadMember(authId: string) {
    const { data } = await supabase
      .from('members')
      .select('*')
      .eq('auth_id', authId)
      .single()
    const m = data as Member | null
    setMember(m)
    setLoading(false)
    // Backfill member info in login log (member_id + full_name)
    if (m && loggedSessionRef.current === authId) {
      fetch('/api/auth/log-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: m.id,
          auth_id: authId,
          email: m.email,
          full_name: m.full_name,
          event_type: 'login_resolved',
        }),
      }).catch(() => {})
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setMember(null)
  }

  return (
    <AuthContext.Provider value={{ user, member, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
