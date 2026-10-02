# CD4Q Runs V6

V6 is the next functional UI build based on the supplied **CD4Q Runs App Demo V5.html** as the visual reference and the V5.1 master build decisions.

## Included in this prototype
- Mobile-first CD4Q UI matching the V5 visual language
- Player dashboard and sessions
- Supabase-authenticated member and run-specific PAYG booking flows
- Live run meter and live attendee visibility
- Takeover 3x3 black/orange/white event flow
- Player profile with initials, avatar colour, Instagram and TikTok
- Notifications + browser push preference UI
- Membership/credit period messaging and Direct Debit failure/recovery behaviour
- Admin run editing/cancellation UI
- Confirmation/notification states in the demo

## Run and membership payments

For an existing CDVRS database, review `supabase/migrations/20261002020000_cd4q_existing_database_upgrade.sql` before applying it. It is an additive upgrade, not a replacement for the initial schema, and does not touch the legacy `registrations` table. The API authenticates a Supabase access token and derives `user_id` server-side.

- Run PAYG creates a `bookings` row for the selected `session_id`, then starts Stripe Checkout with `booking_id`, `session_id` and `user_id` metadata.
- Member run booking creates a `bookings` row and a credit-ledger debit without Stripe Checkout.
- Membership checkout creates a `memberships` row and Stripe subscription. Paid invoices create `membership_periods` and idempotent credit-ledger grants.
- Takeover remains a separate `team_registrations`/`team_players` flow; its checkout endpoint is not connected to this payment path.

Required `.env.local` keys: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PAYG_PRICE_ID`, `STRIPE_15_PRICE_ID`, `STRIPE_30_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, and `NEXT_PUBLIC_APP_URL`. Never expose or commit the service-role or Stripe secret keys.

For local webhook testing, listen for every event the handler processes:

```sh
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.expired,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed --forward-to localhost:3000/api/stripe/webhook
```

## Remaining production work
Apply and verify the Supabase schema, test real Stripe Checkout and webhook delivery, configure email confirmations/Resend, Bacs settings, Web Push/VAPID, production URLs and redirect allowlists, persistent admin actions/audit logs, and GDPR/safeguarding retention jobs. The Takeover checkout flow remains separate and is not yet enabled for live payment.
