import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/api-auth';
import { stripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ensurePlayerProfile } from '@/lib/provision-profile';

const membershipPlans = {
  monthly_15: {
    env: 'STRIPE_15_PRICE_ID',
    name: 'CD4Q 2',
    credits: 2,
    periodDays: 30,
  },
  every_2_months_30: {
    env: 'STRIPE_30_PRICE_ID',
    name: 'CD4Q 4',
    credits: 4,
    periodDays: 60,
  },
} as const;

type MembershipPlan = keyof typeof membershipPlans;

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Sign in before choosing a membership.' },
        { status: 401 }
      );
    }

    try {
      await ensurePlayerProfile(user);
    } catch (error) {
      console.error('Player profile provisioning failed:', error);

      return NextResponse.json(
        { error: 'Unable to prepare your player profile.' },
        { status: 500 }
      );
    }

    let body: { plan?: string };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request body.' },
        { status: 400 }
      );
    }

    if (!body.plan || !(body.plan in membershipPlans)) {
      return NextResponse.json(
        { error: 'Choose a valid membership plan.' },
        { status: 400 }
      );
    }

    const plan = body.plan as MembershipPlan;
    const config = membershipPlans[plan];
    const priceId = process.env[config.env];

    if (!priceId) {
      return NextResponse.json(
        { error: 'Membership Stripe price is not configured.' },
        { status: 503 }
      );
    }

    const {
      data: currentMemberships,
      error: currentError,
    } = await supabaseAdmin
      .from('memberships')
      .select('id,status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing', 'past_due']);

    if (currentError) {
      console.error('Membership lookup failed:', currentError);

      return NextResponse.json(
        { error: 'Unable to verify current membership.' },
        { status: 500 }
      );
    }

    if (currentMemberships?.length) {
      return NextResponse.json(
        {
          error:
            'An active membership already exists for this account.',
        },
        { status: 409 }
      );
    }

    // Find the existing membership product by Stripe Price ID.
    // We avoid an upsert because the database currently uses
    // a partial unique index on stripe_price_id.
    const {
      data: existingProduct,
      error: existingProductError,
    } = await supabaseAdmin
      .from('membership_products')
      .select('id')
      .eq('stripe_price_id', priceId)
      .maybeSingle();

    if (existingProductError) {
      console.error(
        'Membership product lookup failed:',
        existingProductError
      );

      return NextResponse.json(
        {
          error: 'Unable to verify the membership product.',
        },
        { status: 500 }
      );
    }

    let productId = existingProduct?.id;

    // This should normally not be needed because the products
    // are already seeded, but it keeps checkout self-healing.
    if (!productId) {
      const {
        data: newProduct,
        error: productInsertError,
      } = await supabaseAdmin
        .from('membership_products')
        .insert({
          name: config.name,
          stripe_price_id: priceId,
          credits: config.credits,
          period_days: config.periodDays,
          active: true,
        })
        .select('id')
        .single();

      if (productInsertError || !newProduct) {
        console.error(
          'Membership product creation failed:',
          productInsertError
        );

        return NextResponse.json(
          {
            error: 'Unable to prepare the membership product.',
          },
          { status: 500 }
        );
      }

      productId = newProduct.id;
    }

    const {
      data: existingMembership,
      error: existingError,
    } = await supabaseAdmin
      .from('memberships')
      .select('id,stripe_checkout_session_id')
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingError) {
      console.error(
        'Pending membership lookup failed:',
        existingError
      );

      return NextResponse.json(
        {
          error: 'Unable to prepare membership checkout.',
        },
        { status: 500 }
      );
    }

    let membershipId = existingMembership?.id;

    // Reuse an existing open Stripe Checkout session.
    if (existingMembership?.stripe_checkout_session_id) {
      try {
        const existingCheckout =
          await stripe.checkout.sessions.retrieve(
            existingMembership.stripe_checkout_session_id
          );

        if (
          existingCheckout.status === 'open' &&
          existingCheckout.url
        ) {
          return NextResponse.json({
            url: existingCheckout.url,
            membershipId,
          });
        }
      } catch (error) {
        console.error(
          'Existing membership Checkout Session lookup failed:',
          error
        );
      }
    }

    // Create a new pending membership if one doesn't already exist.
    if (!membershipId) {
      const {
        data: membership,
        error: membershipError,
      } = await supabaseAdmin
        .from('memberships')
        .insert({
          user_id: user.id,
          product_id: productId,
          status: 'pending',
        })
        .select('id')
        .single();

      if (membershipError || !membership) {
        console.error(
          'Membership creation failed:',
          membershipError
        );

        return NextResponse.json(
          { error: 'Unable to create membership.' },
          { status: 500 }
        );
      }

      membershipId = membership.id;
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000';

    const checkout = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        customer_email: user.email ?? undefined,
        client_reference_id: membershipId,
        success_url: `${baseUrl}/dashboard?membership=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/plan?membership=cancelled`,
        metadata: {
          membership_id: membershipId,
          user_id: user.id,
          plan,
        },
        subscription_data: {
          metadata: {
            membership_id: membershipId,
            user_id: user.id,
            plan,
          },
        },
      },
      {
        // Every genuinely new Checkout Session gets a fresh
        // idempotency key. This prevents Stripe from rejecting
        // the request because an old key was reused with
        // different Checkout parameters.
        idempotencyKey: `membership-checkout-${membershipId}-${crypto.randomUUID()}`,
      }
    );

    const { error: updateError } = await supabaseAdmin
      .from('memberships')
      .update({
        stripe_checkout_session_id: checkout.id,
      })
      .eq('id', membershipId)
      .eq('user_id', user.id);

    if (updateError) {
      await stripe.checkout.sessions
        .expire(checkout.id)
        .catch((error) =>
          console.error(
            'Failed to expire unlinked membership checkout:',
            error
          )
        );

      console.error(
        'Failed to link membership Checkout Session:',
        updateError
      );

      return NextResponse.json(
        {
          error:
            'Unable to link checkout to the membership.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: checkout.url,
      membershipId,
    });
  } catch (error) {
    console.error(
      'Unexpected membership checkout failure:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Unable to start membership checkout. Please try again.',
      },
      { status: 500 }
    );
  }
}