import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAuthenticatedAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const validationError = validate(body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const { count, error: countError } = await supabaseAdmin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', id)
    .in('status', ['booked', 'pending_payment']);
  if (countError) return NextResponse.json({ error: 'Unable to verify current bookings.' }, { status: 500 });
  if (Number(body.capacity) < (count ?? 0)) return NextResponse.json({ error: 'Capacity cannot be lower than existing bookings.' }, { status: 409 });

  const { data, error } = await supabaseAdmin
    .from('sessions')
    .update(toRow(body))
    .eq('id', id)
    .select('id,title,starts_at,ends_at,venue_name,address,capacity,cancel_cutoff_hours,status,theme,notes')
    .maybeSingle();

  if (error) {
    console.error('Admin session update failed:', error);
    return NextResponse.json({ error: 'Unable to update run.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Run not found.' }, { status: 404 });
  await supabaseAdmin.from('audit_log').insert({ user_id: admin.id, action: body.status === 'cancelled' ? 'session.cancelled' : 'session.updated', entity_type: 'session', entity_id: id, metadata: data });
  return NextResponse.json({ session: toClientSession(data) });
}

function validate(body: Record<string, unknown>): string | null {
  if (typeof body.title !== 'string' || !body.title.trim()) return 'Run title is required.';
  if (typeof body.venue !== 'string' || !body.venue.trim()) return 'Venue name is required.';
  if (typeof body.address !== 'string' || !body.address.trim()) return 'Full address is required.';
  if (typeof body.startsAt !== 'string' || !Number.isFinite(Date.parse(body.startsAt))) return 'A valid start time is required.';
  if (typeof body.endsAt !== 'string' || !Number.isFinite(Date.parse(body.endsAt)) || Date.parse(body.endsAt) <= Date.parse(body.startsAt as string)) return 'End time must be after start time.';
  if (!Number.isInteger(body.capacity) || Number(body.capacity) < 1) return 'Capacity must be at least one.';
  if (typeof body.cancelCutoffHours !== 'number' || body.cancelCutoffHours < 0) return 'Cancellation cutoff must be zero or more hours.';
  if (!['draft', 'published', 'cancelled'].includes(String(body.status))) return 'Choose draft, published, or cancelled status.';
  return null;
}

function toRow(body: Record<string, unknown>) {
  return {
    title: String(body.title).trim(),
    starts_at: new Date(String(body.startsAt)).toISOString(),
    ends_at: new Date(String(body.endsAt)).toISOString(),
    venue_name: String(body.venue).trim(),
    address: String(body.address).trim(),
    capacity: Number(body.capacity),
    cancel_cutoff_hours: Number(body.cancelCutoffHours),
    status: String(body.status),
    theme: ['blue', 'takeover', 'black-orange-white'].includes(String(body.theme)) ? String(body.theme) : 'default',
    notes: typeof body.notes === 'string' ? body.notes.trim() || null : null,
  };
}

function toClientSession(session: Record<string, unknown>) {
  return {
    id: session.id,
    title: session.title,
    startsAt: session.starts_at,
    endsAt: session.ends_at,
    venue: session.venue_name,
    address: session.address,
    capacity: session.capacity,
    booked: 0,
    cancelCutoffHours: Number(session.cancel_cutoff_hours ?? 12),
    status: session.status,
    theme: session.theme ?? 'default',
    notes: session.notes ?? '',
  };
}