"use client";

import { Eye, EyeOff, LockKeyhole, Mail, Phone, UserRound } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthField, AuthLayout, AuthNotice, authInputClassName } from "@/components/auth/AuthLayout";

export default function RegisterPage() {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("Registrasi mandiri belum diaktifkan. Akun HRMS disiapkan oleh administrator.");
  }

  return (
    <AuthLayout
      backgroundImage="/images/andima-register-warehouse.png"
      backgroundAlt="Area operasional PT Andima Transportindo"
      eyebrow="PT ANDIMA TRANSPORTINDO"
      title="Register Account"
      description="Complete the account information below. Account activation remains managed by the HRMS administrator."
      wide
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-[#3b6ff5] underline-offset-4 hover:underline">
            Login
          </Link>
        </>
      }
    >
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        <AuthField htmlFor="fullName" label="Full Name" icon={<UserRound size={20} />}>
          <input id="fullName" name="fullName" autoComplete="name" placeholder="Enter full name" className={authInputClassName} />
        </AuthField>

        <AuthField htmlFor="email" label="Email Address" icon={<Mail size={20} />}>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="name@email.com" className={authInputClassName} />
        </AuthField>

        <AuthField htmlFor="username" label="Username" icon={<UserRound size={20} />}>
          <input id="username" name="username" autoComplete="username" placeholder="Enter username" className={authInputClassName} />
        </AuthField>

        <AuthField htmlFor="phone" label="Phone Number" icon={<Phone size={20} />}>
          <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="Enter phone number" className={authInputClassName} />
        </AuthField>

        <div className="sm:col-span-2">
          <AuthField htmlFor="registerPassword" label="Password" icon={<LockKeyhole size={20} />}>
            <input
              id="registerPassword"
              name="password"
              type={isPasswordVisible ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Enter password"
              className={authInputClassName}
            />
            <button
              type="button"
              onClick={() => setIsPasswordVisible((visible) => !visible)}
              className="shrink-0 rounded-full p-2 text-[#657286] transition hover:bg-[#eef2ff] hover:text-[#3b6ff5] focus:outline-none focus:ring-2 focus:ring-[#3b6ff5]/30"
              aria-label={isPasswordVisible ? "Sembunyikan password" : "Tampilkan password"}
            >
              {isPasswordVisible ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </AuthField>
        </div>

        {notice && (
          <div className="sm:col-span-2">
            <AuthNotice tone="info">{notice}</AuthNotice>
          </div>
        )}

        <button
          type="submit"
          className="mt-2 flex h-14 w-full items-center justify-center rounded-[20px] bg-[#3b6ff5] px-6 text-sm font-extrabold tracking-[0.12em] text-white shadow-[0_12px_28px_rgba(59,111,245,0.35)] transition hover:bg-[#2e61e8] focus:outline-none focus:ring-4 focus:ring-[#3b6ff5]/25 sm:col-span-2"
        >
          REGISTER
        </button>
      </form>
    </AuthLayout>
  );
}
