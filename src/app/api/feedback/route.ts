import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, getClientIp } from '@/lib/rate-limit'

const GITHUB_REPO = process.env.GITHUB_FEEDBACK_REPO || 'theclueit/klub-strzelecki'

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 5 feedback per hour per IP
    const ip = getClientIp(req)
    const rl = checkRateLimit(`feedback:${ip}`, { limit: 5, windowSeconds: 3600 })
    if (!rl.success) {
      return NextResponse.json({ error: 'Zbyt wiele zgłoszeń. Spróbuj później.' }, { status: 429 })
    }

    const { type, title, description, email } = await req.json()

    if (!title || !description) {
      return NextResponse.json({ error: 'Tytuł i opis są wymagane' }, { status: 400 })
    }

    const labels: string[] = []
    if (type === 'bug') labels.push('bug')
    else if (type === 'feature') labels.push('enhancement')
    else labels.push('feedback')

    const typeLabel = type === 'bug' ? '🐛 Błąd' : type === 'feature' ? '💡 Propozycja' : '📝 Uwaga'

    const body = [
      `## ${typeLabel}`,
      '',
      description,
      '',
      '---',
      `**Zgłoszono przez:** ${email || 'Anonim'}`,
      `**Data:** ${new Date().toLocaleDateString('pl-PL')}`,
      `**Źródło:** Formularz na stronie weclue.it`,
    ].join('\n')

    const ghToken = process.env.GITHUB_TOKEN
    if (!ghToken) {
      // Jeśli brak tokena, logujemy i zwracamy sukces (feedback zapisany w logach)
      console.log('[FEEDBACK]', { type, title, description, email })
      return NextResponse.json({ success: true, fallback: true })
    }

    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `[${typeLabel}] ${title}`,
        body,
        labels,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[FEEDBACK] GitHub API error:', err)
      return NextResponse.json({ error: 'Nie udało się utworzyć zgłoszenia' }, { status: 500 })
    }

    await res.json()
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[FEEDBACK] Error:', err)
    return NextResponse.json({ error: 'Wystąpił błąd' }, { status: 500 })
  }
}
