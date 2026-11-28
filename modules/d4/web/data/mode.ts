/**
 * Fixture mode is a local preview with fictional data: only `next dev` with NEXT_PUBLIC_D4_DATA_MODE=fixture.
 * Same condition as the fixturePreview flag in proxy.ts, so the UI and the auth bypass always agree.
 */
export const d4DataMode: "live" | "fixture" =
  process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_D4_DATA_MODE === "fixture" ? "fixture" : "live";
