// Everything the public demo keeps lives in the visitor's own browser. Storage can be missing or throw
// (private windows, blocked site data), so every access is guarded and the demo still runs from the seed.
const PERSONA_KEY = "d4-demo-persona";
const STATE_KEY = "d4-demo-state-v1";

function read(key: string): string | null {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null) {
  try { if (value === null) window.localStorage.removeItem(key); else window.localStorage.setItem(key, value); } catch { /* demo continues in memory */ }
}

// Kept free of the dataset import so the app shell can use it without pulling the demo data into its bundle.
export const readPersonaKey = () => read(PERSONA_KEY);
export const writePersona = (key: "hr" | "manager" | "employee") => write(PERSONA_KEY, key);

export function readState<T>(): T | null {
  const raw = read(STATE_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as T; } catch { return null; }
}
export const writeState = (value: unknown) => write(STATE_KEY, JSON.stringify(value));
/** Back to the original dataset: removes every change made in this browser. */
export const resetState = () => write(STATE_KEY, null);
