export type D4DataMode = "live" | "fixture" | "demo";

/**
 * - fixture: local preview with fictional data, only `next dev` with NEXT_PUBLIC_D4_DATA_MODE=fixture.
 * - demo: a public, read-and-try deployment with a large fictional dataset kept in the visitor's browser.
 *   Only when NEXT_PUBLIC_D4_DATA_MODE=demo AND no Supabase URL is configured, so a deployment wired to the
 *   shared database can never drop its login by a single misconfigured variable.
 * Same conditions as the bypass flags in proxy.ts, so the UI and the auth bypass always agree.
 */
export const isDemoMode = process.env.NEXT_PUBLIC_D4_DATA_MODE === "demo" && !process.env.NEXT_PUBLIC_SUPABASE_URL;

export const d4DataMode: D4DataMode =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_D4_DATA_MODE === "fixture" ? "fixture" : isDemoMode ? "demo" : "live";
