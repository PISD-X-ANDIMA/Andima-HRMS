import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ufjbbwqaztgkqmpdmcyv.supabase.co";
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    "sb_publishable_0GFbshHOM6k80Wxde_iZVQ_v6DpVj1D";

  if (!url || !publishableKey) {
    throw new Error("Konfigurasi Supabase belum tersedia.");
  }

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Cookie write is unavailable from Server Components, but valid in route handlers.
        }
      },
    },
  });
}