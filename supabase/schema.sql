create table if not exists profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null,
 email text,
 phone text,
 role text not null default 'player' check (role in ('player','admin')),
 maps_pref text default 'google',
 show_name boolean default true,
 avatar_icon text,
 avatar_color text default '#dbeafe',
 level text,
 aim text,
 favourite_team text,
 favourite_player text,
 age integer,
 city text,
 instagram text,
 tiktok text,
 profile_visible boolean default true,
 created_at timestamptz default now()
);

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
 insert into public.profiles (id, full_name, email)
 values (
	 new.id,
	 coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, ''), '@', 1)),
	 new.email
 )
 on conflict (id) do nothing;
 return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
 after insert on auth.users
 for each row execute function public.create_profile_for_auth_user();

create table if not exists player_health (
 user_id uuid primary key references profiles(id) on delete cascade,
 emergency_name text not null,
 emergency_phone text not null,
 medical text,
 allergies text,
 updated_at timestamptz default now(),
 reconfirmed_at timestamptz
);

create table if not exists membership_products (
 id uuid primary key default gen_random_uuid(),
 name text not null,
 stripe_price_id text,
 credits integer not null default 0,
 period_days integer,
 perks jsonb default '[]'::jsonb,
 active boolean default true
);

create table if not exists memberships (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references profiles(id) on delete cascade,
 product_id uuid references membership_products(id),
 stripe_customer_id text,
 stripe_subscription_id text,
 status text not null default 'none',
 current_period_id uuid,
 stripe_checkout_session_id text,
 admin_override boolean default false
);

create table if not exists membership_periods (
 id uuid primary key default gen_random_uuid(),
 membership_id uuid not null references memberships(id) on delete cascade,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 credits_granted integer not null default 0,
 stripe_invoice_id text,
 payment_status text
);

create table if not exists credit_ledger (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references profiles(id) on delete cascade,
 period_id uuid references membership_periods(id),
 change integer not null,
 expires_at timestamptz,
 reason text not null,
 booking_id uuid,
 session_id uuid,
 note text,
 created_by uuid,
 created_at timestamptz default now()
);

create table if not exists sessions (
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
 notes text
);

create table if not exists bookings (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references sessions(id) on delete cascade,
 user_id uuid not null references profiles(id) on delete cascade,
 status text not null default 'booked',
 position integer,
 source text not null default 'member',
 credit_ledger_id uuid,
 stripe_checkout_session_id text,
 stripe_payment_id text,
 checkout_expires_at timestamptz,
 created_at timestamptz default now(),
 cancelled_at timestamptz,
 unique(session_id,user_id)
);

create table if not exists waitlist_offers (
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references sessions(id) on delete cascade,
 user_id uuid not null references profiles(id) on delete cascade,
 offered_at timestamptz default now(),
 expires_at timestamptz not null,
 status text not null default 'pending'
);

create table if not exists refunds (
 id uuid primary key default gen_random_uuid(),
 booking_id uuid references bookings(id),
 stripe_refund_id text,
 amount integer not null,
 status text,
 created_at timestamptz default now()
);

create table if not exists notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references profiles(id) on delete cascade,
 type text not null,
 body text not null,
 read_at timestamptz,
 created_at timestamptz default now()
);

create table if not exists messages (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 body text not null,
 starts_at timestamptz,
 expires_at timestamptz,
 created_by uuid references profiles(id),
 send_email boolean default false
);

create table if not exists tournaments (
 id uuid primary key default gen_random_uuid(),
 title text not null,
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 venue_name text not null,
 address text not null,
 lat double precision,
 lng double precision,
 price_3 integer,
 price_4 integer,
 price_5 integer,
 deadline timestamptz,
 description text,
 image_url text,
 field_config jsonb default '{}'::jsonb,
 status text default 'draft'
);

create table if not exists tournament_categories (
 id uuid primary key default gen_random_uuid(),
 tournament_id uuid references tournaments(id) on delete cascade,
 name text not null,
 max_teams integer
);

create table if not exists team_registrations (
 id uuid primary key default gen_random_uuid(),
 tournament_id uuid references tournaments(id) on delete cascade,
 category_id uuid references tournament_categories(id),
 team_name text not null,
 team_size integer not null,
 price integer not null,
 member_discount integer default 0,
 registrant_user_id uuid references profiles(id),
 captain_player_id uuid,
 status text default 'pending',
 stripe_session_id text,
 stripe_payment_id text,
 created_at timestamptz default now(),
 expires_at timestamptz
);

