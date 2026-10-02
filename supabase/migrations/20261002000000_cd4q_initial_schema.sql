-- ============================================================
-- CDVRS SPORTS — INITIAL SUPABASE SCHEMA
-- ============================================================
-- Stripe Products / Prices
--
-- PAYG:
--   price_1ULtV37bYWsJeF2wRieFCkMw
--
-- CD4Q 2:
--   price_1ULtW17bYWsJeF2w29UX6fnQ
--
-- CD4Q 4:
--   price_1ULtWz7bYWsJeF2wVKDysJTT
--
-- IMPORTANT:
-- This migration does NOT modify the legacy `registrations`
-- table.
-- ============================================================


-- ============================================================
-- EXTENSIONS
-- ============================================================

create extension if not exists pgcrypto;


-- ============================================================
-- PROFILES
-- ============================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  role text not null default 'player',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- PLAYER HEALTH
-- ============================================================

create table if not exists public.player_health (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  height_cm numeric,
  weight_kg numeric,
  injuries text,
  medical_notes text,
  emergency_contact_name text,
  emergency_contact_phone text,
  updated_at timestamptz not null default now()
);


-- ============================================================
-- MEMBERSHIP PRODUCTS
-- ============================================================

create table if not exists public.membership_products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  stripe_price_id text,
  credits integer not null default 0,
  period_days integer,
  perks jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);


-- ============================================================
-- MEMBERSHIPS
-- ============================================================

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  product_id uuid
    references public.membership_products(id),

  stripe_customer_id text,
  stripe_subscription_id text,

  status text not null default 'none',

  current_period_id uuid,

  stripe_checkout_session_id text,

  admin_override boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- MEMBERSHIP PERIODS
-- ============================================================

create table if not exists public.membership_periods (
  id uuid primary key default gen_random_uuid(),

  membership_id uuid not null
    references public.memberships(id)
    on delete cascade,

  starts_at timestamptz not null,
  ends_at timestamptz not null,

  credits_granted integer not null default 0,

  stripe_invoice_id text,

  payment_status text,

  created_at timestamptz not null default now()
);


-- ============================================================
-- LINK MEMBERSHIP CURRENT PERIOD
-- ============================================================

alter table public.memberships
  add constraint memberships_current_period_fk
  foreign key (current_period_id)
  references public.membership_periods(id);


-- ============================================================
-- SESSIONS / RUNS
-- ============================================================

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),

  title text not null,

  starts_at timestamptz not null,
  ends_at timestamptz not null,

  venue_name text not null,
  address text not null,

  lat double precision,
  lng double precision,

  capacity integer not null,

  cancel_cutoff_hours numeric default 12,

  status text not null default 'draft',

  theme text not null default 'default',

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- ============================================================
-- BOOKINGS
-- ============================================================

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),

  session_id uuid not null
    references public.sessions(id)
    on delete cascade,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  status text not null default 'booked',

  position integer,

  source text not null default 'member',

  credit_ledger_id uuid,

  stripe_checkout_session_id text,

  stripe_payment_id text,

  checkout_expires_at timestamptz,

  created_at timestamptz not null default now(),

  cancelled_at timestamptz,

  unique(session_id, user_id)
);


-- ============================================================
-- CREDIT LEDGER
-- ============================================================

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  period_id uuid
    references public.membership_periods(id),

  change integer not null,

  expires_at timestamptz,

  reason text not null,

  booking_id uuid,

  session_id uuid,

  note text,

  created_by uuid,

  source_event_id text,

  created_at timestamptz not null default now()
);


-- ============================================================
-- LINK CREDIT LEDGER ↔ BOOKINGS
-- ============================================================

alter table public.bookings
  add constraint bookings_credit_ledger_fk
  foreign key (credit_ledger_id)
  references public.credit_ledger(id);


alter table public.credit_ledger
  add constraint credit_ledger_booking_fk
  foreign key (booking_id)
  references public.bookings(id);


alter table public.credit_ledger
  add constraint credit_ledger_session_fk
  foreign key (session_id)
  references public.sessions(id);


