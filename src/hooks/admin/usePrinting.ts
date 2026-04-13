'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase'
import type { EventRow, RegDiscipline, GuestReg } from '@/types/admin'
import type { Discipline, EventDiscipline, Member } from '@/types/database'

interface UsePrintingParams {
  events: EventRow[]
  disciplines: Discipline[]
  memberRegs: { id: string; event_id: string; member_id: string; registered_at: string; status: string; paid?: boolean; start_number?: number; member?: Member }[]
  guestRegs: GuestReg[]
  regDisciplines: RegDiscipline[]
  eventDisciplines: (EventDiscipline & { discipline?: Discipline })[]
  allMembers: Member[]
  getEventDiscs: (eventId: string) => (EventDiscipline & { discipline?: Discipline })[]
  getRegDisciplineNames: (regId: string, type: 'member' | 'guest') => string[]
}

export function usePrinting({
  events,
  disciplines,
  memberRegs,
  guestRegs,
  regDisciplines,
  eventDisciplines,
  allMembers,
  getEventDiscs,
  getRegDisciplineNames,
}: UsePrintingParams) {
  const supabase = createSupabaseBrowser()

  const [attendancePreview, setAttendancePreview] = useState<{
    eventId: string
    eventTitle: string
    eventDate: string
    eventLocation: string
    isCourse: boolean
    rows: {
      lp: number
      name: string
      isGuest: boolean
      pesel: string
      document: string
      address: string
      club: string
      basis: string
      weapon: string
      permit: string
      disciplines: string
      missingData: boolean
    }[]
    htmlContent: string
  } | null>(null)
  const [attendanceLoading, setAttendanceLoading] = useState(false)

  function printSingleMetryczka(reg: { memberId: string; memberName: string; eventId: string; eventTitle: string; discName: string; discScoringType: string; discShotsCount: number; regId: string }, startNumber?: string) {
    const { memberName, eventTitle, discName, discScoringType, discShotsCount } = reg
    const parts = memberName.trim().split(/\s+/)
    const lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0]
    const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : ''
    const dashIdx = discName.indexOf(' — ')
    const abbr = dashIdx > 0 ? discName.substring(0, dashIdx).trim() : discName.substring(0, Math.min(discName.length, 8))
    const fullDiscName = discName.includes(' — ') ? discName.split(' — ').slice(1).join(' — ') : discName
    const sn = startNumber || '0000'
    const metNr = `${abbr}/${sn}`
    const displayCount = Math.min(discShotsCount, 60) <= 10 ? Math.min(discShotsCount, 60) : 10

    let html = `<!DOCTYPE html><html><head><title>Metryczka - ${memberName}</title><style>
      @page { size: 85mm auto; margin: 2mm 3mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 12px; color: #000; width: 79mm; }
      .header { text-align: center; margin-bottom: 2mm; }
      .club-name { font-size: 14px; font-weight: bold; }
      .club-short { font-size: 20px; font-weight: 900; margin: 1mm 0; }
      .event-name { font-size: 9px; margin-bottom: 1mm; }
      .field { font-size: 10px; margin: 1mm 0; }
      .field-label { font-size: 9px; }
      .field-value { font-weight: bold; font-size: 12px; }
      .field-value-large { font-weight: 900; font-size: 14px; }
      .dotted { border-bottom: 1px dotted #000; min-height: 4mm; margin: 1mm 0; }
      .sig-section { margin-top: 2mm; }
      .sig-label { font-size: 9px; margin-top: 1mm; }
      .sig-line { border-bottom: 1px dotted #000; height: 6mm; margin-bottom: 1mm; }
      .score-grid { border-collapse: collapse; margin: 1mm auto; }
      .score-grid td { border: 1px solid #000; width: 10mm; height: 7mm; text-align: center; }
      .penalty-row { display: flex; justify-content: space-between; align-items: flex-start; margin: 1mm 0; }
      .penalty-box { border: 1px solid #000; min-width: 15mm; min-height: 6mm; display: inline-block; }
    </style></head><body>`

    html += `<div class="header"><div class="club-name">Klub Strzelecki</div><div class="club-short">CEL</div></div>`
    html += `<div class="event-name">${eventTitle}</div>`
    html += `<div class="field"><span class="field-label">Konkurencja:</span><br/>${fullDiscName}</div>`
    html += `<div class="field"><span class="field-label">Metryczka nr:</span> <span class="field-value-large">${metNr}</span></div>`
    html += `<div class="field"><span class="field-label">Nazwisko:</span> <span class="field-value">${lastName.toUpperCase()}</span></div>`
    html += `<div class="field"><span class="field-label">Imię:</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="field-value">${firstName}</span></div>`

    if (discScoringType === 'shotgun') {
      html += `<div class="field" style="margin-top:3mm"><span class="field-label">Czas konkurencji:</span></div><div class="dotted"></div>`
      html += `<div class="penalty-row"><div><span class="field-label">Ilość pudeł:</span><br/><div class="penalty-box">&nbsp;</div></div><div style="text-align:right"><span class="field-label">Kara za 1 pudło:</span><br/><span class="field-value">5 sek.</span></div></div><div class="dotted"></div>`
    } else {
      html += `<div class="field" style="margin-top:3mm"><span class="field-label">Ilość strzałów ocenianych:</span> <span class="field-value">${displayCount}</span></div>`
      html += `<div class="field" style="margin-top:2mm"><span class="field-label">Oceny:</span></div>`
      const cols = 5; const rows2 = Math.ceil(displayCount / cols)
      html += `<table class="score-grid">`
      for (let row = 0; row < rows2; row++) { html += '<tr>'; for (let col = 0; col < cols; col++) { if (row * cols + col < displayCount) html += '<td>&nbsp;</td>' }; html += '</tr>' }
      html += `</table>`
    }

    html += `<div class="sig-section"><div class="sig-line"></div><div class="sig-label">Podpis zawodnika/zawodniczki:</div></div>`
    html += `<div class="sig-section"><div class="sig-line"></div><div class="sig-label">Podpis sędziego:</div></div>`
    html += `</body></html>`

    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300) }
  }

  async function printAllMetryczki(reg: { memberId: string; memberName: string; eventId: string; eventTitle: string; discName: string; discScoringType: string; discShotsCount: number; regId: string }) {
    // Get all disciplines this member is registered for in this event
    const memberId = reg.memberId
    const eventId = reg.eventId

    // Get member's registration
    const memberReg = memberRegs.find(r => r.event_id === eventId && r.member?.id === memberId)
    const startNumber = memberReg?.start_number ? String(memberReg.start_number).padStart(4, '0') : '0000'

    // Get their registered disciplines
    const regDiscIds = regDisciplines
      .filter(rd => rd.member_registration_id === memberReg?.id)
      .map(rd => rd.event_discipline_id)

    // Get event disciplines with discipline details
    const evDiscs = getEventDiscs(eventId)
    const applicableDiscs = regDiscIds.length > 0
      ? evDiscs.filter(ed => regDiscIds.includes(ed.id))
      : evDiscs

    // Filter only actual disciplines
    const competitionDiscs = applicableDiscs.filter(ed => {
      const disc = disciplines.find(d => d.id === ed.discipline_id)
      return disc && disc.category === 'discipline'
    })

    if (competitionDiscs.length === 0) {
      // Fallback: print only the current discipline
      printSingleMetryczka(reg, startNumber)
      return
    }

    // Build continuous metryczki (no page breaks — save paper)
    let html = `<!DOCTYPE html><html><head><title>Metryczki - ${reg.memberName}</title><style>
      @page { size: 85mm auto; margin: 2mm 3mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; font-size: 12px; color: #000; width: 79mm; }
      .metryczka { width: 79mm; padding: 2mm 0; }
      .metryczka + .metryczka { border-top: 1px dashed #000; margin-top: 3mm; padding-top: 3mm; }
      .header { text-align: center; margin-bottom: 2mm; }
      .club-name { font-size: 14px; font-weight: bold; }
      .club-short { font-size: 20px; font-weight: 900; margin: 1mm 0; }
      .event-name { font-size: 9px; margin-bottom: 1mm; }
      .field { font-size: 10px; margin: 1mm 0; }
      .field-label { font-size: 9px; }
      .field-value { font-weight: bold; font-size: 12px; }
      .field-value-large { font-weight: 900; font-size: 14px; }
      .dotted { border-bottom: 1px dotted #000; min-height: 4mm; margin: 1mm 0; }
      .sig-section { margin-top: 2mm; }
      .sig-label { font-size: 9px; margin-top: 1mm; }
      .sig-line { border-bottom: 1px dotted #000; height: 6mm; margin-bottom: 1mm; }
      .score-grid { border-collapse: collapse; margin: 1mm auto; }
      .score-grid td { border: 1px solid #000; width: 10mm; height: 7mm; text-align: center; }
      .penalty-row { display: flex; justify-content: space-between; align-items: flex-start; margin: 1mm 0; }
      .penalty-box { border: 1px solid #000; min-width: 15mm; min-height: 6mm; display: inline-block; }
    </style></head><body>`

    const parts = reg.memberName.trim().split(/\s+/)
    const lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0]
    const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : ''

    for (const ed of competitionDiscs) {
      const disc = disciplines.find(d => d.id === ed.discipline_id)
      if (!disc) continue
      const discName = disc.name
      const dashIdx = discName.indexOf(' — ')
      const abbr = dashIdx > 0 ? discName.substring(0, dashIdx).trim() : discName.substring(0, Math.min(discName.length, 8))
      const fullDiscName = discName.includes(' — ') ? discName.split(' — ').slice(1).join(' — ') : discName
      const metNr = `${abbr}/${startNumber}`
      const displayCount = Math.min(disc.shots_count ?? 10, 60) <= 10 ? Math.min(disc.shots_count ?? 10, 60) : 10

      html += `<div class="metryczka">`
      html += `<div class="header"><div class="club-name">Klub Strzelecki</div><div class="club-short">CEL</div></div>`
      html += `<div class="event-name">${reg.eventTitle}</div>`
      html += `<div class="field"><span class="field-label">Konkurencja:</span><br/>${fullDiscName}</div>`
      html += `<div class="field"><span class="field-label">Metryczka nr:</span> <span class="field-value-large">${metNr}</span></div>`
      html += `<div class="field"><span class="field-label">Nazwisko:</span> <span class="field-value">${lastName.toUpperCase()}</span></div>`
      html += `<div class="field"><span class="field-label">Imię:</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="field-value">${firstName}</span></div>`

      if (disc.scoring_type === 'shotgun') {
        html += `<div class="field" style="margin-top:3mm"><span class="field-label">Czas konkurencji:</span></div><div class="dotted"></div>`
        html += `<div class="penalty-row"><div><span class="field-label">Ilość pudeł:</span><br/><div class="penalty-box">&nbsp;</div></div><div style="text-align:right"><span class="field-label">Kara za 1 pudło:</span><br/><span class="field-value">5 sek.</span></div></div><div class="dotted"></div>`
      } else {
        html += `<div class="field" style="margin-top:3mm"><span class="field-label">Ilość strzałów ocenianych:</span> <span class="field-value">${displayCount}</span></div>`
        html += `<div class="field" style="margin-top:2mm"><span class="field-label">Oceny:</span></div>`
        const cols = 5; const rows2 = Math.ceil(displayCount / cols)
        html += `<table class="score-grid">`
        for (let row = 0; row < rows2; row++) { html += '<tr>'; for (let col = 0; col < cols; col++) { if (row * cols + col < displayCount) html += '<td>&nbsp;</td>' }; html += '</tr>' }
        html += `</table>`
      }

      html += `<div class="sig-section"><div class="sig-line"></div><div class="sig-label">Podpis zawodnika/zawodniczki:</div></div>`
      html += `<div class="sig-section"><div class="sig-line"></div><div class="sig-label">Podpis sędziego:</div></div>`
      html += `</div>`
    }

    html += `</body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 300) }
  }

  async function printMetryczki(eventId: string) {
    const ev = events.find(e => e.id === eventId)
    if (!ev) return

    // Load registrations with members
    const { data: regs } = await supabase
      .from('event_registrations')
      .select('id, member_id, start_number, member:members(full_name, club_name, license_number)')
      .eq('event_id', eventId)
      .neq('status', 'cancelled')
      .order('start_number')

    if (!regs || regs.length === 0) {
      alert('Brak zawodników do wydruku metryczek')
      return
    }

    // Load event disciplines with discipline details
    const { data: evDiscsData } = await supabase
      .from('event_disciplines')
      .select('id, discipline_id, discipline:disciplines(name, scoring_type, shots_count)')
      .eq('event_id', eventId)

    // Load registration_disciplines to know which athlete is in which discipline
    const { data: regDiscs } = await supabase
      .from('registration_disciplines')
      .select('member_registration_id, event_discipline_id')
      .in('member_registration_id', regs.map(r => r.id))

    if (!evDiscsData || evDiscsData.length === 0) {
      alert('Brak dyscyplin w wydarzeniu')
      return
    }

    const dateStr = new Date(ev.start_date).toLocaleDateString('pl-PL', { year: 'numeric', month: '2-digit', day: '2-digit' })

    // Extract discipline abbreviation from name like "Pcz — Pistolet centralnego zapłonu 25m" → "Pcz"
    function discAbbr(name: string): string {
      const dashIdx = name.indexOf(' — ')
      if (dashIdx > 0) return name.substring(0, dashIdx).trim()
      // For names like "Trap", "Skeet" etc.
      return name.substring(0, Math.min(name.length, 8))
    }

    // Split full_name into first name + last name
    function splitName(fullName: string): { firstName: string; lastName: string } {
      const parts = fullName.trim().split(/\s+/)
      if (parts.length === 1) return { firstName: parts[0], lastName: '' }
      const lastName = parts[parts.length - 1]
      const firstName = parts.slice(0, -1).join(' ')
      return { firstName, lastName }
    }

    // Build metryczki HTML for thermal printer (85mm continuous paper)
    let html = `<!DOCTYPE html><html><head><title>Metryczki - ${ev.title}</title><style>
      @page { size: 85mm auto; margin: 2mm 3mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Arial', sans-serif; font-size: 12px; color: #000; width: 79mm; }
      .metryczka {
        width: 79mm; padding: 2mm 0;
      }
      .metryczka + .metryczka { border-top: 1px dashed #000; margin-top: 3mm; padding-top: 3mm; }
      .header { text-align: center; margin-bottom: 2mm; }
      .club-name { font-size: 14px; font-weight: bold; }
      .club-short { font-size: 20px; font-weight: 900; margin: 1mm 0; }
      .event-name { font-size: 9px; margin-bottom: 1mm; }
      .field { font-size: 10px; margin: 1mm 0; }
      .field-label { font-size: 9px; }
      .field-value { font-weight: bold; font-size: 12px; }
      .field-value-large { font-weight: 900; font-size: 14px; }
      .dotted { border-bottom: 1px dotted #000; min-height: 4mm; margin: 1mm 0; }
      .dotted-short { border-bottom: 1px dotted #000; display: inline-block; min-width: 25mm; min-height: 4mm; }
      .sig-section { margin-top: 2mm; }
      .sig-label { font-size: 9px; margin-top: 1mm; }
      .sig-line { border-bottom: 1px dotted #000; height: 6mm; margin-bottom: 1mm; }
      .score-grid { border-collapse: collapse; margin: 1mm auto; }
      .score-grid td { border: 1px solid #000; width: 10mm; height: 7mm; text-align: center; font-size: 10px; }
      .penalty-row { display: flex; justify-content: space-between; align-items: flex-start; margin: 1mm 0; }
      .penalty-box { border: 1px solid #000; min-width: 15mm; min-height: 6mm; display: inline-block; text-align: center; }
      .catering-title { font-size: 28px; font-weight: 900; text-align: center; margin: 4mm 0; }
      .separator { border-top: 1px dashed #aaa; margin: 2mm 0; }
      @media print {
        body { width: 72mm; }
        .metryczka { page-break-after: always; }
        .metryczka:last-child { page-break-after: auto; }
      }
    </style></head><body>`

    // Build map of registration_id → discipline ids
    const regDiscMap = new Map<string, string[]>()
    for (const rd of (regDiscs ?? [])) {
      if (!rd.member_registration_id) continue
      const arr = regDiscMap.get(rd.member_registration_id) || []
      arr.push(rd.event_discipline_id)
      regDiscMap.set(rd.member_registration_id, arr)
    }

    // For each registration, print metryczki per discipline
    for (const reg of regs as any[]) {
      const memberName = reg.member?.full_name ?? 'Nieznany'
      const { firstName, lastName } = splitName(memberName)
      const startNum = String(reg.start_number ?? 0).padStart(4, '0')

      // Get disciplines for this registration
      const regDiscIds = regDiscMap.get(reg.id) || []
      // If no registration_disciplines, print for all event disciplines
      const applicableDiscs = regDiscIds.length > 0
        ? (evDiscsData as any[]).filter(ed => regDiscIds.includes(ed.id))
        : evDiscsData as any[]

      // Filter only actual disciplines (not services)
      const competitionDiscs = applicableDiscs.filter((ed: any) => {
        const disc = ed.discipline
        return disc && disc.scoring_type && disc.scoring_type !== 'service'
      })

      for (const ed of competitionDiscs) {
        const disc = (ed as any).discipline
        const discName = disc?.name ?? 'Dyscyplina'
        const scoringType = disc?.scoring_type ?? 'points'
        const shotsCount = disc?.shots_count ?? 10
        const abbr = discAbbr(discName)
        // Full discipline name (after " — " or full name)
        const fullDiscName = discName.includes(' — ') ? discName.split(' — ').slice(1).join(' — ') : discName
        const metNr = `${abbr}/${startNum}`

        html += `<div class="metryczka">`
        // Header
        html += `<div class="header">
          <div class="club-name">Klub Strzelecki</div>
          <div class="club-short">CEL</div>
        </div>`
        // Event name
        html += `<div class="event-name">${ev.title}</div>`
        // Konkurencja
        html += `<div class="field"><span class="field-label">Konkurencja:</span><br/>${fullDiscName}</div>`
        // Metryczka nr
        html += `<div class="field"><span class="field-label">Metryczka nr:</span> <span class="field-value-large">${metNr}</span></div>`
        // Nazwisko / Imię
        html += `<div class="field"><span class="field-label">Nazwisko:</span> <span class="field-value">${lastName.toUpperCase()}</span></div>`
        html += `<div class="field"><span class="field-label">Imię:</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="field-value">${firstName}</span></div>`

        if (scoringType === 'shotgun') {
          // Time-based metryczka (strzelba / dynamika)
          html += `<div class="field" style="margin-top:3mm"><span class="field-label">Czas konkurencji:</span></div>`
          html += `<div class="dotted"></div>`
          html += `<div class="penalty-row">
            <div><span class="field-label">Ilość pudeł:</span><br/><div class="penalty-box">&nbsp;</div></div>
            <div style="text-align:right"><span class="field-label">Kara za 1 pudło:</span><br/><span class="field-value">5 sek.</span></div>
          </div>`
          html += `<div class="dotted"></div>`
        } else {
          // Score-based metryczka (precyzja / punkty)
          const evalCount = Math.min(shotsCount, 60)
          const displayCount = evalCount <= 10 ? evalCount : 10
          html += `<div class="field" style="margin-top:3mm"><span class="field-label">Ilość strzałów ocenianych:</span> <span class="field-value">${displayCount}</span></div>`
          html += `<div class="field" style="margin-top:2mm"><span class="field-label">Oceny:</span></div>`
          // Grid: rows of 5
          const cols = 5
          const rows2 = Math.ceil(displayCount / cols)
          html += `<table class="score-grid">`
          for (let row = 0; row < rows2; row++) {
            html += '<tr>'
            for (let col = 0; col < cols; col++) {
              const cellNum = row * cols + col + 1
              if (cellNum <= displayCount) {
                html += '<td>&nbsp;</td>'
              }
            }
            html += '</tr>'
          }
          html += `</table>`
        }

        // Signatures
        html += `<div class="sig-section">
          <div class="sig-line"></div>
          <div class="sig-label">Podpis zawodnika/zawodniczki:</div>
        </div>`
        html += `<div class="sig-section">
          <div class="sig-line"></div>
          <div class="sig-label">Podpis sędziego:</div>
        </div>`
        html += `</div>` // end metryczka
      }

      // Catering card for each athlete
      html += `<div class="metryczka">
        <div class="header">
          <div class="club-name">Klub Strzelecki CEL</div>
          <div class="catering-title">KATERING</div>
        </div>
        <div class="event-name">${ev.title}</div>
        <div class="field">Data zawodów: ${dateStr}</div>
        <div class="field" style="margin-top:3mm"><span class="field-value">${memberName}</span></div>
        <div class="field"><span class="field-label">Nr startowy:</span> <span class="field-value">${startNum}</span></div>
      </div>`
    }

    html += `</body></html>`

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      setTimeout(() => printWindow.print(), 500)
    }
  }

  async function printStartNumbers(eventId: string) {
    const ev = events.find(e => e.id === eventId)
    if (!ev) return

    const { data: regs } = await supabase
      .from('event_registrations')
      .select('member_id, start_number, member:members(full_name, club_name, license_number)')
      .eq('event_id', eventId)
      .neq('status', 'cancelled')
      .not('start_number', 'is', null)
      .order('start_number')

    if (!regs || regs.length === 0) {
      alert('Brak zawodników z numerami startowymi')
      return
    }

    const qrBaseUrl = `START-${eventId}-`

    let html = `<!DOCTYPE html><html><head><title>Numery startowe - ${ev.title}</title><style>
      @page { size: A4; margin: 5mm; }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; width: 210mm; }
      .card {
        width: 70mm; height: 99mm;
        border: 1px dashed #ccc;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        padding: 8mm;
        page-break-inside: avoid;
      }
      .number {
        font-size: 72px; font-weight: 900;
        line-height: 1; margin-bottom: 4mm;
        color: #000;
      }
      .name {
        font-size: 16px; font-weight: 700;
        text-align: center; margin-bottom: 2mm;
        max-width: 100%; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap;
      }
      .club {
        font-size: 12px; color: #555;
        text-align: center; margin-bottom: 3mm;
      }
      .license {
        font-size: 10px; color: #888;
        margin-bottom: 3mm;
      }
      .qr {
        width: 25mm; height: 25mm;
      }
      .event-title {
        font-size: 9px; color: #999;
        text-align: center; margin-top: 2mm;
        max-width: 100%; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap;
      }
      @media print {
        .grid { gap: 0; }
        .card { border: 1px dashed #ddd; }
      }
    </style></head><body><div class="grid">`

    for (const r of regs as any[]) {
      const sn = r.start_number
      const name = r.member?.full_name ?? '?'
      const club = r.member?.club_name ?? ''
      const license = r.member?.license_number ?? ''
      const qrData = encodeURIComponent(qrBaseUrl + sn)
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${qrData}`

      html += `<div class="card">
        <div class="number">${sn}</div>
        <div class="name">${name}</div>
        <div class="club">${club}</div>
        ${license ? `<div class="license">${license}</div>` : ''}
        <img class="qr" src="${qrUrl}" alt="QR ${sn}" />
        <div class="event-title">${ev.title}</div>
      </div>`
    }

    html += `</div></body></html>`

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.focus()
      // Wait for QR images to load
      setTimeout(() => printWindow.print(), 1500)
    }
  }

  async function loadAttendanceData(eventId: string) {
    const ev = events.find(e => e.id === eventId)
    if (!ev) return null

    const isCourse = ev.event_type === 'course'
    const evMemberRegs = memberRegs.filter(r => r.event_id === eventId)
    const evGuestRegs = guestRegs.filter(r => r.event_id === eventId)

    // Load full member data
    const memberIds = evMemberRegs.map(r => r.member_id).filter(Boolean)
    const { data: fullMembers } = memberIds.length > 0
      ? await supabase.from('members').select('*').in('id', memberIds)
      : { data: [] }
    const memberMap = new Map((fullMembers ?? []).map((m: any) => [m.id, m]))

    // For courses we only need names — skip weapons/permits loading
    let weaponsByMember = new Map<string, any[]>()
    let ownWeaponMap = new Map<string, boolean>()

    if (!isCourse) {
      const { data: memberWeapons } = memberIds.length > 0
        ? await supabase.from('member_weapons').select('*').in('member_id', memberIds).eq('is_active', true)
        : { data: [] }
      for (const w of (memberWeapons ?? [])) {
        if (!weaponsByMember.has(w.member_id)) weaponsByMember.set(w.member_id, [])
        weaponsByMember.get(w.member_id)!.push(w)
      }
      const regIds = evMemberRegs.map(r => r.id)
      for (const rd of regDisciplines) {
        if (rd.member_registration_id && regIds.includes(rd.member_registration_id)) {
          if (rd.own_weapon) ownWeaponMap.set(rd.member_registration_id, true)
        }
      }
    }

    const docTypeLabels: Record<string, string> = {
      dowod_osobisty: 'Dowod os.',
      paszport: 'Paszport',
      karta_pobytu: 'Karta pob.',
    }

    const rows: NonNullable<typeof attendancePreview>['rows'] = []
    let lp = 1

    for (const r of evMemberRegs) {
      const m = memberMap.get(r.member_id) as any
      if (!m) continue

      if (isCourse) {
        // Courses: only name + signature
        rows.push({ lp: lp++, name: m.full_name, isGuest: false, pesel: '', document: '', address: '', club: '', basis: '', weapon: '', permit: '', disciplines: '', missingData: false })
      } else {
        const discNames = getRegDisciplineNames(r.id, 'member')
        const hasOwnWeapon = ownWeaponMap.get(r.id) ?? false
        const mWeapons = weaponsByMember.get(m.id) ?? []

        const pesel = m.pesel || (m.date_of_birth ? new Date(m.date_of_birth).toLocaleDateString('pl') : '')
        const document = m.id_document_number ? `${docTypeLabels[m.id_document_type] || 'Dok.'} ${m.id_document_number}` : ''
        const address = m.address || ''

        let basis = ''
        if (hasOwnWeapon && m.has_weapons_permit) basis = 'Pozwolenie na bron'
        else if (m.shooting_patent_number) basis = `Patent: ${m.shooting_patent_number}`
        else if (m.license_number) basis = `Licencja: ${m.license_number}`
        else basis = 'Bron klubowa / pod nadzorem'

        let weapon = ''
        if (hasOwnWeapon && mWeapons.length > 0) weapon = mWeapons.map((w: any) => `${w.type} ${w.caliber} (${w.serial_number})`).join('; ')
        else if (hasOwnWeapon) weapon = 'bron wlasna - brak danych'
        else weapon = 'Bron klubowa'

        let permit = ''
        if (hasOwnWeapon && m.weapon_permit_number) {
          permit = m.weapon_permit_number
          if (m.weapon_permit_issuing_authority) permit += ` / ${m.weapon_permit_issuing_authority}`
        } else if (!hasOwnWeapon) permit = 'Sw. broni klubu'

        const missingData = !m.pesel || !m.id_document_number || !m.address || (hasOwnWeapon && !m.weapon_permit_number)

        rows.push({ lp: lp++, name: m.full_name, isGuest: false, pesel, document, address, club: m.club_name || '-', basis, weapon, permit, disciplines: discNames.join(', ') || '-', missingData })
      }
    }

    for (const r of evGuestRegs) {
      if (isCourse) {
        rows.push({ lp: lp++, name: `${r.full_name} (gosc)`, isGuest: true, pesel: '', document: '', address: '', club: '', basis: '', weapon: '', permit: '', disciplines: '', missingData: false })
      } else {
        const discNames = getRegDisciplineNames(r.id, 'guest')
        rows.push({ lp: lp++, name: `${r.full_name} (gosc)`, isGuest: true, pesel: '', document: '', address: '', club: '', basis: r.has_license ? `Licencja: ${r.license_number || '?'}` : 'Pod nadzorem', weapon: r.has_license ? 'Bron wlasna' : 'Bron klubowa', permit: '', disciplines: discNames.join(', ') || '-', missingData: true })
      }
    }

    // Build HTML for print
    const dateStr = new Date(ev.start_date).toLocaleDateString('pl-PL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const printStyles = `body { font-family: Arial, sans-serif; margin: 15px; color: #000; font-size: 11px; }
      h1 { font-size: 16px; margin-bottom: 2px; }
      h2 { font-size: 12px; font-weight: normal; color: #555; margin-bottom: 4px; }
      .meta { font-size: 10px; color: #666; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #333; padding: 4px 6px; text-align: left; font-size: 10px; vertical-align: top; }
      th { background: #eee; font-weight: bold; font-size: 9px; }
      .sig-col { width: 150px; min-height: 30px; }
      .small { font-size: 9px; color: #555; }
      .warn { color: #c00; font-style: italic; }
      .footer { margin-top: 20px; font-size: 10px; }
      .footer-line { margin-top: 30px; border-top: 1px solid #333; width: 250px; padding-top: 4px; }`

    let htmlContent = `<!DOCTYPE html><html><head><title>${isCourse ? 'Lista obecnosci' : 'Lista do podpisu'} - ${ev.title}</title><style>
      ${printStyles}
      @media print { body { margin: 5mm; } @page { size: ${isCourse ? 'portrait' : 'landscape'}; margin: 5mm; } }
    </style></head><body>`

    htmlContent += `<h1>${isCourse ? 'LISTA OBECNOSCI' : 'REJESTR POBYTU NA STRZELNICY'}</h1>`
    htmlContent += `<h2>${ev.title}</h2>`
    htmlContent += `<div class="meta">${dateStr}`
    if (ev.location) htmlContent += ` &middot; ${ev.location}`
    if (ev.address) htmlContent += ` &middot; ${ev.address}`
    htmlContent += `</div>`

    if (isCourse) {
      // Simple table: Lp, Name, Signature
      htmlContent += `<table><thead><tr><th style="width:40px">Lp.</th><th>Imie i nazwisko</th><th class="sig-col">Podpis</th></tr></thead><tbody>`
      for (const row of rows) {
        htmlContent += `<tr><td>${row.lp}</td><td><strong>${row.name}</strong></td><td></td></tr>`
      }
      let walkInLp = rows.length + 1
      for (let i = 0; i < 10; i++) {
        htmlContent += `<tr><td>${walkInLp++}</td><td></td><td style="height:24px"></td></tr>`
      }
      htmlContent += `</tbody></table>`
      htmlContent += `<div class="footer"><div class="footer-line">Prowadzacy kurs (imie, nazwisko, podpis)</div></div>`
    } else {
      // Full shooting range sign-in sheet
      htmlContent += `<table><thead><tr><th>Lp.</th><th>Imie i nazwisko</th><th>PESEL / data ur.</th><th>Dokument tozsamosci</th><th>Adres zamieszkania</th><th>Klub</th><th>Podstawa uzytk. broni</th><th>Bron (rodzaj, kaliber, nr)</th><th>Nr pozwolenia / organ wydajacy</th><th>Dyscypliny</th><th class="sig-col">Podpis</th></tr></thead><tbody>`
      for (const row of rows) {
        const warnOrVal = (v: string) => v || '<span class="warn">brak</span>'
        htmlContent += `<tr><td>${row.lp}</td><td><strong>${row.name}</strong></td><td>${warnOrVal(row.pesel)}</td><td>${warnOrVal(row.document)}</td><td>${warnOrVal(row.address)}</td><td>${row.club}</td><td>${row.basis}</td><td>${row.weapon}</td><td>${warnOrVal(row.permit)}</td><td>${row.disciplines}</td><td></td></tr>`
      }
      let walkInLp = rows.length + 1
      for (let i = 0; i < 10; i++) {
        htmlContent += `<tr><td>${walkInLp++}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td style="height:24px"></td></tr>`
      }
      htmlContent += `</tbody></table>`
      htmlContent += `<div class="footer"><div class="footer-line">Prowadzacy strzelanie (imie, nazwisko, podpis)</div><div class="footer-line">Kierownik strzelnicy (imie, nazwisko, podpis)</div></div>`
    }
    htmlContent += `</body></html>`

    return {
      eventId: ev.id,
      eventTitle: ev.title,
      eventDate: dateStr,
      eventLocation: [ev.location, ev.address].filter(Boolean).join(' · '),
      isCourse,
      rows,
      htmlContent,
    }
  }

  async function openAttendancePreview(eventId: string) {
    setAttendanceLoading(true)
    const data = await loadAttendanceData(eventId)
    setAttendanceLoading(false)
    if (data) setAttendancePreview(data)
  }

  function printAttendanceFromPreview() {
    if (!attendancePreview) return
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(attendancePreview.htmlContent)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
    }
  }

  return {
    // State
    attendancePreview,
    setAttendancePreview,
    attendanceLoading,
    setAttendanceLoading,

    // Functions
    printSingleMetryczka,
    printAllMetryczki,
    printMetryczki,
    printStartNumbers,
    loadAttendanceData,
    openAttendancePreview,
    printAttendanceFromPreview,
  }
}