create table if not exists team_players (
 id uuid primary key default gen_random_uuid(),
 registration_id uuid references team_registrations(id) on delete cascade,
 full_name text not null,
 home_town text,
 email text,
 age integer,
 emergency_name text,
 emergency_phone text,
 medical text,
 allergies text,
 position text,
 skill_level text,
 media_consent boolean default false,
 guardian_name text,
 guardian_phone text,
 guardian_email text,
 guardian_consent boolean default false,
 agreements_accepted_at timestamptz,
 agreements_version text
);

create table if not exists consent_log (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references profiles(id) on delete cascade,
 type text not null,
 version text not null,
 accepted_at timestamptz default now()
);

create table if not exists stripe_events (
 stripe_event_id text primary key,
 type text not null,
 processed_at timestamptz default now()
);

-- Existing deployments may already have the base tables, so keep these changes additive.
alter table bookings add column if not exists stripe_checkout_session_id text;
alter table bookings add column if not exists checkout_expires_at timestamptz;
alter table memberships add column if not exists stripe_checkout_session_id text;
alter table credit_ledger add column if not exists source_event_id text;

alter table bookings alter column status set default 'booked';
alter table bookings drop constraint if exists bookings_status_check;
alter table bookings add constraint bookings_status_check
 check (status in ('pending_payment', 'booked', 'cancelled', 'waitlist', 'attended'));

create unique index if not exists bookings_stripe_checkout_session_unique
 on bookings(stripe_checkout_session_id) where stripe_checkout_session_id is not null;

create unique index if not exists memberships_stripe_checkout_session_unique
 on memberships(stripe_checkout_session_id) where stripe_checkout_session_id is not null;

create unique index if not exists membership_periods_invoice_unique
 on membership_periods(stripe_invoice_id) where stripe_invoice_id is not null;

create unique index if not exists credit_ledger_source_event_unique
 on credit_ledger(source_event_id) where source_event_id is not null;

create unique index if not exists membership_products_stripe_price_unique
 on membership_products(stripe_price_id);

