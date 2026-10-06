import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [], set: () => {} }) }));

const { handle } = await import("@/modules/d4/server/_lib/http");
const { d4Session } = await import("@/modules/d4/server/_lib/session");

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("missing Supabase configuration", () => {
  it("answers 503 without a stack and logs once", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    for (let i = 0; i < 3; i += 1) {
      const res = await handle(d4Session);
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: { code: "CONFIGURATION_ERROR", message: "Konfigurasi server belum lengkap." } });
    }
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0].some((arg) => arg instanceof Error)).toBe(false);
  });
});
