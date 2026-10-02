import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { stripe } from '@/lib/stripe';
import { ensurePlayerProfile } from '@/lib/provision-profile';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Sign in to view your bookings.' }, { status: 401 });

  const [{ data: bookings, error: bookingsError }, { data: ledger, error: ledgerError }, { data: memberships, error: membershipsError }] = await Promise.all([
    supabaseAdmin
      .from('bookings')
      .select('id,session_id,status,source,credit_ledger_id,created_at,cancelled_at,sessions(id,title,starts_at,ends_at,venue_name,address,cancel_cutoff_hours)')
      .eq('user_id', user.id)
      .in('status', ['booked', 'pending_payment', 'waitlist'])
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('credit_ledger')
      .select('change,period_id,expires_at,reason')
      .eq('user_id', user.id),
    supabaseAdmin
      .from('memberships')
      .select('id,status,current_period_id,product_id,membership_products(name)')
      .eq('user_id', user.id)
      .order('id', { ascending: false }),
  ]);

  if (bookingsError || ledgerError || membershipsError) {
    console.error('Player booking summary query failed:', bookingsError || ledgerError || membershipsError);
    return NextResponse.json({ error: 'Unable to load your booking summary.' }, { status: 500 });
  }

  const membershipIds = (memberships ?? []).map((membership) => membership.id);
  const { data: periods, error: periodsError } = membershipIds.length
    ? await supabaseAdmin
        .from('membership_periods')
        .select('id,starts_at,ends_at,credits_granted')
        .in('membership_id', membershipIds)
    : { data: [], error: null };

  if (periodsError) {
    console.error('Membership period query failed:', periodsError);
    return NextResponse.json({ error: 'Unable to load your credit balance.' }, { status: 500 });
  }

  const periodById = new Map((periods ?? []).map((period) => [period.id, period]));
  const now = Date.now();
  let available = 0;
  let paygRefundCredits = 0;
  for (const entry of ledger ?? []) {
    const expiresAt = entry.expires_at ? new Date(entry.expires_at).getTime() : null;
    const period = entry.period_id ? periodById.get(entry.period_id) : undefined;
    const isValid = expiresAt !== null
      ? expiresAt > now
      : !entry.period_id || (period ? new Date(period.ends_at).getTime() > now : false);
    if (isValid) {
      available += entry.change;
      if (!entry.period_id && ['payg_refund_credit', 'session_booking'].includes(entry.reason)) {
        paygRefundCredits += entry.change;
      }
    }
  }

  const held = (bookings ?? []).filter((booking) => {
    if (booking.status !== 'booked' || !booking.credit_ledger_id || !booking.sessions) return false;
    const session = Array.isArray(booking.sessions) ? booking.sessions[0] : booking.sessions;
    const cutoff = new Date(session.starts_at).getTime() - Number(session.cancel_cutoff_hours ?? 12) * 3600000;
    return now < cutoff;
  }).length;
  const granted = (periods ?? []).reduce((total, period) => total + period.credits_granted, 0);
  const currentMembership = (memberships ?? []).find((membership) => ['active', 'trialing', 'past_due'].includes(membership.status));
  const currentPeriod = currentMembership?.current_period_id
    ? periodById.get(currentMembership.current_period_id)
    : undefined;
  const productRelation = currentMembership?.membership_products;
  const membershipProduct = Array.isArray(productRelation) ? productRelation[0] : productRelation;

  return NextResponse.json({
    bookings,
    membership: currentMembership ? {
      id: currentMembership.id,
      status: currentMembership.status,
      name: membershipProduct?.name ?? 'Membership',
      periodStartsAt: currentPeriod?.starts_at ?? null,
      periodEndsAt: currentPeriod?.ends_at ?? null,
    } : null,
    credits: {
      available: Math.max(0, available),
      paygRefundAvailable: Math.max(0, paygRefundCredits),
      held,
      used: Math.max(0, granted - available - held),
    },
  });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Sign in before booking a session.' }, { status: 401 });

  try {
    await ensurePlayerProfile(user);
  } catch (error) {
    console.error('Player profile provisioning failed:', error);
    return NextResponse.json({ error: 'Unable to prepare your player profile.' }, { status: 500 });
  }

  let body: { action?: string; bookingId?: string; sessionId?: string; paymentType?: string; refundMethod?: 'credit' | 'bank' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (body.action === 'cancel') {
    if (!body.bookingId) return NextResponse.json({ error: 'Booking ID is required.' }, { status: 400 });

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id,user_id,status,source,stripe_payment_id,stripe_checkout_session_id,sessions!inner(starts_at,cancel_cutoff_hours)')
      .eq('id', body.bookingId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (bookingError) {
      console.error('Booking cancellation lookup failed:', bookingError);
      return NextResponse.json({ error: 'Unable to verify this booking.' }, { status: 500 });
    }
    if (!booking) return NextResponse.json({ error: 'Booking not found for this account.' }, { status: 404 });

    const session = Array.isArray(booking.sessions) ? booking.sessions[0] : booking.sessions;
    const cutoff = new Date(session.starts_at).getTime() - Number(session.cancel_cutoff_hours ?? 12) * 3600000;
    if (booking.status === 'booked' && Date.now() >= cutoff) {
      return NextResponse.json({ error: 'The cancellation window has closed.' }, { status: 409 });
    }

    if (booking.status === 'pending_payment' && booking.stripe_checkout_session_id) {
      try {
        const checkout = await stripe.checkout.sessions.retrieve(booking.stripe_checkout_session_id);
        if (checkout.status === 'complete') {
          return NextResponse.json({ error: 'Payment has completed. Refresh your bookings before cancelling.' }, { status: 409 });
        }
        if (checkout.status === 'open') await stripe.checkout.sessions.expire(checkout.id);
      } catch (error) {
        console.error('Unable to expire pending booking checkout:', error);
        return NextResponse.json({ error: 'Unable to close the pending payment session.' }, { status: 502 });
      }
    }

    const refundMethod = booking.status === 'booked' && booking.source === 'payg'
      ? body.refundMethod
      : 'none';
    if (booking.status === 'booked' && booking.source === 'payg' && !['credit', 'bank'].includes(String(refundMethod))) {
      return NextResponse.json({ error: 'Choose a run credit or a bank refund.' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.rpc('cancel_session_booking_with_refund', {
      p_booking_id: booking.id,
      p_user_id: user.id,
      p_refund_method: refundMethod,
    });
    if (error) {
      console.error('Booking cancellation RPC failed:', error);
      return NextResponse.json({ error: 'Unable to cancel the booking.' }, { status: 500 });
    }

    const refundPaymentId = data?.refund_required && typeof data?.stripe_payment_id === 'string'
      ? data.stripe_payment_id
      : booking.status === 'cancelled' && booking.source === 'payg'
        ? booking.stripe_payment_id
        : null;
    let refundStatus: string | null = null;
    if (refundPaymentId) {
      try {
        const refund = await stripe.refunds.create(
          { payment_intent: refundPaymentId, metadata: { booking_id: booking.id, user_id: user.id } },
          { idempotencyKey: `booking-refund-${booking.id}` },
        );
        refundStatus = refund.status ?? 'pending';
        const { data: existingRefund, error: refundLookupError } = await supabaseAdmin
          .from('refunds')
          .select('id')
          .eq('stripe_refund_id', refund.id)
          .maybeSingle();
        if (refundLookupError) throw refundLookupError;
        if (!existingRefund) {
          const { error: refundInsertError } = await supabaseAdmin.from('refunds').insert({
            booking_id: booking.id,
            stripe_refund_id: refund.id,
            amount: refund.amount,
            status: refundStatus,
          });
          if (refundInsertError) throw refundInsertError;
        }
      } catch (refundError) {
        console.error('PAYG refund initiation failed; retry remains safe:', refundError);
        return NextResponse.json({ error: 'Booking cancelled, but refund initiation failed. Retry the cancellation or contact support.' }, { status: 502 });
      }
    }

    return NextResponse.json({ ...data, refundStatus });
  }

  if (!body.sessionId || !/^[0-9a-f-]{36}$/i.test(body.sessionId)) {
    return NextResponse.json({ error: 'A valid session ID is required.' }, { status: 400 });
  }
  if (body.paymentType !== 'member' && body.paymentType !== 'payg') {
    return NextResponse.json({ error: 'Choose member credit or PAYG.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc('create_session_booking', {
    p_session_id: body.sessionId,
    p_user_id: user.id,
    p_payment_type: body.paymentType,
  });

  if (error) {
    const message = error.message ?? '';
    if (message.includes('NO_CREDITS')) return NextResponse.json({ error: 'No available membership credits. Choose PAYG for this session.' }, { status: 409 });
    if (message.includes('SESSION_UNAVAILABLE') || message.includes('SESSION_STARTED')) return NextResponse.json({ error: 'This session is no longer available to book.' }, { status: 409 });
    console.error('Booking RPC failed:', error);
    return NextResponse.json({ error: 'Unable to create the booking.' }, { status: 500 });
  }

  return NextResponse.json(data);
}