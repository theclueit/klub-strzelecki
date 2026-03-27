import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
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
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return NextResponse.json({ error: 'Błąd analizy AI' }, { status: 502 })
    }

    const result = await response.json()
    const text = result.content?.[0]?.text ?? ''

    // Parse JSON from response
    try {
      const analysis = JSON.parse(text)
      return NextResponse.json({ ok: true, analysis })
    } catch {
      // Try to extract JSON from text
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
    return NextResponse.json({ error: err.message || 'Nieznany błąd' }, { status: 500 })
  }
}
