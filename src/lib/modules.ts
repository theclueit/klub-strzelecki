/**
 * System modułowy — konfiguracja po stronie serwera.
 *
 * Etap 1: Env vars w Vercel (server-only, bez NEXT_PUBLIC_).
 * Etap 2: Zamienić getEnabledModules() na weryfikację JWT z serwera licencji.
 *
 * Zmienne środowiskowe (domyślnie wszystkie ON):
 *   MODULE_EVENTS=false    — wyłącza Zawody
 *   MODULE_RANGE=false     — wyłącza Strzelnicę
 *   MODULE_MEMBERS=false   — wyłącza Członków
 *   MODULE_PAYMENTS=false  — wyłącza Płatności
 */

export type ModuleName = 'events' | 'range' | 'members' | 'payments'

export const ALL_MODULES: ModuleName[] = ['events', 'range', 'members', 'payments']

/**
 * Jedyna funkcja do wymiany przy przejściu na etap 2 (serwer licencji).
 * Teraz: czyta env vars. Potem: weryfikuje JWT.
 */
export async function getEnabledModules(): Promise<ModuleName[]> {
  return ALL_MODULES.filter(
    m => process.env[`MODULE_${m.toUpperCase()}`] !== 'false'
  )
}

/** Synchroniczna wersja dla middleware (env vars są dostępne synchronicznie) */
export function getEnabledModulesSync(): ModuleName[] {
  return ALL_MODULES.filter(
    m => process.env[`MODULE_${m.toUpperCase()}`] !== 'false'
  )
}

/** Mapowanie ścieżek stron do modułów */
export const routeModuleMap: Record<string, ModuleName> = {
  '/kalendarz':              'events',
  '/wyniki':                 'events',
  '/rankingi':               'events',
  '/sedzia':                 'events',
  '/rezerwacje':             'range',
  '/strzelanie-rekreacyjne': 'range',
  '/instruktor':             'range',
  '/zawodnicy':              'members',
  '/profil':                 'members',
  '/dolacz':                 'members',
  '/platnosc':               'payments',
}

/** Mapowanie prefixów API do modułów */
export const apiModuleMap: Record<string, ModuleName> = {
  '/api/zapisy':         'events',
  '/api/results':        'events',
  '/api/rankings':       'events',
  '/api/judge-notify':   'events',
  '/api/analyze-target': 'events',
  '/api/reservations':   'range',
  '/api/recreational':   'range',
  '/api/ammo':           'range',
  '/api/rejestracja':    'members',
  '/api/payments':       'payments',
}

/** Sprawdza moduł wymagany dla ścieżki strony */
export function getRouteModule(pathname: string): ModuleName | null {
  for (const [route, mod] of Object.entries(routeModuleMap)) {
    if (pathname === route || pathname.startsWith(route + '/')) return mod
  }
  return null
}

/** Sprawdza moduł wymagany dla ścieżki API */
export function getApiModule(pathname: string): ModuleName | null {
  for (const [prefix, mod] of Object.entries(apiModuleMap)) {
    if (pathname.startsWith(prefix)) return mod
  }
  return null
}
