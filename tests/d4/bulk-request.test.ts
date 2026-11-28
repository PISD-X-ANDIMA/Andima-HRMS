import { describe, expect, it } from "vitest";
import { addTrainingToNeeds, BULK_CHUNK } from "@/modules/d4/web/data/bulk";
import type { BulkTrainingItem, D4DataSource } from "@/modules/d4/web/data/source";

const needs = Array.from({ length: 45 }, (_, index) => ({ key: `need-${index}`, label: `Pegawai ${index}`, employeeId: `emp-${index}` }));
const training = { activity: "Uji", date: "2026-12-01", status: "Planned" as const, notes: "" };

/** A live source with only the bulk endpoint; `answer` decides each request. */
function source(answer: (items: readonly BulkTrainingItem[], call: number) => ReturnType<NonNullable<D4DataSource["bulkTraining"]>>) {
  const calls: (readonly BulkTrainingItem[])[] = [];
  return { calls, source: { bulkTraining: (items: readonly BulkTrainingItem[]) => { calls.push(items); return answer(items, calls.length); } } as unknown as D4DataSource };
}

describe("bulk training save through the bulk endpoint", () => {
  it("sends BULK_CHUNK rows per request and maps each result back to its row", async () => {
    const live = source(async (items) => items.map((item) => item.op === "create" && item.developmentNeedId === "need-3" ? { ok: false, message: "Sudah Completed." } : { ok: true }));
    const outcome = await addTrainingToNeeds(live.source, needs, training);
    expect(live.calls.map((items) => items.length)).toEqual([10, 10, 10, 10, 5]);
    expect(BULK_CHUNK).toBe(10);
    expect(live.calls[0][0]).toEqual({ op: "create", employeeId: "emp-0", developmentNeedId: "need-0", activity: "Uji", date: "2026-12-01", status: "Planned", result: "", notes: "" });
    expect(outcome.done).toHaveLength(44);
    expect(outcome.failed).toEqual([{ key: "need-3", label: "Pegawai 3", message: "Sudah Completed." }]);
  });

  it("reports the rows of a failed request after a saved one as not saved", async () => {
    const live = source(async (items, call) => { if (call === 2) throw new Error("Server terlalu lama merespons."); return items.map(() => ({ ok: true })); });
    const outcome = await addTrainingToNeeds(live.source, needs, training);
    expect(live.calls).toHaveLength(2);
    expect(outcome.done).toHaveLength(BULK_CHUNK);
    expect(outcome.failed).toHaveLength(45 - BULK_CHUNK);
    expect(outcome.failed[0]).toEqual({ key: `need-${BULK_CHUNK}`, label: `Pegawai ${BULK_CHUNK}`, message: "Server terlalu lama merespons." });
  });

  it("passes a failure of the first request on, so the form shows it as an error", async () => {
    const live = source(async () => { throw new Error("Tidak dapat terhubung ke server."); });
    await expect(addTrainingToNeeds(live.source, needs, training)).rejects.toThrow("Tidak dapat terhubung");
  });
});
