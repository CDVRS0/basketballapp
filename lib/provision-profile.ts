import type { User } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function ensurePlayerProfile(user: User): Promise<void> {
  const email = user.email ?? null;
  const metadataName = typeof user.user_metadata.full_name === 'string'
    ? user.user_metadata.full_name.trim()
    : '';
  const fallbackName = email?.split('@')[0] || 'Player';

  const { error } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: user.id,
      full_name: metadataName || fallbackName,
      email,
    }, { onConflict: 'id', ignoreDuplicates: true });

  if (error) throw error;
}