import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/api-auth'
import { sendWelcomeEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    // Require auth — only send welcome to yourself or admin can trigger
    const auth = await requireAuth()
    if (isAuthError(auth)) return auth

    const { member } = auth

    const { error: emailErr } = await sendWelcomeEmail({
      to: member.email,
      memberName: member.full_name,
    })

    if (emailErr) {
      console.error('Welcome email error:', emailErr)
      return NextResponse.json({ error: 'Błąd wysyłki' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Welcome email error:', err)
    return NextResponse.json({ error: 'Nieznany błąd' }, { status: 500 })
  }
}