-- ============================================================
-- WAITLIST OFFERS
-- ============================================================

create table if not exists public.waitlist_offers (
  id uuid primary key default gen_random_uuid(),

  booking_id uuid not null
    references public.bookings(id)
    on delete cascade,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  expires_at timestamptz not null,

  status text not null default 'pending',

  created_at timestamptz not null default now()
);


-- ============================================================
-- REFUNDS
-- ============================================================

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),

  booking_id uuid
    references public.bookings(id)
    on delete set null,

  user_id uuid
    references public.profiles(id)
    on delete set null,

  stripe_payment_id text,

  amount integer not null,

  currency text not null default 'gbp',

  reason text,

  status text not null default 'pending',

  created_at timestamptz not null default now()
);


-- ============================================================
-- NOTIFICATIONS
-- ============================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  type text not null,

  title text not null,

  body text,

  read_at timestamptz,

  created_at timestamptz not null default now()
);


-- ============================================================
-- MESSAGES
-- ============================================================

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),

  sender_id uuid
    references public.profiles(id)
    on delete set null,

  recipient_id uuid
    references public.profiles(id)
    on delete cascade,

  subject text,

  body text not null,

  read_at timestamptz,

  created_at timestamptz not null default now()
);


-- ============================================================
-- TOURNAMENTS
-- ============================================================

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),

  name text not null,

  starts_at timestamptz not null,

  ends_at timestamptz,

  venue_name text,

  address text,

  description text,

  status text not null default 'draft',

  created_at timestamptz not null default now()
);


-- ============================================================
-- TOURNAMENT CATEGORIES
-- ============================================================

create table if not exists public.tournament_categories (
  id uuid primary key default gen_random_uuid(),

  tournament_id uuid not null
    references public.tournaments(id)
    on delete cascade,

  name text not null,

  description text,

  max_teams integer,

  team_size integer,

  price integer not null default 0,

  created_at timestamptz not null default now()
);


-- ============================================================
-- TAKEOVER TEAM REGISTRATIONS
-- ============================================================

create table if not exists public.team_registrations (
  id uuid primary key default gen_random_uuid(),

  tournament_id uuid
    references public.tournaments(id)
    on delete cascade,

  category_id uuid
    references public.tournament_categories(id),

  team_name text not null,

  team_size integer not null,

  price integer not null,

  member_discount integer not null default 0,

  registrant_user_id uuid
    references public.profiles(id),

  captain_player_id uuid,

  status text not null default 'pending',

  stripe_session_id text,

  stripe_payment_id text,

  created_at timestamptz not null default now(),

  expires_at timestamptz
);


-- ============================================================
-- TAKEOVER TEAM PLAYERS
-- ============================================================

create table if not exists public.team_players (
  id uuid primary key default gen_random_uuid(),

  team_registration_id uuid not null
    references public.team_registrations(id)
    on delete cascade,

  user_id uuid
    references public.profiles(id)
    on delete set null,

  full_name text not null,

  email text,

  phone text,

  jersey_number integer,

  is_captain boolean not null default false,

  created_at timestamptz not null default now()
);


-- ============================================================
-- CONSENT LOG
-- ============================================================

create table if not exists public.consent_log (
  id uuid primary key default gen_random_uuid(),

  user_id uuid
    references public.profiles(id)
    on delete cascade,

  consent_type text not null,

  version text,

  accepted boolean not null default false,

  accepted_at timestamptz not null default now()
);


-- ============================================================
-- STRIPE EVENTS
-- ============================================================

create table if not exists public.stripe_events (
  id uuid primary key default gen_random_uuid(),

  stripe_event_id text not null unique,

  event_type text not null,

  processed boolean not null default false,

  payload jsonb,

  created_at timestamptz not null default now(),

  processed_at timestamptz
);


-- ============================================================
-- AUDIT LOG
-- ============================================================

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),

  user_id uuid
    references public.profiles(id)
    on delete set null,

  action text not null,

  entity_type text,

  entity_id uuid,

  metadata jsonb,

  created_at timestamptz not null default now()
);


