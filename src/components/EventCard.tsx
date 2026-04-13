'use client'

import { useState } from 'react'
import { MapPin, Users, Clock, Tag, UserPlus, Check, X, User, Mail, Phone, ExternalLink, Target, Shield, AlertTriangle, CreditCard } from 'lucide-react'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { useEventRegistration, useDisciplineSelection } from '@/hooks/eventCard'
import type { EventDisc, EventSlot } from '@/hooks/eventCard'

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
    address: string | null
    max_participants: number | null
    price_pln: number
    discipline?: { name: string } | null
  }
  regCount: number
  eventDisciplines: EventDisc[]
  slots?: EventSlot[]
}

export default function EventCard({ event, regCount, eventDisciplines, slots = [] }: EventCardProps) {
  const reg = useEventRegistration(event, eventDisciplines, slots, regCount)
  const disc = useDisciplineSelection(eventDisciplines, slots, reg.isCourse)

  const [guestForm, setGuestForm] = useState({
    full_name: '', email: '', phone: '',
    experience: '' as string, has_license: false, license_number: '', message: '',
  })

  const type = typeLabels[event.event_type] ?? typeLabels.other

  const totalCostVal = reg.totalCost(disc.ownWeapon)
  const newDiscsTotalVal = reg.addingDiscs
    ? reg.newDiscsTotal(disc.selectedDiscs, disc.ownWeapon)
    : disc.selectedTotal

  const inputClass = "w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-primary"

  // Slot picker for a discipline
  function SlotPicker({ edId }: { edId: string }) {
    if (reg.isCourse) return null
    const discSlots = disc.getSlotsForDiscipline(edId)
    if (discSlots.length === 0) return null

    const currentSelected = disc.selectedSlots.get(edId)

    return (
      <div className="ml-6 mt-2 mb-1 space-y-1">
        <p className="text-xs text-muted mb-1.5">Wybierz termin:</p>
        {discSlots.map(slot => {
          const isFull = slot.current_count >= slot.max_participants
          const isSelected = currentSelected === slot.id
          const startFormatted = format(new Date(slot.start_time), 'HH:mm')
          const endFormatted = format(new Date(slot.end_time), 'HH:mm')

          return (
            <button
              key={slot.id}
              type="button"
              disabled={isFull}
              onClick={() => disc.selectSlot(edId, slot.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors text-left ${
                isFull
                  ? 'border-border bg-background/50 text-muted/50 cursor-not-allowed opacity-50'
                  : isSelected
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border hover:border-primary/30 text-muted hover:text-foreground'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                  isSelected ? 'bg-primary border-primary' : 'border-border'
                }`}>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-background" />}
                </div>
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                <span className={isSelected ? 'font-medium' : ''}>{startFormatted} - {endFormatted}</span>
              </div>
              <span className={`text-xs flex-shrink-0 ${isFull ? 'text-danger/50' : isSelected ? 'text-primary' : ''}`}>
                {slot.current_count}/{slot.max_participants} miejsc
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  function DisciplinePicker() {
    if (eventDisciplines.length === 0) return null
    return (
      <div className="mb-3">
        <p className="text-sm font-medium mb-2">Wybierz dyscypliny / opcje:</p>
        <div className="space-y-1.5">
          {eventDisciplines.map(ed => {
            const isSelected = disc.selectedDiscs.has(ed.id)
            const alreadyRegistered = reg.addingDiscs && reg.myDiscs.some((d: any) => d.edId === ed.id)
            return (
              <div key={ed.id}>
                <button
                  type="button"
                  disabled={alreadyRegistered}
                  onClick={() => !alreadyRegistered && disc.toggleDisc(ed.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-sm transition-colors text-left ${
                    alreadyRegistered
                      ? 'border-border bg-success/5 text-muted cursor-default'
                      : isSelected
                        ? 'border-primary bg-primary/10 text-foreground'
                        : 'border-border hover:border-primary/30 text-muted hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      alreadyRegistered ? 'bg-success/30 border-success/50' : isSelected ? 'bg-primary border-primary' : 'border-border'
                    }`}>
                      {(isSelected || alreadyRegistered) && <Check className={`w-3 h-3 ${alreadyRegistered ? 'text-success' : 'text-background'}`} />}
                    </div>
                    <span className={isSelected ? 'font-medium' : ''}>{ed.discipline?.name ?? 'Dyscyplina'}</span>
                    {alreadyRegistered && (() => {
                      const myDisc = reg.myDiscs.find((d: any) => d.edId === ed.id) as any
                      return (
                        <span className="text-xs text-success ml-1 flex items-center gap-1">
                          (zapisano)
                          {!reg.isCourse && myDisc?.slot && (
                            <span className="flex items-center gap-0.5 text-success/70">
                              <Clock className="w-3 h-3" />
                              {format(new Date(myDisc.slot.start), 'HH:mm')}-{format(new Date(myDisc.slot.end), 'HH:mm')}
                            </span>
                          )}
                        </span>
                      )
                    })()}
                  </div>
                  {(Number(ed.price_pln) > 0 || Number(ed.own_weapon_price_pln ?? 0) > 0) && (
                    <span className="text-xs font-semibold ml-2 flex-shrink-0">
                      {disc.ownWeapon.has(ed.id) && (ed.own_weapon_price_pln ?? 0) > 0
                        ? `${Number(ed.own_weapon_price_pln).toFixed(0)} zł`
                        : `${Number(ed.price_pln).toFixed(0)} zł`}
                    </span>
                  )}
                </button>
                {isSelected && !alreadyRegistered && (ed.own_weapon_price_pln ?? 0) > 0 && (
                  <label className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={disc.ownWeapon.has(ed.id)}
                      onChange={() => disc.toggleOwnWeapon(ed.id)}
                      className="rounded border-border"
                    />
                    <span>Własna broń</span>
                    <span className="text-xs text-muted">({Number(ed.own_weapon_price_pln).toFixed(0)} zł zamiast {Number(ed.price_pln).toFixed(0)} zł)</span>
                  </label>
                )}
                {isSelected && !alreadyRegistered && <SlotPicker edId={ed.id} />}
              </div>
            )
          })}
        </div>
        {disc.selectedDiscs.size > 0 && (
          <div className="flex items-center justify-between mt-2 px-1">
            {reg.addingDiscs ? (
              <>
                <span className="text-xs text-muted">Nowe: {disc.selectedDiscs.size - reg.alreadyEdIds.size} {(disc.selectedDiscs.size - reg.alreadyEdIds.size) === 1 ? 'pozycja' : (disc.selectedDiscs.size - reg.alreadyEdIds.size) < 5 ? 'pozycje' : 'pozycji'}</span>
                <span className="text-sm font-semibold text-primary">{newDiscsTotalVal > 0 ? `+${newDiscsTotalVal.toFixed(0)} zł` : '0 zł'}</span>
              </>
            ) : (
              <>
                <span className="text-xs text-muted">Wybrano: {disc.selectedDiscs.size} {disc.selectedDiscs.size === 1 ? 'pozycja' : disc.selectedDiscs.size < 5 ? 'pozycje' : 'pozycji'}</span>
                <span className="text-sm font-semibold text-primary">{disc.selectedTotal.toFixed(0)} zł</span>
              </>
            )}
          </div>
        )}
      </div>
    )
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
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${type.color}`}>
              {type.label}
            </span>
            {eventDisciplines.map(ed => (
              <span key={ed.id} className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                {ed.discipline?.name}
              </span>
            ))}
            {eventDisciplines.length === 0 && event.discipline?.name && (
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
                {event.address && (
                  <a
                    href={`https://maps.google.com/?q=${encodeURIComponent(event.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-primary hover:text-primary-dark transition-colors ml-1"
                    title="Otwórz w Google Maps"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </span>
            )}
            {eventDisciplines.length > 0 && (
              <span className="flex items-center gap-1">
                <Tag className="w-4 h-4" />
                {eventDisciplines.length === 1
                  ? `${Number(eventDisciplines[0].price_pln).toFixed(0)} zł`
                  : `od ${Math.min(...eventDisciplines.map(d => Number(d.price_pln))).toFixed(0)} zł`
                }
              </span>
            )}
            {eventDisciplines.length === 0 && event.price_pln > 0 && (
              <span className="flex items-center gap-1">
                <Tag className="w-4 h-4" />
                {Number(event.price_pln).toFixed(0)} zł
              </span>
            )}
            {event.event_type === 'competition' && eventDisciplines.length > 0 && (() => {
              const totalStations = eventDisciplines.reduce((s, ed) => s + (ed.discipline?.stations_count ?? 1), 0)
              return (
                <span className="flex items-center gap-1">
                  <Target className="w-4 h-4" />
                  {totalStations} stanowisk
                </span>
              )
            })()}
          </div>
        </div>

        {/* Capacity + Action */}
        <div className="flex-shrink-0 w-44">
          {event.max_participants && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="flex items-center gap-1 text-muted">
                  <Users className="w-4 h-4" />
                  {reg.count}/{event.max_participants}
                </span>
                {reg.isFull && !reg.registered && <span className="text-xs text-danger font-medium">Pełne</span>}
              </div>
              <div className="w-full bg-background rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${reg.isFull && !reg.registered ? 'bg-danger' : 'bg-primary'}`}
                  style={{ width: `${reg.fillPercent}%` }}
                />
              </div>
            </div>
          )}

          {!reg.registered && !reg.isFull && reg.mode === null && (
            <button
              onClick={() => reg.openRegistration(disc.preselectSingle)}
              className="w-full text-sm px-4 py-2 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-1"
            >
              <UserPlus className="w-4 h-4" />
              Zapisz się
            </button>
          )}

          {reg.registered && reg.mode === null && (
            <div className="space-y-2">
              <div className="w-full text-sm px-4 py-2 bg-success/20 text-success font-semibold rounded-lg flex items-center justify-center gap-1">
                <Check className="w-4 h-4" />
                Zapisano {reg.isPaid && '· Opłacono'}
              </div>
              {!reg.isPaid && totalCostVal > 0 && (
                <button
                  onClick={() => reg.handlePayment(disc.ownWeapon)}
                  disabled={reg.paymentLoading}
                  className="w-full text-sm px-4 py-2 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <CreditCard className="w-4 h-4" />
                  {reg.paymentLoading ? 'Przekierowanie...' : `Zapłać ${totalCostVal.toFixed(2)} zł`}
                </button>
              )}
              {reg.member && eventDisciplines.length > 1 && reg.myDiscs.length < eventDisciplines.length && (
                <button
                  onClick={() => reg.startAddingDiscs(disc.setSelectedDiscs, disc.setSelectedSlots)}
                  className="w-full text-xs px-3 py-1.5 border border-primary/30 text-primary rounded-lg hover:bg-primary/10 transition-colors"
                >
                  Dodaj dyscyplinę
                </button>
              )}
              {reg.member && (
                <button
                  onClick={reg.handleCancel}
                  disabled={reg.cancelling}
                  className="w-full text-xs px-3 py-1.5 border border-border text-muted rounded-lg hover:bg-card-hover hover:text-danger transition-colors disabled:opacity-50"
                >
                  {reg.cancelling ? 'Anulowanie...' : 'Anuluj zapis'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* My registered disciplines */}
      {reg.registered && reg.mode === null && reg.myDiscs.length > 0 && (
        <div className="mx-6 mb-4 pb-0">
          <p className="text-xs text-muted mb-1.5">Twoje dyscypliny:</p>
          <div className="flex flex-wrap gap-2">
            {reg.myDiscs.map((d: any, i: number) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
                {d.name}
                {!reg.isCourse && d.slot && (
                  <span className="text-primary/70 flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    {format(new Date(d.slot.start), 'HH:mm')} - {format(new Date(d.slot.end), 'HH:mm')}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ---- DATA CONFIRMATION ---- */}
      {reg.mode === 'confirm_data' && reg.member && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-sm font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Potwierdz aktualne dane przed zapisem
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm mb-4">
              <div>
                <span className="text-xs text-muted">Imie i nazwisko</span>
                <p className="font-medium">{reg.member.full_name}</p>
              </div>
              <div>
                <span className="text-xs text-muted">PESEL</span>
                <p className={`font-medium ${!reg.member.pesel ? 'text-warning italic' : ''}`}>{reg.member.pesel || 'brak - uzupelnij w profilu'}</p>
              </div>
              <div>
                <span className="text-xs text-muted">Nr dokumentu</span>
                <p className={`font-medium ${!reg.member.id_document_number ? 'text-warning italic' : ''}`}>{reg.member.id_document_number || 'brak - uzupelnij w profilu'}</p>
              </div>
              <div>
                <span className="text-xs text-muted">Adres</span>
                <p className={`font-medium ${!reg.member.address ? 'text-warning italic' : ''}`}>{reg.member.address || 'brak - uzupelnij w profilu'}</p>
              </div>
              <div>
                <span className="text-xs text-muted">Telefon</span>
                <p className="font-medium">{reg.member.phone || '-'}</p>
              </div>
              <div>
                <span className="text-xs text-muted">Klub</span>
                <p className="font-medium">{reg.member.club_name}</p>
              </div>
              {reg.member.has_weapons_permit && (
                <div>
                  <span className="text-xs text-muted">Nr pozwolenia na bron</span>
                  <p className={`font-medium ${!reg.member.weapon_permit_number ? 'text-warning italic' : ''}`}>{reg.member.weapon_permit_number || 'brak - uzupelnij w profilu'}</p>
                </div>
              )}
              {reg.member.license_number && (
                <div>
                  <span className="text-xs text-muted">Nr licencji</span>
                  <p className="font-medium">{reg.member.license_number}</p>
                </div>
              )}
            </div>

            {(() => {
              const missing: string[] = []
              if (!reg.member!.pesel) missing.push('PESEL')
              if (!reg.member!.date_of_birth) missing.push('data urodzenia')
              if (!reg.member!.id_document_number) missing.push('nr dokumentu tozsamosci')
              if (!reg.member!.address) missing.push('adres zamieszkania')
              const hasMissing = missing.length > 0

              return hasMissing ? (
                <>
                  <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 mb-3">
                    <p className="text-sm text-danger font-semibold mb-1">Nie mozna sie zapisac</p>
                    <p className="text-xs text-danger/80 mb-2">
                      Rejestracja na zawody wymaga kompletnych danych do listy wejscia na strzelnice. Brakuje: <strong>{missing.join(', ')}</strong>
                    </p>
                    <p className="text-xs text-danger/60">Uzupelnij dane w profilu, a nastepnie wroc i zapisz sie na zawody.</p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href="/profil"
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors"
                    >
                      Uzupelnij dane w profilu
                    </a>
                    <button onClick={() => reg.closeForm(disc.resetSelection)} className="px-4 py-2.5 border border-border text-muted text-sm rounded-lg hover:bg-card-hover transition-colors">
                      Anuluj
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={reg.confirmDataAndProceed}
                    className="flex-1 bg-primary text-background text-sm font-semibold py-2.5 rounded-lg hover:bg-primary-dark transition-colors"
                  >
                    Dane sa aktualne - kontynuuj
                  </button>
                  <a
                    href="/profil"
                    className="flex items-center gap-1 px-4 py-2.5 border border-border text-muted text-sm rounded-lg hover:bg-card-hover transition-colors"
                  >
                    Zaktualizuj dane
                  </a>
                </div>
              )
            })()}
            <button onClick={() => reg.closeForm(disc.resetSelection)} className="mt-2 text-xs text-muted hover:text-foreground transition-colors block w-full text-center">
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* ---- CHOOSE PATH ---- */}
      {reg.mode === 'choose' && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-sm font-medium mb-3">Jak chcesz się zapisać?</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <a
              href="/logowanie"
              className="flex items-center gap-3 p-4 border border-border rounded-xl hover:border-primary/30 transition-colors group"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-sm group-hover:text-primary transition-colors">Jestem członkiem klubu</div>
                <div className="text-xs text-muted">Zaloguj się i zapisz jednym kliknięciem</div>
              </div>
            </a>
            <button
              onClick={() => {
                disc.preselectSingle()
                reg.setMode('guest')
              }}
              className="flex items-center gap-3 p-4 border border-border rounded-xl hover:border-primary/30 transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <div className="font-semibold text-sm group-hover:text-blue-400 transition-colors">Osoba z zewnątrz</div>
                <div className="text-xs text-muted">Wypełnij formularz zgłoszeniowy</div>
              </div>
            </button>
          </div>
          <button onClick={() => reg.closeForm(disc.resetSelection)} className="mt-3 text-xs text-muted hover:text-foreground transition-colors">
            Anuluj
          </button>
        </div>
      )}

      {/* ---- MEMBER CONFIRM ---- */}
      {reg.mode === 'member' && (!reg.registered || reg.addingDiscs) && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {reg.member?.full_name.charAt(0)}
            </div>
            <div>
              <div className="font-medium text-sm">{reg.member?.full_name}</div>
              <div className="text-xs text-muted">{reg.member?.license_number ?? reg.member?.email}</div>
            </div>
          </div>

          <DisciplinePicker />

          {reg.error && (
            <div className="bg-danger/10 border border-danger/30 rounded-lg p-2 mb-3">
              <p className="text-xs text-danger">{reg.error}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!disc.allSlotsSelected()) {
                  return
                }
                reg.handleMemberRegister(disc.selectedDiscs, disc.selectedSlots, disc.ownWeapon)
              }}
              disabled={reg.registering}
              className="flex-1 text-sm px-4 py-2 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {reg.registering ? 'Zapisuję...' : reg.addingDiscs
                ? (newDiscsTotalVal > 0 ? `Potwierdź dopisanie · ${newDiscsTotalVal.toFixed(0)} zł` : 'Potwierdź dopisanie')
                : (disc.selectedTotal > 0 ? `Potwierdź zapis · ${disc.selectedTotal.toFixed(0)} zł` : 'Potwierdź zapis')}
            </button>
            <button onClick={() => reg.closeForm(disc.resetSelection)} className="text-sm px-4 py-2 border border-border rounded-lg hover:bg-card-hover transition-colors">
              Anuluj
            </button>
          </div>
        </div>
      )}

      {/* ---- GUEST FORM ---- */}
      {reg.mode === 'guest' && !reg.registered && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-5 h-5 text-blue-400" />
            <h4 className="font-semibold text-sm">Zgłoszenie osoby z zewnątrz</h4>
          </div>
          <form onSubmit={e => {
            if (!disc.allSlotsSelected()) {
              e.preventDefault()
              return
            }
            reg.handleGuestRegister(e, guestForm, disc.selectedDiscs, disc.selectedSlots, disc.ownWeapon)
          }} className="space-y-3">
            <DisciplinePicker />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted block mb-1">Imię i nazwisko *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-muted absolute left-3 top-2.5" />
                  <input
                    required
                    value={guestForm.full_name}
                    onChange={e => setGuestForm(f => ({ ...f, full_name: e.target.value }))}
                    placeholder="Jan Kowalski"
                    className={inputClass + ' pl-9'}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Email *</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-muted absolute left-3 top-2.5" />
                  <input
                    required
                    type="email"
                    value={guestForm.email}
                    onChange={e => setGuestForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="jan@example.com"
                    className={inputClass + ' pl-9'}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted block mb-1">Telefon</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-muted absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    value={guestForm.phone}
                    onChange={e => setGuestForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+48 123 456 789"
                    className={inputClass + ' pl-9'}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Doświadczenie</label>
                <select
                  value={guestForm.experience}
                  onChange={e => setGuestForm(f => ({ ...f, experience: e.target.value }))}
                  className={inputClass}
                >
                  <option value="">Wybierz...</option>
                  <option value="none">Brak</option>
                  <option value="beginner">Początkujący (do 1 roku)</option>
                  <option value="intermediate">Średniozaawansowany</option>
                  <option value="advanced">Zaawansowany (3+ lat)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={guestForm.has_license}
                  onChange={e => setGuestForm(f => ({ ...f, has_license: e.target.checked }))}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-sm">Posiadam pozwolenie na broń</span>
              </label>
              {guestForm.has_license && (
                <input
                  value={guestForm.license_number}
                  onChange={e => setGuestForm(f => ({ ...f, license_number: e.target.value }))}
                  placeholder="Numer pozwolenia"
                  className={inputClass + ' mt-2'}
                />
              )}
            </div>

            <div>
              <label className="text-xs text-muted block mb-1">Wiadomość do organizatora</label>
              <textarea
                value={guestForm.message}
                onChange={e => setGuestForm(f => ({ ...f, message: e.target.value }))}
                rows={2}
                placeholder="Dodatkowe informacje, pytania..."
                className={inputClass + ' resize-none'}
              />
            </div>

            {disc.selectedTotal > 0 && (
              <p className="text-xs text-muted">
                Do zapłaty: <span className="font-semibold text-foreground">{disc.selectedTotal.toFixed(0)} zł</span> — szczegóły płatności zostaną przesłane na email.
              </p>
            )}

            {reg.error && (
              <div className="bg-danger/10 border border-danger/30 rounded-lg p-2">
                <p className="text-xs text-danger">{reg.error}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={reg.registering}
                className="flex-1 text-sm px-4 py-2 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {reg.registering ? 'Wysyłanie...' : disc.selectedTotal > 0 ? `Wyślij zgłoszenie · ${disc.selectedTotal.toFixed(0)} zł` : 'Wyślij zgłoszenie'}
              </button>
              <button type="button" onClick={() => reg.closeForm(disc.resetSelection)} className="text-sm px-4 py-2 border border-border rounded-lg hover:bg-card-hover transition-colors">
                Anuluj
              </button>
            </div>

            <p className="text-xs text-muted text-center">
              Wysyłając zgłoszenie wyrażasz zgodę na przetwarzanie danych w celu organizacji wydarzenia (RODO art. 6 ust. 1 lit. a).
            </p>
          </form>
        </div>
      )}

      {/* Global error outside forms */}
      {reg.error && reg.mode === null && (
        <div className="mt-3 bg-danger/10 border border-danger/30 rounded-lg p-2">
          <p className="text-xs text-danger">{reg.error}</p>
        </div>
      )}
    </div>
  )
}
