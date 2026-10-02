-- CDVRS Sports additive upgrade for an existing populated Supabase project.
-- This migration intentionally does not create, alter, or drop the legacy registrations table.
-- It does not recreate membership products, booking data, or existing RLS policies.

begin;

-- Fail before changing anything if this is not the established CDVRS schema.
do $$
declare
  missing_tables text;
begin
  select string_agg(required.table_name, ', ' order by required.table_name)
    into missing_tables
  from (values
    ('profiles'),
    ('player_health'),
    ('sessions'),
    ('bookings'),
    ('memberships'),
    ('membership_products'),
    ('membership_periods'),
    ('credit_ledger'),
    ('refunds'),
    ('stripe_events'),
    ('audit_log')
  ) as required(table_name)
  where to_regclass(format('public.%I', required.table_name)) is null;

  if missing_tables is not null then
    raise exception 'CDVRS upgrade stopped before changes: missing required public tables: %', missing_tables;
  end if;

  if to_regprocedure('public.is_cd4q_admin(uuid)') is null
     or to_regprocedure('public.create_session_booking(uuid,uuid,text)') is null
     or to_regprocedure('public.cancel_session_booking(uuid,uuid)') is null then
    raise exception 'CDVRS upgrade stopped before changes: expected admin/booking RPC functions are missing';
  end if;
end;
$$;

-- Fields read/written by current run and checkout APIs. ADD COLUMN IF NOT EXISTS
-- preserves all existing rows and values.
alter table public.sessions
  add column if not exists theme text not null default 'default';

alter table public.bookings
  add column if not exists stripe_checkout_session_id text,
  add column if not exists checkout_expires_at timestamptz;

alter table public.memberships
  add column if not exists stripe_checkout_session_id text;

alter table public.credit_ledger
  add column if not exists source_event_id text;

alter table public.refunds
  add column if not exists stripe_refund_id text;

-- Run safety profile already stores emergency_contact_name,
-- emergency_contact_phone and medical_notes. Add only the missing allergy field.
alter table public.player_health
  add column if not exists allergies text;

-- The app must be able to create pending PAYG bookings before Stripe payment.
-- Keep an existing compatible status constraint. Add one only when there is no
-- bookings status check at all; stop if an existing check excludes pending_payment.
do $$
declare
  status_checks text[];
  has_pending_payment boolean;
begin
  select array_agg(pg_get_constraintdef(oid))
    into status_checks
  from pg_constraint
  where conrelid = 'public.bookings'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';

  select coalesce(bool_or(pg_get_constraintdef(oid) ilike '%pending_payment%'), false)
    into has_pending_payment
  from pg_constraint
  where conrelid = 'public.bookings'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';

  if coalesce(array_length(status_checks, 1), 0) = 0 then
    alter table public.bookings
      add constraint bookings_status_cdvrs_upgrade_check
      check (status in ('pending_payment', 'booked', 'cancelled', 'waitlist', 'attended')) not valid;
  elsif not has_pending_payment then
    raise exception 'CDVRS upgrade stopped: an existing bookings status constraint does not allow pending_payment; review it before changing constraints';
  end if;
end;
$$;

