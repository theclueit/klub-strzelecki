import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resendKey = process.env.RESEND_API_KEY!
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://klub-strzelecki.vercel.app'
const fromEmail = 'Klub Strzelecki <noreply@klub-strzelecki.vercel.app>'

function getResend() {
  return new Resend(resendKey)
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const fallbackSafetyRules = `
  <div style="background: #16213e; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
    <h3 style="color: #ff6b35; margin: 0 0 12px; font-size: 15px;">&#128680; Zasady bezpieczeństwa na strzelnicy</h3>
    <ol style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.8; color: #ccc;">
      <li>Broń <strong style="color: #fff;">zawsze</strong> traktuj jako naładowaną.</li>
      <li>Nigdy nie kieruj lufy w stronę osób — broń kierujemy <strong style="color: #fff;">wyłącznie w stronę kulochwytu</strong>.</li>
      <li>Palec na spuście <strong style="color: #fff;">tylko</strong> w momencie oddawania strzału.</li>
      <li>Przed strzelaniem upewnij się, że <strong style="color: #fff;">znasz swój cel i co jest za nim</strong>.</li>
      <li>Ładowanie i rozładowanie broni <strong style="color: #fff;">wyłącznie na stanowisku</strong>, po komendzie prowadzącego strzelanie.</li>
      <li>Na linii ognia obowiązują <strong style="color: #fff;">ochronniki słuchu i okulary ochronne</strong>.</li>
      <li><strong style="color: #fff;">Bezwzględnie</strong> wykonuj polecenia prowadzącego strzelanie.</li>
      <li>W przypadku niesprawności broni — <strong style="color: #fff;">odłóż broń i wezwij prowadzącego</strong>.</li>
    </ol>
  </div>

  <div style="background: #1e2a45; border-left: 3px solid #ff6b35; border-radius: 0 8px 8px 0; padding: 16px; margin: 0 0 24px;">
    <h3 style="color: #fff; margin: 0 0 8px; font-size: 14px;">&#128220; Regulamin strzelnicy — najważniejsze punkty</h3>
    <ul style="margin: 0; padding-left: 20px; font-size: 12px; line-height: 1.8; color: #bbb;">
      <li>Przemieszczanie się z bronią dozwolone wyłącznie na trasie miejsce zamieszkania — strzelnica. Broń rozładowana, w pokrowcu, amunicja osobno (Ustawa o broni i amunicji, art. 10 ust. 8).</li>
      <li>Na terenie strzelnicy obowiązuje bezwzględny zakaz spożywania alkoholu i środków odurzających.</li>
      <li>Osoby bez pozwolenia na broń mogą strzelać wyłącznie pod bezpośrednim nadzorem prowadzącego strzelanie.</li>
      <li>Strzelanie dozwolone wyłącznie na wyznaczonych stanowiskach, do wyznaczonych celów.</li>
      <li>Zabrania się wchodzenia przed linię ognia bez zgody prowadzącego strzelanie.</li>
      <li>Każdy uczestnik zobowiązany jest do podpisania listy obecności przed rozpoczęciem strzelania.</li>
    </ul>
  </div>
`

async function getSafetyRules(): Promise<string> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    if (!supabaseUrl || !supabaseKey) return fallbackSafetyRules

    const supabase = createClient(supabaseUrl, supabaseKey)
    const { data } = await supabase
      .from('regulations')
      .select('slug, title, content')
      .eq('is_active', true)
      .in('slug', ['zasady_bezpieczenstwa', 'regulamin_strzelnicy'])

    if (!data || data.length === 0) return fallbackSafetyRules

    const safety = data.find(r => r.slug === 'zasady_bezpieczenstwa')
    const regulations = data.find(r => r.slug === 'regulamin_strzelnicy')

    let html = ''
    if (safety) {
      html += `
        <div style="background: #16213e; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
          <h3 style="color: #ff6b35; margin: 0 0 12px; font-size: 15px;">&#128680; ${safety.title}</h3>
          <div style="margin: 0; font-size: 13px; line-height: 1.8; color: #ccc;">${safety.content}</div>
        </div>`
    }
    if (regulations) {
      html += `
        <div style="background: #1e2a45; border-left: 3px solid #ff6b35; border-radius: 0 8px 8px 0; padding: 16px; margin: 0 0 24px;">
          <h3 style="color: #fff; margin: 0 0 8px; font-size: 14px;">&#128220; ${regulations.title}</h3>
          <div style="margin: 0; font-size: 12px; line-height: 1.8; color: #bbb;">${regulations.content}</div>
        </div>`
    }

    return html || fallbackSafetyRules
  } catch {
    return fallbackSafetyRules
  }
}

