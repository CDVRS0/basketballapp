import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Sign in before starting checkout.' }, { status: 401 });

  let body: { bookingId?: string; sessionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.bookingId || !body.sessionId) {
    return NextResponse.json({ error: 'Booking ID and session ID are required.' }, { status: 400 });
  }

  const priceId = process.env.STRIPE_PAYG_PRICE_ID;
  if (!priceId) return NextResponse.json({ error: 'PAYG Stripe price is not configured.' }, { status: 503 });

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from('bookings')
    .select('id,user_id,session_id,status,source,stripe_checkout_session_id,checkout_expires_at,sessions!inner(id,title,starts_at,status)')
    .eq('id', body.bookingId)
    .eq('session_id', body.sessionId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (bookingError) {
    console.error('PAYG booking lookup failed:', bookingError);
    return NextResponse.json({ error: 'Unable to verify this booking.' }, { status: 500 });
  }
  if (!booking || booking.source !== 'payg') return NextResponse.json({ error: 'PAYG booking not found for this account.' }, { status: 404 });
  if (booking.status !== 'pending_payment') return NextResponse.json({ error: 'This booking is not awaiting payment.' }, { status: 409 });
  if (!booking.checkout_expires_at || new Date(booking.checkout_expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'This booking checkout has expired. Please select the session again.' }, { status: 409 });
  }

  const session = Array.isArray(booking.sessions) ? booking.sessions[0] : booking.sessions;
  if (!session || session.status !== 'published' || new Date(session.starts_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: 'This session is no longer available.' }, { status: 409 });
  }

  if (booking.stripe_checkout_session_id) {
    try {
      const existing = await stripe.checkout.sessions.retrieve(booking.stripe_checkout_session_id);
      if (existing.status === 'open' && existing.url) return NextResponse.json({ url: existing.url, bookingId: booking.id });
    } catch (error) {
      console.error('Existing PAYG Checkout Session lookup failed:', error);
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const expiresAt = Math.floor(Date.now() / 1000) + 35 * 60;
  const checkout = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],
    customer_email: user.email ?? undefined,
    client_reference_id: booking.id,
    success_url: `${baseUrl}/sessions?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/sessions?payment=cancelled`,
    expires_at: expiresAt,
    metadata: { booking_id: booking.id, session_id: session.id, user_id: user.id, payment_type: 'payg' },
    payment_intent_data: { metadata: { booking_id: booking.id, session_id: session.id, user_id: user.id } },
  }, { idempotencyKey: `payg-booking-${booking.id}-${Math.floor(Date.now() / 3600000)}` });

  const { error: updateError } = await supabaseAdmin
    .from('bookings')
    .update({ stripe_checkout_session_id: checkout.id, checkout_expires_at: new Date(expiresAt * 1000).toISOString() })
    .eq('id', booking.id)
    .eq('user_id', user.id)
    .eq('status', 'pending_payment');

  if (updateError) {
    await stripe.checkout.sessions.expire(checkout.id).catch((error) => console.error('Failed to expire unlinked checkout:', error));
    console.error('Failed to link PAYG Checkout Session:', updateError);
    return NextResponse.json({ error: 'Unable to link secure checkout to this booking.' }, { status: 500 });
  }

  return NextResponse.json({ url: checkout.url, bookingId: booking.id });
}