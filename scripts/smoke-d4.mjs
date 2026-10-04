#!/usr/bin/env node
// Smoke test for the 14 D4 route files under app/api/d4 (12 GET + 7 POST endpoints).
//
//   npm run smoke:d4                    # read-only: every GET, per role
//   npm run smoke:d4 -- --probe         # + POST "{}" per role: EMPLOYEE 403, HR/MANAGER 422 (nothing is written)
//   npm run smoke:d4 -- --write         # + real POSTs as HR/MANAGER (201) — WRITES records marked "[smoke-d4]"
//
// The API reads the Supabase session from cookies only (no Bearer token). Log in with each test
// account in a browser, copy the full `Cookie` request header of any /api/d4 call, and put it in
// D4_SMOKE_COOKIE_HR / _MANAGER / _EMPLOYEE (env or .env.local). Roles without a cookie are skipped.
// Never commit cookie values: they are live session tokens.
import { existsSync } from "node:fs";

for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);

const BASE_URL = (process.env.D4_SMOKE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const ROLES = ["HR", "MANAGER", "EMPLOYEE"];
const MARKER = "[smoke-d4]";
const write = process.argv.includes("--write");
const probe = write || process.argv.includes("--probe");
const TODAY = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10); // WIB, like the app
const NO_ID = "00000000-0000-4000-8000-000000000000";

const results = [];

