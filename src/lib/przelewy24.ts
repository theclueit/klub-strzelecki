import { createHash } from 'crypto'

const P24_MERCHANT_ID = process.env.P24_MERCHANT_ID!
const P24_POS_ID = process.env.P24_POS_ID || P24_MERCHANT_ID
const P24_CRC_KEY = process.env.P24_CRC_KEY!
const P24_API_KEY = process.env.P24_API_KEY!
const P24_SANDBOX = process.env.P24_SANDBOX === 'true'

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

  return {
    token: data.data.token,
    redirectUrl: `${BASE_URL}/trnRequest/${data.data.token}`,
  }
}

export interface P24VerifyParams {
  sessionId: string
  orderId: number
  amount: number
  currency: string
}

export async function p24VerifyTransaction(params: P24VerifyParams): Promise<boolean> {
  const { sessionId, orderId, amount, currency } = params

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