-- These indexes support webhook idempotency and Stripe/refund reconciliation.
-- The existing membership_products_stripe_price_unique partial index is deliberately
-- not replaced or modified; membership checkout uses SELECT, then INSERT if absent.
create unique index if not exists memberships_stripe_checkout_session_unique
  on public.memberships(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists bookings_stripe_checkout_session_unique
  on public.bookings(stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists membership_periods_invoice_unique
  on public.membership_periods(stripe_invoice_id)
  where stripe_invoice_id is not null;

create unique index if not exists credit_ledger_source_event_unique
  on public.credit_ledger(source_event_id)
  where source_event_id is not null;

create unique index if not exists refunds_stripe_refund_id_unique
  on public.refunds(stripe_refund_id)
  where stripe_refund_id is not null;

-- PAYG cancellations can return either one non-expiring run credit or the
-- Stripe payment reference for a bank refund. source_event_id makes the credit
-- grant idempotent if the player retries the request.
create or replace function public.cancel_session_booking_with_refund(
  p_booking_id uuid,
  p_user_id uuid,
  p_refund_method text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_session public.sessions%rowtype;
  v_cutoff timestamptz;
  v_credit_id uuid;
  v_credit_total integer;
begin
  if p_refund_method not in ('none', 'credit', 'bank') then
    raise exception 'INVALID_REFUND_METHOD';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into v_booking
  from public.bookings
  where id = p_booking_id and user_id = p_user_id
  for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;

  if v_booking.status = 'cancelled' then
    select id into v_credit_id
    from public.credit_ledger
    where source_event_id = 'payg-refund-credit:' || v_booking.id::text;
    if found then
      select coalesce(sum(change), 0)::integer into v_credit_total
      from public.credit_ledger
      where user_id = p_user_id
        and period_id is null
        and reason in ('payg_refund_credit', 'session_booking')
        and (expires_at is null or expires_at > now());
      return jsonb_build_object('status', 'cancelled', 'credit_refunded', true, 'credit_ledger_id', v_credit_id, 'payg_refund_credits', v_credit_total);
    end if;
    return jsonb_build_object('status', 'cancelled', 'refund_required', p_refund_method = 'bank' and v_booking.source = 'payg', 'stripe_payment_id', v_booking.stripe_payment_id, 'credit_refunded', false);
  end if;

  select * into v_session
  from public.sessions
  where id = v_booking.session_id
  for update;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;

  if v_booking.status = 'pending_payment' then
    update public.bookings set status = 'cancelled', cancelled_at = now(), checkout_expires_at = null where id = v_booking.id;
    return jsonb_build_object('status', 'cancelled', 'refund_required', false, 'credit_refunded', false);
  end if;

  if v_booking.status = 'waitlist' then
    update public.bookings set status = 'cancelled', cancelled_at = now(), position = null where id = v_booking.id;
    return jsonb_build_object('status', 'cancelled', 'refund_required', false, 'credit_refunded', false);
  end if;

  if v_booking.status <> 'booked' then raise exception 'BOOKING_NOT_ACTIVE'; end if;
  v_cutoff := v_session.starts_at - coalesce(v_session.cancel_cutoff_hours, 12)::double precision * interval '1 hour';
  if now() >= v_cutoff then raise exception 'CANCELLATION_CUTOFF'; end if;

  if v_booking.source = 'member' and v_booking.credit_ledger_id is not null then
    insert into public.credit_ledger (user_id, period_id, change, reason, booking_id, session_id, note)
    select v_booking.user_id, period_id, 1, 'booking_cancellation', v_booking.id, v_booking.session_id, 'Credit returned after member booking cancellation'
    from public.credit_ledger where id = v_booking.credit_ledger_id;
    update public.bookings set status = 'cancelled', cancelled_at = now() where id = v_booking.id;
    return jsonb_build_object('status', 'cancelled', 'refund_required', false, 'credit_refunded', true);
  end if;

  if v_booking.source = 'payg' then
    if p_refund_method = 'credit' then
      select id into v_credit_id
      from public.credit_ledger
      where source_event_id = 'payg-refund-credit:' || v_booking.id::text;

      if v_credit_id is null then
        insert into public.credit_ledger (user_id, period_id, change, reason, booking_id, session_id, source_event_id, note)
        values (p_user_id, null, 1, 'payg_refund_credit', v_booking.id, v_booking.session_id,
          'payg-refund-credit:' || v_booking.id::text, 'One run credit issued instead of a bank refund')
        returning id into v_credit_id;
      end if;

      update public.bookings set status = 'cancelled', cancelled_at = now() where id = v_booking.id;
      select coalesce(sum(change), 0)::integer into v_credit_total
      from public.credit_ledger
      where user_id = p_user_id and period_id is null
        and reason in ('payg_refund_credit', 'session_booking')
        and (expires_at is null or expires_at > now());
      return jsonb_build_object('status', 'cancelled', 'refund_required', false, 'credit_refunded', true, 'credit_ledger_id', v_credit_id, 'payg_refund_credits', v_credit_total);
    end if;

    if p_refund_method <> 'bank' then raise exception 'REFUND_METHOD_REQUIRED'; end if;
    update public.bookings set status = 'cancelled', cancelled_at = now() where id = v_booking.id;
    return jsonb_build_object('status', 'cancelled', 'refund_required', v_booking.stripe_payment_id is not null, 'stripe_payment_id', v_booking.stripe_payment_id, 'credit_refunded', false);
  end if;

  raise exception 'UNSUPPORTED_BOOKING_SOURCE';
end;
$$;

revoke all on function public.cancel_session_booking_with_refund(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.cancel_session_booking_with_refund(uuid, uuid, text) to service_role;

-- No membership products are inserted or updated. Existing products and Stripe IDs
-- are preserved. No existing player, booking, credit, membership, or payment rows
-- are deleted or rewritten. Existing RLS policies and both booking RPCs are retained.

commit;
