import { NextRequest, NextResponse } from 'next/server'
import { requireRole, isAuthError } from '@/lib/api-auth'
import { Resend } from 'resend'

const resendKey = process.env.RESEND_API_KEY!
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://klub-strzelecki.vercel.app'

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole('admin', 'superadmin')
    if (isAuthError(auth)) return auth

    if (!resendKey) {
      return NextResponse.json({ error: 'Missing email config' }, { status: 500 })
    }

    const { supabase } = auth
    const { event_judge_id } = await req.json()
    if (!event_judge_id) {
      return NextResponse.json({ error: 'Missing event_judge_id' }, { status: 400 })
    }

    // Get the event_judge record with judge and event details
    const { data: ej, error: ejErr } = await supabase
      .from('event_judges')
      .select('*, judge:members!judge_id(full_name, email), event:events!event_id(title, start_date, end_date, location)')
      .eq('id', event_judge_id)
      .single()

    if (ejErr || !ej) {
      return NextResponse.json({ error: 'Event judge not found' }, { status: 404 })
    }

    const judge = ej.judge as any
    const event = ej.event as any
    const token = ej.confirmation_token

    if (!judge?.email) {
      return NextResponse.json({ error: 'Judge has no email' }, { status: 400 })
    }

    const confirmUrl = `${appUrl}/sedzia/potwierdz?token=${token}`
    const eventDate = new Date(event.start_date).toLocaleDateString('pl-PL', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })

    // Sanitize user-provided data for HTML email
    const safeName = escapeHtml(judge.full_name)
    const safeTitle = escapeHtml(event.title)
    const safeLocation = event.location ? escapeHtml(event.location) : ''

    const resend = new Resend(resendKey)
    const { error: emailErr } = await resend.emails.send({
      from: 'Klub Strzelecki <noreply@klub-strzelecki.vercel.app>',
      to: judge.email,
      subject: `Wyznaczenie na sędziego: ${safeTitle}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #1a1a2e; border-radius: 12px; padding: 32px; color: #e0e0e0;">
            <h1 style="color: #ff6b35; margin: 0 0 8px;">Klub Strzelecki</h1>
            <p style="color: #888; margin: 0 0 24px; font-size: 14px;">Powiadomienie o wyznaczeniu na sędziego</p>

            <p style="margin: 0 0 16px;">Witaj <strong style="color: #fff;">${safeName}</strong>,</p>

            <p style="margin: 0 0 24px;">Zostałeś(aś) wyznaczony(a) na <strong style="color: #fff;">sędziego</strong> podczas wydarzenia:</p>

            <div style="background: #16213e; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
              <h2 style="color: #fff; margin: 0 0 12px; font-size: 18px;">${safeTitle}</h2>
              <p style="margin: 0 0 6px; font-size: 14px;">📅 ${eventDate}</p>
              ${safeLocation ? `<p style="margin: 0; font-size: 14px;">📍 ${safeLocation}</p>` : ''}
            </div>

            <p style="margin: 0 0 24px;">Proszę potwierdź swoją dostępność klikając poniższy przycisk:</p>

            <div style="text-align: center; margin: 0 0 24px;">
              <a href="${confirmUrl}" style="display: inline-block; background: #ff6b35; color: #1a1a2e; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
                Potwierdzam uczestnictwo
              </a>
            </div>

            <p style="font-size: 12px; color: #666; margin: 0;">
              Jeśli przycisk nie działa, skopiuj ten link: <br/>
              <a href="${confirmUrl}" style="color: #ff6b35; word-break: break-all;">${confirmUrl}</a>
            </p>
          </div>
        </div>
      `,
    })

    if (emailErr) {
      console.error('Judge notify email error:', emailErr)
      return NextResponse.json({ error: 'Błąd wysyłki emaila' }, { status: 500 })
    }

    // Mark as notified
    await supabase
      .from('event_judges')
      .update({ notified_at: new Date().toISOString() })
      .eq('id', event_judge_id)

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Judge notify error:', err)
    return NextResponse.json({ error: 'Nieznany błąd' }, { status: 500 })
  }
}
