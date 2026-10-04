import type { KpiCatalog } from "../../kpi/catalog";
import type { D4LiveSnapshot } from "../../supabase/types";
import type { D4DataSource } from "./source";

export class D4RequestError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

/** Requests that take longer than this are aborted and reported as a timeout. */
const REQUEST_TIMEOUT_MS = 20_000;

const MESSAGES = {
  NETWORK_ERROR: "Tidak dapat terhubung ke server. Periksa koneksi internet lalu coba lagi.",
  TIMEOUT: "Server terlalu lama merespons. Coba lagi beberapa saat lagi.",
  INTEGRATION_ERROR: "Layanan data HRMS sedang tidak dapat dihubungi. Coba lagi beberapa saat lagi.",
  SERVER_ERROR: "Permintaan ke server gagal. Coba lagi beberapa saat lagi.",
} as const;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "same-origin",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (cause) {
    // fetch only rejects when no HTTP response arrived: offline, DNS, CORS, or our timeout.
    const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
    const code = timedOut ? "TIMEOUT" : "NETWORK_ERROR";
    throw new D4RequestError(0, code, MESSAGES[code]);
  }
  const body = await response.json().catch(() => null) as { data?: T; error?: { code: string; message: string } } | null;
  if (response.ok && body && !body.error) return body.data as T;
  if (body?.error) throw new D4RequestError(response.status, body.error.code, body.error.message);
  // No D4 envelope: a gateway/proxy or the upstream service answered instead of our route handler.
  const code = response.status === 502 || response.status === 503 || response.status === 504 ? "INTEGRATION_ERROR" : "SERVER_ERROR";
  throw new D4RequestError(response.status, code, MESSAGES[code]);
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) });

/** Live data through the D4 REST API, so every call is visible in the browser Network tab. */
export const apiSource: D4DataSource = {
  mode: "live",
  loadSnapshot: () => request<D4LiveSnapshot>("/api/d4/snapshot"),
  loadKpiCatalog: () => request<KpiCatalog>("/api/d4/kpi-catalog"),
  createEvaluation: async (input) => (await post<{ id: string }>("/api/d4/performance-evaluations", input)).id,
  createKpiAssessment: async (input) => (await post<{ id: string }>("/api/d4/kpi-assessments", input)).id,
  saveCompetency: async (input) => (await post<{ id: string }>("/api/d4/competency-assessments", input)).id,
  createDevelopment: async (input) => (await post<{ id: string }>("/api/d4/development-needs", input)).id,
  updateDevelopment: async (needId, status, notes) => { await post(`/api/d4/development-needs/${encodeURIComponent(needId)}/versions`, { status, notes }); },
  createTraining: async (input) => (await post<{ id: string }>("/api/d4/training-records", input)).id,
  updateTraining: async (trainingId, status, result, notes) => { await post(`/api/d4/training-records/${encodeURIComponent(trainingId)}/versions`, { status, result, notes }); },
};
