import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedAdmin } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(request: NextRequest) {
  const admin = await getAuthenticatedAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const [{ data: profiles, error: profilesError }, { data: memberships, error: membershipsError }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id,full_name,email,role,created_at').order('created_at', { ascending: false }),
    supabaseAdmin.from('memberships').select('id,user_id,status,product_id,current_period_id,stripe_customer_id,membership_products(name)').order('created_at', { ascending: false }),
  ]);

  if (profilesError || membershipsError) {
    console.error('Admin user list failed:', profilesError || membershipsError);
    return NextResponse.json({ error: 'Unable to load player accounts.' }, { status: 500 });
  }

  const periodIds = (memberships ?? []).map((membership) => membership.current_period_id).filter((id): id is string => Boolean(id));
  const { data: periods, error: periodError } = periodIds.length
    ? await supabaseAdmin.from('membership_periods').select('id,starts_at,ends_at,credits_granted,payment_status,stripe_invoice_id').in('id', periodIds)
    : { data: [], error: null };
  if (periodError) return NextResponse.json({ error: 'Unable to load membership periods.' }, { status: 500 });

  const periodsById = new Map((periods ?? []).map((period) => [period.id, period]));
  const membershipsByUser = new Map<string, unknown[]>();
  for (const membership of memberships ?? []) {
    const productRelation = membership.membership_products;
    const product = Array.isArray(productRelation) ? productRelation[0] : productRelation;
    const period = membership.current_period_id ? periodsById.get(membership.current_period_id) : undefined;
    const entry = { id: membership.id, status: membership.status, product: product?.name ?? 'Membership', period, paymentFailed: ['past_due', 'unpaid'].includes(membership.status) };
    membershipsByUser.set(membership.user_id, [...(membershipsByUser.get(membership.user_id) ?? []), entry]);
  }

  const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (authError) return NextResponse.json({ error: 'Unable to load account access status.' }, { status: 500 });
  const authById = new Map(authUsers.users.map((user) => [user.id, user]));

  return NextResponse.json({ users: (profiles ?? []).map((profile) => ({
    ...profile,
    disabled: Boolean(authById.get(profile.id)?.banned_until && new Date(authById.get(profile.id)!.banned_until!) > new Date()),
    memberships: membershipsByUser.get(profile.id) ?? [],
    tier: (membershipsByUser.get(profile.id) ?? []).some((item) => ['active', 'trialing', 'past_due'].includes((item as { status: string }).status)) ? 'Membership' : 'Free / PAYG',
  })) });
}

export async function POST(request: NextRequest) {
  const admin = await getAuthenticatedAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  let body: { email?: string; fullName?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Enter a valid player email.' }, { status: 400 });

  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`;
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: { full_name: body.fullName?.trim() || email.split('@')[0] },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await supabaseAdmin.from('audit_log').insert({ user_id: admin.id, action: 'player.invited', entity_type: 'profile', entity_id: data.user.id, metadata: { email } });
  return NextResponse.json({ userId: data.user.id, invited: true }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const admin = await getAuthenticatedAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  let body: { userId?: string; action?: 'disable' | 'restore' };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 }); }
  if (!body.userId || !['disable', 'restore'].includes(String(body.action))) return NextResponse.json({ error: 'A user and disable/restore action are required.' }, { status: 400 });
  if (body.userId === admin.id && body.action === 'disable') return NextResponse.json({ error: 'You cannot disable your own admin account.' }, { status: 409 });

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(body.userId, {
    ban_duration: body.action === 'disable' ? '876000h' : 'none',
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await supabaseAdmin.from('audit_log').insert({ user_id: admin.id, action: `player.${body.action}d`, entity_type: 'profile', entity_id: body.userId, metadata: { banned_until: data.user.banned_until } });
  return NextResponse.json({ userId: body.userId, disabled: body.action === 'disable' });
}