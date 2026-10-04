"use client";

import { createBrowserClient } from "@supabase/ssr";

// Public browser configuration only; record access is enforced by RLS and the D4 API.
// Values come from .env.local (see .env.example) — never hard-coded in source (TR-11).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

export function hasSupabaseConfig(): boolean {
  return Boolean(supabaseUrl && publishableKey);
}

export function createD4BrowserClient() {
  if (!hasSupabaseConfig()) throw new Error("Konfigurasi Supabase belum tersedia. Isi .env.local sesuai .env.example.");
  return createBrowserClient(supabaseUrl, publishableKey);
}
