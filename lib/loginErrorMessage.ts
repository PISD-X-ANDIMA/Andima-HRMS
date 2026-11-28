import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js';

/**
 * Message for a failed signInWithPassword (D4-FN-02). supabase-js returns a network failure in `{ error }` instead of
 * throwing it, so it has to be told apart here. Only an answer from the auth server can mean a wrong email or
 * password. The Supabase rate limit (429) is the real attempt limit (D4-SEC-01).
 */
export function loginErrorMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error) || !isAuthApiError(error)) return 'Tidak dapat menghubungi server login. Coba lagi.';
  if (error.status === 429) return 'Terlalu banyak percobaan. Coba lagi nanti.';
  if (error.code === 'email_not_confirmed' || error.message.toLowerCase().includes('email not confirmed'))
    return 'Email belum dikonfirmasi. Selesaikan konfirmasi melalui email terlebih dahulu.';
  return 'Email atau password salah.';
}