-- ============================================================
-- SETTINGS
-- ============================================================

create table if not exists public.settings (
  key text primary key,

  value jsonb,

  updated_at timestamptz not null default now()
);


-- ============================================================
-- REFERRALS
-- ============================================================

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),

  referrer_user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  referred_user_id uuid
    references public.profiles(id)
    on delete set null,

  code text not null,

  status text not null default 'pending',

  created_at timestamptz not null default now()
);


-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists bookings_session_idx
  on public.bookings(session_id);

create index if not exists bookings_user_idx
  on public.bookings(user_id);

create index if not exists bookings_status_idx
  on public.bookings(status);

create index if not exists bookings_checkout_idx
  on public.bookings(stripe_checkout_session_id);

create index if not exists sessions_starts_at_idx
  on public.sessions(starts_at);

create index if not exists sessions_status_idx
  on public.sessions(status);

create index if not exists membership_user_idx
  on public.memberships(user_id);

create index if not exists membership_status_idx
  on public.memberships(status);

create index if not exists membership_period_membership_idx
  on public.membership_periods(membership_id);

create index if not exists credit_ledger_user_idx
  on public.credit_ledger(user_id);

create index if not exists credit_ledger_period_idx
  on public.credit_ledger(period_id);

create index if not exists credit_ledger_booking_idx
  on public.credit_ledger(booking_id);

create index if not exists team_registrations_tournament_idx
  on public.team_registrations(tournament_id);

create index if not exists team_players_registration_idx
  on public.team_players(team_registration_id);


-- ============================================================
-- UNIQUE STRIPE INDEXES
-- ============================================================

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


create unique index if not exists membership_products_stripe_price_unique
  on public.membership_products(stripe_price_id)
  where stripe_price_id is not null;


-- ============================================================
-- BOOKING STATUS CONSTRAINT
-- ============================================================

alter table public.bookings
  drop constraint if exists bookings_status_check;

alter table public.bookings
  add constraint bookings_status_check
  check (
    status in (
      'pending_payment',
      'booked',
      'cancelled',
      'waitlist',
      'attended'
    )
  );


-- ============================================================
-- MEMBERSHIP PRODUCTS
-- ============================================================
-- CD4Q 2:
-- £15 recurring monthly
-- 2 credits
-- 30-day period
--
-- CD4Q 4:
-- £30 recurring every 2 months
-- 4 credits
-- 60-day period
-- ============================================================

insert into public.membership_products (
  name,
  stripe_price_id,
  credits,
  period_days,
  perks,
  active
)
select
  'CD4Q 2',
  'price_1ULtW17bYWsJeF2w29UX6fnQ',
  2,
  30,
  '[]'::jsonb,
  true
where not exists (
  select 1
  from public.membership_products
  where name = 'CD4Q 2'
);


insert into public.membership_products (
  name,
  stripe_price_id,
  credits,
  period_days,
  perks,
  active
)
select
  'CD4Q 4',
  'price_1ULtWz7bYWsJeF2wVKDysJTT',
  4,
  60,
  '[]'::jsonb,
  true
where not exists (
  select 1
  from public.membership_products
  where name = 'CD4Q 4'
);


-- ============================================================
-- PROFILE PROVISIONING
-- ============================================================

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

  insert into public.profiles (
    id,
    full_name,
    email
  )
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name'
    ),
    new.email
  )
  on conflict (id) do update
  set
    email = excluded.email,
    updated_at = now();

  return new;

end;
$$;


drop trigger if exists on_auth_user_created_profile
on auth.users;


create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function public.create_profile_for_auth_user();


-- ============================================================
-- ADMIN CHECK
-- ============================================================

create or replace function public.is_cd4q_admin(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_user_id
      and role in ('admin', 'super_admin')
  );
$$;


-- ============================================================
-- CREATE SESSION BOOKING
-- ============================================================

