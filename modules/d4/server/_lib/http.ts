import { NextResponse } from "next/server";
import { ApiError, isNetworkFailure, NETWORK_ERROR_MESSAGE } from "../../shared/errors";

export { ApiError, enforce, type ErrorCode } from "../../shared/errors";

/** Wraps a handler in the standard `{ data }` / `{ error: { code, message } }` envelope. */
export async function handle(run: () => Promise<unknown>, successStatus = 200) {
  try {
    return NextResponse.json({ data: await run() }, { status: successStatus });
  } catch (cause) {
    // Only typed errors carry a user-facing message; anything else (SQL, bugs) becomes a generic
    // message so database details and stack traces never reach the client (TR-17).
    const error = cause instanceof ApiError ? cause
      : isNetworkFailure(cause instanceof Error ? cause.message : "") ? new ApiError("INTEGRATION_ERROR", NETWORK_ERROR_MESSAGE)
        : new ApiError("SERVER_ERROR", "Permintaan gagal diproses. Coba lagi beberapa saat lagi.");
    if (error.code === "SERVER_ERROR" || error.code === "INTEGRATION_ERROR") console.error("[d4-api]", cause);
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
}

/**
 * Handler for the HTTP methods a route does not implement, so they get the standard envelope
 * instead of Next.js' empty 405. `allowed` is the route's own methods, e.g. "GET, POST".
 */
export function methodNotAllowed(allowed: string) {
  return () => {
    const error = new ApiError("METHOD_NOT_ALLOWED", "Metode HTTP ini tidak didukung untuk endpoint tersebut.");
    return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status, headers: { Allow: allowed } });
  };
}

/** Optional UUID, e.g. `revisionOf` when a record is saved as a revision of the current one. */
export function optionalUuid(body: Record<string, unknown>, key: string): string | null {
  return body[key] === undefined || body[key] === null || body[key] === "" ? null : field.uuid(body, key);
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  let body: unknown;
  try { body = await request.json(); } catch { throw new ApiError("BAD_REQUEST", "Body harus berupa JSON yang valid."); }
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError("BAD_REQUEST", "Body harus berupa objek JSON.");
  return body as Record<string, unknown>;
}

// Small field readers so every endpoint validates input the same way before touching the database (TR-19).
export const field = {
  text(body: Record<string, unknown>, key: string, { required = true, max = 2000 } = {}): string {
    const value = body[key];
    if (value === undefined || value === null || value === "") {
      if (required) throw new ApiError("VALIDATION_FAILED", `Field ${key} wajib diisi.`);
      return "";
    }
    if (typeof value !== "string") throw new ApiError("VALIDATION_FAILED", `Field ${key} harus berupa teks.`);
    if (value.length > max) throw new ApiError("VALIDATION_FAILED", `Field ${key} maksimal ${max} karakter.`);
    return value;
  },
  uuid(body: Record<string, unknown>, key: string): string {
    const value = field.text(body, key);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new ApiError("VALIDATION_FAILED", `Field ${key} harus berupa UUID.`);
    return value;
  },
  oneOf<T extends string>(body: Record<string, unknown>, key: string, options: readonly T[]): T {
    const value = field.text(body, key);
    if (!options.includes(value as T)) throw new ApiError("VALIDATION_FAILED", `Field ${key} harus salah satu dari: ${options.join(", ")}.`);
    return value as T;
  },
  period(body: Record<string, unknown>, key: string): string {
    const value = field.text(body, key);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new ApiError("VALIDATION_FAILED", `Field ${key} harus berformat YYYY-MM.`);
    return value;
  },
  date(body: Record<string, unknown>, key: string, { required = true } = {}): string {
    const value = field.text(body, key, { required });
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new ApiError("VALIDATION_FAILED", `Field ${key} harus berformat YYYY-MM-DD.`);
    return value;
  },
  /** Integer score 1–5 (business rule; 3.5 is rejected). */
  score(value: unknown, label: string, { required = true } = {}): number | null {
    if (value === null || value === undefined || value === "") {
      if (required) throw new ApiError("VALIDATION_FAILED", `${label} wajib diisi.`);
      return null;
    }
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) throw new ApiError("VALIDATION_FAILED", `${label} harus bilangan bulat 1 sampai 5.`);
    return value;
  },
};

export function employeeFilter(request: Request): string | null {
  return new URL(request.url).searchParams.get("employee_id");
}
