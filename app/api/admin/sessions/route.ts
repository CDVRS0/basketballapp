import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const admin = await getAuthenticatedAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const { data: sessions, error } = await supabaseAdmin
    .from('sessions')
    .select('id,title,starts_at,ends_at,venue_name,address,capacity,cancel_cutoff_hours,status,theme,notes,created_at')
    .order('starts_at', { ascending: true });

  if (error) {
    console.error('Admin session list query failed:', error);
    return NextResponse.json({ error: 'Unable to load sessions.' }, { status: 500 });
  }

  const sessionIds = (sessions ?? []).map((session) => session.id);
  const counts = new Map<string, { booked: number; waitlist: number }>();
  if (sessionIds.length) {
    const { data: bookings, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('session_id,status')
      .in('session_id', sessionIds)
      .in('status', ['booked', 'pending_payment', 'waitlist']);
    if (bookingsError) {
      console.error('Admin session booking count query failed:', bookingsError);
      return NextResponse.json({ error: 'Unable to load session booking counts.' }, { status: 500 });
    }
    for (const booking of bookings ?? []) {
      const row = counts.get(booking.session_id) ?? { booked: 0, waitlist: 0 };
      if (booking.status === 'waitlist') row.waitlist += 1;
      else row.booked += 1;
      counts.set(booking.session_id, row);
    }
  }

  return NextResponse.json({ sessions: (sessions ?? []).map((session) => ({
    id: session.id,
    title: session.title,
    startsAt: session.starts_at,
    endsAt: session.ends_at,
    venue: session.venue_name,
    address: session.address,
    capacity: session.capacity,
    booked: counts.get(session.id)?.booked ?? 0,
    waitlist: counts.get(session.id)?.waitlist ?? 0,
    cancelCutoffHours: Number(session.cancel_cutoff_hours ?? 12),
    status: session.status,
    theme: session.theme ?? 'default',
    notes: session.notes ?? '',
  })) });
}

export async function POST(request: NextRequest) {
  const admin = await getAuthenticatedAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const validationError = validateSession(body);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('sessions')
    .insert(toSessionRow(body))
    .select('id,title,starts_at,ends_at,venue_name,address,capacity,cancel_cutoff_hours,status,theme,notes')
    .single();

  if (error || !data) {
    console.error('Admin session create failed:', error);
    return NextResponse.json({ error: 'Unable to create session.' }, { status: 500 });
  }
  await writeAudit(admin.id, 'session.created', data.id, data).catch((auditError) => console.error('Session creation audit failed:', auditError));
  return NextResponse.json({ session: toClientSession(data) }, { status: 201 });
}

export function validateSession(body: Record<string, unknown>): string | null {
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

export function toSessionRow(body: Record<string, unknown>) {
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

export async function writeAudit(actorId: string, action: string, target: string, detail: unknown) {
  const { error } = await supabaseAdmin.from('audit_log').insert({ user_id: actorId, action, entity_type: 'session', entity_id: target, metadata: detail });
  if (error) throw error;
}