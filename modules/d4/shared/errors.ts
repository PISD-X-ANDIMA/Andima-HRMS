/**
 * Typed D4 errors. The code decides the HTTP status (modules/d4/server/_lib/http.ts), so the API never
 * has to guess a status from message text. Framework-free: also thrown by rules used in the browser.
 */
export type ErrorCode = "BAD_REQUEST" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "METHOD_NOT_ALLOWED" | "CONFLICT" | "VALIDATION_FAILED" | "INTEGRATION_ERROR" | "CONFIGURATION_ERROR" | "SERVER_ERROR";

const statusByCode: Record<ErrorCode, number> = {
  BAD_REQUEST: 400, VALIDATION_FAILED: 422, UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, METHOD_NOT_ALLOWED: 405, CONFLICT: 409, SERVER_ERROR: 500, INTEGRATION_ERROR: 503, CONFIGURATION_ERROR: 503,
};

/** An error whose message is safe to show to the user. */
export class ApiError extends Error {
  constructor(readonly code: ErrorCode, message: string) { super(message); }
  get status() { return statusByCode[this.code]; }
}

/** Duplicate or concurrent write (double click, two tabs) of a record that must be unique. */
export const DUPLICATE_MESSAGE = "Data yang sama sudah tersimpan atau sedang diproses. Muat ulang halaman untuk melihat data terbaru.";

export const NETWORK_ERROR_MESSAGE = "Layanan data HRMS sedang tidak dapat dihubungi. Coba lagi beberapa saat lagi.";

/** Transport failures reported by fetch / Node (English system text, not D4 messages). */
export const isNetworkFailure = (message: string) => /fetch failed|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|network ?error|timed? ?out/i.test(message);

/**
 * Maps a Supabase/PostgREST error to a typed error by its Postgres code (23505 → 409, 42501 → 403,
 * P0001 → 422: D4 triggers `raise exception` with messages written for the user, e.g. the KPI catalog checks).
 * Anything unrecognised stays a plain Error so handle() answers with a generic 500 and SQL details
 * never reach the client (TR-17).
 */
export function databaseError(error: { message: string; code?: string }, label: string): Error {
  if (error.code === "23505") return new ApiError("CONFLICT", DUPLICATE_MESSAGE); // unique_violation
  if (error.code === "P0001") return new ApiError("VALIDATION_FAILED", error.message); // raise_exception
  if (error.code === "42501" || /row-level security/i.test(error.message)) return new ApiError("FORBIDDEN", "Akun ini tidak memiliki izin untuk tindakan tersebut.");
  if (isNetworkFailure(error.message)) return new ApiError("INTEGRATION_ERROR", NETWORK_ERROR_MESSAGE);
  return new Error(`${label}: ${error.message}`);
}

/** Runs an integrity rule; any other error it throws is reported as a validation error. */
export function enforce(check: () => void) {
  try { check(); } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    throw new ApiError("VALIDATION_FAILED", cause instanceof Error ? cause.message : "Data tidak valid.");
  }
}
