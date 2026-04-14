import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Create a Supabase client that reads the user's auth session from cookies.
 * Use this to verify WHO is making the request.
 */
export async function createAuthClient() {
  const cookieStore = await cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
    },
  })
}

/**
 * Create a Supabase client with service role (bypasses RLS).
 * Only use AFTER verifying auth + authorization.
 */
export function createServiceClient() {
  return createClient<any>(supabaseUrl, supabaseServiceKey)
}

/**
 * Verify the user is authenticated and get their member record.
 * Returns { user, member, supabase (service client) } or a NextResponse error.
 */
export async function requireAuth(): Promise<
  | { user: { id: string; email?: string }; member: { id: string; role: string; full_name: string; email: string }; supabase: ReturnType<typeof createServiceClient> }
  | NextResponse
> {
  const authClient = await createAuthClient()
  const { data: { user }, error } = await authClient.auth.getUser()

  if (error || !user) {
    return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data: member } = await supabase
    .from('members')
    .select('id, role, full_name, email')
    .eq('auth_id', user.id)
    .single()

  if (!member) {
    return NextResponse.json({ error: 'Brak profilu członka' }, { status: 403 })
  }

  return { user, member, supabase }
}

/**
 * Verify the user has one of the required roles.
 */
export async function requireRole(...roles: string[]): Promise<
  | { user: { id: string; email?: string }; member: { id: string; role: string; full_name: string; email: string }; supabase: ReturnType<typeof createServiceClient> }
  | NextResponse
> {
  const result = await requireAuth()
  if (result instanceof NextResponse) return result

  if (!roles.includes(result.member.role)) {
    return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 })
  }

  return result
}

/**
 * Check if a result is an error response (NextResponse).
 */
export function isAuthError(result: unknown): result is NextResponse {
  return result instanceof NextResponse
}
