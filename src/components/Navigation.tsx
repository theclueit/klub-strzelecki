'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Target, Calendar, Trophy, Users, Crosshair, UserPlus, LogIn, LogOut, Shield, Menu, X, Award, Clock, ChevronDown } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/components/AuthProvider'

interface NavItem {
  href: string
  label: string
  icon: any
}

interface NavGroup {
  label: string
  icon: any
  items: NavItem[]
}

function DropdownMenu({ group, pathname, closeAll }: { group: NavGroup; pathname: string; closeAll: () => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>(null)

  const isActive = group.items.some(item => pathname === item.href)

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [])

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setIsOpen(true)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 150)
  }

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-primary/15 text-primary'
            : 'text-muted hover:text-foreground hover:bg-card-hover'
        }`}
      >
        <group.icon className="w-4 h-4" />
        {group.label}
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-lg py-1 min-w-[180px] z-50">
          {group.items.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => { setIsOpen(false); closeAll() }}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors ${
                pathname === href
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:text-foreground hover:bg-card-hover'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Navigation() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const { member, loading, signOut } = useAuth()

  // Grupy menu
  const navGroups: NavGroup[] = [
    {
      label: 'Klub',
      icon: Target,
      items: [
        { href: '/', label: 'O klubie', icon: Target },
        { href: '/kalendarz', label: 'Kalendarz', icon: Calendar },
        { href: '/zawodnicy', label: 'Zawodnicy', icon: Users },
        { href: '/wyniki', label: 'Wyniki zawodów', icon: Award },
        { href: '/rankingi', label: 'Rankingi', icon: Trophy },
        ...(!member ? [{ href: '/dolacz', label: 'Zapisz się', icon: UserPlus }] : []),
      ],
    },
    {
      label: 'Strzelnica',
      icon: Crosshair,
      items: [
        { href: '/rezerwacje', label: 'Rezerwacje torów', icon: Clock },
        { href: '/strzelanie-rekreacyjne', label: 'Strzelanie rekreacyjne', icon: Crosshair },
      ],
    },
  ]

  // Role-based links — flat, na tym samym poziomie co grupy (widoczne tylko dla uprawnionych)
  const roleLinks: NavItem[] = [
    ...(member?.role === 'judge' || member?.role === 'admin'
      ? [{ href: '/sedzia', label: 'Sędzia', icon: Crosshair }]
      : []),
    ...(member?.role === 'instructor' || member?.role === 'admin'
      ? [{ href: '/instruktor', label: 'Instruktor', icon: Target }]
      : []),
    ...(['registrar', 'range_registrar', 'admin'].includes(member?.role || '')
      ? [{ href: '/rejestracja', label: 'Rejestracja', icon: UserPlus }]
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
          <div className="hidden lg:flex items-center gap-0.5">
            {navGroups.map(group => (
              <DropdownMenu
                key={group.label}
                group={group}
                pathname={pathname}
                closeAll={() => {}}
              />
            ))}

            {roleLinks.length > 0 && (
              <>
                <div className="w-px h-6 bg-border mx-1" />
                {roleLinks.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pathname === href
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted hover:text-foreground hover:bg-card-hover'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                ))}
              </>
            )}

            {/* Auth section */}
            {!loading && (
              member ? (
                <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
                  <Link
                    href="/profil"
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
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pathname === '/logowanie'
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted hover:text-foreground hover:bg-card-hover'
                    }`}
                  >
                    <LogIn className="w-4 h-4" />
                    Zaloguj
                  </Link>
                </div>
              )
            )}
          </div>

          {/* Mobile toggle */}
          <button
            className="lg:hidden p-2 text-muted hover:text-foreground"
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <div className="lg:hidden pb-4">
            {navGroups.map(group => (
              <div key={group.label} className="mb-2">
                <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted/60">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        pathname === href
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted hover:text-foreground hover:bg-card-hover'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            {roleLinks.length > 0 && (
              <div className="mb-2 pt-2 border-t border-border">
                <p className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted/60">
                  Twoje panele
                </p>
                <div className="space-y-0.5">
                  {roleLinks.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        pathname === href
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted hover:text-foreground hover:bg-card-hover'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            )}

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
                  <Link
                    href="/logowanie"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-foreground hover:bg-card-hover"
                  >
                    <LogIn className="w-5 h-5" />
                    Zaloguj się
                  </Link>
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
