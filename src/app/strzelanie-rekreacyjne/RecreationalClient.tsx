'use client'

import { Target, Clock, CreditCard, CheckCircle, X, Loader2, ChevronLeft, ChevronRight, User, Crosshair, Package, ShoppingCart, Trash2, Plus } from 'lucide-react'
import Link from 'next/link'
import { formatDate, addDays, timeToMin } from '@/lib/date'
import { useRecreationalBooking, useOnsiteBooking } from '@/hooks/recreational'
import type { RecPackage, Lane } from '@/hooks/recreational'

const TYPE_LABELS: Record<string, string> = {
  pistol: 'Pistolet',
  rifle: 'Karabin',
  shotgun: 'Strzelba',
  other: 'Inne',
}

export default function RecreationalClient({ packages, lanes }: { packages: RecPackage[]; lanes: Lane[] }) {
  const b = useRecreationalBooking(packages, lanes)
  const onsite = useOnsiteBooking(packages)

  if (b.bookingSuccess) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Zarezerwowano!</h1>
        <p className="text-muted mb-6">
          Twoje strzelanie rekreacyjne zostało zarezerwowane. Instruktor przygotuje broń i amunicję.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => { b.setBookingSuccess(false); b.setSelectedPkg(null) }} className="px-6 py-2.5 border border-border rounded-lg font-medium hover:bg-card transition-colors">
            Zarezerwuj kolejne
          </button>
          <Link href="/" className="px-6 py-2.5 bg-primary text-background rounded-lg font-semibold hover:bg-primary-dark transition-colors">
            Strona główna
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">Strzelanie rekreacyjne</h1>
          <p className="text-muted">Wybierz pakiet, datę i godzinę. Instruktor przygotuje broń i amunicję — Ty strzelasz!</p>
        </div>
        {onsite.isRangeStaff && (
          <button
            onClick={onsite.openOnsiteBooking}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors whitespace-nowrap"
          >
            <Package className="w-4 h-4" />
            Zestaw na miejscu
          </button>
        )}
      </div>

      {packages.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted">
          <Target className="w-12 h-12 mx-auto mb-4 opacity-40" />
          <p className="font-semibold mb-1">Brak dostępnych pakietów</p>
          <p className="text-sm">Administrator musi najpierw skonfigurować pakiety strzeleckie.</p>
        </div>
      ) : (
        <>
          <h2 className="text-lg font-semibold mb-4">Wybierz pakiet</h2>

          {Object.entries(b.groupedPackages).map(([type, pkgs]) => (
            <div key={type} className="mb-6">
              <h3 className="text-sm font-medium text-muted mb-2">{TYPE_LABELS[type] || type}</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {pkgs.map(pkg => {
                  const isSelected = b.selectedPkg?.id === pkg.id
                  return (
                    <div
                      key={pkg.id}
                      className={`rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-primary/5 border-primary sm:col-span-2 lg:col-span-3'
                          : 'bg-card border-border hover:border-primary/40'
                      }`}
                    >
                      <button
                        onClick={() => { b.setSelectedPkg(isSelected ? null : pkg); b.setSelectedSlot(null) }}
                        className="w-full text-left p-4"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-sm">{pkg.name}</h4>
                            <p className="text-xs text-muted">{pkg.weapon?.name} · {pkg.weapon?.caliber}</p>
                          </div>
                          <Crosshair className={`w-5 h-5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted/30'}`} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted">
                          <span className="flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            {pkg.ammo_count} szt.
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {pkg.duration_minutes} min
                          </span>
                        </div>
                        {pkg.description && <p className="text-xs text-muted mt-2">{pkg.description}</p>}
                        <div className="mt-3 text-lg font-bold text-primary">{Number(pkg.price_pln).toFixed(0)} zł</div>
                      </button>

                      {isSelected && (
                        <div className="px-4 pb-4 border-t border-border/50 pt-4 space-y-4">
                          <div>
                            <p className="text-sm font-medium mb-2">Wybierz termin</p>
                            <div className="flex items-center gap-2 mb-3">
                              <button
                                onClick={() => b.setSelectedDate(formatDate(addDays(b.dateObj, -1)))}
                                className="p-1.5 rounded-lg border border-border hover:bg-background"
                              >
                                <ChevronLeft className="w-4 h-4" />
                              </button>
                              <input
                                type="date"
                                value={b.selectedDate}
                                min={formatDate(addDays(new Date(), 1))}
                                onChange={e => { b.setSelectedDate(e.target.value); b.setSelectedSlot(null) }}
                                className="px-3 py-1.5 bg-background border border-border rounded-lg text-sm font-medium"
                              />
                              <button
                                onClick={() => b.setSelectedDate(formatDate(addDays(b.dateObj, 1)))}
                                className="p-1.5 rounded-lg border border-border hover:bg-background"
                              >
                                <ChevronRight className="w-4 h-4" />
                              </button>
                              <span className="text-xs text-muted ml-1">
                                {b.dateObj.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })}
                              </span>
                            </div>

                            {/* Rearrange prompt */}
                            {b.showRearrangePrompt && b.rearrangeInfo && !b.loadingSlots && (
                              <div className="bg-primary/10 border border-primary/30 rounded-lg px-4 py-3 mb-2">
                                <p className="text-sm font-medium mb-2">
                                  <Clock className="w-4 h-4 inline mr-1.5" />
                                  Brak ciągłego terminu po obecnych pakietach. Mogę przesunąć sloty, aby zachować ciągłość:
                                </p>
                                <div className="bg-background/50 rounded-lg px-3 py-2 mb-3 text-sm space-y-1">
                                  {b.rearrangeInfo.cartRemap.map((remap: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-2 text-muted">
                                      <span>{b.cart[remap.cartIndex]?.pkg.name}:</span>
                                      <span className="line-through text-red-400/70">{b.cart[remap.cartIndex]?.slot.time}</span>
                                      <span>→</span>
                                      <span className="font-semibold text-foreground">{remap.startTime}–{remap.endTime}</span>
                                    </div>
                                  ))}
                                  <div className="flex items-center gap-2 text-primary font-medium">
                                    <span>{b.selectedPkg?.name}:</span>
                                    <span className="font-semibold">{b.rearrangeInfo.newPkgSlot.time}–{b.rearrangeInfo.endTime}</span>
                                    <span className="text-xs text-muted">(nowy)</span>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={b.acceptRearrangement} className="flex-1 px-4 py-2 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors text-sm">
                                    Tak, przesuń
                                  </button>
                                  <button onClick={b.declineRearrangement} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-background transition-colors text-sm">
                                    Nie, zostaw z przerwą
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Gap info */}
                            {!b.showRearrangePrompt && b.suggestedSlotInfo && b.suggestedSlotInfo.gapMin > 0 && !b.loadingSlots && b.availableSlots.length > 0 && (() => {
                              const continuousSlot = b.availableSlots.find(s => timeToMin(s.time) === b.lastCartEndMin)
                              const lastEndH = Math.floor(b.lastCartEndMin! / 60).toString().padStart(2, '0')
                              const lastEndM = (b.lastCartEndMin! % 60).toString().padStart(2, '0')
                              return continuousSlot ? null : (
                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 text-sm text-yellow-400 mb-2">
                                  <Clock className="w-4 h-4 inline mr-1.5" />
                                  Brak ciągłego terminu od {lastEndH}:{lastEndM}. Najbliższy wolny o <span className="font-semibold">{b.suggestedSlotInfo.slot.time}</span> — przerwa {b.suggestedSlotInfo.gapMin} min.
                                  {' '}Możesz wybrać inny dzień.
                                </div>
                              )
                            })()}

                            {/* Time slots */}
                            {b.loadingSlots ? (
                              <div className="flex items-center gap-2 py-6 justify-center text-muted text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Sprawdzam dostępność...
                              </div>
                            ) : b.isPast ? (
                              <p className="text-muted text-sm py-3">Wybierz przyszłą datę.</p>
                            ) : b.availableSlots.length === 0 ? (
                              <p className="text-muted text-sm py-3">Brak dostępnych terminów. Spróbuj inną datę.</p>
                            ) : (
                              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                                {b.availableSlots.map(slot => {
                                  const isSuggested = b.suggestedSlotInfo?.slot.time === slot.time && !b.selectedSlot
                                  const isBeforeCart = b.lastCartEndMin && timeToMin(slot.time) < b.lastCartEndMin
                                  return (
                                    <button
                                      key={slot.time}
                                      onClick={() => b.setSelectedSlot(slot)}
                                      disabled={!!isBeforeCart}
                                      className={`py-2 px-1.5 rounded-lg text-sm font-medium border transition-colors ${
                                        b.selectedSlot?.time === slot.time
                                          ? 'bg-primary text-background border-primary'
                                          : isSuggested
                                            ? 'bg-primary/20 border-primary/60 text-primary ring-1 ring-primary/40'
                                            : isBeforeCart
                                              ? 'bg-background/50 border-border/30 text-muted/40 cursor-not-allowed'
                                              : 'bg-background border-border hover:border-primary/40'
                                      }`}
                                    >
                                      {slot.time}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>

                          {/* Summary after slot selection */}
                          {b.selectedSlot && (
                            <div className="border-t border-border/50 pt-4 space-y-4">
                              <div className="bg-background rounded-lg p-4">
                                <p className="text-sm font-medium mb-2">Podsumowanie</p>
                                <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted">Broń:</span>
                                    <span className="font-medium">{pkg.weapon?.name}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted">Data:</span>
                                    <span className="font-medium">{b.dateObj.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted">Amunicja:</span>
                                    <span className="font-medium">{pkg.ammo_count} szt.</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted">Godzina:</span>
                                    <span className="font-medium">
                                      {b.selectedSlot.time} – {(() => {
                                        const endMin = timeToMin(b.selectedSlot.time) + pkg.duration_minutes
                                        return `${Math.floor(endMin / 60).toString().padStart(2, '0')}:${(endMin % 60).toString().padStart(2, '0')}`
                                      })()}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted">Instruktor:</span>
                                    <span className="font-medium">{b.selectedSlot.instructorName}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                                <div className="text-2xl font-bold text-primary">{Number(pkg.price_pln).toFixed(0)} zł</div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={b.addToCart}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors"
                                  >
                                    <ShoppingCart className="w-4 h-4" />
                                    Dodaj do koszyka
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Same day prompt */}
      {b.sameDayPrompt && b.cart.length > 0 && !b.selectedPkg && (
        <div className="bg-card border border-primary/30 rounded-xl p-5 mb-6">
          <p className="font-semibold mb-3">Dodać kolejny pakiet?</p>
          <p className="text-sm text-muted mb-4">
            Masz już {b.cart.length} {b.cart.length === 1 ? 'pakiet' : b.cart.length < 5 ? 'pakiety' : 'pakietów'} w koszyku
            ({b.cart[b.cart.length - 1].date === b.selectedDate ? b.dateObj.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' }) : ''}).
            Chcesz dopasować kolejny na ten sam dzień?
          </p>
          <div className="flex gap-2">
            <button onClick={() => b.setSameDayPrompt(false)} className="flex items-center gap-2 px-4 py-2 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark text-sm">
              <Plus className="w-4 h-4" />
              Tak, na ten sam dzień
            </button>
            <button onClick={() => { b.setSameDayPrompt(false); b.setSelectedDate(formatDate(addDays(new Date(), 1))) }} className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-background">
              Inny dzień
            </button>
            <button onClick={() => { b.setSameDayPrompt(false); b.setShowCart(true) }} className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-background">
              Przejdź do koszyka
            </button>
          </div>
        </div>
      )}

      {/* Cart sticky bar */}
      {b.cart.length > 0 && !b.showCart && (
        <div className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button onClick={() => b.setShowCart(!b.showCart)} className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart className="w-6 h-6 text-primary" />
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-primary text-background text-xs font-bold rounded-full flex items-center justify-center">
                  {b.cart.length}
                </span>
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">{b.cart.length} {b.cart.length === 1 ? 'pakiet' : b.cart.length < 5 ? 'pakiety' : 'pakietów'}</p>
                <p className="text-xs text-muted">{b.cart.map(c => {
                  const d = new Date(c.date + 'T00:00:00')
                  return `${c.pkg.name} (${d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })} ${c.slot.time})`
                }).join(', ')}</p>
              </div>
            </button>
            <div className="flex items-center gap-4">
              <span className="text-xl font-bold text-primary">{b.cartTotalPerPerson.toFixed(0)} zł{b.peopleCount > 1 ? ` × ${b.peopleCount}` : ''}</span>
              <button onClick={() => b.setShowCart(true)} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors">
                <CreditCard className="w-4 h-4" />
                Rezerwuj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart panel */}
      {b.showCart && b.cart.length > 0 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-card border border-border rounded-t-2xl sm:rounded-xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                Koszyk ({b.cart.length})
              </h2>
              <button onClick={() => b.setShowCart(false)} className="p-1 text-muted hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 mb-4">
              {b.cart.map((item, idx) => {
                const endMin = timeToMin(item.slot.time) + item.pkg.duration_minutes
                const endTime = `${Math.floor(endMin / 60).toString().padStart(2, '0')}:${(endMin % 60).toString().padStart(2, '0')}`
                const itemDate = new Date(item.date + 'T00:00:00')
                return (
                  <div key={idx} className="bg-background border border-border rounded-lg p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{item.pkg.name}</p>
                      <p className="text-xs text-muted">
                        {itemDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })} · {item.slot.time}–{endTime} · {item.slot.instructorName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-primary text-sm">{Number(item.pkg.price_pln).toFixed(0)} zł</span>
                      <button onClick={() => b.removeFromCart(idx)} className="p-1 text-red-500 hover:bg-red-500/10 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              onClick={() => { b.setShowCart(false); b.setSameDayPrompt(false) }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg text-sm text-muted hover:text-foreground hover:border-primary/40 mb-4"
            >
              <Plus className="w-4 h-4" />
              Dodaj kolejny pakiet
            </button>

            {!b.member && (
              <div className="border-t border-border pt-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <User className="w-4 h-4" />
                    {b.guestForms.length === 1 ? 'Twoje dane' : `Uczestnicy (${b.guestForms.length})`}
                  </p>
                  <button onClick={b.addPerson} className="flex items-center gap-1 text-xs text-primary hover:text-primary-dark font-medium">
                    <Plus className="w-3.5 h-3.5" />
                    Dodaj osobę
                  </button>
                </div>
                <div className="space-y-3">
                  {b.guestForms.map((guest, idx) => (
                    <div key={idx} className={`space-y-2 ${b.guestForms.length > 1 ? 'bg-background/50 border border-border rounded-lg p-3' : ''}`}>
                      {b.guestForms.length > 1 && (
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-muted">Osoba {idx + 1}</span>
                          <button onClick={() => b.removePerson(idx)} className="text-xs text-red-500 hover:text-red-400">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" placeholder="Imię i nazwisko *" value={guest.name} onChange={e => b.updateGuestForm(idx, 'name', e.target.value)} className="px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                        <input type="tel" placeholder="Telefon *" value={guest.phone} onChange={e => b.updateGuestForm(idx, 'phone', e.target.value)} className="px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                      </div>
                      <input type="text" placeholder="Adres zamieszkania *" value={guest.address} onChange={e => b.updateGuestForm(idx, 'address', e.target.value)} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" placeholder="Nr dowodu / paszportu *" value={guest.document} onChange={e => b.updateGuestForm(idx, 'document', e.target.value)} className="px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                        <input type="email" placeholder="Email" value={guest.email} onChange={e => b.updateGuestForm(idx, 'email', e.target.value)} className="px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                      </div>
                    </div>
                  ))}
                </div>
                {b.guestForms.length > 1 && (
                  <p className="text-xs text-muted mt-2">
                    Każda osoba otrzyma te same pakiety. Suma: {b.cartTotalPerPerson.toFixed(0)} zł × {b.guestForms.length} os. = <span className="font-bold text-primary">{b.cartTotal.toFixed(0)} zł</span>
                  </p>
                )}
              </div>
            )}

            <input
              type="text"
              placeholder="Uwagi (opcjonalnie)"
              value={b.notes}
              onChange={e => b.setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm mb-4"
            />

            <div className="flex items-center justify-between pt-4 border-t border-border">
              <div>
                <p className="text-xs text-muted">Do zapłaty{b.peopleCount > 1 ? ` (${b.peopleCount} os.)` : ''}</p>
                <p className="text-2xl font-bold text-primary">{b.cartTotal.toFixed(0)} zł</p>
              </div>
              <button
                onClick={b.handleBook}
                disabled={b.bookingLoading}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-background font-semibold rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
              >
                {b.bookingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                Rezerwuj i zapłać
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={`mt-8 text-center ${b.cart.length > 0 ? 'pb-20' : ''}`}>
        <Link href="/" className="text-sm text-muted hover:text-foreground transition-colors">
          &larr; Wróć na stronę główną
        </Link>
      </div>

      {/* Onsite booking modal */}
      {onsite.showOnsite && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                Zestaw strzelecki na miejscu
              </h2>
              <button onClick={() => onsite.setShowOnsite(false)} className="p-1 text-muted hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {onsite.onsiteSuccess ? (
              <div className="text-center py-6">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                <p className="font-semibold mb-2">Rezerwacja utworzona!</p>
                <p className="text-sm text-muted mb-4">{onsite.onsiteSuccess}</p>
                <div className="flex gap-2 justify-center">
                  <button onClick={onsite.resetOnsiteForNextClient} className="px-4 py-2 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark">
                    Następny klient
                  </button>
                  <button onClick={() => onsite.setShowOnsite(false)} className="px-4 py-2 border border-border text-sm rounded-lg hover:bg-background">
                    Zamknij
                  </button>
                </div>
              </div>
            ) : onsite.onsiteLoading ? (
              <div className="flex items-center gap-2 justify-center py-12 text-muted">
                <Loader2 className="w-5 h-5 animate-spin" />
                Ładowanie...
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted block mb-1">Pakiet (opcjonalnie)</label>
                  <select
                    value={onsite.onsiteForm.package_id}
                    onChange={e => onsite.handlePackageSelect(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                  >
                    <option value="">— własny zestaw —</option>
                    {packages.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.price_pln} zł)</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted block mb-1">Broń *</label>
                    <select
                      value={onsite.onsiteForm.weapon_id}
                      onChange={e => onsite.setOnsiteForm(f => ({ ...f, weapon_id: e.target.value }))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    >
                      <option value="">Wybierz...</option>
                      {onsite.onsiteWeapons.map(w => (
                        <option key={w.id} value={w.id}>{w.name} ({w.caliber})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Instruktor *</label>
                    <select
                      value={onsite.onsiteForm.instructor_id}
                      onChange={e => onsite.setOnsiteForm(f => ({ ...f, instructor_id: e.target.value }))}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm"
                    >
                      <option value="">Wybierz...</option>
                      {onsite.onsiteInstructors.map(i => (
                        <option key={i.id} value={i.id}>{i.full_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted block mb-1">Godzina</label>
                    <input type="time" value={onsite.onsiteForm.start_time} onChange={e => onsite.setOnsiteForm(f => ({ ...f, start_time: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Czas (min)</label>
                    <input type="number" value={onsite.onsiteForm.duration_minutes} onChange={e => onsite.setOnsiteForm(f => ({ ...f, duration_minutes: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Cena (zł)</label>
                    <input type="number" step="0.01" value={onsite.onsiteForm.price_pln} onChange={e => onsite.setOnsiteForm(f => ({ ...f, price_pln: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted block mb-1">Ilość amunicji</label>
                    <input type="number" value={onsite.onsiteForm.ammo_count} onChange={e => onsite.setOnsiteForm(f => ({ ...f, ammo_count: e.target.value }))} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Tarcze</label>
                    <input type="text" value={onsite.onsiteForm.targets} onChange={e => onsite.setOnsiteForm(f => ({ ...f, targets: e.target.value }))} placeholder="np. 3x tarcza TS-2" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                  </div>
                </div>

                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted mb-2 font-medium">Dane klienta (do książki wejścia) *</p>
                  <div className="space-y-2">
                    <input type="text" value={onsite.onsiteForm.guest_name} onChange={e => onsite.setOnsiteForm(f => ({ ...f, guest_name: e.target.value }))} placeholder="Imię i nazwisko *" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                    <input type="email" value={onsite.onsiteForm.guest_email} onChange={e => onsite.setOnsiteForm(f => ({ ...f, guest_email: e.target.value }))} placeholder="Email * (regulamin strzelnicy)" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                    <input type="text" value={onsite.onsiteForm.guest_address} onChange={e => onsite.setOnsiteForm(f => ({ ...f, guest_address: e.target.value }))} placeholder="Adres zamieszkania *" className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={onsite.onsiteForm.guest_document} onChange={e => onsite.setOnsiteForm(f => ({ ...f, guest_document: e.target.value }))} placeholder="Nr dowodu / paszportu *" className="px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                      <input type="tel" value={onsite.onsiteForm.guest_phone} onChange={e => onsite.setOnsiteForm(f => ({ ...f, guest_phone: e.target.value }))} placeholder="Telefon" className="px-3 py-2 bg-background border border-border rounded-lg text-sm" />
                    </div>
                  </div>
                </div>

                <textarea value={onsite.onsiteForm.notes} onChange={e => onsite.setOnsiteForm(f => ({ ...f, notes: e.target.value }))} placeholder="Uwagi..." rows={2} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none" />

                {onsite.onsiteForm.weapon_id && (
                  <div className="bg-background rounded-lg p-3 text-sm space-y-1 border border-border">
                    <p className="font-semibold">Podsumowanie:</p>
                    <p>Broń: <span className="text-primary">{onsite.onsiteWeapons.find(w => w.id === onsite.onsiteForm.weapon_id)?.name}</span></p>
                    <p>Amunicja: {onsite.onsiteForm.ammo_count} szt. · Czas: {onsite.onsiteForm.start_time} · {onsite.onsiteForm.duration_minutes} min</p>
                    <p className="font-semibold text-lg pt-1 border-t border-border mt-1">
                      Do zapłaty: <span className="text-primary">{Number(onsite.onsiteForm.price_pln).toFixed(2)} zł</span>
                    </p>
                  </div>
                )}

                <button
                  onClick={onsite.handleOnsiteSubmit}
                  disabled={onsite.onsiteSaving || !onsite.onsiteForm.weapon_id || !onsite.onsiteForm.instructor_id || !onsite.onsiteForm.guest_name || !onsite.onsiteForm.guest_address || !onsite.onsiteForm.guest_document || !onsite.onsiteForm.guest_email}
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {onsite.onsiteSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Zarejestruj i oznacz jako opłacone (gotówka)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
