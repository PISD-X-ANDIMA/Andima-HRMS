import { AuthApiError, AuthRetryableFetchError, createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { loginErrorMessage } from "@/lib/loginErrorMessage";

const UNREACHABLE = "Tidak dapat menghubungi server login. Coba lagi.";

// D4-FN-02: an unreachable server or the Supabase rate limit is not reported as a wrong email or password.
describe("loginErrorMessage", () => {
  it("reports an unreachable login server", () => {
    expect(loginErrorMessage(new AuthRetryableFetchError("Failed to fetch", 0))).toBe(UNREACHABLE);
    expect(loginErrorMessage(new AuthRetryableFetchError("Service Unavailable", 503))).toBe(UNREACHABLE);
    expect(loginErrorMessage(new TypeError("Failed to fetch"))).toBe(UNREACHABLE); // thrown instead of returned
  });

  it("reports the Supabase rate limit", () => {
    expect(loginErrorMessage(new AuthApiError("Request rate limit reached", 429, "over_request_rate_limit")))
      .toBe("Terlalu banyak percobaan. Coba lagi nanti.");
  });

  it("keeps the credential messages", () => {
    expect(loginErrorMessage(new AuthApiError("Invalid login credentials", 400, "invalid_credentials"))).toBe("Email atau password salah.");
    expect(loginErrorMessage(new AuthApiError("Email not confirmed", 400, "email_not_confirmed")))
      .toBe("Email belum dikonfirmasi. Selesaikan konfirmasi melalui email terlebih dahulu.");
  });

  // The audit's root cause: supabase-js returns a network failure in { error } instead of throwing it.
  it("maps what signInWithPassword returns when nothing listens on the auth URL", async () => {
    const client = createClient("http://127.0.0.1:1", "test-anon-key", { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await client.auth.signInWithPassword({ email: "uji@andima.co.id", password: "Rahasia-123!" });
    expect(error).not.toBeNull();
    expect(loginErrorMessage(error)).toBe(UNREACHABLE);
  });
});
