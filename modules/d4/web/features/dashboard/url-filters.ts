"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * List filters kept in the URL query, so Back from a detail page restores them (N4) and an alert link such as
 * `?q=<name>` opens the list already narrowed (K15). The first values come from the router, which already holds the
 * target URL while a client navigation renders; `window.location` still shows the previous page at that point.
 * No Suspense boundary is needed: these pages render only after the snapshot loaded in the browser, never in a prerender.
 */
export function useUrlFilters<K extends string>(keys: readonly K[]) {
  const params = useSearchParams();
  const [values, setValues] = useState(() => Object.fromEntries(keys.map((key) => [key, params.get(key) ?? ""])) as Record<K, string>);
  // Effects run after Next.js has committed the new URL, so this replaces the entry of this page, not the previous one.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(values)) {
      if (value) query.set(key, value as string); else query.delete(key);
    }
    const search = query.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
  }, [values]);
  const set = (key: K) => (value: string) => setValues((current) => ({ ...current, [key]: value }));
  const reset = () => setValues((current) => Object.fromEntries(Object.keys(current).map((key) => [key, ""])) as Record<K, string>);
  return { values, set, reset };
}
