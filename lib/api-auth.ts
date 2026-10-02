import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { supabaseProjectUrl } from '@/lib/supabase-url';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function getAuthenticatedUser(request: NextRequest): Promise<User | null> {
  const authorization = request.headers.get('authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!token || !url || !anonKey) return null;

  const supabase = createClient(supabaseProjectUrl(url), anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase.auth.getUser(token);

  return error ? null : data.user;
}

export async function getAuthenticatedAdmin(request: NextRequest): Promise<User | null> {
  const user = await getAuthenticatedUser(request);
  if (!user) return null;

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  return !error && profile && ['admin', 'super_admin'].includes(profile.role)
    ? user
    : null;
}