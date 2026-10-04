import type { D4LiveSnapshot } from "../supabase/types";
import { createLocalSource } from "../web/data/fixture-source";
import type { D4DataSource } from "../web/data/source";
import { createDemoSeed, DEMO_PERSONAS } from "./dataset";
import { readPersonaKey, readState, writeState } from "./storage";

type StoredRecords = Omit<D4LiveSnapshot, "role" | "actorEmployeeId">;

/**
 * Public demo source: the large fictional dataset plus the visitor's own changes, saved in their browser.
 * The persona picked on the login page decides the role and the signed-in employee; records are shared
 * between personas, so a scorecard saved as HR is what the employee persona then sees.
 */
export function createDemoSource(): D4DataSource {
  // No persona chosen yet (direct link to a page): start as HR, who can see every screen.
  const persona = DEMO_PERSONAS.find((item) => item.key === readPersonaKey()) ?? DEMO_PERSONAS[0];
  const records = readState<StoredRecords>() ?? createDemoSeed();
  const initial: D4LiveSnapshot = { ...records, role: persona.role, actorEmployeeId: persona.employeeId };
  return createLocalSource({
    mode: "demo",
    initial,
    persist: (state) => {
      const { role: _role, actorEmployeeId: _actor, ...rest } = state;
      void _role; void _actor;
      writeState(rest);
    },
  });
}