create unique index if not exists refunds_stripe_refund_unique
 on refunds(stripe_refund_id);

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

 if not exists (select 1 from public.profiles where id = p_user_id) then
	 raise exception 'PROFILE_REQUIRED';
 end if;

 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

 select * into v_session
 from public.sessions
 where id = p_session_id
 for update;

 if not found or v_session.status <> 'published' then
	 raise exception 'SESSION_UNAVAILABLE';
 end if;

 if v_session.starts_at <= now() then
	 raise exception 'SESSION_STARTED';
 end if;

 select * into v_booking
 from public.bookings
 where session_id = p_session_id and user_id = p_user_id
 for update;

 if found and v_booking.status = 'booked' then
	 return jsonb_build_object('booking_id', v_booking.id, 'status', v_booking.status, 'payment_required', false, 'credits_available', null);
 end if;

 if found and v_booking.status = 'pending_payment' and v_booking.checkout_expires_at > now() then
	 return jsonb_build_object('booking_id', v_booking.id, 'status', v_booking.status, 'payment_required', true, 'credits_available', null);
 end if;

 select count(*) into v_active_bookings
 from public.bookings
 where session_id = p_session_id
	 and (status = 'booked' or (status = 'pending_payment' and checkout_expires_at > now()));

 if v_active_bookings >= v_session.capacity then
	 select count(*) + 1 into v_waitlist_position
	 from public.bookings
	 where session_id = p_session_id and status = 'waitlist';

	if v_booking.id is not null then
		 update public.bookings
		 set status = 'waitlist', source = p_payment_type, position = v_waitlist_position,
				 stripe_checkout_session_id = null, checkout_expires_at = null
		 where id = v_booking.id
		 returning * into v_booking;
	 else
		 insert into public.bookings(session_id, user_id, status, source, position)
		 values (p_session_id, p_user_id, 'waitlist', p_payment_type, v_waitlist_position)
		 returning * into v_booking;
	 end if;

	 return jsonb_build_object('booking_id', v_booking.id, 'status', v_booking.status, 'payment_required', false, 'credits_available', null);
 end if;

 if p_payment_type = 'payg' then
	 if v_booking.id is null then
		 insert into public.bookings(session_id, user_id, status, source, checkout_expires_at)
		values (p_session_id, p_user_id, 'pending_payment', 'payg', now() + interval '35 minutes')
		 returning * into v_booking;
	 else
		 update public.bookings
		 set status = 'pending_payment', source = 'payg', position = null,
				 credit_ledger_id = null, stripe_checkout_session_id = null,
				 stripe_payment_id = null, checkout_expires_at = now() + interval '35 minutes'
		 where id = v_booking.id
		 returning * into v_booking;
	 end if;

	 return jsonb_build_object('booking_id', v_booking.id, 'status', v_booking.status, 'payment_required', true, 'credits_available', null);
 end if;

 select ledger.period_id, sum(ledger.change)::integer
 into v_credit_period_id, v_credits_available
 from public.credit_ledger ledger
 left join public.membership_periods period on period.id = ledger.period_id
 where ledger.user_id = p_user_id
	 and (
		 (ledger.expires_at is not null and ledger.expires_at > now())
		 or (ledger.expires_at is null and (ledger.period_id is null or period.ends_at > now()))
	 )
 group by ledger.period_id, period.starts_at
 having sum(ledger.change) > 0
 order by period.starts_at nulls last
 limit 1;

 if coalesce(v_credits_available, 0) < 1 then
	 raise exception 'NO_CREDITS';
 end if;

 if v_booking.id is null then
	 insert into public.bookings(session_id, user_id, status, source)
	 values (p_session_id, p_user_id, 'booked', 'member')
	 returning * into v_booking;
 else
	 update public.bookings
	 set status = 'booked', source = 'member', position = null,
			 stripe_checkout_session_id = null, stripe_payment_id = null,
			 checkout_expires_at = null
	 where id = v_booking.id
	 returning * into v_booking;
 end if;

 insert into public.credit_ledger(user_id, period_id, change, reason, booking_id, session_id, note)
 values (p_user_id, v_credit_period_id, -1, 'session_booking', v_booking.id, p_session_id, 'Credit used for member run booking')
 returning id into v_ledger_id;

 update public.bookings set credit_ledger_id = v_ledger_id where id = v_booking.id;

 return jsonb_build_object('booking_id', v_booking.id, 'status', 'booked', 'payment_required', false, 'credits_available', v_credits_available - 1);
end;
$$;

