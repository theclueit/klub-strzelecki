'use client'

import { useState, useEffect, useCallback } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { Shield, Calendar, Target, Users, Plus, Trash2, Pencil, Save, X, UserPlus, ChevronDown, ChevronUp, ClipboardList, Check, Ban, Tag, Clock, Printer, MapPin, Zap, Package, AlertTriangle, DollarSign, Eye, Crosshair, Boxes, Wrench, CircleDot, Bell, Mail, Trophy, Hash, History, ArrowDownUp, Camera } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Discipline, Member, EventDiscipline, EventDisciplineSlot } from '@/types/database'
import type { InventoryItem, Regulation, Tab } from '@/types/admin'

// Tab components
import EventsTab from './components/EventsTab'
import DisciplinesTab from './components/DisciplinesTab'
import JudgesTab from './components/JudgesTab'
import RegistrationsTab from './components/RegistrationsTab'
import InventoryTab from './components/InventoryTab'
import InstructorsTab from './components/InstructorsTab'
import RegulationsTab from './components/RegulationsTab'
import RangesTab from './components/RangesTab'

// Hooks
import { useAdminData } from '@/hooks/admin/useAdminData'
import { useOnlineUsers } from '@/hooks/admin/useOnlineUsers'
import { useLoginHistory } from '@/hooks/admin/useLoginHistory'
import { useInstructorSchedule } from '@/hooks/admin/useInstructorSchedule'
import { useShootingRange } from '@/hooks/admin/useShootingRange'
import { useRangeWeapons } from '@/hooks/admin/useRangeWeapons'
import { useShootingPackages } from '@/hooks/admin/useShootingPackages'
import { useSlotManagement } from '@/hooks/admin/useSlotManagement'
import { useJudgeManagement } from '@/hooks/admin/useJudgeManagement'
import { useDisciplineManagement } from '@/hooks/admin/useDisciplineManagement'
import { useEventManagement } from '@/hooks/admin/useEventManagement'
import { useInventoryManagement } from '@/hooks/admin/useInventoryManagement'
import { useResultsPreview } from '@/hooks/admin/useResultsPreview'
import { useOnsiteRegistration } from '@/hooks/admin/useOnsiteRegistration'
import { usePrinting } from '@/hooks/admin/usePrinting'
import { useEventFinancials } from '@/hooks/admin/useEventFinancials'

const TIME_OPTIONS: string[] = []
for (let h = 6; h <= 22; h++) {
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:00`)
  TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:30`)
}

function TimeSelect({ value, onChange, className, required }: { value: string; onChange: (v: string) => void; className?: string; required?: boolean }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className={className} required={required}>
      {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
    </select>
  )
}

