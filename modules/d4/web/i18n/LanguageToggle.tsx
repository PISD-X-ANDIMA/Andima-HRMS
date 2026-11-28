"use client";

import type { Language } from "../../shared/text";
import { cx } from "../ui/primitives";
import { useLanguage } from "./LanguageProvider";

// Each language names itself, so someone who cannot read the current one still finds theirs.
const OPTIONS: { value: Language; label: string; name: string }[] = [
  { value: "en", label: "EN", name: "English" },
  { value: "id", label: "ID", name: "Bahasa Indonesia" },
];

/** EN | ID switch in the header, the same two choices as D3's LanguageToggle. */
export function LanguageToggle() {
  const { language, setLanguage, t } = useLanguage();
  return <div role="group" aria-label={t("Language")} data-testid="language-toggle" className="flex shrink-0 items-center rounded-lg border border-line bg-surface p-0.5">
    {OPTIONS.map((option) => <button key={option.value} type="button" lang={option.value} data-testid={`btn-language-${option.value}`}
      aria-pressed={language === option.value} aria-label={`${option.label}, ${option.name}`} title={option.name} onClick={() => setLanguage(option.value)}
      className={cx("inline-flex h-7 min-w-8 items-center justify-center rounded-md px-2 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary-500",
        language === option.value ? "bg-primary-600 text-white" : "text-ink-2 hover:bg-muted")}>{option.label}</button>)}
  </div>;
}
