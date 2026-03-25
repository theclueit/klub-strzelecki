'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Target, Calendar, Trophy, Users, Crosshair, UserPlus, LogIn, LogOut, Shield, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/components/AuthProvider'

const publicLinks = [
  { href: '/', label: 'O klubie', icon: Target },
  { href: '/kalendarz', label: 'Kalendarz', icon: Calendar },
  { href: '/rankingi', label: 'Rankingi', icon: Trophy },
  { href: '/zawodnicy', label: 'Zawodnicy', icon: Users },
]

export default function Navigation() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const { member, loading, signOut } = useAuth()

  const links = [
    ...publicLinks,
    ...(member?.role === 'judge' || member?.role === 'admin'
      ? [{ href: '/sedzia', label: 'Panel sędziego', icon: Crosshair }]
      : []),
    ...(member?.role === 'admin'
      ? [{ href: '/admin', label: 'Admin', icon: Shield }]
      : []),
  ]

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <Target className="w-8 h-8 text-primary" />
            <span className="text-lg font-bold tracking-wide">KLUB STRZELECKI</span>
          </Link>

          {/* Desktop */}
          <div className="hidden md:flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname === href
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted hover:text-foreground hover:bg-card-hover'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}

            {/* Auth section */}
            {!loading && (
              member ? (
                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
                  <Link
                    href={`/zawodnicy/${member.id}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-muted hover:text-foreground hover:bg-card-hover transition-colors"
                  >
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                      {member.full_name.charAt(0)}
                    </div>
                    {member.full_name.split(' ')[0]}
                  </Link>
                  <button
                    onClick={signOut}
                    className="p-2 text-muted hover:text-foreground rounded-lg hover:bg-card-hover transition-colors"
                    title="Wyloguj"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 ml-2 pl-2 border-l border-border">
                  <Link
                    href="/logowanie"
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pathname === '/logowanie'
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted hover:text-foreground hover:bg-card-hover'
                    }`}
                  >
                    <LogIn className="w-4 h-4" />
                    Zaloguj
                  </Link>
                  <Link
                    href="/dolacz"
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-background rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Dołącz
                  </Link>
                </div>
              )
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 text-muted hover:text-foreground"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="md:hidden pb-4 space-y-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  pathname === href
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted hover:text-foreground hover:bg-card-hover'
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </Link>
            ))}

            {/* Mobile auth */}
            {!loading && (
              <div className="pt-2 mt-2 border-t border-border space-y-1">
                {member ? (
                  <>
                    <Link
                      href={`/zawodnicy/${member.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-foreground hover:bg-card-hover"
                    >
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                        {member.full_name.charAt(0)}
                      </div>
                      Mój profil
                    </Link>
                    <button
                      onClick={() => { signOut(); setOpen(false) }}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-foreground hover:bg-card-hover w-full"
                    >
                      <LogOut className="w-5 h-5" />
                      Wyloguj
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/logowanie"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-foreground hover:bg-card-hover"
                    >
                      <LogIn className="w-5 h-5" />
                      Zaloguj się
                    </Link>
                    <Link
                      href="/dolacz"
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-primary hover:bg-primary/10"
                    >
                      <UserPlus className="w-5 h-5" />
                      Dołącz do klubu
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legal banner */}
      <div className="bg-danger/10 border-t border-danger/30">
        <div className="max-w-7xl mx-auto px-4 py-2">
          <p className="text-xs text-danger/80 text-center">
            Przypomnienie: Przemieszczanie się z bronią dozwolone wyłącznie na trasie miejsce zamieszkania — strzelnica.
            Broń rozładowana, w pokrowcu, amunicja osobno. (Ustawa o broni i amunicji, art. 10 ust. 8)
          </p>
        </div>
      </div>
    </nav>
  )
}
