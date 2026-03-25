'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Target, Calendar, Trophy, Users, Crosshair, UserPlus, Menu, X } from 'lucide-react'
import { useState } from 'react'

const links = [
  { href: '/', label: 'O klubie', icon: Target },
  { href: '/kalendarz', label: 'Kalendarz', icon: Calendar },
  { href: '/rankingi', label: 'Rankingi', icon: Trophy },
  { href: '/zawodnicy', label: 'Zawodnicy', icon: Users },
  { href: '/dolacz', label: 'Dołącz', icon: UserPlus },
  { href: '/sedzia', label: 'Panel sędziego', icon: Crosshair },
]

export default function Navigation() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

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
