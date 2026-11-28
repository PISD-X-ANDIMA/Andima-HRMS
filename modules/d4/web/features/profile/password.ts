import { msg } from "../../../shared/text";

const SPECIAL = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

/** Same rule as /register, so a changed password is never weaker than the one a new account must have. */
export function newPasswordProblem(current: string, next: string): string | undefined {
  if (!next) return msg("Password baru wajib diisi.");
  if (next.length < 10) return msg("Password minimal 10 karakter.");
  if (!/[a-zA-Z]/.test(next) || !/[0-9]/.test(next) || !SPECIAL.test(next)) return msg("Password harus berisi huruf, angka, dan karakter khusus.");
  if (next === current) return msg("Password baru harus berbeda dari password saat ini.");
}
