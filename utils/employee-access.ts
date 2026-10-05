import type { createClient } from "@/utils/supabase/server";

export const d3AppRoles = ["EMPLOYEE", "HR", "MANAGER"] as const;

export type D3AppRole = (typeof d3AppRoles)[number];

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

function isD3AppRole(value: unknown): value is D3AppRole {
  return typeof value === "string" && d3AppRoles.includes(value as D3AppRole);
}

export async function getD3AppRole(
  supabase: ServerSupabaseClient,
  authUserId: string
): Promise<D3AppRole | null> {
  const { data, error } = await supabase
    .from("d3_user_access")
    .select("app_role")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    console.error("D3 user access query failed", {
      code: error.code,
      message: error.message,
    });
    return null;
  }

  return isD3AppRole(data?.app_role) ? data.app_role : null;
}

export function canManageEmployeeProfiles(role: D3AppRole | null) {
  return role === "HR";
}
