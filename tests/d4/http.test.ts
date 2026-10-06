import { describe, expect, it, vi } from "vitest";
import { ApiError, field, handle } from "@/modules/d4/server/_lib/http";

// The status comes from the typed error code, never from the message text.
const fail = (error: Error) => handle(async () => { throw error; });

describe("handle() error mapping", () => {
  it.each([
    ["BAD_REQUEST", 400],
    ["UNAUTHENTICATED", 401],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["VALIDATION_FAILED", 422],
    ["INTEGRATION_ERROR", 503],
    ["SERVER_ERROR", 500],
  ] as const)("%s → %i", async (code, status) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await fail(new ApiError(code, "Pesan uji."));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error: { code, message: "Pesan uji." } });
  });

  it("does not guess a status from an untyped message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await fail(new Error("Periode penilaian wajib dipilih."))).status).toBe(500);
  });

  it("maps a transport failure to 503", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await fail(new Error("fetch failed"))).status).toBe(503);
  });

  it("never leaks database details on a server error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const body = await (await fail(new Error('insert: violates check constraint "d4_x_check"'))).json();
    expect(body.error.code).toBe("SERVER_ERROR");
    expect(body.error.message).not.toMatch(/d4_x|constraint/);
  });
});

describe("field.score", () => {
  it.each([1, 3, 5])("accepts %d", (value) => expect(field.score(value, "Skor")).toBe(value));

  it.each([3.5, 0, 6, "4", Number.NaN])("rejects %s with VALIDATION_FAILED", (value) => {
    expect(() => field.score(value, "Skor")).toThrow(ApiError);
    expect(() => field.score(value, "Skor")).toThrow(/bilangan bulat 1 sampai 5/);
  });
});

describe("unsupported methods", () => {
  it("answer 405 with the standard envelope and an Allow header", async () => {
    const route = await import("@/app/api/d4/performance-evaluations/route");
    const res = await route.DELETE();
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET, POST");
    expect(await res.json()).toEqual({ error: { code: "METHOD_NOT_ALLOWED", message: expect.any(String) } });
  });
});
