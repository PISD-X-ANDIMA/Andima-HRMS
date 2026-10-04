import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SupabaseD4Repository } from "../../supabase/repository";
import type { D4AppRole } from "../../supabase/types";
import { databaseError } from "../../shared/errors";
import { ApiError } from "./http";

let missingConfigLogged = false;

// Route handlers use the caller's Supabase session cookie, so every query is still
// limited by the D4 RLS policies. The role checks below add an explicit server-side
// authorization layer on top of RLS (TR-12, TR-13).
export async function d4Session() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    // A deployment problem, not a request problem: log it once (no stack) and answer 503 every time.
    if (!missingConfigLogged) console.error("[d4-api] NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY belum diatur; endpoint D4 menjawab 503.");
    missingConfigLogged = true;
    throw new ApiError("CONFIGURATION_ERROR", "Konfigurasi server belum lengkap.");
  }
  const cookieStore = await cookies();
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try { items.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* read-only in some contexts */ }
      },
    },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new ApiError("UNAUTHENTICATED", "Sesi login tidak tersedia. Silakan masuk kembali.");
  return { client, user: data.user, repository: new SupabaseD4Repository(client, data.user) };
}

export async function d4Access(session: Awaited<ReturnType<typeof d4Session>>): Promise<{ role: D4AppRole; employeeId: string }> {
  const { data, error } = await session.client.from("d3_user_access").select("app_role,employee_id").eq("auth_user_id", session.user.id).maybeSingle();
  if (error) throw databaseError(error, "Hak akses");
  if (!data) throw new ApiError("FORBIDDEN", "Akun belum diberi akses data HRMS.");
  return { role: data.app_role as D4AppRole, employeeId: data.employee_id as string };
}

/** Create/update of performance, KPI, development, and training data is limited to HR and managers. */
export async function requireWriter() {
  const session = await d4Session();
  const access = await d4Access(session);
  if (access.role !== "HR" && access.role !== "MANAGER") throw new ApiError("FORBIDDEN", "Hanya HR atau manager yang dapat mengubah data ini.");
  return { ...session, access };
}