function emailWrapper(content: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: #1a1a2e; border-radius: 12px; padding: 32px; color: #e0e0e0;">
        <h1 style="color: #ff6b35; margin: 0 0 8px;">Klub Strzelecki</h1>
        ${content}
        <hr style="border: none; border-top: 1px solid #333; margin: 24px 0;" />
        <p style="font-size: 11px; color: #555; margin: 0;">
          Ta wiadomość została wygenerowana automatycznie. Nie odpowiadaj na nią.<br/>
          <a href="${appUrl}" style="color: #ff6b35;">klub-strzelecki.vercel.app</a>
        </p>
      </div>
    </div>
  `
}

export async function sendRegistrationConfirmation(params: {
  to: string
  memberName: string
  eventTitle: string
  eventDate: string
  eventLocation: string | null
  disciplines: string[]
  startNumber?: number | null
}) {
  const resend = getResend()
  const date = formatDate(params.eventDate)
  const safetyRules = await getSafetyRules()
  const disciplinesList = params.disciplines.length > 0
    ? params.disciplines.map(d => `<li style="margin: 4px 0;">${d}</li>`).join('')
    : '<li>Nie wybrano dyscyplin</li>'

  return resend.emails.send({
    from: fromEmail,
    to: params.to,
    subject: `Potwierdzenie zapisu: ${params.eventTitle}`,
    html: emailWrapper(`
      <p style="color: #888; margin: 0 0 24px; font-size: 14px;">Potwierdzenie rejestracji na wydarzenie</p>

      <p style="margin: 0 0 16px;">Witaj <strong style="color: #fff;">${params.memberName}</strong>,</p>

      <p style="margin: 0 0 24px;">Twój zapis na wydarzenie został pomyślnie zarejestrowany.</p>

      <div style="background: #16213e; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
        <h2 style="color: #fff; margin: 0 0 12px; font-size: 18px;">${params.eventTitle}</h2>
        ${params.startNumber ? `<p style="margin: 0 0 8px; font-size: 16px;"><strong style="color: #ff6b35;">Numer startowy: ${params.startNumber}</strong></p>` : ''}
        <p style="margin: 0 0 6px; font-size: 14px;">&#128197; ${date}</p>
        ${params.eventLocation ? `<p style="margin: 0 0 12px; font-size: 14px;">&#128205; ${params.eventLocation}</p>` : ''}
        <p style="margin: 0 0 6px; font-size: 13px; color: #aaa;">Wybrane dyscypliny:</p>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px;">${disciplinesList}</ul>
      </div>

      ${safetyRules}

      <div style="text-align: center; margin: 0 0 24px;">
        <a href="${appUrl}/kalendarz" style="display: inline-block; background: #ff6b35; color: #1a1a2e; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
          Zobacz kalendarz
        </a>
      </div>
    `),
  })
}

export async function sendEventReminder(params: {
  to: string
  memberName: string
  eventTitle: string
  eventDate: string
  eventLocation: string | null
  hoursUntil: number
}) {
  const resend = getResend()
  const date = formatDate(params.eventDate)
  const timeLabel = params.hoursUntil <= 24 ? 'jutro' : `za ${Math.round(params.hoursUntil / 24)} dni`

  return resend.emails.send({
    from: fromEmail,
    to: params.to,
    subject: `Przypomnienie: ${params.eventTitle} — ${timeLabel}`,
    html: emailWrapper(`
      <p style="color: #888; margin: 0 0 24px; font-size: 14px;">Przypomnienie o nadchodzącym wydarzeniu</p>

      <p style="margin: 0 0 16px;">Witaj <strong style="color: #fff;">${params.memberName}</strong>,</p>

      <p style="margin: 0 0 24px;">Przypominamy, że <strong style="color: #fff;">${timeLabel}</strong> odbywa się wydarzenie, na które jesteś zapisany(a):</p>

      <div style="background: #16213e; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
        <h2 style="color: #fff; margin: 0 0 12px; font-size: 18px;">${params.eventTitle}</h2>
        <p style="margin: 0 0 6px; font-size: 14px;">&#128197; ${date}</p>
        ${params.eventLocation ? `<p style="margin: 0; font-size: 14px;">&#128205; ${params.eventLocation}</p>` : ''}
      </div>

      <div style="background: #1e2a45; border-left: 3px solid #ff6b35; border-radius: 0 8px 8px 0; padding: 16px; margin: 0 0 24px;">
        <p style="margin: 0; font-size: 13px; color: #ccc;">
          <strong style="color: #fff;">Pamiętaj:</strong> Broń rozładowana, w pokrowcu, amunicja osobno.
          Przemieszczanie się z bronią dozwolone wyłącznie na trasie miejsce zamieszkania — strzelnica.
        </p>
      </div>

      <div style="text-align: center; margin: 0 0 24px;">
        <a href="${appUrl}/kalendarz" style="display: inline-block; background: #ff6b35; color: #1a1a2e; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
          Szczegóły wydarzenia
        </a>
      </div>
    `),
  })
}

export async function sendResultNotification(params: {
  to: string
  memberName: string
  eventTitle: string
  eventDate: string
  disciplineName: string
  totalScore: number
  maxScore: number | null
  position: number | null
}) {
  const resend = getResend()
  const date = formatDate(params.eventDate)
  const scoreText = params.maxScore
    ? `${params.totalScore} / ${params.maxScore} pkt`
    : `${params.totalScore} pkt`
  const positionText = params.position
    ? `<p style="margin: 0 0 6px; font-size: 14px;">&#127942; Miejsce: <strong style="color: #fff;">${params.position}</strong></p>`
    : ''
  const medal = params.position === 1 ? '&#129351;' : params.position === 2 ? '&#129352;' : params.position === 3 ? '&#129353;' : ''

  return resend.emails.send({
    from: fromEmail,
    to: params.to,
    subject: `Wyniki: ${params.eventTitle} — ${params.disciplineName}`,
    html: emailWrapper(`
      <p style="color: #888; margin: 0 0 24px; font-size: 14px;">Twoje wyniki z zawodów</p>

      <p style="margin: 0 0 16px;">Witaj <strong style="color: #fff;">${params.memberName}</strong>,</p>

      <p style="margin: 0 0 24px;">Twoje wyniki z zawodów zostały opublikowane:</p>

      <div style="background: #16213e; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
        <h2 style="color: #fff; margin: 0 0 12px; font-size: 18px;">${params.eventTitle}</h2>
        <p style="margin: 0 0 6px; font-size: 14px;">&#128197; ${date}</p>
        <p style="margin: 0 0 6px; font-size: 14px;">&#127919; Dyscyplina: <strong style="color: #fff;">${params.disciplineName}</strong></p>
        <hr style="border: none; border-top: 1px solid #2a3a5e; margin: 12px 0;" />
        <p style="margin: 0 0 6px; font-size: 20px; text-align: center;">
          ${medal} <strong style="color: #ff6b35;">${scoreText}</strong>
        </p>
        ${positionText}
      </div>

      <div style="text-align: center; margin: 0 0 24px;">
        <a href="${appUrl}/wyniki" style="display: inline-block; background: #ff6b35; color: #1a1a2e; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
          Zobacz pełne wyniki
        </a>
      </div>
    `),
  })
}

