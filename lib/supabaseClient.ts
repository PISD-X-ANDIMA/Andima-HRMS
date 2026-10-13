import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Variabel Supabase tidak ditemukan! Pastikan .env.local sudah dibuat di root folder dan server Next.js sudah di-restart.'
  );
}

export const supabase = createBrowserClient(supabaseUrl, supabasePublishableKey);