create or replace function public.create_session_booking(
  p_session_id uuid,
  p_user_id uuid,
  p_payment_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare

  v_session public.sessions%rowtype;
  v_booking public.bookings%rowtype;

  v_booking_id uuid;

  v_credit_period_id uuid;
  v_ledger_id uuid;

  v_credits_available integer := 0;
  v_active_bookings integer := 0;
  v_waitlist_position integer := 0;

begin

  if p_payment_type not in ('member', 'payg') then
    raise exception 'INVALID_PAYMENT_TYPE';
  end if;


  if not exists (
    select 1
    from public.profiles
    where id = p_user_id
  ) then
    raise exception 'PROFILE_REQUIRED';
  end if;


  perform pg_advisory_xact_lock(
    hashtextextended(p_user_id::text, 0)
  );


  select *
  into v_session
  from public.sessions
  where id = p_session_id
  for update;


  if not found
     or v_session.status <> 'published' then

    raise exception 'SESSION_UNAVAILABLE';

  end if;


  if v_session.starts_at <= now() then
    raise exception 'SESSION_STARTED';
  end if;


  select *
  into v_booking
  from public.bookings
  where session_id = p_session_id
    and user_id = p_user_id
  for update;


  if found
     and v_booking.status = 'booked' then

    return jsonb_build_object(
      'booking_id', v_booking.id,
      'status', v_booking.status,
      'payment_required', false,
      'credits_available', null
    );

  end if;


  if found
     and v_booking.status = 'pending_payment'
     and v_booking.checkout_expires_at > now() then

    return jsonb_build_object(
      'booking_id', v_booking.id,
      'status', v_booking.status,
      'payment_required', true,
      'credits_available', null
    );

  end if;


  select count(*)
  into v_active_bookings
  from public.bookings
  where session_id = p_session_id
    and (
      status = 'booked'
      or (
        status = 'pending_payment'
        and checkout_expires_at > now()
      )
    );


  if v_active_bookings >= v_session.capacity then

    select count(*) + 1
    into v_waitlist_position
    from public.bookings
    where session_id = p_session_id
      and status = 'waitlist';


    if v_booking.id is not null then

      update public.bookings
      set
        status = 'waitlist',
        source = p_payment_type,
        position = v_waitlist_position,
        stripe_checkout_session_id = null,
        checkout_expires_at = null
      where id = v_booking.id
      returning *
      into v_booking;

    else

      insert into public.bookings (
        session_id,
        user_id,
        status,
        source,
        position
      )
      values (
        p_session_id,
        p_user_id,
        'waitlist',
        p_payment_type,
        v_waitlist_position
      )
      returning *
      into v_booking;

    end if;


    return jsonb_build_object(
      'booking_id', v_booking.id,
      'status', v_booking.status,
      'payment_required', false,
      'credits_available', null
    );

  end if;


  -- ==========================================================
  -- PAYG
  -- ==========================================================

  if p_payment_type = 'payg' then

    if v_booking.id is null then

      insert into public.bookings (
        session_id,
        user_id,
        status,
        source,
        checkout_expires_at
      )
      values (
        p_session_id,
        p_user_id,
        'pending_payment',
        'payg',
        now() + interval '35 minutes'
      )
      returning *
      into v_booking;

    else

      update public.bookings
      set
        status = 'pending_payment',
        source = 'payg',
        position = null,
        credit_ledger_id = null,
        stripe_checkout_session_id = null,
        stripe_payment_id = null,
        checkout_expires_at = now() + interval '35 minutes'
      where id = v_booking.id
      returning *
      into v_booking;

    end if;


    return jsonb_build_object(
      'booking_id', v_booking.id,
      'status', v_booking.status,
      'payment_required', true,
      'credits_available', null
    );

  end if;


  -- ==========================================================
  -- MEMBER CREDIT CHECK
  -- ==========================================================

  select
    ledger.period_id,
    sum(ledger.change)::integer
  into
    v_credit_period_id,
    v_credits_available
  from public.credit_ledger ledger

  left join public.membership_periods period
    on period.id = ledger.period_id

  where ledger.user_id = p_user_id

    and (
      (
        ledger.expires_at is not null
        and ledger.expires_at > now()
      )

      or

      (
        ledger.expires_at is null
        and (
          ledger.period_id is null
          or period.ends_at > now()
        )
      )
    )

  group by
    ledger.period_id,
    period.starts_at

  having sum(ledger.change) > 0

  order by
    period.starts_at nulls last

  limit 1;


  if coalesce(v_credits_available, 0) < 1 then
    raise exception 'NO_CREDITS';
  end if;


  -- ==========================================================
  -- CREATE / RESTORE MEMBER BOOKING
  -- ==========================================================

  if v_booking.id is null then

    insert into public.bookings (
      session_id,
      user_id,
      status,
      source
    )
    values (
      p_session_id,
      p_user_id,
      'booked',
      'member'
    )
    returning *
    into v_booking;

  else

    update public.bookings
    set
      status = 'booked',
      source = 'member',
      position = null,
      stripe_checkout_session_id = null,
      stripe_payment_id = null,
      checkout_expires_at = null
    where id = v_booking.id
    returning *
    into v_booking;

  end if;


  -- ==========================================================
  -- REMOVE ONE CREDIT
  -- ==========================================================

  insert into public.credit_ledger (
    user_id,
    period_id,
    change,
    reason,
    booking_id,
    session_id,
    note
  )
  values (
    p_user_id,
    v_credit_period_id,
    -1,
    'session_booking',
    v_booking.id,
    p_session_id,
    'Credit used for member run booking'
  )
  returning id
  into v_ledger_id;


  update public.bookings
  set credit_ledger_id = v_ledger_id
  where id = v_booking.id;


  return jsonb_build_object(
    'booking_id', v_booking.id,
    'status', 'booked',
    'payment_required', false,
    'credits_available', v_credits_available - 1
  );

end;
$$;


-- ============================================================
-- CANCEL SESSION BOOKING
-- ============================================================

create or replace function public.cancel_session_booking(
  p_booking_id uuid,
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare

  v_booking public.bookings%rowtype;
  v_session public.sessions%rowtype;

  v_refund_amount integer := 0;

begin

  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
    and user_id = p_user_id
  for update;


  if not found then
    raise exception 'BOOKING_NOT_FOUND';
  end if;


  if v_booking.status = 'cancelled' then
    return jsonb_build_object(
      'status', 'cancelled',
      'refund_required', false
    );
  end if;


  select *
  into v_session
  from public.sessions
  where id = v_booking.session_id;


  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;


  -- ==========================================================
  -- PENDING PAYMENT
  -- ==========================================================

  if v_booking.status = 'pending_payment' then

    update public.bookings
    set
      status = 'cancelled',
      cancelled_at = now(),
      checkout_expires_at = null
    where id = v_booking.id;


    return jsonb_build_object(
      'status', 'cancelled',
      'refund_required', false
    );

  end if;


  -- ==========================================================
  -- WAITLIST
  -- ==========================================================

  if v_booking.status = 'waitlist' then

    update public.bookings
    set
      status = 'cancelled',
      cancelled_at = now(),
      position = null
    where id = v_booking.id;


    return jsonb_build_object(
      'status', 'cancelled',
      'refund_required', false
    );

  end if;


  if v_booking.status <> 'booked' then
    raise exception 'BOOKING_NOT_ACTIVE';
  end if;


  -- ==========================================================
  -- CANCELLATION CUTOFF
  -- ==========================================================

  if now() >
     v_session.starts_at
       - (
           coalesce(
             v_session.cancel_cutoff_hours,
             12
           )
           * interval '1 hour'
         ) then

    raise exception 'CANCELLATION_CUTOFF';

  end if;


  -- ==========================================================
  -- MEMBER BOOKING
  -- ==========================================================

  if v_booking.source = 'member'
     and v_booking.credit_ledger_id is not null then

    insert into public.credit_ledger (
      user_id,
      period_id,
      change,
      reason,
      booking_id,
      session_id,
      note
    )
    select
      v_booking.user_id,
      period_id,
      1,
      'booking_cancellation',
      v_booking.id,
      v_booking.session_id,
      'Credit returned after member booking cancellation'
    from public.credit_ledger
    where id = v_booking.credit_ledger_id;


    update public.bookings
    set
      status = 'cancelled',
      cancelled_at = now()
    where id = v_booking.id;


    return jsonb_build_object(
      'status', 'cancelled',
      'refund_required', false
    );

  end if;


  -- ==========================================================
  -- PAYG BOOKING
  -- ==========================================================

  if v_booking.source = 'payg' then

    update public.bookings
    set
      status = 'cancelled',
      cancelled_at = now()
    where id = v_booking.id;


    return jsonb_build_object(
      'status', 'cancelled',
      'refund_required',
      v_booking.stripe_payment_id is not null,
      'stripe_payment_id',
      v_booking.stripe_payment_id
    );

  end if;


  update public.bookings
  set
    status = 'cancelled',
    cancelled_at = now()
  where id = v_booking.id;


  return jsonb_build_object(
    'status', 'cancelled',
    'refund_required', false
  );

end;
$$;


-- ============================================================
-- FUNCTION PERMISSIONS
-- ============================================================

revoke all
on function public.create_session_booking(uuid, uuid, text)
from public, anon, authenticated;

grant execute
on function public.create_session_booking(uuid, uuid, text)
to service_role;


revoke all
on function public.cancel_session_booking(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.cancel_session_booking(uuid, uuid)
to service_role;


revoke all
on function public.is_cd4q_admin(uuid)
from public, anon;

grant execute
on function public.is_cd4q_admin(uuid)
to authenticated, service_role;


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.player_health enable row level security;
alter table public.membership_products enable row level security;
alter table public.memberships enable row level security;
alter table public.membership_periods enable row level security;
alter table public.sessions enable row level security;
alter table public.bookings enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.waitlist_offers enable row level security;
alter table public.refunds enable row level security;
alter table public.notifications enable row level security;
alter table public.messages enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_categories enable row level security;
alter table public.team_registrations enable row level security;
alter table public.team_players enable row level security;
alter table public.consent_log enable row level security;
alter table public.stripe_events enable row level security;
alter table public.audit_log enable row level security;
alter table public.settings enable row level security;
alter table public.referrals enable row level security;


-- ============================================================
-- PROFILES POLICIES
-- ============================================================

create policy profiles_select_own
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.is_cd4q_admin(auth.uid())
);


create policy profiles_update_own
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
)
with check (
  id = auth.uid()
);


-- ============================================================
-- PLAYER HEALTH POLICIES
-- ============================================================

create policy player_health_select_own
on public.player_health
for select
to authenticated
using (
  user_id = auth.uid()
);


create policy player_health_insert_own
on public.player_health
for insert
to authenticated
with check (
  user_id = auth.uid()
);


create policy player_health_update_own
on public.player_health
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);


