import { NextRequest, NextResponse } from 'next/server'
import { requireRole, isAuthError } from '@/lib/api-auth'

// Mark a lane reservation as paid (cash payment at range)
// Only range registrars and admins can do this
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRole('admin', 'superadmin', 'registrar', 'range_registrar')
    if (isAuthError(auth)) return auth

    const { supabase } = auth
    const { reservation_id } = await req.json()

    if (!reservation_id) {
      return NextResponse.json({ error: 'Brak reservation_id' }, { status: 400 })
    }

    // Verify reservation exists and is not already paid
    const { data: res, error: resErr } = await supabase
      .from('lane_reservations')
      .select('id, paid, status')
      .eq('id', reservation_id)
      .single()

    if (resErr || !res) {
      return NextResponse.json({ error: 'Rezerwacja nie istnieje' }, { status: 404 })
    }

    if (res.paid) {
      return NextResponse.json({ error: 'Rezerwacja jest już opłacona' }, { status: 400 })
    }

    const { error: updateErr } = await supabase
      .from('lane_reservations')
      .update({ paid: true })
      .eq('id', reservation_id)

    if (updateErr) {
      console.error('Mark paid error:', updateErr)
      return NextResponse.json({ error: 'Błąd aktualizacji' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Mark paid error:', err)
    return NextResponse.json({ error: 'Nieznany błąd' }, { status: 500 })
  }
}
