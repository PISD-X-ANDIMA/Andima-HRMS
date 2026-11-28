/**
 * Display language of the D4 screens. Same values and cookie as D3's LanguageProvider (Andima-HRMS
 * feature/D3-002-attendance), so one choice holds across the HRMS once the modules share a domain.
 */
export type Language = "id" | "en";

export const LANGUAGE_COOKIE = "andima-hrms-language";
export const DEFAULT_LANGUAGE: Language = "id";

export const normalizeLanguage = (value: string | null | undefined): Language => (value === "en" ? "en" : "id");

export type TextVars = Record<string, string | number>;

/**
 * Turns a source text (the text the code carried before the language toggle) into the display text.
 * Functions outside React take one as an optional last argument; the server and the tests call them without it.
 */
export type Translate = ((text: string, vars?: TextVars) => string) & { language: Language | null };

export const interpolate = (text: string, vars?: TextVars) =>
  vars ? text.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : text;

/** The source text itself, as D4 showed it before the toggle. `language: null` keeps the formatters on their old output. */
export const plainText: Translate = Object.assign((text: string, vars?: TextVars) => interpolate(text, vars), { language: null });

/** Marks a text kept in a constant as a dictionary key, so tests/d4/i18n.test.ts checks it like a literal passed to t. */
export const msg = (text: string) => text;
