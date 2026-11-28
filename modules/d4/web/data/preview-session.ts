/**
 * Sign-in for the local preview (fixture mode only): a cookie the proxy checks like a real session, so login and logout
 * can be tried without an account. Nothing is sent to Supabase or any other server.
 */
export const PREVIEW_SESSION_COOKIE = "d4-preview-session";

export function startPreviewSession() {
  document.cookie = `${PREVIEW_SESSION_COOKIE}=1; path=/; SameSite=Lax`;
}

export function endPreviewSession() {
  document.cookie = `${PREVIEW_SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
