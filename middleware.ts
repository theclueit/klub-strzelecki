import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getEnabledModulesSync, getRouteModule, getApiModule } from '@/lib/modules'

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function csrfCheck(request: NextRequest): NextResponse | null {
  // Only check mutation requests to API routes
  if (!MUTATION_METHODS.has(request.method)) return null
  if (!request.nextUrl.pathname.startsWith('/api/')) return null

  // Allow callback/webhook routes that come from external services
  const publicCallbacks = ['/api/payments/callback', '/api/ammo/pay']
  if (publicCallbacks.some(p => request.nextUrl.pathname.startsWith(p))) return null

  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')

  // At least one must be present
  if (!origin && !referer) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const allowedHost = request.nextUrl.host // e.g. "example.com" or "localhost:3000"

  if (origin) {
    try {
      const originHost = new URL(origin).host
      if (originHost !== allowedHost) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  } else if (referer) {
    try {
      const refererHost = new URL(referer).host
      if (refererHost !== allowedHost) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  return null
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // CSRF protection for all API mutation requests
  const csrfError = csrfCheck(request)
  if (csrfError) return csrfError

  const enabled = new Set(getEnabledModulesSync())

  // API routes — zwróć 404 JSON
  const apiModule = getApiModule(pathname)
  if (apiModule && !enabled.has(apiModule)) {
    return NextResponse.json(
      { error: 'Ten moduł jest wyłączony' },
      { status: 404 }
    )
  }

  // Page routes — redirect na stronę główną
  const pageModule = getRouteModule(pathname)
  if (pageModule && !enabled.has(pageModule)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/kalendarz/:path*',
    '/wyniki/:path*',
    '/rankingi/:path*',
    '/sedzia/:path*',
    '/rezerwacje/:path*',
    '/strzelanie-rekreacyjne/:path*',
    '/instruktor/:path*',
    '/zawodnicy/:path*',
    '/profil/:path*',
    '/dolacz/:path*',
    '/platnosc/:path*',
    '/admin/:path*',
    '/api/zapisy/:path*',
    '/api/results/:path*',
    '/api/rankings/:path*',
    '/api/judge-notify/:path*',
    '/api/analyze-target/:path*',
    '/api/reservations/:path*',
    '/api/recreational/:path*',
    '/api/rejestracja/:path*',
    '/api/payments/:path*',
    '/api/ammo/:path*',
    '/api/email/:path*',
    '/api/feedback/:path*',
    '/api/auth/:path*',
  ],
}
