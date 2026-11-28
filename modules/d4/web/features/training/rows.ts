import type { TrainingVersion } from "../../../training/types";
import { trainingDecision, type Snapshot } from "../../data/selectors";

/**
 * Same rule as Development Requirement (interview 13 Nov 2026, 1:08:36): a training HR has nothing left to do on leaves
 * the default list; its record stays on its detail and history pages. That is a Completed training whose result is
 * decided, and a Cancelled one, whose requirement already asks for a new training. A Completed training still waiting
 * for HR's follow-up or reassessment stays listed.
 */
export const isTrainingArchived = (snapshot: Snapshot, record: TrainingVersion) =>
  record.status === "Cancelled" || (record.status === "Completed" && !trainingDecision(snapshot, record));
