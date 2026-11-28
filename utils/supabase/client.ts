import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ufjbbwqaztgkqmpdmcyv.supabase.co";
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_0GFbshHOM6k80Wxde_iZVQ_v6DpVj1D";

  if (!url || !publishableKey) {
    throw new Error("Konfigurasi Supabase belum tersedia. Periksa file .env.local.");
  }

  return createBrowserClient(url, publishableKey);
}