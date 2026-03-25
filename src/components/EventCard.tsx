'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MapPin, Users, Clock, Tag, UserPlus, Check, Search } from 'lucide-react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

const typeLabels: Record<string, { label: string; color: string }> = {
  competition: { label: 'Zawody', color: 'bg-primary/20 text-primary' },
  training: { label: 'Trening', color: 'bg-success/20 text-success' },
  course: { label: 'Kurs', color: 'bg-blue-500/20 text-blue-400' },
  other: { label: 'Inne', color: 'bg-muted/20 text-muted' },
}

interface EventCardProps {
  event: {
    id: string
    title: string
    description: string | null
    event_type: string
    start_date: string
    end_date: string | null
    location: string | null
    max_participants: number | null
    price_pln: number
    discipline?: { name: string } | null
  }
  regCount: number
  members: { id: string; full_name: string; license_number: string | null }[]
}

export default function EventCard({ event, regCount, members }: EventCardProps) {
  const [showRegister, setShowRegister] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [registering, setRegistering] = useState(false)
  const [registered, setRegistered] = useState(false)
  const [error, setError] = useState('')
  const [count, setCount] = useState(regCount)

  const type = typeLabels[event.event_type] ?? typeLabels.other
  const isFull = event.max_participants ? count >= event.max_participants : false
  const fillPercent = event.max_participants ? Math.min((count / event.max_participants) * 100, 100) : 0

  const filteredMembers = members.filter(m =>
    m.full_name.toLowerCase().includes(search.toLowerCase()) ||
    m.license_number?.toLowerCase().includes(search.toLowerCase())
  )

  async function handleRegister() {
    if (!selectedMemberId) return
    setRegistering(true)
    setError('')

    const { error: dbError } = await supabase.from('event_registrations').insert({
      event_id: event.id,
      member_id: selectedMemberId,
      status: 'registered',
    })

    setRegistering(false)

    if (dbError) {
      if (dbError.code === '23505') {
        setError('Ten zawodnik jest już zapisany na to wydarzenie.')
      } else {
        setError('Błąd zapisu: ' + dbError.message)
      }
      return
    }

    setRegistered(true)
    setCount(prev => prev + 1)
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 hover:border-primary/30 transition-colors">
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        {/* Date */}
        <div className="flex-shrink-0 text-center bg-background rounded-lg p-3 w-20">
          <div className="text-2xl font-bold text-primary">
            {format(new Date(event.start_date), 'd', { locale: pl })}
          </div>
          <div className="text-xs text-muted uppercase">
            {format(new Date(event.start_date), 'MMM', { locale: pl })}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${type.color}`}>
              {type.label}
            </span>
            {event.discipline?.name && (
              <span className="text-xs text-muted">{event.discipline.name}</span>
            )}
          </div>
          <h3 className="text-lg font-semibold mb-2">{event.title}</h3>
          {event.description && (
            <p className="text-sm text-muted mb-3">{event.description}</p>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-muted">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {format(new Date(event.start_date), 'HH:mm', { locale: pl })}
              {event.end_date && ` - ${format(new Date(event.end_date), 'HH:mm', { locale: pl })}`}
            </span>
            {event.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {event.location}
              </span>
            )}
            {event.price_pln > 0 && (
              <span className="flex items-center gap-1">
                <Tag className="w-4 h-4" />
                {Number(event.price_pln).toFixed(0)} zł
              </span>
            )}
          </div>
        </div>

        {/* Capacity + Register button */}
        <div className="flex-shrink-0 w-44">
          {event.max_participants && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="flex items-center gap-1 text-muted">
                  <Users className="w-4 h-4" />
                  {count}/{event.max_participants}
                </span>
                {isFull && <span className="text-xs text-danger font-medium">Pełne</span>}
              </div>
              <div className="w-full bg-background rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${isFull ? 'bg-danger' : 'bg-primary'}`}
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
            </div>
          )}
          {!isFull && !registered && (
            <button
              onClick={() => setShowRegister(!showRegister)}
              className="w-full text-sm px-4 py-2 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-1"
            >
              <UserPlus className="w-4 h-4" />
              Zapisz się
            </button>
          )}
          {registered && (
            <div className="w-full text-sm px-4 py-2 bg-success/20 text-success font-semibold rounded-lg flex items-center justify-center gap-1">
              <Check className="w-4 h-4" />
              Zapisano!
            </div>
          )}
        </div>
      </div>

      {/* Registration form */}
      {showRegister && !registered && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm text-muted mb-3">Wybierz członka klubu do zapisania:</p>
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-muted absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Szukaj po nazwisku lub licencji..."
              className="w-full bg-background border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary"
            />
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1 mb-3">
            {filteredMembers.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedMemberId(m.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                  selectedMemberId === m.id
                    ? 'bg-primary/15 text-primary border border-primary/30'
                    : 'hover:bg-card-hover border border-transparent'
                }`}
              >
                <span>{m.full_name}</span>
                <span className="text-xs text-muted">{m.license_number}</span>
              </button>
            ))}
            {filteredMembers.length === 0 && (
              <p className="text-sm text-muted py-2 text-center">Nie znaleziono członka.</p>
            )}
          </div>

          {error && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg p-2 mb-3">
              <p className="text-xs text-danger">{error}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleRegister}
              disabled={!selectedMemberId || registering}
              className="flex-1 text-sm px-4 py-2 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {registering ? 'Zapisywanie...' : 'Potwierdź zapis'}
            </button>
            <button
              onClick={() => { setShowRegister(false); setError('') }}
              className="text-sm px-4 py-2 border border-border rounded-lg hover:bg-card-hover transition-colors"
            >
              Anuluj
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