-- ============================================================
-- MEMBERSHIP PRODUCTS
-- ============================================================

create policy membership_products_select
on public.membership_products
for select
to authenticated
using (
  active = true
  or public.is_cd4q_admin(auth.uid())
);


-- ============================================================
-- MEMBERSHIPS
-- ============================================================

create policy memberships_select_own
on public.memberships
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_cd4q_admin(auth.uid())
);


-- ============================================================
-- MEMBERSHIP PERIODS
-- ============================================================

create policy membership_periods_select_own
on public.membership_periods
for select
to authenticated
using (
  exists (
    select 1
    from public.memberships m
    where m.id = membership_periods.membership_id
      and (
        m.user_id = auth.uid()
        or public.is_cd4q_admin(auth.uid())
      )
  )
);


-- ============================================================
-- SESSIONS
-- ============================================================

create policy sessions_select_published
on public.sessions
for select
to authenticated
using (
  status = 'published'
  or public.is_cd4q_admin(auth.uid())
);


-- ============================================================
-- BOOKINGS
-- ============================================================

create policy bookings_select_own
on public.bookings
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_cd4q_admin(auth.uid())
);


-- ============================================================
-- CREDIT LEDGER
-- ============================================================

create policy credit_ledger_select_own
on public.credit_ledger
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_cd4q_admin(auth.uid())
);