export default function AdminPage() {
  const { member, loading } = useAuth()
  const router = useRouter()
  const supabase = createSupabaseBrowser()

  // ---- Local state (not moved to hooks) ----
  const [tab, setTab] = useState<Tab>('events')
  const [rangeSubTab, setRangeSubTab] = useState<'lanes' | 'packages' | 'weapons'>('lanes')

  // Regulations (no hook exists)
  const [regulationHistory, setRegulationHistory] = useState<Regulation[]>([])
  const [editingRegulation, setEditingRegulation] = useState<Regulation | null>(null)
  const [regContent, setRegContent] = useState('')
  const [historySlug, setHistorySlug] = useState<string | null>(null)
  const [savingReg, setSavingReg] = useState(false)

  // ---- Hooks ----
  const adminData = useAdminData()
  const {
    events, disciplines, judges, eventJudges, allMembers, guestRegs, memberRegs,
    eventDisciplines, regDisciplines, eventSlots, inventoryItems, regulations,
    memberTargetMap, shootingLanes, rangeWeapons, shootingPackages,
    loadAll, loadShootingLanes, loadShootingPackages, loadRangeWeapons,
    getEventDiscs, getEventTotalRegs, getEventDiscRegCounts, getRegDisciplineNames,
    getRegTotal, getSlotsForEventDiscipline, getSlotRegistrationCount,
    getFilteredDisciplines: getFilteredDisciplinesWithArg, getEventJudges, getAvailableJudges,
  } = adminData

  const { onlineUsers, showOnlineList, setShowOnlineList, loadOnlineUsers } = useOnlineUsers()
  const { loginHistory, loginHistoryLoading, showLoginHistory, setShowLoginHistory, loadLoginHistory } = useLoginHistory()
  const {
    instructorAvailability, instructorsList,
    showInstructorScheduleForm, setShowInstructorScheduleForm,
    instructorScheduleForm, setInstructorScheduleForm,
    loadInstructorSchedule, saveInstructorSchedule,
    deleteInstructorAvailability, toggleInstructorAvailability,
  } = useInstructorSchedule()

  const {
    showLaneForm, setShowLaneForm, editingLane, setEditingLane,
    laneForm, setLaneForm, laneReservations, laneResDate, setLaneResDate,
    laneResFilter, setLaneResFilter, showEventBlockForm, setShowEventBlockForm,
    eventBlockForm, setEventBlockForm,
    loadLaneReservations, openNewLane, openEditLane, saveLane, deleteLane,
    toggleResPaid, cancelReservation, blockLaneForEvent,
  } = useShootingRange({ shootingLanes, events, loadShootingLanes })

  const {
    showWeaponForm, setShowWeaponForm, editingWeapon, setEditingWeapon,
    weaponForm, setWeaponForm, saveWeapon, deleteWeapon, updateWeaponStatus,
  } = useRangeWeapons({ rangeWeapons, loadRangeWeapons })

  const {
    showPackageForm, setShowPackageForm, editingPackage, setEditingPackage,
    packageForm, setPackageForm, openNewPackage, openEditPackage,
    savePackage, deletePackage, togglePackageActive,
  } = useShootingPackages({ shootingPackages, loadShootingPackages })

  const {
    slotManagedEvent, setSlotManagedEvent, newSlotForm, setNewSlotForm,
    autoGenerateSlots, addSlotManual, deleteSlot,
  } = useSlotManagement({ events, eventSlots, disciplines, loadAll, getEventDiscs, getSlotsForEventDiscipline })

  const {
    permSearchQuery, setPermSearchQuery, notifyJudge, assignJudge, removeJudge,
    promoteToJudge, changeRole, filterByPermSearch,
    getStaffingByDisciplines, getStaffingByRegistrations,
  } = useJudgeManagement({
    judges, eventJudges, events, allMembers, eventDisciplines, regDisciplines, disciplines,
    loadAll, getEventDiscs, getEventJudges,
  })

  const {
    showDisciplineForm, setShowDisciplineForm, editingDiscipline, setEditingDiscipline,
    disciplineForm, setDisciplineForm,
    saving: discSaving, error: discError,
    openNewDiscipline, openEditDiscipline, saveDiscipline, deleteDiscipline,
  } = useDisciplineManagement({ loadAll })

  const {
    showEventForm, setShowEventForm, editingEvent, setEditingEvent,
    eventForm, setEventForm, editingEventDisciplines, setEditingEventDisciplines,
    eventLaneIds, setEventLaneIds, expandedEvent, setExpandedEvent,
    saving: eventSaving, error: eventError,
    openNewEvent, openEditEvent, saveEvent, deleteEvent,
    addDisciplineToEvent, removeDisciplineFromEvent, updateEventDiscipline,
  } = useEventManagement({
    events, disciplines, eventDisciplines, eventSlots, shootingLanes,
    loadAll, getEventDiscs, getFilteredDisciplines: getFilteredDisciplinesWithArg,
    autoGenerateSlots, notifyJudge,
  })

  const {
    showInventoryForm, setShowInventoryForm, editingInventory, setEditingInventory,
    inventoryFilter, setInventoryFilter, collapsedGroups, setCollapsedGroups,
    inventoryForm, setInventoryForm,
    showTransactionHistory, setShowTransactionHistory, transactions, setTransactions,
    showStockAdjust, setShowStockAdjust, stockAdjustForm, setStockAdjustForm,
    openAddInventory, openEditInventory, saveInventory, deleteInventory,
    loadTransactions, saveStockAdjust, settleEventMaterials, getEventMaterials,
  } = useInventoryManagement({
    inventoryItems, eventDisciplines, regDisciplines, disciplines,
    loadAll, getEventDiscs, member,
  })

  const {
    resultsPreview, setResultsPreview, resultsLightbox, setResultsLightbox,
    viewEventResults, viewMemberTargets,
  } = useResultsPreview({ events })

  const {
    onsiteMode, setOnsiteMode, onsiteMemberId, setOnsiteMemberId,
    onsiteEventId, setOnsiteEventId, onsiteDisciplineId, setOnsiteDisciplineId,
    onsiteSlotId, setOnsiteSlotId, onsiteSaving, onsiteMessage, setOnsiteMessage,
    onsiteMemberSearch, setOnsiteMemberSearch, lastOnsiteReg, setLastOnsiteReg,
    onsiteGuestForm, setOnsiteGuestForm,
    getEventsHappeningNow, quickRegisterOnsite, quickRegisterGuestOnsite,
  } = useOnsiteRegistration({
    events, allMembers, disciplines, eventDisciplines, loadAll, getEventDiscs,
  })

  const {
    attendancePreview, setAttendancePreview, attendanceLoading,
    printSingleMetryczka, printAllMetryczki, printMetryczki, printStartNumbers,
    openAttendancePreview, printAttendanceFromPreview,
  } = usePrinting({
    events, disciplines, memberRegs, guestRegs, regDisciplines, eventDisciplines,
    allMembers, getEventDiscs, getRegDisciplineNames,
  })

  const { getEventRevenue } = useEventFinancials({
    eventDisciplines, regDisciplines, getEventDiscs,
  })

  // ---- Combined saving/error from event and discipline hooks ----
  // The original code shared a single `saving` and `error` state between both forms.
  // Since these modals are never shown simultaneously, we combine them.
  const saving = eventSaving || discSaving
  const error = eventError || discError

  // ---- Wrapper for getFilteredDisciplines (JSX calls it with no args) ----
  function getFilteredDisciplines() {
    return getFilteredDisciplinesWithArg(eventForm.event_type)
  }

  useEffect(() => {
    if (!loading && (!member || !['admin', 'superadmin'].includes(member.role))) {
      router.push('/')
      return
    }
    if (member?.role === 'admin' || member?.role === 'superadmin') {
      loadAll()
      loadOnlineUsers()
      const onlineInterval = setInterval(loadOnlineUsers, 30_000)
      return () => clearInterval(onlineInterval)
    }
  }, [member, loading])


  useEffect(() => {
    if (tab === 'ranges') {
      loadShootingLanes()
      loadLaneReservations()
      loadRangeWeapons()
    }
    if (tab === 'instructors') {
      loadInstructorSchedule()
    }
  }, [tab, laneResDate, laneResFilter])

  if (loading) return <div className="p-8 text-center text-muted">Ladowanie...</div>
  if (!member || !['admin', 'superadmin'].includes(member.role)) return null

  const eventTypeLabels: Record<string, string> = {
    competition: 'Zawody', training: 'Trening', course: 'Kurs', other: 'Inne',
  }

  const inputClass = "w-full bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted focus:outline-none focus:border-primary text-sm"

  // Filter members for on-site search
  const filteredOnsiteMembers = onsiteMemberSearch.length >= 2
    ? allMembers.filter(m =>
        m.full_name.toLowerCase().includes(onsiteMemberSearch.toLowerCase()) ||
        (m.license_number && m.license_number.toLowerCase().includes(onsiteMemberSearch.toLowerCase()))
      ).slice(0, 20)
    : []

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Panel administracyjny</h1>
        </div>
        <button
          onClick={async () => {
            if (!confirm('Przeliczyć rankingi na podstawie wszystkich wyników?')) return
            const res = await fetch('/api/rankings', { method: 'POST' })
            const data = await res.json()
            alert(data.error ? `Błąd: ${data.error}` : `Rankingi przeliczone (${data.count} pozycji)`)
          }}
          className="flex items-center gap-2 px-3 py-2 text-xs border border-border rounded-lg hover:bg-card-hover transition-colors"
        >
          <Trophy className="w-3.5 h-3.5" />
          Przelicz rankingi
        </button>
      </div>

      {/* Online users */}
      <div className="mb-6">
        <button
          onClick={() => setShowOnlineList(!showOnlineList)}
          className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl hover:bg-card-hover transition-colors w-full sm:w-auto"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-success animate-pulse" />
          <span className="text-sm font-medium">
            {onlineUsers.length} {onlineUsers.length === 1 ? 'osoba online' : onlineUsers.length < 5 ? 'osoby online' : 'osób online'}
          </span>
          {showOnlineList ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
        </button>
        {showOnlineList && (
          <div className="mt-2 bg-card border border-border rounded-xl overflow-hidden">
            {onlineUsers.length === 0 ? (
              <p className="text-sm text-muted px-4 py-3">Brak zalogowanych użytkowników.</p>
            ) : (
              <div className="divide-y divide-border/50">
                {onlineUsers.map(u => {
                  const roleLabels: Record<string, string> = { superadmin: 'Superadmin', admin: 'Admin', judge: 'Sędzia', member: 'Członek', registrar: 'Rejestrator', range_registrar: 'Rej. strzelnica' }
                  const roleColors: Record<string, string> = { superadmin: 'bg-red-500/20 text-red-400', admin: 'bg-primary/20 text-primary', judge: 'bg-blue-500/20 text-blue-400', member: 'bg-gray-500/20 text-gray-400', registrar: 'bg-purple-500/20 text-purple-400', range_registrar: 'bg-orange-500/20 text-orange-400' }
                  const ago = Math.round((Date.now() - new Date(u.last_seen_at).getTime()) / 60_000)
                  return (
                    <div key={u.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-success" />
                        <span className="text-sm font-medium">{u.full_name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColors[u.role] || roleColors.member}`}>
                          {roleLabels[u.role] || u.role}
                        </span>
                      </div>
                      <span className="text-xs text-muted">
                        {ago < 1 ? 'teraz' : `${ago} min temu`}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-border overflow-x-auto">
        {[
          { key: 'events' as Tab, label: 'Zawody / Wydarzenia', icon: Calendar },
          { key: 'disciplines' as Tab, label: 'Dyscypliny', icon: Target },
          { key: 'registrations' as Tab, label: 'Zgloszenia', icon: ClipboardList },
          { key: 'judges' as Tab, label: 'Uprawnienia', icon: Users },
          { key: 'inventory' as Tab, label: 'Magazyn', icon: Package },
          { key: 'ranges' as Tab, label: 'Strzelnica', icon: Crosshair },
          { key: 'instructors' as Tab, label: 'Instruktorzy', icon: UserPlus },
          { key: 'regulations' as Tab, label: 'Regulaminy', icon: Shield },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ============ EVENTS TAB ============ */}
      {tab === 'events' && (
        <EventsTab
          events={events}
          disciplines={disciplines}
          shootingLanes={shootingLanes}
          expandedEvent={expandedEvent}
          slotManagedEvent={slotManagedEvent}
          showEventForm={showEventForm}
          editingEvent={editingEvent}
          eventForm={eventForm}
          editingEventDisciplines={editingEventDisciplines}
          eventLaneIds={eventLaneIds}
          newSlotForm={newSlotForm}
          saving={saving}
          error={error}
          inputClass={inputClass}
          eventTypeLabels={eventTypeLabels}
          setExpandedEvent={setExpandedEvent}
          setSlotManagedEvent={setSlotManagedEvent}
          setShowEventForm={setShowEventForm}
          setEventForm={setEventForm}
          setEditingEventDisciplines={setEditingEventDisciplines}
          setEventLaneIds={setEventLaneIds}
          setNewSlotForm={setNewSlotForm}
          openNewEvent={openNewEvent}
          openEditEvent={openEditEvent}
          deleteEvent={deleteEvent}
          saveEvent={saveEvent}
          addDisciplineToEvent={addDisciplineToEvent}
          removeDisciplineFromEvent={removeDisciplineFromEvent}
          updateEventDiscipline={updateEventDiscipline as (idx: number, field: string, value: string) => void}
          getEventDiscs={getEventDiscs}
          getEventJudges={getEventJudges}
          getAvailableJudges={getAvailableJudges}
          getEventTotalRegs={getEventTotalRegs}
          getEventDiscRegCounts={getEventDiscRegCounts}
          getStaffingByDisciplines={getStaffingByDisciplines}
          getStaffingByRegistrations={getStaffingByRegistrations}
          getSlotsForEventDiscipline={getSlotsForEventDiscipline}
          getSlotRegistrationCount={getSlotRegistrationCount}
          getFilteredDisciplines={getFilteredDisciplines}
          getEventRevenue={getEventRevenue}
          getEventMaterials={getEventMaterials}
          assignJudge={assignJudge}
          removeJudge={removeJudge}
          autoGenerateSlots={autoGenerateSlots}
          addSlotManual={addSlotManual}
          deleteSlot={deleteSlot}
          viewEventResults={viewEventResults}
          openAttendancePreview={openAttendancePreview}
          printStartNumbers={printStartNumbers}
          printMetryczki={printMetryczki}
          settleEventMaterials={settleEventMaterials}
        />
      )}

      {/* ============ DISCIPLINES TAB ============ */}
      {tab === 'disciplines' && (
        <DisciplinesTab
          disciplines={disciplines}
          openNewDiscipline={openNewDiscipline}
          openEditDiscipline={openEditDiscipline}
          deleteDiscipline={deleteDiscipline}
          showDisciplineForm={showDisciplineForm}
          setShowDisciplineForm={setShowDisciplineForm}
          editingDiscipline={editingDiscipline}
          disciplineForm={disciplineForm}
          setDisciplineForm={setDisciplineForm}
          saveDiscipline={saveDiscipline}
          saving={saving}
          error={error}
          inputClass={inputClass}
        />
      )}

      {/* ============ JUDGES TAB ============ */}
      {tab === 'judges' && (
        <JudgesTab
          allMembers={allMembers}
          events={events}
          eventJudges={eventJudges}
          permSearchQuery={permSearchQuery}
          setPermSearchQuery={setPermSearchQuery}
          filterByPermSearch={filterByPermSearch}
          changeRole={changeRole}
          onUpdateInstructorLicense={async (memberId, value) => { await supabase.from('members').update({ instructor_license: value }).eq('id', memberId); loadAll() }}
          onUpdateShootingLeader={async (memberId, checked) => { await supabase.from('members').update({ has_shooting_leader: checked }).eq('id', memberId); loadAll() }}
          inputClass={inputClass}
        />
      )}

      {/* ============ REGISTRATIONS TAB ============ */}
      {tab === 'registrations' && (
        <RegistrationsTab
          events={events as any}
          disciplines={disciplines}
          memberRegs={memberRegs}
          guestRegs={guestRegs}
          eventDisciplines={eventDisciplines}
          regDisciplines={regDisciplines}
          allMembers={allMembers}
          memberTargetMap={memberTargetMap as any}
          filteredOnsiteMembers={filteredOnsiteMembers}
          inputClass={inputClass}
          supabase={supabase}
          onsiteMode={onsiteMode}
          setOnsiteMode={setOnsiteMode}
          onsiteEventId={onsiteEventId}
          setOnsiteEventId={setOnsiteEventId}
          onsiteDisciplineId={onsiteDisciplineId}
          setOnsiteDisciplineId={setOnsiteDisciplineId}
          onsiteSlotId={onsiteSlotId}
          setOnsiteSlotId={setOnsiteSlotId}
          onsiteMemberId={onsiteMemberId}
          setOnsiteMemberId={setOnsiteMemberId}
          onsiteMemberSearch={onsiteMemberSearch}
          setOnsiteMemberSearch={setOnsiteMemberSearch}
          onsiteSaving={onsiteSaving}
          onsiteMessage={onsiteMessage}
          setOnsiteMessage={setOnsiteMessage}
          onsiteGuestForm={onsiteGuestForm}
          setOnsiteGuestForm={setOnsiteGuestForm}
          lastOnsiteReg={lastOnsiteReg}
          setLastOnsiteReg={setLastOnsiteReg}
          getEventsHappeningNow={getEventsHappeningNow as any}
          quickRegisterOnsite={quickRegisterOnsite}
          quickRegisterGuestOnsite={quickRegisterGuestOnsite}
          getEventDiscs={getEventDiscs}
          getSlotsForEventDiscipline={getSlotsForEventDiscipline}
          getSlotRegistrationCount={getSlotRegistrationCount}
          getRegDisciplineNames={getRegDisciplineNames}
          getRegTotal={getRegTotal}
          loadAll={loadAll}
          printSingleMetryczka={printSingleMetryczka}
          printAllMetryczki={printAllMetryczki}
          openAttendancePreview={openAttendancePreview}
          viewEventResults={viewEventResults}
          viewMemberTargets={viewMemberTargets}
        />
      )}

      {/* ============ INVENTORY TAB ============ */}
      {tab === 'inventory' && (
        <InventoryTab
          inventoryItems={inventoryItems}
          inventoryFilter={inventoryFilter}
          setInventoryFilter={setInventoryFilter}
          collapsedGroups={collapsedGroups}
          setCollapsedGroups={setCollapsedGroups}
          showInventoryForm={showInventoryForm}
          setShowInventoryForm={setShowInventoryForm}
          editingInventory={editingInventory}
          inventoryForm={inventoryForm}
          setInventoryForm={setInventoryForm}
          saveInventory={saveInventory}
          openAddInventory={openAddInventory}
          openEditInventory={openEditInventory}
          deleteInventory={deleteInventory}
          showStockAdjust={showStockAdjust}
          setShowStockAdjust={setShowStockAdjust}
          stockAdjustForm={stockAdjustForm}
          setStockAdjustForm={setStockAdjustForm}
          saveStockAdjust={saveStockAdjust}
          showTransactionHistory={showTransactionHistory}
          setShowTransactionHistory={setShowTransactionHistory}
          transactions={transactions}
          loadTransactions={loadTransactions}
          inputClass={inputClass}
        />
      )}

      {/* ============ INSTRUCTORS TAB ============ */}
      {tab === 'instructors' && (
        <InstructorsTab
          instructorAvailability={instructorAvailability}
          instructorsList={instructorsList}
          allMembers={allMembers}
          setShowInstructorScheduleForm={setShowInstructorScheduleForm}
          setInstructorScheduleForm={setInstructorScheduleForm}
          toggleInstructorAvailability={toggleInstructorAvailability}
          deleteInstructorAvailability={deleteInstructorAvailability}
        />
      )}

      {/* Attendance List Preview Modal */}
      {attendanceLoading && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm text-muted">Ladowanie danych listy...</p>
          </div>
        </div>
      )}

      {attendancePreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-7xl max-h-[95vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary" />
                  {attendancePreview.isCourse ? 'Lista obecnosci' : 'Lista do podpisu'}
                </h2>
                <p className="text-sm text-muted">{attendancePreview.eventTitle} &middot; {attendancePreview.eventDate}</p>
                {attendancePreview.eventLocation && <p className="text-xs text-muted">{attendancePreview.eventLocation}</p>}
              </div>
              <div className="flex items-center gap-2">
                {!attendancePreview.isCourse && (() => {
                  const missing = attendancePreview.rows.filter(r => r.missingData && !r.isGuest)
                  if (missing.length === 0) return null
                  return (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-warning/20 text-warning font-medium flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {missing.length} {missing.length === 1 ? 'osoba' : 'osob'} z brakujacymi danymi
                    </span>
                  )
                })()}
                <span className="text-xs px-2.5 py-1 rounded-full bg-primary/20 text-primary font-medium">
                  {attendancePreview.rows.length} {attendancePreview.rows.length === 1 ? 'osoba' : 'osob'}
                </span>
                <button
                  onClick={printAttendanceFromPreview}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-background text-sm font-semibold rounded-lg hover:bg-primary-dark transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  Drukuj
                </button>
                <button
                  onClick={() => setAttendancePreview(null)}
                  className="p-2 text-muted hover:text-foreground rounded-lg hover:bg-card-hover"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto px-4 py-3">
              {attendancePreview.isCourse ? (
                /* Course: simple name + signature table */
                <table className="w-full text-sm border-collapse max-w-xl">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b-2 border-border">
                      <th className="text-left py-2 px-3 text-xs text-muted font-semibold w-12">Lp.</th>
                      <th className="text-left py-2 px-3 text-xs text-muted font-semibold">Imie i nazwisko</th>
                      <th className="text-left py-2 px-3 text-xs text-muted font-semibold w-40">Podpis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendancePreview.rows.map((row, idx) => (
                      <tr key={idx} className="border-b border-border/50 hover:bg-card-hover transition-colors">
                        <td className="py-2.5 px-3 text-xs text-muted">{row.lp}</td>
                        <td className="py-2.5 px-3 font-medium">{row.name}</td>
                        <td className="py-2.5 px-3"></td>
                      </tr>
                    ))}
                    {[...Array(3)].map((_, i) => (
                      <tr key={`empty-${i}`} className="border-b border-border/30">
                        <td className="py-3 px-3 text-xs text-muted/30">{attendancePreview.rows.length + i + 1}</td>
                        <td colSpan={2} className="py-3 px-3 text-xs text-muted/30 italic">Wolny wiersz</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                /* Competition/training: full sign-in sheet */
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b-2 border-border">
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold w-10">Lp.</th>
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold">Imie i nazwisko</th>
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold">PESEL / data ur.</th>
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold">Dokument</th>
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold">Adres</th>
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold">Klub</th>
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold">Podstawa</th>
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold">Bron</th>
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold">Pozwolenie</th>
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold">Dyscypliny</th>
                      <th className="text-left py-2 px-2 text-xs text-muted font-semibold w-20">Podpis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendancePreview.rows.map((row, idx) => (
                      <tr key={idx} className={`border-b border-border/50 hover:bg-card-hover transition-colors ${row.missingData && !row.isGuest ? 'bg-warning/5' : ''}`}>
                        <td className="py-2 px-2 text-xs text-muted">{row.lp}</td>
                        <td className="py-2 px-2 font-medium">
                          {row.name}
                          {row.isGuest && <span className="text-xs text-muted ml-1">(gosc)</span>}
                        </td>
                        <td className={`py-2 px-2 text-xs ${!row.pesel && !row.isGuest ? 'text-warning italic' : ''}`}>
                          {row.pesel || (row.isGuest ? '-' : 'brak')}
                        </td>
                        <td className={`py-2 px-2 text-xs ${!row.document && !row.isGuest ? 'text-warning italic' : ''}`}>
                          {row.document || (row.isGuest ? '-' : 'brak')}
                        </td>
                        <td className={`py-2 px-2 text-xs ${!row.address && !row.isGuest ? 'text-warning italic' : ''}`}>
                          {row.address || (row.isGuest ? '-' : 'brak')}
                        </td>
                        <td className="py-2 px-2 text-xs">{row.club || '-'}</td>
                        <td className="py-2 px-2 text-xs">{row.basis}</td>
                        <td className="py-2 px-2 text-xs">{row.weapon}</td>
                        <td className={`py-2 px-2 text-xs ${!row.permit && !row.isGuest ? 'text-warning italic' : ''}`}>
                          {row.permit || (row.isGuest ? '-' : 'brak')}
                        </td>
                        <td className="py-2 px-2 text-xs">
                          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs">{row.disciplines}</span>
                        </td>
                        <td className="py-2 px-2"></td>
                      </tr>
                    ))}
                    {[...Array(3)].map((_, i) => (
                      <tr key={`empty-${i}`} className="border-b border-border/30">
                        <td className="py-3 px-2 text-xs text-muted/30">{attendancePreview.rows.length + i + 1}</td>
                        <td colSpan={10} className="py-3 px-2 text-xs text-muted/30 italic">Wolny wiersz (walk-in)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-border flex-shrink-0 text-xs text-muted">
              <span>+10 pustych wierszy na wydruku</span>
              <span>Wydruk w orientacji {attendancePreview.isCourse ? 'pionowej (portrait)' : 'poziomej (landscape)'}</span>
            </div>
          </div>
        </div>
      )}

      {/* ============ REGULATIONS TAB ============ */}
      {tab === 'regulations' && (
        <RegulationsTab
          regulations={regulations}
          regulationHistory={regulationHistory}
          setRegulationHistory={setRegulationHistory}
          editingRegulation={editingRegulation}
          setEditingRegulation={setEditingRegulation}
          regContent={regContent}
          setRegContent={setRegContent}
          historySlug={historySlug}
          setHistorySlug={setHistorySlug}
          savingReg={savingReg}
          setSavingReg={setSavingReg}
          member={member}
          supabase={supabase}
          loadAll={loadAll}
        />
      )}

      {/* ============ RANGES TAB ============ */}
      {tab === 'ranges' && (
        <RangesTab
          rangeSubTab={rangeSubTab}
          setRangeSubTab={setRangeSubTab}
          shootingLanes={shootingLanes}
          showLaneForm={showLaneForm}
          setShowLaneForm={setShowLaneForm}
          editingLane={editingLane}
          laneForm={laneForm}
          setLaneForm={setLaneForm}
          openNewLane={openNewLane}
          openEditLane={openEditLane}
          saveLane={saveLane}
          deleteLane={deleteLane}
          laneReservations={laneReservations}
          laneResDate={laneResDate}
          setLaneResDate={setLaneResDate}
          laneResFilter={laneResFilter}
          setLaneResFilter={setLaneResFilter}
          toggleResPaid={toggleResPaid}
          cancelReservation={cancelReservation}
          showEventBlockForm={showEventBlockForm}
          setShowEventBlockForm={setShowEventBlockForm}
          eventBlockForm={eventBlockForm}
          setEventBlockForm={setEventBlockForm}
          blockLaneForEvent={blockLaneForEvent}
          events={events}
          shootingPackages={shootingPackages}
          showPackageForm={showPackageForm}
          setShowPackageForm={setShowPackageForm}
          editingPackage={editingPackage}
          packageForm={packageForm}
          setPackageForm={setPackageForm}
          openNewPackage={openNewPackage}
          openEditPackage={openEditPackage}
          savePackage={savePackage}
          deletePackage={deletePackage}
          togglePackageActive={togglePackageActive}
          rangeWeapons={rangeWeapons}
          showWeaponForm={showWeaponForm}
          setShowWeaponForm={setShowWeaponForm}
          editingWeapon={editingWeapon}
          setEditingWeapon={setEditingWeapon}
          weaponForm={weaponForm}
          setWeaponForm={setWeaponForm}
          saveWeapon={saveWeapon}
          deleteWeapon={deleteWeapon}
          updateWeaponStatus={updateWeaponStatus}
          inventoryItems={inventoryItems}
          instructorsList={instructorsList}
          showInstructorScheduleForm={showInstructorScheduleForm}
          setShowInstructorScheduleForm={setShowInstructorScheduleForm}
          instructorScheduleForm={instructorScheduleForm}
          setInstructorScheduleForm={setInstructorScheduleForm}
          saveInstructorSchedule={saveInstructorSchedule}
        />
      )}

      {/* Login History — superadmin only */}
      {member.role === 'superadmin' && (
        <div className="mt-8 bg-card border border-border rounded-xl p-6">
          <button
            onClick={() => { setShowLoginHistory(!showLoginHistory); if (!showLoginHistory && loginHistory.length === 0) loadLoginHistory() }}
            className="flex items-center gap-3 w-full text-left"
          >
            <History className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold flex-1">Historia logowań</h2>
            {showLoginHistory ? <ChevronUp className="w-4 h-4 text-muted" /> : <ChevronDown className="w-4 h-4 text-muted" />}
          </button>

          {showLoginHistory && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-muted">Ostatnie 200 zdarzeń logowania</p>
                <button onClick={loadLoginHistory} disabled={loginHistoryLoading} className="text-xs px-3 py-1.5 border border-border rounded-lg hover:bg-background disabled:opacity-50">
                  {loginHistoryLoading ? 'Ładowanie...' : 'Odśwież'}
                </button>
              </div>

              {loginHistoryLoading ? (
                <p className="text-sm text-muted py-4 text-center">Ładowanie...</p>
              ) : loginHistory.length === 0 ? (
                <p className="text-sm text-muted py-4 text-center">Brak wpisów.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted">
                        <th className="py-2 px-3 font-medium">Data</th>
                        <th className="py-2 px-3 font-medium">Użytkownik</th>
                        <th className="py-2 px-3 font-medium">Email</th>
                        <th className="py-2 px-3 font-medium">Typ</th>
                        <th className="py-2 px-3 font-medium">IP</th>
                        <th className="py-2 px-3 font-medium">Urządzenie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loginHistory.map(entry => {
                        const eventLabels: Record<string, { label: string; color: string }> = {
                          login: { label: 'Logowanie', color: 'text-green-400' },
                          logout: { label: 'Wylogowanie', color: 'text-red-400' },
                          login_resolved: { label: 'Logowanie ✓', color: 'text-green-400' },
                          token_refresh: { label: 'Odświeżenie', color: 'text-muted' },
                        }
                        const ev = eventLabels[entry.event_type] || { label: entry.event_type, color: 'text-muted' }
                        // Parse user agent for readable device
                        const ua = entry.user_agent || ''
                        const isMobile = /Mobile|Android|iPhone/i.test(ua)
                        const browser = /Chrome/.test(ua) ? 'Chrome' : /Firefox/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : /Edge/.test(ua) ? 'Edge' : 'Inna'
                        const deviceLabel = isMobile ? `📱 ${browser}` : `💻 ${browser}`

                        return (
                          <tr key={entry.id} className="border-b border-border/30 hover:bg-background/50">
                            <td className="py-2 px-3 whitespace-nowrap text-xs">
                              {new Date(entry.created_at).toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </td>
                            <td className="py-2 px-3 font-medium">{entry.full_name || '—'}</td>
                            <td className="py-2 px-3 text-muted">{entry.email || '—'}</td>
                            <td className={`py-2 px-3 font-medium ${ev.color}`}>{ev.label}</td>
                            <td className="py-2 px-3 text-xs text-muted font-mono">{entry.ip_address || '—'}</td>
                            <td className="py-2 px-3 text-xs" title={ua}>{deviceLabel}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* Results with targets modal */}
      {resultsPreview && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 pt-12 overflow-y-auto" onClick={() => { setResultsPreview(null); setResultsLightbox(null) }}>
          <div className="bg-card border border-border rounded-xl w-full max-w-4xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="font-semibold text-lg">Wyniki — {resultsPreview.eventTitle}</h2>
              <button onClick={() => { setResultsPreview(null); setResultsLightbox(null) }} className="p-1 hover:bg-card-hover rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              {resultsPreview.results.length === 0 ? (
                <p className="text-muted text-center py-8">Brak wyników dla tego wydarzenia</p>
              ) : (
                (() => {
                  const byDisc: Record<string, typeof resultsPreview.results> = {}
                  for (const r of resultsPreview.results) {
                    const dn = r.discipline?.name ?? 'Bez dyscypliny'
                    if (!byDisc[dn]) byDisc[dn] = []
                    byDisc[dn].push(r)
                  }
                  return Object.entries(byDisc).map(([discName, dResults]) => {
                    const isShotgun = dResults[0]?.discipline?.scoring_type === 'shotgun'
                    const sorted = [...dResults].sort((a, b) => isShotgun ? a.total_score - b.total_score : b.total_score - a.total_score)
                    return (
                      <div key={discName} className="mb-6">
                        <h3 className="text-sm font-semibold text-blue-400 mb-2">{discName}</h3>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border/30 text-xs text-muted">
                              <th className="text-left px-3 py-2 w-10">#</th>
                              <th className="text-left px-3 py-2">Zawodnik</th>
                              {isShotgun ? (
                                <>
                                  <th className="text-right px-3 py-2">Czas</th>
                                  <th className="text-right px-3 py-2">Pudła</th>
                                  <th className="text-right px-3 py-2">Wynik</th>
                                </>
                              ) : (
                                <>
                                  <th className="text-right px-3 py-2">Wynik</th>
                                  <th className="text-right px-3 py-2">10-tki</th>
                                  <th className="text-right px-3 py-2">Pudła</th>
                                </>
                              )}
                              <th className="text-center px-3 py-2 w-20">Tarcza</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sorted.map((r: any, idx: number) => (
                              <tr key={r.id} className="border-b border-border/20 hover:bg-card-hover">
                                <td className="px-3 py-2">{idx < 3 ? ['🥇','🥈','🥉'][idx] : idx + 1}</td>
                                <td className="px-3 py-2 font-medium">{r.member?.full_name ?? '?'}</td>
                                {isShotgun ? (
                                  <>
                                    <td className="px-3 py-2 text-right font-mono text-muted">{r.time_seconds ? `${Number(r.time_seconds).toFixed(2)}s` : '-'}</td>
                                    <td className="px-3 py-2 text-right text-muted">{r.misses ? <span className="text-danger">{r.misses}</span> : '0'}</td>
                                    <td className="px-3 py-2 text-right font-mono font-bold">{Number(r.total_score).toFixed(2)}s</td>
                                  </>
                                ) : (
                                  <>
                                    <td className="px-3 py-2 text-right font-mono font-bold">{r.total_score}{r.max_score && <span className="text-xs text-muted">/{r.max_score}</span>}</td>
                                    <td className="px-3 py-2 text-right text-muted">{r.tens_count ?? '-'}</td>
                                    <td className="px-3 py-2 text-right text-muted">{r.misses ?? '-'}</td>
                                  </>
                                )}
                                <td className="px-3 py-2 text-center">
                                  {r.target_image_url ? (
                                    <button onClick={() => setResultsLightbox(r.target_image_url)} className="hover:opacity-80 transition-opacity" title="Podgląd tarczy">
                                      <img src={r.target_image_url} alt="Tarcza" className="w-10 h-10 object-cover rounded border border-border inline-block" />
                                    </button>
                                  ) : (
                                    <Camera className="w-4 h-4 text-muted/30 mx-auto" />
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  })
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {/* Results target lightbox */}
      {resultsLightbox && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setResultsLightbox(null)}>
          <div className="relative max-w-2xl max-h-[90vh]">
            <button onClick={() => setResultsLightbox(null)} className="absolute -top-10 right-0 text-white hover:text-primary transition-colors"><X className="w-8 h-8" /></button>
            <img src={resultsLightbox} alt="Tarcza — powiększenie" className="max-w-full max-h-[85vh] rounded-lg object-contain" />
          </div>
        </div>
      )}
    </div>
  )
}
