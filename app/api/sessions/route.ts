import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Sign in to view sessions.' }, { status: 401 });

  const { data: sessions, error } = await supabaseAdmin
    .from('sessions')
    .select('id,title,starts_at,ends_at,venue_name,address,capacity,cancel_cutoff_hours,status')
    .eq('status', 'published')
    .gte('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true });

  if (error) {
    console.error('Session list query failed:', error);
    return NextResponse.json({ error: 'Unable to load sessions.' }, { status: 500 });
  }

  const sessionIds = (sessions ?? []).map((session) => session.id);
  const bookingCounts = new Map<string, number>();
  if (sessionIds.length) {
    const { data: bookings, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('session_id,status,checkout_expires_at')
      .in('session_id', sessionIds)
      .in('status', ['booked', 'pending_payment']);

    if (bookingError) {
      console.error('Session capacity query failed:', bookingError);
      return NextResponse.json({ error: 'Unable to load session availability.' }, { status: 500 });
    }

    for (const booking of bookings ?? []) {
      if (booking.status === 'pending_payment' && (!booking.checkout_expires_at || new Date(booking.checkout_expires_at).getTime() <= Date.now())) continue;
      bookingCounts.set(booking.session_id, (bookingCounts.get(booking.session_id) ?? 0) + 1);
    }
  }

  return NextResponse.json({
    sessions: (sessions ?? []).map((session) => ({
      id: session.id,
      title: session.title,
      startsAt: session.starts_at,
      endsAt: session.ends_at,
      venue: session.venue_name,
      address: session.address,
      capacity: session.capacity,
      booked: bookingCounts.get(session.id) ?? 0,
      cancelCutoffHours: Number(session.cancel_cutoff_hours ?? 12),
      status: session.status,
    })),
  });
}