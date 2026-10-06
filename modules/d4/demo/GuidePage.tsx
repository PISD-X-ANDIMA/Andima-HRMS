"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useSnapshot } from "../web/data/D4DataProvider";
import { PageHeader } from "../web/ui/layout";
import { Card, Notice } from "../web/ui/primitives";
import { DEMO_LEVEL_SCALE, DEMO_PERSONAS } from "./dataset";

const FLOW: { step: string; menu: string; href: string; who: string; what: string; rules: string[] }[] = [
  {
    step: "1", menu: "Performance Evaluation", href: "/performance", who: "HR / Manager (atasan)",
    what: "Penilaian bulanan: satu nilai 1–5 (5 Sangat Baik … 1 Sangat Kurang) dan catatan evaluasi untuk satu karyawan pada satu periode (bulan).",
    rules: ["Evaluator otomatis = akun yang login; tidak bisa menilai diri sendiri.", "Satu catatan aktif per karyawan per bulan. Catatan kedua hanya boleh sebagai revisi dan wajib disertai alasan; versi lama tetap di riwayat.", "Nilai tidak otomatis menjadi keputusan HR (promosi, sanksi, dll)."],
  },
  {
    step: "2", menu: "KPI Scorecard", href: "/kpi", who: "HR / Manager",
    what: "Scorecard per kuartal memakai katalog KPI V5.1: setiap jabatan punya 5 indikator dengan bobot total 100%. Penilai mengisi target, realisasi dan skor 1–5 per indikator.",
    rules: ["KPI dipilih dari jabatan karyawan; jabatan yang tidak ada di katalog V5.1 memang tidak punya KPI.", "Skor akhir = Σ (bobot × skor) / 100. Skor tidak dihitung otomatis dari realisasi; penilai yang memutuskan.", "Revisi pada periode yang sama wajib beralasan."],
  },
  {
    step: "3", menu: "Competency Gap", href: "/competency", who: "HR / Manager",
    what: "Membandingkan level minimal kompetensi jabatan (ditetapkan D1) dengan level aktual karyawan beserta buktinya (dicatat D3).",
    rules: ["Level aktual < level minimal → Gap; selisihnya ditampilkan (−1, −2, …).", "Tidak ada data atau bukti → Data Belum Cukup, bukan Gap (BR-03.2).", "Kompetensi opsional ditampilkan tetapi tidak menentukan status keseluruhan.", "Save Assessment menyimpan snapshot; Assess Position Change menilai terhadap jabatan tujuan (mutasi/promosi)."],
  },
  {
    step: "4", menu: "Development Requirement", href: "/development", who: "HR / Manager",
    what: "Kebutuhan pengembangan dibuat manual dari salah satu sumber: baris Gap, penilaian perubahan jabatan, atau hasil evaluasi kinerja.",
    rules: ["Satu kebutuhan terbuka per baris Gap (mencegah duplikat).", "Status Identified → Planned → In Progress → Completed; setiap perubahan disimpan sebagai revisi. Mundur status wajib beralasan.", "Tidak pernah dibuat otomatis hanya karena ada gap."],
  },
  {
    step: "5", menu: "Training Tracking", href: "/training", who: "HR / Manager",
    what: "Mencatat pelatihan yang menjawab satu kebutuhan pengembangan terbuka milik karyawan yang sama.",
    rules: ["Completed wajib berisi hasil dan tidak boleh bertanggal di masa depan.", "Mundur status (mis. Completed → Planned) atau membatalkan wajib beralasan.", "Training selesai tidak mengubah level kompetensi otomatis: D3 memperbarui skill, lalu HR menilai ulang (tautan ‘Nilai ulang kompetensi’)."],
  },
  {
    step: "6", menu: "People Dashboard", href: "/dashboard", who: "Semua peran (sesuai cakupan)",
    what: "Ringkasan per karyawan: skor KPI dan evaluasi periode terpilih, status kompetensi saat ini, kebutuhan pengembangan terbuka dan progres training. Klik nama untuk profil lengkap.",
    rules: ["Hanya menampilkan data sumber; tidak membuat keputusan atau peringkat otomatis."],
  },
];

const ROLES: { role: string; sees: string; does: string }[] = [
  { role: "HR", sees: "Semua karyawan dan semua catatan.", does: "Membuat dan merevisi evaluasi, scorecard, assessment, development dan training (kecuali untuk dirinya sendiri)." },
  { role: "Manager", sees: "Hanya karyawan di departemennya.", does: "Sama seperti HR, terbatas pada timnya." },
  { role: "Employee", sees: "Hanya catatan miliknya sendiri.", does: "Read-only: memantau nilai, gap, rencana pengembangan dan training." },
];

const SQUADS: { squad: string; owns: string }[] = [
  { squad: "D1 · Position & Competency", owns: "Jabatan, daftar kompetensi per jabatan dan level minimalnya (1–5)." },
  { squad: "D3 · Employee 360° Profile", owns: "Data karyawan, level aktual kompetensi dan bukti (sertifikat, observasi)." },
  { squad: "D4 · Performance & Training", owns: "Evaluasi, KPI scorecard, perbandingan gap, kebutuhan pengembangan, training dan dashboard. D4 hanya membaca data D1 dan D3." },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <Card title={title}><div className="space-y-3 text-sm leading-6 text-ink-2">{children}</div></Card>;
}