-- ============================================================
-- WAITLIST
-- ============================================================

create policy waitlist_offers_select_own
on public.waitlist_offers
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_cd4q_admin(auth.uid())
);


-- ============================================================
-- NOTIFICATIONS
-- ============================================================

create policy notifications_select_own
on public.notifications
for select
to authenticated
using (
  user_id = auth.uid()
);


create policy notifications_update_own
on public.notifications
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);


-- ============================================================
-- MESSAGES
-- ============================================================

create policy messages_select_own
on public.messages
for select
to authenticated
using (
  sender_id = auth.uid()
  or recipient_id = auth.uid()
  or public.is_cd4q_admin(auth.uid())
);


-- ============================================================
-- TOURNAMENTS
-- ============================================================

create policy tournaments_select
on public.tournaments
for select
to authenticated
using (
  status <> 'draft'
  or public.is_cd4q_admin(auth.uid())
);


-- ============================================================
-- TOURNAMENT CATEGORIES
-- ============================================================

create policy tournament_categories_select
on public.tournament_categories
for select
to authenticated
using (
  exists (
    select 1
    from public.tournaments t
    where t.id = tournament_categories.tournament_id
      and (
        t.status <> 'draft'
        or public.is_cd4q_admin(auth.uid())
      )
  )
);


-- ============================================================
-- TEAM REGISTRATIONS
-- ============================================================

