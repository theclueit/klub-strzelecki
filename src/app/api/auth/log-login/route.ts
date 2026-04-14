import { NextRequest, NextResponse } from 'next/server'
import { createAuthClient, createServiceClient } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  try {
    // Verify the user is actually authenticated before logging
    const authClient = await createAuthClient()
    const { data: { user }, error } = await authClient.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const body = await req.json()
    const { event_type } = body

    // Get member info from session, not from body (prevent spoofing)
    const { data: member } = await supabase
      .from('members')
      .select('id, full_name')
      .eq('auth_id', user.id)
      .single()

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    await supabase.from('login_history').insert({
      member_id: member?.id || null,
      auth_id: user.id,
      email: user.email || null,
      full_name: member?.full_name || null,
      ip_address: ip,
      user_agent: userAgent,
      event_type: event_type || 'login',
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Log login error:', err)
    return NextResponse.json({ error: 'Błąd logowania' }, { status: 500 })
  }
}
