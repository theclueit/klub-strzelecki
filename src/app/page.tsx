import { supabase } from '@/lib/supabase'
import { Target, MapPin, Award, Users, Calendar, Shield } from 'lucide-react'
import Link from 'next/link'

export const revalidate = 60

export default async function HomePage() {
  const { data: members } = await supabase.from('members').select('id')
  const { data: events } = await supabase.from('events').select('id').eq('event_type', 'competition')

  const stats = [
    { label: 'Członków', value: members?.length ?? 0, icon: Users },
    { label: 'Zawodów', value: events?.length ?? 0, icon: Calendar },
    { label: 'Lat tradycji', value: 35, icon: Shield },
    { label: 'Medali', value: 48, icon: Award },
  ]

  return (
    <div>
      {/* Hero */}
      <section className="relative py-24 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(200,168,78,0.08)_0%,transparent_70%)]" />
        <div className="max-w-4xl mx-auto text-center relative">
          <Target className="w-16 h-16 text-primary mx-auto mb-6" />
          <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
            Klub Strzelecki
          </h1>
          <p className="text-lg text-muted mb-8 max-w-2xl mx-auto">
            Tradycja, precyzja, dyscyplina. Dołącz do naszej społeczności strzelców sportowych
            i rozwijaj swoje umiejętności pod okiem doświadczonych instruktorów.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/kalendarz"
              className="px-6 py-3 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors"
            >
              Najbliższe wydarzenia
            </Link>
            <Link
              href="/rankingi"
              className="px-6 py-3 border border-border text-foreground font-semibold rounded-lg hover:bg-card-hover transition-colors"
            >
              Zobacz rankingi
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4 border-t border-border">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-6 text-center">
              <Icon className="w-8 h-8 text-primary mx-auto mb-3" />
              <div className="text-3xl font-bold mb-1">{value}</div>
              <div className="text-sm text-muted">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Disciplines */}
      <section className="py-16 px-4 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">Dyscypliny</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { name: 'Pistolet 10m', desc: 'Strzelanie pneumatyczne na precyzję' },
              { name: 'Pistolet 25m', desc: 'Centralny zapłon, szybkostrzelność' },
              { name: 'IPSC', desc: 'Dynamiczne strzelanie sportowe' },
              { name: 'Karabin', desc: 'Strzelanie z karabinu sportowego' },
              { name: 'Benchrest', desc: 'Strzelanie odległościowe z podpory' },
              { name: 'Pistolet 50m', desc: 'Strzelanie wolne z pistoletu' },
            ].map(({ name, desc }) => (
              <div key={name} className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
                <h3 className="font-semibold mb-1">{name}</h3>
                <p className="text-sm text-muted">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Location */}
      <section className="py-16 px-4 border-t border-border">
        <div className="max-w-3xl mx-auto text-center">
          <MapPin className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">Lokalizacja</h2>
          <p className="text-muted mb-2">ul. Strzelecka 15, 00-001 Warszawa</p>
          <p className="text-sm text-muted">
            Strzelnica czynna: Pon-Pt 16:00-21:00, Sob-Nd 9:00-18:00
          </p>
        </div>
      </section>
    </div>
  )
}