export async function sendGuestRegistrationConfirmation(params: {
  to: string
  guestName: string
  eventTitle: string
  eventDate: string
  eventLocation: string | null
  disciplines: string[]
}) {
  const resend = getResend()
  const date = formatDate(params.eventDate)
  const safetyRules = await getSafetyRules()
  const disciplinesList = params.disciplines.length > 0
    ? params.disciplines.map(d => `<li style="margin: 4px 0;">${d}</li>`).join('')
    : '<li>Nie wybrano dyscyplin</li>'

  return resend.emails.send({
    from: fromEmail,
    to: params.to,
    subject: `Potwierdzenie zgłoszenia: ${params.eventTitle}`,
    html: emailWrapper(`
      <p style="color: #888; margin: 0 0 24px; font-size: 14px;">Potwierdzenie zgłoszenia gościa</p>

      <p style="margin: 0 0 16px;">Witaj <strong style="color: #fff;">${params.guestName}</strong>,</p>

      <p style="margin: 0 0 24px;">Twoje zgłoszenie na wydarzenie zostało przyjęte. Organizator skontaktuje się z Tobą w celu potwierdzenia udziału.</p>

      <div style="background: #16213e; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
        <h2 style="color: #fff; margin: 0 0 12px; font-size: 18px;">${params.eventTitle}</h2>
        <p style="margin: 0 0 6px; font-size: 14px;">&#128197; ${date}</p>
        ${params.eventLocation ? `<p style="margin: 0 0 12px; font-size: 14px;">&#128205; ${params.eventLocation}</p>` : ''}
        <p style="margin: 0 0 6px; font-size: 13px; color: #aaa;">Wybrane dyscypliny:</p>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px;">${disciplinesList}</ul>
      </div>

      ${safetyRules}

      <p style="font-size: 13px; color: #aaa;">
        Nie masz jeszcze konta? <a href="${appUrl}/dolacz" style="color: #ff6b35;">Zarejestruj się</a> aby mieć pełny dostęp do kalendarza, wyników i rankingów.
      </p>
    `),
  })
}

export async function sendWelcomeEmail(params: {
  to: string
  memberName: string
}) {
  const resend = getResend()

  return resend.emails.send({
    from: fromEmail,
    to: params.to,
    subject: 'Witamy w Klubie Strzeleckim!',
    html: emailWrapper(`
      <p style="color: #888; margin: 0 0 24px; font-size: 14px;">Rejestracja zakończona pomyślnie</p>

      <p style="margin: 0 0 16px;">Witaj <strong style="color: #fff;">${params.memberName}</strong>,</p>

      <p style="margin: 0 0 24px;">Twoje konto w portalu Klubu Strzeleckiego zostało utworzone. Możesz teraz:</p>

      <ul style="margin: 0 0 24px; padding-left: 20px; line-height: 2;">
        <li>Przeglądać <strong style="color: #fff;">kalendarz wydarzeń</strong> i zapisywać się na zawody</li>
        <li>Sprawdzać <strong style="color: #fff;">rankingi</strong> i wyniki</li>
        <li>Uzupełnić swój <strong style="color: #fff;">profil</strong> (licencja, broń, dane osobowe)</li>
      </ul>

      <div style="text-align: center; margin: 0 0 24px;">
        <a href="${appUrl}/profil" style="display: inline-block; background: #ff6b35; color: #1a1a2e; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: bold; font-size: 16px;">
          Uzupełnij profil
        </a>
      </div>
    `),
  })
}