async function call(cookie, method, path, body) {
  const headers = { accept: "application/json" };
  if (cookie) headers.cookie = cookie;
  if (body !== undefined) headers["content-type"] = "application/json";
  try {
    const response = await fetch(BASE_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
    const json = await response.json().catch(() => null);
    return { status: response.status, data: json?.data, error: json?.error?.message };
  } catch (error) {
    return { status: 0, error: error.cause?.code ?? error.message };
  }
}

async function check(role, cookie, method, path, expected, body) {
  const result = await call(cookie, method, path, body);
  const pass = result.status === expected;
  results.push({ role, method, path, expected, actual: result.status, verdict: pass ? "PASS" : "FAIL", note: pass ? "" : (result.error ?? "") });
  return result;
}

function skip(role, method, path, expected, note) {
  results.push({ role, method, path, expected, actual: "-", verdict: "SKIP", note });
}

/** Every GET endpoint. Detail ids come from the first row of the matching list. */
async function readAll(role, cookie) {
  const me = (await check(role, cookie, "GET", "/api/d4/me", 200)).data;
  const snapshot = (await check(role, cookie, "GET", "/api/d4/snapshot", 200)).data;
  await check(role, cookie, "GET", "/api/d4/kpi-catalog", 200);

  const lists = [
    ["performance-evaluations", true],
    ["kpi-assessments", true],
    ["competency-assessments", false],
    ["development-needs", true],
    ["training-records", true],
  ];
  for (const [resource, hasDetail] of lists) {
    const rows = (await check(role, cookie, "GET", `/api/d4/${resource}`, 200)).data ?? [];
    if (!hasDetail) continue;
    const first = rows[0];
    const id = first?.needId ?? first?.trainingId ?? first?.id;
    if (id) await check(role, cookie, "GET", `/api/d4/${resource}/${id}`, 200);
    else skip(role, "GET", `/api/d4/${resource}/[id]`, 200, "list kosong");
  }
  return { me, snapshot };
}

const POSTS = [
  "/api/d4/performance-evaluations",
  "/api/d4/kpi-assessments",
  "/api/d4/competency-assessments",
  "/api/d4/development-needs",
  `/api/d4/development-needs/${NO_ID}/versions`,
  "/api/d4/training-records",
  `/api/d4/training-records/${NO_ID}/versions`,
];

/** POST "{}" — the role check runs before validation, so this never writes anything. */
async function probeAll(role, cookie) {
  const expected = role === "EMPLOYEE" ? 403 : 422;
  for (const path of POSTS) await check(role, cookie, "POST", path, expected, {});
}

/** Latest record per employee and period, the same rule the API uses for `revisionOf`. */
const latestFor = (records, employeeId, period) => records
  .filter((item) => item.employeeId === employeeId && item.period === period)
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

/** Real writes as HR/MANAGER. Performance and KPI are saved as revisions with the same values. */
async function writeAll(role, cookie, me, snapshot) {
  const self = me?.employee?.id;
  const notSelf = (item) => item.employeeId !== self;

  const evaluation = snapshot.performance.find((item) => notSelf(item) && item.status === "completed");
  if (evaluation) {
    const latest = latestFor(snapshot.performance, evaluation.employeeId, evaluation.period);
    await check(role, cookie, "POST", "/api/d4/performance-evaluations", 201, {
      status: "completed", employeeId: latest.employeeId, period: latest.period, evaluationDate: TODAY,
      overallScore: Math.min(5, Math.max(1, Math.round(latest.overallScore ?? 3))),
      generalNotes: `${MARKER} revisi uji smoke (skor dibulatkan ke bilangan bulat).`, revisionOf: latest.id,
    });
  } else skip(role, "POST", "/api/d4/performance-evaluations", 201, "tidak ada evaluasi employee lain");

  const scorecard = (snapshot.kpiAssessments ?? []).find(notSelf);
  if (scorecard) {
    const latest = latestFor(snapshot.kpiAssessments, scorecard.employeeId, scorecard.period);
    await check(role, cookie, "POST", "/api/d4/kpi-assessments", 201, {
      status: "completed", employeeId: latest.employeeId, roleOrder: latest.roleOrder, period: latest.period,
      evaluationDate: TODAY, generalNotes: MARKER, revisionOf: latest.id,
      lines: latest.lines.map(({ kpi_name, target, actual, raw_score }) => ({ kpi_name, target, actual, raw_score, comment: MARKER })),
    });
  } else skip(role, "POST", "/api/d4/kpi-assessments", 201, "tidak ada scorecard employee lain");

  const employee = snapshot.reference.employees.find((item) => item.id !== self && item.positionId);
  if (employee) {
    await check(role, cookie, "POST", "/api/d4/competency-assessments", 201, { employeeId: employee.id, positionId: employee.positionId, effectiveDate: TODAY });
  } else skip(role, "POST", "/api/d4/competency-assessments", 201, "tidak ada employee dengan posisi");

  let needId = null;
  if (evaluation) {
    const created = await check(role, cookie, "POST", "/api/d4/development-needs", 201, {
      employeeId: evaluation.employeeId, sourceType: "performance_context", sourceRef: evaluation.id,
      objective: `${MARKER} kebutuhan uji smoke`, priority: "Low", notes: MARKER,
    });
    needId = created.data?.id ?? null;
  } else skip(role, "POST", "/api/d4/development-needs", 201, "tidak ada evaluasi completed");

  if (needId) {
    await check(role, cookie, "POST", `/api/d4/development-needs/${needId}/versions`, 201, { status: "Identified", notes: MARKER });
    const created = await check(role, cookie, "POST", "/api/d4/training-records", 201, {
      employeeId: evaluation.employeeId, developmentNeedId: needId, activity: `${MARKER} training uji`, date: TODAY, status: "Planned", result: "", notes: MARKER,
    });
    const trainingId = created.data?.id;
    if (trainingId) await check(role, cookie, "POST", `/api/d4/training-records/${trainingId}/versions`, 201, { status: "Planned", result: "", notes: MARKER });
    else skip(role, "POST", "/api/d4/training-records/[id]/versions", 201, "training gagal dibuat");
  } else {
    for (const path of ["/api/d4/development-needs/[id]/versions", "/api/d4/training-records", "/api/d4/training-records/[id]/versions"]) skip(role, "POST", path, 201, "development need gagal dibuat");
  }
}

async function main() {
  console.log(`D4 smoke → ${BASE_URL}  mode: ${write ? "write" : probe ? "probe" : "read-only"}\n`);
  await check("ANON", null, "GET", "/api/d4/me", 401);

  for (const role of ROLES) {
    const cookie = process.env[`D4_SMOKE_COOKIE_${role}`];
    if (!cookie) { skip(role, "*", "/api/d4/*", "-", `D4_SMOKE_COOKIE_${role} kosong`); continue; }
    const { me, snapshot } = await readAll(role, cookie);
    if (me && me.role !== role) results.push({ role, method: "GET", path: "/api/d4/me (role)", expected: role, actual: me.role, verdict: "FAIL", note: "cookie bukan untuk role ini" });
    if (!probe) continue;
    if (role === "EMPLOYEE" || !write) await probeAll(role, cookie);
    else if (snapshot) await writeAll(role, cookie, me, snapshot);
    else skip(role, "POST", "/api/d4/*", 201, "snapshot gagal dibaca");
  }

  console.table(results);
  const failed = results.filter((item) => item.verdict === "FAIL").length;
  const passed = results.filter((item) => item.verdict === "PASS").length;
  console.log(`\n${passed} PASS, ${failed} FAIL, ${results.length - passed - failed} SKIP`);
  process.exitCode = failed ? 1 : 0;
}

await main();
