import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// Client untuk halaman login & register dari B2 (della).
// createBrowserClient menyimpan sesi di cookie, jadi proxy.ts bisa membaca status login.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

let client: SupabaseClient | undefined;

// Created on first use: CI builds without Supabase env and prerenders /login and /register, where creating it throws.
export function supabaseClient() {
  return client ??= createBrowserClient(supabaseUrl, supabaseKey);
}
