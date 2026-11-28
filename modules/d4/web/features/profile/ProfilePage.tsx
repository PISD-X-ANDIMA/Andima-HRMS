"use client";

import { isAuthApiError } from "@supabase/supabase-js";
import { useEffect, useState, type FormEvent } from "react";
import { loginErrorMessage } from "@/lib/loginErrorMessage";
import { msg } from "../../../shared/text";
import { createD4BrowserClient } from "../../../supabase/client";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { departmentOf, employeeById, positionOf } from "../../data/selectors";
import { useLanguage } from "../../i18n/LanguageProvider";
import { roleLabel } from "../../ui/AppShell";
import { FormError, TextField } from "../../ui/forms";
import { PageHeader } from "../../ui/layout";
import { Avatar, Button, Card, InfoGrid } from "../../ui/primitives";
import { newPasswordProblem } from "./password";

/**
 * Every account has a profile and changes its own password here (mas Bram via Gebi, 25 Nov 2026). Personal data stays
 * read-only: HR keeps it in the employee master. Resetting someone else's password to a default is IT's, outside D4.
 */
export function ProfilePage() {
  const snapshot = useSnapshot();
  const { mode } = useD4();
  const { t } = useLanguage();
  const me = employeeById(snapshot, snapshot.actorEmployeeId);
  // The employee master has no email; the live account does. The preview has no account behind it.
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (mode !== "live") return;
    let active = true;
    createD4BrowserClient().auth.getUser().then(({ data }) => { if (active) setEmail(data.user?.email ?? ""); }).catch(() => undefined);
    return () => { active = false; };
  }, [mode]);
  const name = me?.fullName ?? (email || "-");

  return <>
    <PageHeader title={t("My Profile")} subtitle={t("Data akun Anda di HRMS. Data diri diubah oleh HR; password Anda ubah sendiri di sini.")} />
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
      <Card testId="profile">
        <div className="mb-6 flex items-center gap-4">
          <Avatar name={name} size="lg" />
          <div className="min-w-0">
            <h2 data-testid="profile-name" className="truncate font-display text-xl font-semibold text-ink">{name}</h2>
            <p data-testid="profile-role" className="text-sm text-ink-2">{t(roleLabel[snapshot.role] ?? "-")}</p>
          </div>
        </div>
        <InfoGrid items={[
          { label: t("Employee ID"), testId: "employee-id", value: me?.employeeId ?? "-" },
          { label: t("Email"), testId: "email", value: mode === "live" ? email || "-" : t("Tidak tersedia di pratinjau") },
          { label: t("Position"), testId: "position", value: positionOf(snapshot, me)?.title ?? "-" },
          { label: t("Department"), testId: "department", value: departmentOf(snapshot, me)?.name ?? "-" },
        ]} />
      </Card>
      <ChangePassword />
    </div>
  </>;
}

type Errors = { current?: string; next?: string; confirm?: string; form?: string };

function ChangePassword() {
  const { mode, notify } = useD4();
  const { t } = useLanguage();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problem = newPasswordProblem(current, next);
    const found: Errors = {
      current: current ? undefined : t("Password saat ini wajib diisi."),
      next: problem && t(problem),
      confirm: !problem && confirm !== next ? t("Konfirmasi password tidak sama.") : undefined,
    };
    setErrors(found);
    if (found.current || found.next || found.confirm) return;
    setBusy(true);
    const result = mode === "live" ? await changeLivePassword(current, next) : {};
    setBusy(false);
    if (result.current || result.next || result.form) {
      setErrors({ current: result.current && t(result.current), next: result.next && t(result.next), form: result.form && t(result.form) });
      return;
    }
    setCurrent(""); setNext(""); setConfirm("");
    notify("success", mode === "live" ? t("Password berhasil diubah.") : t("Pratinjau: password tidak benar-benar diubah."));
  }

  return <Card title={t("Change Password")} testId="change-password">
    <form noValidate onSubmit={(event) => void submit(event)} className="space-y-4">
      <FormError message={errors.form ?? ""} />
      <TextField label={t("Current password")} testId="current-password" type="password" autoComplete="current-password" required
        value={current} onChange={(event) => setCurrent(event.target.value)} error={errors.current} />
      <TextField label={t("New password")} testId="new-password" type="password" autoComplete="new-password" required
        value={next} onChange={(event) => setNext(event.target.value)} error={errors.next} helper={t("Minimal 10 karakter, berisi huruf, angka, dan karakter khusus.")} />
      <TextField label={t("Confirm new password")} testId="confirm-password" type="password" autoComplete="new-password" required
        value={confirm} onChange={(event) => setConfirm(event.target.value)} error={errors.confirm} />
      <div className="flex justify-end pt-1">
        <Button type="submit" data-testid="btn-change-password" disabled={busy}>{busy ? t("Menyimpan…") : t("Change Password")}</Button>
      </div>
    </form>
  </Card>;
}

/** Signing in again proves the current password and gives the fresh login Supabase asks for before a password change. */
async function changeLivePassword(current: string, next: string): Promise<Omit<Errors, "confirm">> {
  try {
    const auth = createD4BrowserClient().auth;
    const email = (await auth.getUser()).data.user?.email;
    if (!email) return { form: msg("Sesi berakhir. Silakan login ulang.") };
    const check = await auth.signInWithPassword({ email, password: current });
    if (check.error) return isAuthApiError(check.error) && check.error.code === "invalid_credentials"
      ? { current: msg("Password saat ini salah.") } : { form: loginErrorMessage(check.error) };
    // current_password only counts when the project requires it for a password change; otherwise it is ignored.
    const { error } = await auth.updateUser({ password: next, current_password: current });
    if (!error) return {};
    if (error.code === "same_password") return { next: msg("Password baru harus berbeda dari password saat ini.") };
    if (error.code === "weak_password") return { next: msg("Password ditolak server karena terlalu lemah. Pakai password lain.") };
    return { form: isAuthApiError(error) ? error.message : msg("Tidak dapat menghubungi server login. Coba lagi.") };
  } catch {
    return { form: msg("Tidak dapat menghubungi server login. Coba lagi.") };
  }
}
