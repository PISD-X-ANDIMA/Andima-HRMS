import { describe, expect, it } from "vitest";
import { clockTime, IDLE_LIMIT_MS, IDLE_WARNING_MS, idlePhase, zoneLabel } from "@/modules/d4/web/data/idle";

// Assistance session 21 Nov 2026: idle users are logged out with a notice, in their own zone (WIB, WITA, WIT).
const inZone = (offsetMinutes: number, hours = 14, minutes = 5) =>
  Object.assign(new Date(2026, 10, 24, hours, minutes), { getTimezoneOffset: () => -offsetMinutes });

describe("automatic logout after inactivity", () => {
  it("warns a minute before the limit and logs out at the limit", () => {
    const start = 1_000_000;
    expect(idlePhase(start + IDLE_LIMIT_MS - IDLE_WARNING_MS - 1, start)).toBe("active");
    expect(idlePhase(start + IDLE_LIMIT_MS - IDLE_WARNING_MS, start)).toBe("warning");
    expect(idlePhase(start + IDLE_LIMIT_MS - 1, start)).toBe("warning");
    expect(idlePhase(start + IDLE_LIMIT_MS, start)).toBe("expired");
    // A laptop that slept for hours is past the limit the moment it wakes.
    expect(idlePhase(start + 5 * IDLE_LIMIT_MS, start)).toBe("expired");
  });

  it("names the three Indonesian zones and falls back to the UTC offset elsewhere", () => {
    expect(zoneLabel(inZone(420))).toBe("WIB");
    expect(zoneLabel(inZone(480))).toBe("WITA");
    expect(zoneLabel(inZone(540))).toBe("WIT");
    expect(zoneLabel(inZone(120))).toBe("GMT+2");
    expect(zoneLabel(inZone(-210))).toBe("GMT-3:30");
    expect(zoneLabel(inZone(0))).toBe("GMT+0");
  });

  it("writes the clock time with its zone", () => {
    expect(clockTime(inZone(480, 9, 5))).toBe("09:05 WITA");
  });
});
