import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getEnabledModulesSync, getRouteModule, getApiModule } from '@/lib/modules'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
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
  ],
}
