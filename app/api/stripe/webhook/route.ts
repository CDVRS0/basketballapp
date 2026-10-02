import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';

function stripeObjectId(
  value: string | { id: string } | null | undefined
): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

async function confirmPaygBooking(session: Stripe.Checkout.Session) {
  if (
    session.payment_status !== 'paid' &&
    session.payment_status !== 'no_payment_required'
  ) {
    return;
  }

  const bookingId = session.metadata?.booking_id;
  const sessionId = session.metadata?.session_id;
  const userId = session.metadata?.user_id;

  if (!bookingId || !sessionId || !userId) {
    throw new Error('PAYG Checkout metadata is incomplete.');
  }

  const { data: booking, error: lookupError } = await supabaseAdmin
    .from('bookings')
    .select(
      'id,status,session_id,user_id,stripe_checkout_session_id'
    )
    .eq('id', bookingId)
    .eq('session_id', sessionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (lookupError) throw lookupError;

  if (!booking) {
    throw new Error(
      'PAYG booking referenced by Stripe was not found.'
    );
  }

  if (
    booking.status === 'booked' &&
    booking.stripe_checkout_session_id === session.id
  ) {
    return;
  }

  if (
    booking.status !== 'pending_payment' ||
    booking.stripe_checkout_session_id !== session.id
  ) {
    const paymentIntentId = stripeObjectId(session.payment_intent);

    if (
      booking.status === 'cancelled' &&
      paymentIntentId &&
      session.payment_status === 'paid'
    ) {
      const refund = await stripe.refunds.create(
        {
          payment_intent: paymentIntentId,
          metadata: {
            booking_id: booking.id,
            reason: 'late_payment_after_booking_cancel',
          },
        },
        {
          idempotencyKey: `late-booking-refund-${booking.id}`,
        }
      );

      const { error: refundError } = await supabaseAdmin
        .from('refunds')
        .upsert(
          {
            booking_id: booking.id,
            stripe_refund_id: refund.id,
            amount: refund.amount,
            status: refund.status ?? 'pending',
          },
          {
            onConflict: 'stripe_refund_id',
          }
        );

      if (refundError) throw refundError;

      return;
    }

    throw new Error(
      'PAYG booking is not pending this Checkout Session.'
    );
  }

  const { error } = await supabaseAdmin
    .from('bookings')
    .update({
      status: 'booked',
      stripe_payment_id: stripeObjectId(session.payment_intent),
      checkout_expires_at: null,
    })
    .eq('id', booking.id)
    .eq('status', 'pending_payment')
    .eq('stripe_checkout_session_id', session.id);

  if (error) throw error;
}

async function updateMembershipFromSubscription(
  subscription: Stripe.Subscription
) {
  const membershipId = subscription.metadata?.membership_id;

  if (!membershipId) return;

  const customerId = stripeObjectId(subscription.customer);

  const { error } = await supabaseAdmin
    .from('memberships')
    .update({
      status: subscription.status,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
    })
    .eq('id', membershipId);

  if (error) throw error;
}

async function grantPaidMembershipPeriod(invoice: Stripe.Invoice) {
  const parent = invoice.parent;

  if (
    parent?.type !== 'subscription_details' ||
    !parent.subscription_details
  ) {
    return;
  }

  const details = parent.subscription_details;

  const subscriptionId = stripeObjectId(details.subscription);

  if (!subscriptionId) {
    throw new Error(
      'Subscription invoice is missing subscription ID.'
    );
  }

  const subscription =
    await stripe.subscriptions.retrieve(subscriptionId);

  const membershipId =
    subscription.metadata?.membership_id;

  if (!membershipId) {
    throw new Error(
      'Stripe subscription is missing membership metadata.'
    );
  }

  const { data: membership, error: membershipError } =
    await supabaseAdmin
      .from('memberships')
      .select(
        'id,user_id,product_id,membership_products(credits)'
      )
      .eq('id', membershipId)
      .maybeSingle();

  if (membershipError) throw membershipError;

  if (!membership) {
    throw new Error(
      'Membership referenced by Stripe was not found.'
    );
  }

  const productRelation = membership.membership_products;

  const product = Array.isArray(productRelation)
    ? productRelation[0]
    : productRelation;

  const credits = Number(product?.credits ?? 0);

  const subscriptionItem = subscription.items.data[0];

  if (!subscriptionItem || !credits) {
    throw new Error(
      'Membership product has no configured credits or billing period.'
    );
  }

  const { data: period, error: periodError } =
    await supabaseAdmin
      .from('membership_periods')
      .upsert(
        {
          membership_id: membership.id,
          starts_at: new Date(
            subscriptionItem.current_period_start * 1000
          ).toISOString(),
          ends_at: new Date(
            subscriptionItem.current_period_end * 1000
          ).toISOString(),
          credits_granted: credits,
          stripe_invoice_id: invoice.id,
          payment_status: 'paid',
        },
        {
          onConflict: 'stripe_invoice_id',
        }
      )
      .select('id')
      .single();

  if (periodError || !period) {
    throw (
      periodError ??
      new Error('Unable to save the membership period.')
    );
  }

  const customerId = stripeObjectId(
    subscription.customer
  );

  const { error: membershipUpdateError } =
    await supabaseAdmin
      .from('memberships')
      .update({
        status: subscription.status,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        current_period_id: period.id,
      })
      .eq('id', membership.id);

  if (membershipUpdateError) {
    throw membershipUpdateError;
  }

  const { error: ledgerError } = await supabaseAdmin
    .from('credit_ledger')
    .upsert(
      {
        user_id: membership.user_id,
        period_id: period.id,
        change: credits,
        reason: 'membership_period_grant',
        source_event_id: `stripe-invoice:${invoice.id}`,
        note: `Credits granted for paid Stripe invoice ${invoice.id}`,
      },
      {
        onConflict: 'source_event_id',
        ignoreDuplicates: true,
      }
    );

  if (ledgerError) throw ledgerError;
}

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const session =
        event.data.object as Stripe.Checkout.Session;

      if (session.metadata?.booking_id) {
        await confirmPaygBooking(session);
        return;
      }

      const membershipId =
        session.metadata?.membership_id;

      if (membershipId) {
        const { error } = await supabaseAdmin
          .from('memberships')
          .update({
            stripe_checkout_session_id: session.id,
            stripe_customer_id: stripeObjectId(
              session.customer
            ),
            stripe_subscription_id: stripeObjectId(
              session.subscription
            ),
          })
          .eq('id', membershipId)
          .eq(
            'user_id',
            session.metadata?.user_id ?? ''
          );

        if (error) throw error;
      }

      return;
    }

    case 'checkout.session.expired': {
      const session =
        event.data.object as Stripe.Checkout.Session;

      const bookingId =
        session.metadata?.booking_id;

      if (bookingId) {
        const { error } = await supabaseAdmin
          .from('bookings')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            checkout_expires_at: null,
          })
          .eq('id', bookingId)
          .eq('status', 'pending_payment')
          .eq(
            'stripe_checkout_session_id',
            session.id
          );

        if (error) throw error;
      }

      return;
    }

    case 'customer.subscription.updated': {
      await updateMembershipFromSubscription(
        event.data.object as Stripe.Subscription
      );

      return;
    }

    case 'customer.subscription.created': {
      await updateMembershipFromSubscription(
        event.data.object as Stripe.Subscription
      );

      return;
    }

    case 'customer.subscription.deleted': {
      const subscription =
        event.data.object as Stripe.Subscription;

      const membershipId =
        subscription.metadata?.membership_id;

      if (!membershipId) return;

      const { error } = await supabaseAdmin
        .from('memberships')
        .update({
          status: 'cancelled',
          stripe_subscription_id: subscription.id,
        })
        .eq('id', membershipId);

      if (error) throw error;

      return;
    }

    case 'invoice.paid': {
      await grantPaidMembershipPeriod(
        event.data.object as Stripe.Invoice
      );

      return;
    }

    case 'invoice.payment_failed': {
      const invoice =
        event.data.object as Stripe.Invoice;

      const parent = invoice.parent;

      if (
        parent?.type !== 'subscription_details' ||
        !parent.subscription_details
      ) {
        return;
      }

      const subscriptionId = stripeObjectId(
        parent.subscription_details.subscription
      );

      if (!subscriptionId) return;

      const subscription =
        await stripe.subscriptions.retrieve(
          subscriptionId
        );

      const membershipId =
        subscription.metadata?.membership_id;

      if (!membershipId) return;

      const { error } = await supabaseAdmin
        .from('memberships')
        .update({
          status: 'past_due',
        })
        .eq('id', membershipId);

      if (error) throw error;

      return;
    }

    default:
      return;
  }
}

