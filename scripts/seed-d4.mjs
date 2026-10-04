#!/usr/bin/env node
// Seeds demo D4 records into the Supabase project configured in .env.local.
//
//   npm run seed:d4                     # dry run: prints what would be inserted
//   npm run seed:d4 -- --apply          # inserts
//
// Signs in as D4_SEED_EMAIL (an HR or MANAGER account) so every row passes RLS and the
// actor columns default to that user — the same path the app uses. Rows carry the
// "[seed-d4]" marker; an employee that already has a marked row is skipped, so the
// script can be re-run safely. Nothing is updated or deleted.
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { roleForPositionTitle } from "../modules/d4/kpi/catalog.ts";

const MARKER = "[seed-d4]";
const PERIOD = process.env.D4_SEED_PERIOD ?? new Date().toISOString().slice(0, 7);
const TODAY = new Date().toISOString().slice(0, 10);
const apply = process.argv.includes("--apply");

for (const file of [".env.local", ".env"]) if (existsSync(file)) process.loadEnvFile(file);
const { NEXT_PUBLIC_SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key, D4_SEED_EMAIL: email, D4_SEED_PASSWORD: password } = process.env;
if (!url || !key || !email || !password) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, D4_SEED_EMAIL and D4_SEED_PASSWORD in .env.local.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const take = ({ data, error }, step) => { if (error) throw new Error(`${step}: ${error.message}`); return data; };

const ASPECTS = [
  ["Work Quality", 20], ["Productivity", 15], ["Accuracy", 15], ["Team Collaboration", 15],
  ["Initiative & Growth", 10], ["Discipline", 15], ["Attendance", 10],
];
// Deterministic sample scores per employee slot; the raw 1–5 scores are chosen by the "evaluator", never derived.
const SAMPLES = [
  { aspects: [4, 4, 4, 4, 5, 4, 5], review: "On Track", kpi: [4, 5, 4, 3, 4] },
  { aspects: [3, 3, 4, 3, 3, 4, 4], review: "Needs Attention", kpi: [3, 3, 4, 3, 3] },
  { aspects: [4, 5, 4, 4, 4, 5, 4], review: "On Track", kpi: [5, 4, 4, 4, 5] },
];

async function main() {
  take(await supabase.auth.signInWithPassword({ email, password }), "Sign in");
  const { data: { user } } = await supabase.auth.getUser();
  const access = take(await supabase.from("d3_user_access").select("app_role,employee_id").eq("auth_user_id", user.id).maybeSingle(), "Read access");
  if (!access || !["HR", "MANAGER"].includes(access.app_role)) throw new Error("The seed account must have app_role HR or MANAGER in d3_user_access.");

  const [employees, positions, catalog, marked, actor] = await Promise.all([
    supabase.from("d3_employee").select("id,employee_id,full_name,position_id").not("position_id", "is", null).order("full_name").limit(SAMPLES.length),
    supabase.from("d3_positions").select("id,title"),
    supabase.from("d4_kpi_role_catalog").select("role_order,role_name,indicator_order,kpi_name,target,weight_percent,source_version").order("role_order").order("indicator_order"),
    supabase.from("d4_performance_evaluations").select("employee_id").like("general_notes", `%${MARKER}%`),
    supabase.from("d3_employee").select("full_name").eq("id", access.employee_id).maybeSingle(),
  ]).then((results) => results.map((result, index) => take(result, ["Employees", "Positions", "KPI catalog", "Existing seed", "Actor"][index])));

  const version = catalog.some((row) => row.source_version === "V5.1") ? "V5.1" : catalog[0]?.source_version ?? "V3.1";
  const rows = catalog.filter((row) => row.source_version === version);
  const roles = [...new Set(rows.map((row) => row.role_order))];
  const seeded = new Set(marked.map((row) => row.employee_id));
  const evaluator = actor?.full_name ?? "HR";
  console.log(`${apply ? "Applying" : "Dry run"} · period ${PERIOD} · KPI catalog ${version} (${roles.length} roles) · actor ${evaluator}`);

  for (const [index, employee] of employees.entries()) {
    const label = `${employee.full_name} (${employee.employee_id})`;
    if (seeded.has(employee.id)) { console.log(`- skip ${label}: already seeded`); continue; }
    const sample = SAMPLES[index];
    const position = positions.find((item) => item.id === employee.position_id);
    const aspects = ASPECTS.map(([name, weight], i) => ({ name, weight, score: sample.aspects[i], notes: "" }));
    const overall = Math.round(aspects.reduce((sum, item) => sum + item.weight * item.score, 0) / 100 * 100) / 100;
    // Same position → KPI role mapping as the scorecard form; unmapped positions fall back to a spread of roles.
    const roleOrder = roleForPositionTitle({ version, rows }, position?.title) || roles[(index * 3) % roles.length];
    const indicators = rows.filter((row) => row.role_order === roleOrder);
    console.log(`- ${label}: evaluation ${overall.toFixed(2)} · KPI role ${indicators[0]?.role_name} · development + training`);
    if (!apply) continue;

    const evaluationId = take(await supabase.from("d4_performance_evaluations").insert({
      employee_id: employee.id, position_id: position.id, position_title_snapshot: position.title,
      period: PERIOD, evaluation_date: TODAY, evaluator_name_snapshot: evaluator, status: "completed",
      review_status: sample.review, overall_score: overall, aspects,
      general_notes: `Evaluasi contoh untuk demo D4. ${MARKER}`, evidence_reference: null,
    }).select("id").single(), "Evaluation").id;

    take(await supabase.from("d4_kpi_assessments").insert({
      ...(version === "V3.1" ? {} : { definition_version: version }),
      employee_id: employee.id, role_order: roleOrder, role_name: indicators[0].role_name,
      period: PERIOD, evaluation_date: TODAY, evaluator_name: evaluator, status: "completed",
      lines: indicators.map((row, i) => ({
        indicator_order: row.indicator_order, kpi_name: row.kpi_name, weight_percent: row.weight_percent,
        target: row.target ?? "Sesuai target periode", actual: "Lihat laporan periode", raw_score: sample.kpi[i], comment: "",
      })),
      general_notes: `Scorecard contoh untuk demo D4. ${MARKER}`,
    }).select("id").single(), "KPI assessment");

    const needId = take(await supabase.rpc("d4_create_development_need", {
      p_employee_id: employee.id, p_source_type: "performance_context", p_source_ref: evaluationId,
      p_objective: "Perkuat ketelitian dokumen operasional", p_priority: index === 1 ? "High" : "Medium",
      p_notes: `Berdasarkan evaluasi ${PERIOD}. ${MARKER}`,
    }), "Development need");

    take(await supabase.rpc("d4_create_training_record", {
      p_employee_id: employee.id, p_development_need_id: needId,
      p_activity: "Workshop Akurasi Dokumen & Administrasi", p_activity_date: TODAY,
      p_status: "Planned", p_result: "", p_notes: MARKER,
    }), "Training");
  }
  if (!apply) console.log("Nothing written. Re-run with --apply to insert.");
  await supabase.auth.signOut();
}

main().catch((error) => { console.error(error.message); process.exit(1); });
