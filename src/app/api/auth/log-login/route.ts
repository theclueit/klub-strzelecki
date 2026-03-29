import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  try {
    if (!supabaseServiceKey) {
      return NextResponse.json({ error: 'Missing config' }, { status: 500 })
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const body = await req.json()
    const { member_id, auth_id, email, full_name, event_type } = body

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    await supabase.from('login_history').insert({
      member_id: member_id || null,
      auth_id: auth_id || null,
      email: email || null,
      full_name: full_name || null,
      ip_address: ip,
      user_agent: userAgent,
      event_type: event_type || 'login',
    })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Log login error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
