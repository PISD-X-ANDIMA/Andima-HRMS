import { createClient } from '@supabase/supabase-js';

export function getSupabaseApiClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = 
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  if (!url || !key) {
    throw new Error('Supabase URL or Key is missing from environment variables (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).');
  }

  return createClient(url, key);
}
