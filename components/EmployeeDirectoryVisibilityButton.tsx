"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setEmployeeDirectoryVisibility } from "@/app/employees/actions";

interface EmployeeDirectoryVisibilityButtonProps {
  employeeUuid: string;
  initiallyHidden: boolean;
}

export default function EmployeeDirectoryVisibilityButton({
  employeeUuid,
  initiallyHidden,
}: EmployeeDirectoryVisibilityButtonProps) {
  const router = useRouter();
  const [isHidden, setIsHidden] = useState(initiallyHidden);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    const action = isHidden ? "menampilkan kembali pegawai di Employee Directory" : "menyembunyikan pegawai dari Employee Directory";
    if (!window.confirm(`Yakin ingin ${action}?`)) return;
    setIsSubmitting(true);
    setMessage(null);

    const result = await setEmployeeDirectoryVisibility(employeeUuid, !isHidden);
    setIsSubmitting(false);
    setMessage(result.message);

    if (result.ok) {
      setIsHidden(!isHidden);
      router.refresh();
    }
  }

  return (
    <details className="relative flex flex-col items-stretch gap-1.5 sm:items-end">
      <summary className="inline-flex h-11 cursor-pointer list-none items-center justify-center rounded-[15px] border border-slate-300 bg-white px-4 text-sm font-bold text-[#1E3765] transition hover:border-[#155DFC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#155DFC]">⋯ Tindakan lainnya</summary>
      <div className="absolute right-0 top-12 z-10 min-w-64 rounded-xl border border-[#D9E2FC] bg-white p-2 shadow-lg">
        <button
        className={`inline-flex h-11 items-center justify-center rounded-[15px] border px-5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
          isHidden
            ? "border-[#16A37A] bg-[#ECFDF5] text-[#117A5A] hover:bg-[#DDF8EF]"
            : "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
        }`}
        disabled={isSubmitting}
        onClick={handleClick}
        type="button"
      >
        {isSubmitting
          ? "Menyimpan…"
          : isHidden
            ? "Tampilkan di Employee Directory"
            : "Sembunyikan dari Employee Directory"}
      </button>
      </div>
      {message && <p aria-live="polite" className={`max-w-72 text-right text-xs font-medium ${isHidden ? "text-[#117A5A]" : "text-rose-700"}`}>{message}</p>}
    </details>
  );
}