export function GuidePage() {
  const snapshot = useSnapshot();
  const names = new Map(snapshot.reference.employees.map((item) => [item.id, item.fullName]));
  const counts = [
    ["Karyawan", snapshot.reference.employees.length], ["Jabatan", snapshot.reference.positions.length],
    ["Kompetensi", snapshot.reference.competencies.length], ["Evaluasi", snapshot.performance.length],
    ["Scorecard KPI", snapshot.kpiAssessments?.length ?? 0], ["Training (versi)", snapshot.trainingVersions.length],
  ] as const;

  return <>
    <PageHeader title="Panduan & Alur" subtitle="Cara kerja modul Performance & Training Development, aturan bisnisnya, dan cara mencobanya di demo ini." />
    <Notice>Semua orang, jabatan dan angka di demo ini fiktif. Perubahan yang Anda simpan hanya ada di browser ini; gunakan “Reset data demo” di menu kiri untuk kembali ke kondisi awal.</Notice>

    <Section title="Alur utama">
      <p>Siklus D4 berjalan dari penilaian ke pengembangan: <strong>Evaluasi & KPI</strong> menunjukkan kinerja, <strong>Competency Gap</strong> menunjukkan kemampuan yang belum memenuhi jabatan, keduanya menjadi sumber <strong>Development Requirement</strong>, yang dijawab dengan <strong>Training</strong>, dan semuanya terangkum di <strong>People Dashboard</strong>.</p>
      <ol className="space-y-4">
        {FLOW.map((item) => <li key={item.step} className="rounded-xl border border-line p-4">
          <p className="flex flex-wrap items-baseline gap-2"><span className="flex size-6 items-center justify-center rounded-full bg-primary-50 text-xs font-bold text-primary-600">{item.step}</span>
            <Link href={item.href} className="font-semibold text-primary-600 hover:underline">{item.menu}</Link><span className="text-xs text-ink-3">· {item.who}</span></p>
          <p className="mt-2 text-ink">{item.what}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">{item.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>
        </li>)}
      </ol>
    </Section>

    <div className="grid gap-6 xl:grid-cols-2">
      <Section title="Peran dan hak akses">
        <table className="w-full text-left text-sm"><thead className="text-xs uppercase text-ink-3"><tr><th className="py-2 pr-3">Peran</th><th className="py-2 pr-3">Melihat</th><th className="py-2">Bisa</th></tr></thead>
          <tbody>{ROLES.map((item) => <tr key={item.role} className="border-t border-line align-top"><td className="py-2 pr-3 font-semibold text-ink">{item.role}</td><td className="py-2 pr-3">{item.sees}</td><td className="py-2">{item.does}</td></tr>)}</tbody></table>
        <p>Persona demo: {DEMO_PERSONAS.map((persona, index) => <span key={persona.key}>{index > 0 && ", "}<strong>{names.get(persona.employeeId) ?? persona.employeeId}</strong> ({persona.title})</span>)}. Ganti lewat menu “Ganti peran”.</p>
      </Section>
      <Section title="Siapa memiliki data apa">
        <ul className="space-y-2">{SQUADS.map((item) => <li key={item.squad}><strong className="text-ink">{item.squad}</strong> — {item.owns}</li>)}</ul>
        <p className="text-xs text-ink-3">Di sistem nyata level minimal jabatan diisi Job Analyst/HR Admin di modul D1, dan level aktual diperbarui D3. Di demo, keduanya sudah terisi sebagai data contoh.</p>
      </Section>
    </div>

    <Section title="Skala level kompetensi (contoh)">
      <p>Database membatasi level 1–5. Definisi resmi tiap level belum ditetapkan D1; skala di bawah adalah contoh untuk demo.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {DEMO_LEVEL_SCALE.map((item) => <div key={item.level} className="rounded-xl border border-line p-3"><p className="font-display text-2xl text-primary-600">{item.level}</p><p className="font-semibold text-ink">{item.label}</p><p className="mt-1 text-xs">{item.description}</p></div>)}
      </div>
    </Section>

    <Section title="Skenario yang bisa dicoba">
      <ol className="list-decimal space-y-2 pl-5">
        <li>Sebagai <strong>HR</strong>, buka Competency Gap, pilih karyawan berstatus Gap, lalu klik <em>Create Development Requirement</em> pada baris gap.</li>
        <li>Buka Training Tracking, buat training untuk kebutuhan tersebut, lalu ubah kebutuhannya ke In Progress.</li>
        <li>Tandai training Completed (isi hasil), lalu gunakan <em>Nilai ulang kompetensi</em>: status gap tidak berubah sampai data skill diperbarui — itu disengaja.</li>
        <li>Buat KPI scorecard untuk periode yang sudah ada: sistem meminta menyimpan sebagai revisi dengan alasan.</li>
        <li>Ganti peran ke <strong>Manager</strong>: hanya anggota departemennya yang terlihat. Ganti ke <strong>Employee</strong>: hanya catatan sendiri, tanpa tombol simpan.</li>
      </ol>
    </Section>

    <Section title="Isi dataset demo">
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{counts.map(([label, value]) => <div key={label} className="rounded-xl bg-muted p-3"><dt className="text-xs text-ink-3">{label}</dt><dd className="font-display text-xl text-ink">{value}</dd></div>)}</dl>
    </Section>
  </>;
}
