import { NextRequest, NextResponse } from 'next/server'
import { requireRole, isAuthError } from '@/lib/api-auth'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  try {
    // Only judges and admins can use AI analysis (costs money per call)
    const auth = await requireRole('judge', 'admin', 'superadmin')
    if (isAuthError(auth)) return auth

    // Rate limit: 30 AI analyses per hour per user (costs ~$0.01 each)
    const rl = await checkRateLimit(`analyze:${auth.member.id}`, { limit: 30, windowSeconds: 3600 })
    if (!rl.success) {
      return NextResponse.json({ error: 'Zbyt wiele analiz. Spróbuj za chwilę.' }, { status: 429 })
    }

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Brak klucza API Anthropic' }, { status: 500 })
    }

    const { image, discipline_name, shots_count } = await req.json()

    if (!image) {
      return NextResponse.json({ error: 'Brak zdjęcia' }, { status: 400 })
    }

    // Extract base64 data and media type
    const match = image.match(/^data:(image\/\w+);base64,(.+)$/)
    if (!match) {
      return NextResponse.json({ error: 'Nieprawidłowy format zdjęcia' }, { status: 400 })
    }
    const mediaType = match[1]
    const base64Data = match[2]

    // Limit image size (max ~5MB base64)
    if (base64Data.length > 7_000_000) {
      return NextResponse.json({ error: 'Zdjęcie jest zbyt duże (max 5MB)' }, { status: 400 })
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: 'text',
                text: `Analizujesz zdjęcie tarczy strzeleckiej${discipline_name ? ` z dyscypliny "${discipline_name}"` : ''}.
${shots_count ? `Oczekiwana liczba strzałów: ${shots_count}.` : ''}

Policz trafienia na tarczy i oszacuj wynik. Odpowiedz WYŁĄCZNIE w formacie JSON (bez markdown):
{
  "total_score": <liczba - suma punktów>,
  "shots_detected": <liczba wykrytych trafień>,
  "tens_count": <liczba dziesiątek (10 lub X)>,
  "xs_count": <liczba X-ów (środek dziesiątki)>,
  "misses": <liczba pudeł (0 pkt)>,
  "confidence": <"high" | "medium" | "low">,
  "notes": "<krótki opis po polsku co widzisz na tarczy>"
}

Jeśli nie możesz odczytać wyniku, zwróć confidence: "low" i oszacuj najlepiej jak potrafisz.`,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      console.error('Anthropic API error:', await response.text())
      return NextResponse.json({ error: 'Błąd analizy AI' }, { status: 502 })
    }

    const result = await response.json()
    const text = result.content?.[0]?.text ?? ''

    // Parse JSON from response
    try {
      const analysis = JSON.parse(text)
      return NextResponse.json({ ok: true, analysis })
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        try {
          const analysis = JSON.parse(jsonMatch[0])
          return NextResponse.json({ ok: true, analysis })
        } catch {
          return NextResponse.json({ ok: true, analysis: { notes: text, confidence: 'low' } })
        }
      }
      return NextResponse.json({ ok: true, analysis: { notes: text, confidence: 'low' } })
    }
  } catch (err: any) {
    console.error('Analyze target error:', err)
    return NextResponse.json({ error: 'Nieznany błąd' }, { status: 500 })
  }
}
