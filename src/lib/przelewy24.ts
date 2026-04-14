import { createHash } from 'crypto'

const P24_MERCHANT_ID = process.env.P24_MERCHANT_ID || ''
const P24_POS_ID = process.env.P24_POS_ID || P24_MERCHANT_ID
const P24_CRC_KEY = process.env.P24_CRC_KEY || ''
const P24_API_KEY = process.env.P24_API_KEY || ''
const P24_SANDBOX = process.env.P24_SANDBOX === 'true'

// Tryb zaślepki — symuluj płatność (TYLKO do testów)
// W production wymagane klucze P24 — bez nich płatności są zablokowane
const IS_PRODUCTION = process.env.NODE_ENV === 'production'
const P24_STUB_MODE = process.env.P24_STUB_MODE === 'true' && !IS_PRODUCTION
const P24_KEYS_MISSING = !P24_MERCHANT_ID || !P24_API_KEY || !P24_CRC_KEY

const BASE_URL = P24_SANDBOX
  ? 'https://sandbox.przelewy24.pl'
  : 'https://secure.przelewy24.pl'

function sha384(data: string): string {
  return createHash('sha384').update(data).digest('hex')
}

function basicAuth(): string {
  return 'Basic ' + Buffer.from(`${P24_POS_ID}:${P24_API_KEY}`).toString('base64')
}

export interface P24RegisterParams {
  sessionId: string
  amount: number // in grosze (1 PLN = 100)
  currency: string
  description: string
  email: string
  urlReturn: string
  urlStatus: string
}

export async function p24RegisterTransaction(params: P24RegisterParams): Promise<{ token: string; redirectUrl: string }> {
  const { sessionId, amount, currency, description, email, urlReturn, urlStatus } = params

  // Blokada: brak kluczy w production = błąd
  if (P24_KEYS_MISSING && IS_PRODUCTION) {
    console.error('[P24] CRITICAL: Payment keys missing in production!')
    throw new Error('Płatności są tymczasowo niedostępne')
  }

  // Tryb zaślepki — TYLKO w development
  if (P24_STUB_MODE || (P24_KEYS_MISSING && !IS_PRODUCTION)) {
    console.warn('[P24 STUB] Symulacja rejestracji transakcji (dev only):', { sessionId, amount, description })
    return {
      token: `STUB-${sessionId}`,
      redirectUrl: urlReturn,
    }
  }

  const sign = sha384(
    JSON.stringify({
      sessionId,
      merchantId: parseInt(P24_MERCHANT_ID),
      amount,
      currency,
      crc: P24_CRC_KEY,
    })
  )

  const body = {
    merchantId: parseInt(P24_MERCHANT_ID),
    posId: parseInt(P24_POS_ID),
    sessionId,
    amount,
    currency,
    description,
    email,
    country: 'PL',
    language: 'pl',
    urlReturn,
    urlStatus,
    sign,
  }

  const res = await fetch(`${BASE_URL}/api/v1/transaction/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(),
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()

  if (data.error || !data.data?.token) {
    throw new Error(data.error || 'Błąd rejestracji transakcji P24')
  }

  const redirectUrl = `${BASE_URL}/trnRequest/${data.data.token}`

  // Validate redirect URL is a trusted P24 domain (prevent open redirect if API is compromised)
  const allowedHosts = ['sandbox.przelewy24.pl', 'secure.przelewy24.pl']
  try {
    const urlHost = new URL(redirectUrl).host
    if (!allowedHosts.includes(urlHost)) {
      throw new Error(`Untrusted payment redirect host: ${urlHost}`)
    }
  } catch (e) {
    if (e instanceof TypeError) throw new Error('Invalid payment redirect URL')
    throw e
  }

  return { token: data.data.token, redirectUrl }
}

export interface P24VerifyParams {
  sessionId: string
  orderId: number
  amount: number
  currency: string
}

export async function p24VerifyTransaction(params: P24VerifyParams): Promise<boolean> {
  const { sessionId, orderId, amount, currency } = params

  // Blokada w production
  if (P24_KEYS_MISSING && IS_PRODUCTION) {
    console.error('[P24] CRITICAL: Payment keys missing in production!')
    return false
  }

  // Tryb zaślepki — TYLKO w development
  if (P24_STUB_MODE || (P24_KEYS_MISSING && !IS_PRODUCTION)) {
    console.warn('[P24 STUB] Symulacja weryfikacji transakcji (dev only):', { sessionId, orderId })
    return true
  }

  const sign = sha384(
    JSON.stringify({
      sessionId,
      orderId,
      amount,
      currency,
      crc: P24_CRC_KEY,
    })
  )

  const body = {
    merchantId: parseInt(P24_MERCHANT_ID),
    posId: parseInt(P24_POS_ID),
    sessionId,
    amount,
    currency,
    orderId,
    sign,
  }

  const res = await fetch(`${BASE_URL}/api/v1/transaction/verify`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(),
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()
  return data.data?.status === 'success'
}

export function verifyP24Callback(body: Record<string, any>): boolean {
  const { merchantId, posId, sessionId, amount, originAmount, currency, orderId, methodId, statement, sign } = body

  const expectedSign = sha384(
    JSON.stringify({
      merchantId,
      posId,
      sessionId,
      amount,
      originAmount,
      currency,
      orderId,
      methodId,
      statement,
      crc: P24_CRC_KEY,
    })
  )

  return sign === expectedSign
}
