"use client";

import { ArrowRight, BriefcaseBusiness, RotateCcw, ShieldCheck, UserRound } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEMO_PERSONAS, createDemoSeed, type DemoPersona } from "./dataset";
import { resetState, writePersona } from "./storage";

const icons = { hr: ShieldCheck, manager: BriefcaseBusiness, employee: UserRound } as const;
const access: Record<DemoPersona["key"], string> = {
  hr: "Melihat seluruh karyawan, membuat dan merevisi semua catatan.",
  manager: "Menilai dan merencanakan pengembangan tim yang dipimpinnya.",
  employee: "Hanya melihat catatan miliknya sendiri (read-only).",
};

/** Demo replacement for the password form: pick a persona instead of signing in. No account, no network. */
export function DemoLogin() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const seed = createDemoSeed();
  const people = new Map(seed.reference.employees.map((employee) => [employee.id, employee]));
  const positions = new Map(seed.reference.positions.map((position) => [position.id, position.title]));

  function enter(key: DemoPersona["key"]) {
    setBusy(key);
    writePersona(key);
    router.replace("/dashboard");
  }

  return <main className="relative isolate min-h-dvh overflow-hidden bg-[#07111f] text-[#172033]">
    <Image src="/images/andima-login-warehouse.png" alt="" fill priority className="-z-20 object-cover object-center opacity-50" />
    <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(7,17,31,0.97),rgba(7,17,31,0.85)_55%,rgba(7,17,31,0.4))]" />
    <section className="flex min-h-dvh w-full items-center px-5 py-10 sm:px-10 lg:px-20">
      <div className="w-full max-w-2xl rounded-3xl border border-white/80 bg-white/90 p-7 shadow-[0_20px_50px_rgba(7,17,31,0.5)] backdrop-blur-2xl sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3b6ff5]">ANDIMA HRMS · Demo</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[#0d1b2a] sm:text-3xl">Pilih peran untuk mencoba</h1>
        <p className="mt-2 text-sm font-medium text-slate-600">
          Seluruh orang dan angka di demo ini <strong>fiktif</strong>. Perubahan yang Anda simpan hanya tersimpan di browser ini dan bisa dikembalikan kapan saja.
        </p>
        <ul className="mt-7 space-y-3">
          {DEMO_PERSONAS.map((persona) => {
            const Icon = icons[persona.key];
            const person = people.get(persona.employeeId);
            return <li key={persona.key}>
              <button type="button" onClick={() => enter(persona.key)} disabled={busy !== null}
                className="group flex w-full items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-[#3b6ff5] hover:shadow-[0_8px_25px_rgba(59,111,245,0.18)] focus:outline-none focus:ring-4 focus:ring-[#3b6ff5]/25 disabled:cursor-wait disabled:opacity-60">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[#3b6ff5]/10 text-[#3b6ff5]"><Icon aria-hidden="true" className="size-6" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold uppercase tracking-wider text-[#3b6ff5]">{persona.title}</span>
                  <strong className="block truncate text-base text-[#0d1b2a]">{person?.fullName ?? persona.employeeId}</strong>
                  <span className="block truncate text-xs text-slate-500">{positions.get(person?.positionId ?? "") ?? ""}</span>
                  <span className="mt-1 block text-xs text-slate-600">{access[persona.key]}</span>
                </span>
                <ArrowRight aria-hidden="true" className="size-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#3b6ff5]" />
              </button>
            </li>;
          })}
        </ul>
        <button type="button" onClick={() => { resetState(); setBusy(null); }} className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-[#3b6ff5]">
          <RotateCcw aria-hidden="true" className="size-3.5" />Kembalikan data demo ke kondisi awal
        </button>
      </div>
    </section>
  </main>;
}
