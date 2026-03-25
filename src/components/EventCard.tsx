'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { MapPin, Users, Clock, Tag, UserPlus, Check, LogIn, X } from 'lucide-react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import Link from 'next/link'

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
  myRegistration?: boolean
}

export default function EventCard({ event, regCount, myRegistration = false }: EventCardProps) {
  const { member } = useAuth()
  const supabase = createSupabaseBrowser()

  const [registering, setRegistering] = useState(false)
  const [registered, setRegistered] = useState(myRegistration)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')
  const [count, setCount] = useState(regCount)
  const [showConfirm, setShowConfirm] = useState(false)

  const type = typeLabels[event.event_type] ?? typeLabels.other
  const isFull = event.max_participants ? count >= event.max_participants : false
  const fillPercent = event.max_participants ? Math.min((count / event.max_participants) * 100, 100) : 0

  async function handleRegister() {
    if (!member) return
    setRegistering(true)
    setError('')

    const { error: dbError } = await supabase.from('event_registrations').insert({
      event_id: event.id,
      member_id: member.id,
      status: 'registered',
    })

    setRegistering(false)

    if (dbError) {
      if (dbError.code === '23505') {
        setError('Jesteś już zapisany na to wydarzenie.')
        setRegistered(true)
      } else {
        setError('Błąd zapisu: ' + dbError.message)
      }
      return
    }

    setRegistered(true)
    setCount(prev => prev + 1)
    setShowConfirm(false)
  }

  async function handleCancel() {
    if (!member) return
    setCancelling(true)
    setError('')

    const { error: dbError } = await supabase
      .from('event_registrations')
      .delete()
      .eq('event_id', event.id)
      .eq('member_id', member.id)

    setCancelling(false)

    if (dbError) {
      setError('Błąd anulowania: ' + dbError.message)
      return
    }

    setRegistered(false)
    setCount(prev => Math.max(0, prev - 1))
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

        {/* Capacity + Action */}
        <div className="flex-shrink-0 w-44">
          {event.max_participants && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="flex items-center gap-1 text-muted">
                  <Users className="w-4 h-4" />
                  {count}/{event.max_participants}
                </span>
                {isFull && !registered && <span className="text-xs text-danger font-medium">Pełne</span>}
              </div>
              <div className="w-full bg-background rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${isFull && !registered ? 'bg-danger' : 'bg-primary'}`}
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Not logged in */}
          {!member && (
            <Link
              href="/logowanie"
              className="w-full text-sm px-4 py-2 border border-border text-muted font-medium rounded-lg hover:bg-card-hover transition-colors flex items-center justify-center gap-1"
            >
              <LogIn className="w-4 h-4" />
              Zaloguj by zapisać
            </Link>
          )}

          {/* Logged in, not registered */}
          {member && !registered && !isFull && !showConfirm && (
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full text-sm px-4 py-2 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-1"
            >
              <UserPlus className="w-4 h-4" />
              Zapisz się
            </button>
          )}

          {/* Confirm */}
          {showConfirm && !registered && (
            <div className="space-y-2">
              <button
                onClick={handleRegister}
                disabled={registering}
                className="w-full text-sm px-4 py-2 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {registering ? 'Zapisuję...' : 'Potwierdź zapis'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="w-full text-sm px-4 py-2 border border-border rounded-lg hover:bg-card-hover transition-colors flex items-center justify-center gap-1"
              >
                <X className="w-3 h-3" />
                Anuluj
              </button>
            </div>
          )}

          {/* Already registered */}
          {registered && (
            <div className="space-y-2">
              <div className="w-full text-sm px-4 py-2 bg-success/20 text-success font-semibold rounded-lg flex items-center justify-center gap-1">
                <Check className="w-4 h-4" />
                Zapisano
              </div>
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full text-xs px-3 py-1.5 border border-border text-muted rounded-lg hover:bg-card-hover hover:text-danger transition-colors disabled:opacity-50"
              >
                {cancelling ? 'Anulowanie...' : 'Anuluj zapis'}
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 bg-danger/10 border border-danger/30 rounded-lg p-2">
          <p className="text-xs text-danger">{error}</p>
        </div>
      )}
    </div>
  )
}
