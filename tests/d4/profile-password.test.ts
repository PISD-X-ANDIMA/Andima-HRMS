import { describe, expect, it } from "vitest";
import { newPasswordProblem } from "@/modules/d4/web/features/profile/password";

// Profile password change (mas Bram via Gebi, 25 Nov 2026) follows the /register rule.
describe("newPasswordProblem", () => {
  it("accepts a password that /register would accept", () => {
    expect(newPasswordProblem("old-pass-1!", "Kopi-pagi-2026")).toBeUndefined();
  });

  it("rejects an empty, short or plain password", () => {
    expect(newPasswordProblem("x", "")).toBe("Password baru wajib diisi.");
    expect(newPasswordProblem("x", "Ab1!")).toBe("Password minimal 10 karakter.");
    expect(newPasswordProblem("x", "abcdefghij1")).toBe("Password harus berisi huruf, angka, dan karakter khusus.");
    expect(newPasswordProblem("x", "abcdefghij!")).toBe("Password harus berisi huruf, angka, dan karakter khusus.");
    expect(newPasswordProblem("x", "1234567890!")).toBe("Password harus berisi huruf, angka, dan karakter khusus.");
  });

  it("rejects the current password", () => {
    expect(newPasswordProblem("Kopi-pagi-2026", "Kopi-pagi-2026")).toBe("Password baru harus berbeda dari password saat ini.");
  });
});