create policy team_registrations_select_own
on public.team_registrations
for select
to authenticated
using (
  registrant_user_id = auth.uid()
  or public.is_cd4q_admin(auth.uid())
);


-- ============================================================
-- TEAM PLAYERS
-- ============================================================

create policy team_players_select_own
on public.team_players
for select
to authenticated
using (
  exists (
    select 1
    from public.team_registrations tr
    where tr.id = team_players.team_registration_id
      and (
        tr.registrant_user_id = auth.uid()
        or public.is_cd4q_admin(auth.uid())
      )
  )
);


-- ============================================================
-- CONSENT
-- ============================================================

create policy consent_log_select_own
on public.consent_log
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_cd4q_admin(auth.uid())
);


-- ============================================================
-- REFERRALS
-- ============================================================

create policy referrals_select_own
on public.referrals
for select
to authenticated
using (
  referrer_user_id = auth.uid()
  or referred_user_id = auth.uid()
  or public.is_cd4q_admin(auth.uid())
);


-- ============================================================
-- ADMIN-ONLY / SERVER MANAGED TABLES
-- ============================================================

-- stripe_events
-- audit_log
-- refunds
-- settings
--
-- These tables intentionally do not receive normal
-- authenticated write policies.
--
-- Server-side routes using the Supabase service role
-- manage these records.


-- ============================================================
-- FINAL PRODUCT VERIFICATION
-- ============================================================

select
  id,
  name,
  stripe_price_id,
  credits,
  period_days,
  active
from public.membership_products
order by name;


-- ============================================================
-- EXPECTED RESULT
-- ============================================================
--
-- CD4Q 2
--   stripe_price_id = price_1ULtW17bYWsJeF2w29UX6fnQ
--   credits         = 2
--   period_days     = 30
--   active          = true
--
-- CD4Q 4
--   stripe_price_id = price_1ULtWz7bYWsJeF2wVKDysJTT
--   credits         = 4
--   period_days     = 60
--   active          = true
--
-- PAYG is NOT stored in membership_products.
-- Its Stripe price is:
--
-- price_1ULtV37bYWsJeF2wRieFCkMw
--
-- ============================================================
alter table public.refunds
add column if not exists stripe_refund_id text;

create unique index if not exists refunds_stripe_refund_id_unique
on public.refunds(stripe_refund_id)
where stripe_refund_id is not null;