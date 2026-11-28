"use client";

import { useState, type FormEvent } from "react";
import { localToday, periodState, reopenablePeriods } from "../../../shared/rules";
import { useD4, useSnapshot } from "../../data/D4DataProvider";
import { formatDate, formatPeriod, today } from "../../data/selectors";
import { useLanguage } from "../../i18n/LanguageProvider";
import { DateField, FormError, FormModal, ModalActions, ReadOnlyField, SelectField, TextAreaField } from "../../ui/forms";
import { Button, Notice } from "../../ui/primitives";

/**
 * HR reopens an older period for a late review, or closes it again before its end date (lecturer review, 24 Nov 2026).
 * Both save a row in d4_period_reopenings; closing uses yesterday as the end date, since the newest row decides.
 */
export function ReopenPeriodModal({ onClose }: { onClose: () => void }) {
  const snapshot = useSnapshot();
  const { run, busy } = useD4();
  const { t, language } = useLanguage();
  const reopenings = snapshot.periodReopenings ?? [];
  const periods = reopenablePeriods();
  const [period, setPeriod] = useState(periods[0] ?? "");
  const [openUntil, setOpenUntil] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState("");
  const latest = reopenings.filter((item) => item.period === period).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const open = Boolean(period) && periodState(period, reopenings) === "open";
  const reasonError = touched && reason.trim().length < 5 ? t("Alasan wajib diisi, 5 sampai 500 karakter.") : undefined;
  const status = (item: string) => {
    const row = reopenings.filter((entry) => entry.period === item).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return periodState(item, reopenings) === "open" && row ? t("dibuka sampai {date}", { date: formatDate(row.openUntil, language) }) : t("tertutup");
  };

  async function save(until: string, success: string) {
    setTouched(true);
    if (!until) { setError(t("Pilih tanggal Dibuka sampai.")); return; }
    if (reason.trim().length < 5) { setError(t("Alasan wajib diisi, 5 sampai 500 karakter.")); return; }
    setError("");
    const result = await run((source) => source.reopenPeriod({ period, openUntil: until, reason }), success);
    if (result.ok) onClose(); else setError(result.error);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void save(openUntil, t("{period} dibuka kembali sampai {date}.", { period: formatPeriod(period, language), date: openUntil ? formatDate(openUntil, language) : "" }));
  }

  // Yesterday in WIB: the period stops taking reviews today.
  const closeNow = () => save(localToday(new Date(Date.now() - 86_400_000)), t("{period} ditutup kembali.", { period: formatPeriod(period, language) }));

  return <FormModal title={t("Reopen Period")} description={t("Bulan ini dan bulan lalu selalu terbuka. Periode yang lebih lama tertutup; buka kembali bila ada Performance Review yang terlambat.")} onClose={onClose}
    footer={<ModalActions onCancel={onClose} busy={busy} submitLabel={t("Reopen")} disabled={!periods.length}
      secondary={open && latest && <Button variant="secondary" data-testid="btn-close-period" disabled={busy} onClick={() => void closeNow()}>{t("Close now")}</Button>} />}>
    <form id="d4-modal-form" onSubmit={submit} noValidate className="space-y-5">
      <FormError message={error} />
      {!periods.length ? <Notice>{t("Belum ada periode lama yang bisa dibuka kembali.")}</Notice> : <>
        <SelectField label={t("Period")} testId="reopen-period" required value={period} onChange={(event) => { setPeriod(event.target.value); setError(""); }}>
          {periods.map((item) => <option key={item} value={item}>{`${formatPeriod(item, language)} · ${status(item)}`}</option>)}
        </SelectField>
        {latest && <ReadOnlyField label={t("Last change")} testId="reopen-last" value={`${t("Sampai {date}", { date: formatDate(latest.openUntil, language) })} · ${latest.reason}`} />}
        <DateField label={t("Open until")} testId="reopen-until" required value={openUntil} min={today()} onChange={(event) => setOpenUntil(event.target.value)}
          error={touched && !openUntil ? t("Pilih tanggal Dibuka sampai.") : undefined} helper={t("Hari terakhir HR masih bisa menyimpan Performance Review untuk periode ini.")} />
        <TextAreaField label={t("Reason")} testId="reopen-reason" required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} error={reasonError}
          helper={`${t("Misalnya: penilaian 3 pegawai terlambat karena cuti atasan.")} ${reason.length}/500`} />
      </>}
    </form>
  </FormModal>;
}
