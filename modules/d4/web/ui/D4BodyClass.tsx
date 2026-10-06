"use client";

import { useEffect } from "react";

/** Dialogs and row menus portal into <body>, outside .d4-root; give <body> the D4 font while a D4 page is open. */
export function D4BodyClass({ className }: { className: string }) {
  useEffect(() => {
    const classes = className.split(" ").filter(Boolean);
    document.body.classList.add(...classes);
    return () => document.body.classList.remove(...classes);
  }, [className]);
  return null;
}
