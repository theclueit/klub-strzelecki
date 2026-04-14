import { redirect } from 'next/navigation'
import { createAuthClient } from '@/lib/api-auth'

/**
 * Server-side layout for /admin — verifies auth + admin/superadmin role
 * BEFORE any client component renders. This prevents data leaking
 * even if the client-side check is bypassed.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createAuthClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/logowanie')
  }

  // Use anon client (respects RLS) to check role
  const { data: member } = await supabase
    .from('members')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (!member || !['admin', 'superadmin'].includes(member.role)) {
    redirect('/')
  }

  return <>{children}</>
}
