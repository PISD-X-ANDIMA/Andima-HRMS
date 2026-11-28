"use client";

import type { ReactNode } from "react";
import type { Language } from "../shared/text";
import { D4DataProvider, useD4 } from "./data/D4DataProvider";
import { LanguageProvider, useLanguage } from "./i18n/LanguageProvider";
import { AppShell } from "./ui/AppShell";
import { LoadingView, StateView, Toasts } from "./ui/layout";
import { Button } from "./ui/primitives";

function Gate({ children }: { children: ReactNode }) {
  const { status, error, reload } = useD4();
  const { t } = useLanguage();
  if (status === "loading") return <LoadingView />;
  // A server message has no dictionary entry and shows as sent; the provider's own fallback is a key.
  if (status === "error") return <StateView kind="error" title={t("Data D4 gagal dimuat")} text={t(error)} action={<Button onClick={reload}>{t("Try again")}</Button>} />;
  return <>{children}</>;
}

/** Client root for every D4 route: language, data provider, shell, load/error gate, and toasts. */
export function D4App({ children, mode, language }: { children: ReactNode; mode: "live" | "fixture"; language: Language }) {
  return <LanguageProvider initialLanguage={language}>
    <D4DataProvider mode={mode}>
      <AppShell><Gate>{children}</Gate></AppShell>
      <Toasts />
    </D4DataProvider>
  </LanguageProvider>;
}
