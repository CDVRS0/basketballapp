import { createClient } from '@supabase/supabase-js';
import { supabaseProjectUrl } from '@/lib/supabase-url';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
}

export const supabaseAdmin = createClient(
  supabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL),
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);