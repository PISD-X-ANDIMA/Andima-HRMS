/**
 * Automatic logout after inactivity (assistance session 21 Nov 2026: every department logs out an idle user and says
 * so). The last activity is shared by every open tab through localStorage, so working in one tab keeps the others
 * signed in. Times are shown in the device's own zone (WIB, WITA or WIT), because staff travel between islands.
 */
export const IDLE_LIMIT_MS = 30 * 60_000;
/** How long before the logout the warning opens, with a button to stay signed in. */
export const IDLE_WARNING_MS = 60_000;
export const LAST_ACTIVITY_KEY = "d4-last-activity";
/** Set just before an automatic logout; the login page reads it once to say why the user is there. */
export const IDLE_LOGOUT_KEY = "d4-idle-logout";

export type IdlePhase = "active" | "warning" | "expired";

export function idlePhase(now: number, lastActivity: number, limit = IDLE_LIMIT_MS, warning = IDLE_WARNING_MS): IdlePhase {
  const idle = now - lastActivity;
  return idle >= limit ? "expired" : idle >= limit - warning ? "warning" : "active";
}

const INDONESIAN_ZONES: Record<number, string> = { 420: "WIB", 480: "WITA", 540: "WIT" };

/** WIB, WITA or WIT for the three Indonesian zones, otherwise the UTC offset (GMT+2, GMT-3:30). */
export function zoneLabel(date: Date): string {
  const offset = -date.getTimezoneOffset();
  if (INDONESIAN_ZONES[offset]) return INDONESIAN_ZONES[offset];
  const sign = offset < 0 ? "-" : "+";
  const hours = Math.floor(Math.abs(offset) / 60), minutes = Math.abs(offset) % 60;
  return `GMT${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
}

/** "14:35 WITA": the device's clock time with its zone. */
export const clockTime = (date: Date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} ${zoneLabel(date)}`;