export async function POST(request: NextRequest) {
  const signature =
    request.headers.get('stripe-signature');

  const webhookSecret =
    process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json(
      {
        error:
          'Stripe webhook signature configuration is missing.',
      },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error(
      'Stripe webhook signature verification failed:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Invalid Stripe webhook signature.',
      },
      { status: 400 }
    );
  }

  try {
    const { data: processed, error: lookupError } =
      await supabaseAdmin
        .from('stripe_events')
        .select('stripe_event_id')
        .eq('stripe_event_id', event.id)
        .maybeSingle();

    if (lookupError) throw lookupError;

    if (processed) {
      return NextResponse.json({
        received: true,
        duplicate: true,
      });
    }

    await handleEvent(event);

    const { error: recordError } =
      await supabaseAdmin
        .from('stripe_events')
        .upsert(
          {
            stripe_event_id: event.id,
            event_type: event.type,
            processed: true,
            processed_at: new Date().toISOString(),
          },
          {
            onConflict: 'stripe_event_id',
            ignoreDuplicates: true,
          }
        );

    if (recordError) throw recordError;

    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    console.error(
      'Stripe webhook processing failed:',
      error
    );

    return NextResponse.json(
      {
        error: 'Webhook processing failed.',
      },
      { status: 500 }
    );
  }
}