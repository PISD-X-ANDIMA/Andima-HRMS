"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LANGUAGE, interpolate, LANGUAGE_COOKIE, type Language, type TextVars, type Translate } from "../../shared/text";
import { DICTIONARY } from "./dictionary";

export function translator(language: Language): Translate {
  return Object.assign((text: string, vars?: TextVars) => {
    const entry = DICTIONARY[text];
    const singular = language === "en" && vars?.count === 1 ? entry?.enOne : undefined;
    return interpolate(singular ?? entry?.[language] ?? text, vars);
  }, { language });
}

// Display text -> source text, so a data-testid built from a label is the same in both languages (UI-D4-001 §6:
// Katalon XPaths use those ids). The first key wins when two keys share a translation; pass an explicit testId there.
const SOURCES = new Map<string, string>();
for (const [key, entry] of Object.entries(DICTIONARY)) for (const shown of [entry.id, entry.en]) if (shown && !SOURCES.has(shown)) SOURCES.set(shown, key);

/** The text a label had before translation. Use it, not the shown label, wherever a data-testid is derived from text. */
export const sourceText = (shown: string) => SOURCES.get(shown) ?? shown;

type LanguageValue ={ language: Language; setLanguage: (language: Language) => void; t: Translate };

const LanguageContext = createContext<LanguageValue>({ language: DEFAULT_LANGUAGE, setLanguage: () => {}, t: translator(DEFAULT_LANGUAGE) });

/**
 * Language of the D4 screens (decision in the class discussion of 21 Nov 2026: React Context, translations kept in the
 * frontend). The server reads the cookie, so the first render is already in the chosen language.
 */
export function LanguageProvider({ initialLanguage, children }: { initialLanguage: Language; children: ReactNode }) {
  const [language, setState] = useState(initialLanguage);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const setLanguage = useCallback((next: Language) => {
    document.cookie = `${LANGUAGE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    // D3's provider reads localStorage first; keeping it in step lets one choice hold in both modules.
    try { window.localStorage.setItem(LANGUAGE_COOKIE, next); } catch { /* storage blocked: the cookie still holds the choice */ }
    setState(next);
  }, []);
  const value = useMemo(() => ({ language, setLanguage, t: translator(language) }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
