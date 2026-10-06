"use client";

import type { ReactNode } from "react";
import { D4DataProvider, useD4 } from "./data/D4DataProvider";
import type { D4DataMode } from "./data/mode";
import { AppShell } from "./ui/AppShell";
import { LoadingView, StateView, Toasts } from "./ui/layout";
import { Button } from "./ui/primitives";

function Gate({ children }: { children: ReactNode }) {
  const { status, error, reload } = useD4();
  if (status === "loading") return <LoadingView />;
  if (status === "error") return <StateView kind="error" title="Data D4 belum dapat dimuat" text={error} action={<Button onClick={reload}>Coba lagi</Button>} />;
  return <>{children}</>;
}

/** Client root for every D4 route: data provider, shell, load/error gate, and toasts. */
export function D4App({ children, mode }: { children: ReactNode; mode: D4DataMode }) {
  return <D4DataProvider mode={mode}>
    <AppShell><Gate>{children}</Gate></AppShell>
    <Toasts />
  </D4DataProvider>;
}
