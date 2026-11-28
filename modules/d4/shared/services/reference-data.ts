import type { ReferenceDataSnapshot } from "../types";

/** Data access stays behind this contract; feature modules do not import fixtures. */
export interface ReferenceDataRepository {
  loadReferenceData(): Promise<ReferenceDataSnapshot>;
}