revoke all on function public.create_session_booking(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.create_session_booking(uuid, uuid, text) to service_role;

create or replace function public.cancel_session_booking(p_booking_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
 v_booking public.bookings%rowtype;
 v_session public.sessions%rowtype;
 v_period_id uuid;
 v_period_end timestamptz;
 v_cutoff timestamptz;
 v_refund_expires_at timestamptz;
 v_ledger_id uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

 select * into v_booking
 from public.bookings
 where id = p_booking_id and user_id = p_user_id
 for update;

 if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
 if v_booking.status = 'cancelled' then
	 return jsonb_build_object('booking_id', v_booking.id, 'status', 'cancelled', 'refund_payment_id', case when v_booking.source = 'payg' then v_booking.stripe_payment_id else null end);
 end if;

 select * into v_session from public.sessions where id = v_booking.session_id for update;
 if not found then raise exception 'SESSION_NOT_FOUND'; end if;

 if v_booking.status = 'waitlist' then
	 update public.bookings set status = 'cancelled', cancelled_at = now() where id = v_booking.id;
	 return jsonb_build_object('booking_id', v_booking.id, 'status', 'cancelled', 'refund_payment_id', null);
 end if;

 if v_booking.status = 'pending_payment' then
	 update public.bookings set status = 'cancelled', cancelled_at = now() where id = v_booking.id;
	 return jsonb_build_object('booking_id', v_booking.id, 'status', 'cancelled', 'refund_payment_id', null, 'checkout_session_id', v_booking.stripe_checkout_session_id);
 end if;

 v_cutoff := v_session.starts_at - coalesce(v_session.cancel_cutoff_hours, 12) * interval '1 hour';
 if now() >= v_cutoff then raise exception 'CANCELLATION_WINDOW_CLOSED'; end if;

 if v_booking.source = 'member' and v_booking.credit_ledger_id is not null then
	 select period_id into v_period_id from public.credit_ledger where id = v_booking.credit_ledger_id;
	 select ends_at into v_period_end from public.membership_periods where id = v_period_id;
	 v_refund_expires_at := greatest(coalesce(v_period_end, now()), now() + interval '30 days');

	 insert into public.credit_ledger(user_id, period_id, change, expires_at, reason, booking_id, session_id, note)
	 values (p_user_id, v_period_id, 1, v_refund_expires_at, 'booking_cancelled', v_booking.id, v_booking.session_id, 'Member credit returned after timely cancellation')
	 returning id into v_ledger_id;

	 update public.bookings set status = 'cancelled', cancelled_at = now() where id = v_booking.id;
	 return jsonb_build_object('booking_id', v_booking.id, 'status', 'cancelled', 'credit_ledger_id', v_ledger_id, 'refund_payment_id', null);
 end if;

 update public.bookings set status = 'cancelled', cancelled_at = now() where id = v_booking.id;
 return jsonb_build_object('booking_id', v_booking.id, 'status', 'cancelled', 'refund_payment_id', v_booking.stripe_payment_id);
end;
$$;

revoke all on function public.cancel_session_booking(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cancel_session_booking(uuid, uuid) to service_role;

create table if not exists audit_log (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid references profiles(id),
 action text not null,
 target text,
 detail jsonb,
 created_at timestamptz default now()
);

create table if not exists settings (
 key text primary key,
 value jsonb
);

create table if not exists referrals (
 id uuid primary key default gen_random_uuid(),
 referrer_user_id uuid references profiles(id),
 referred_user_id uuid references profiles(id),
 referral_code text,
 status text default 'pending',
 reward jsonb,
 created_at timestamptz default now()
);

-- Tournament consent, payment state and private player details.
alter table team_registrations
 add column if not exists data_protection_version text,
 add column if not exists data_protection_accepted_at timestamptz,
 add column if not exists agreements_version text,
 add column if not exists checkout_expires_at timestamptz;

alter table team_players
 add column if not exists data_protection_accepted_at timestamptz,
 add column if not exists data_protection_version text,
 add column if not exists agreement_acceptances jsonb not null default '{}'::jsonb;

create unique index if not exists team_registrations_stripe_session_unique
 on team_registrations(stripe_session_id) where stripe_session_id is not null;

create index if not exists team_registrations_tournament_status_idx
 on team_registrations(tournament_id, status, created_at desc);

create index if not exists team_players_registration_idx
 on team_players(registration_id);

alter table team_registrations enable row level security;
alter table team_players enable row level security;
alter table player_health enable row level security;

drop policy if exists "registrants and admins read team registrations" on team_registrations;
create policy "registrants and admins read team registrations"
 on team_registrations for select to authenticated
 using (
	 registrant_user_id = auth.uid()
	 or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin')
 );

drop policy if exists "registrants and admins read team player details" on team_players;
create policy "registrants and admins read team player details"
 on team_players for select to authenticated
 using (
	 exists (
		 select 1 from team_registrations registration
		 where registration.id = team_players.registration_id
			 and (
				 registration.registrant_user_id = auth.uid()
				 or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin')
			 )
	 )
 );

drop policy if exists "players and admins read run safety details" on player_health;
create policy "players and admins read run safety details"
 on player_health for select to authenticated
 using (
	 user_id = auth.uid()
	 or exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin')
 );

drop policy if exists "players update their run safety details" on player_health;
create policy "players update their run safety details"
 on player_health for update to authenticated
 using (user_id = auth.uid())
 with check (user_id = auth.uid());

drop policy if exists "players add their run safety details" on player_health;
create policy "players add their run safety details"
 on player_health for insert to authenticated
 with check (user_id = auth.uid());

drop policy if exists "players remove their run safety details" on player_health;
create policy "players remove their run safety details"
 on player_health for delete to authenticated
 using (user_id = auth.uid());

-- Client inserts are intentionally disallowed; a verified server-side Stripe flow writes registrations.
revoke insert, update, delete on team_registrations, team_players from anon, authenticated;

-- Run health-data retention reminder: player_health is admin-only and reconfirmed every 6 months.
-- Delete Takeover medical/allergy fields when the event ends; run player_health remains until the player removes it.
-- Production RLS policies and transactional booking functions must be added before launch.
