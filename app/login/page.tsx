"use client";

import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthField, AuthLayout, AuthNotice, authInputClassName } from "@/components/auth/AuthLayout";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErrorMessage("Email atau password tidak valid.");
      setIsLoading(false);
      return;
    }

    router.replace("/employees");
    router.refresh();
  };

  return (
    <AuthLayout
      backgroundImage="/images/andima-login-warehouse.png"
      backgroundAlt="Aktivitas gudang PT Andima Transportindo"
      eyebrow="ANDIMA HRMS"
      title="Good Evening"
      description="Please sign in with your registered account to access the dashboard."
      footer={
        <>
          Not login?{" "}
          <Link href="/register" className="font-bold text-[#3b6ff5] underline-offset-4 hover:underline">
            Register
          </Link>
        </>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <AuthField htmlFor="email" label="Email / Username" icon={<Mail size={20} />}>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={isLoading}
              placeholder="Enter your registered email"
              className={authInputClassName}
            />
        </AuthField>

        <AuthField htmlFor="password" label="Password" icon={<LockKeyhole size={20} />}>
            <input
              id="password"
              type={isPasswordVisible ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={isLoading}
              placeholder="Enter your password"
              className={authInputClassName}
            />
            <button
              type="button"
              onClick={() => setIsPasswordVisible((visible) => !visible)}
              disabled={isLoading}
              className="shrink-0 rounded-full p-2 text-[#657286] transition hover:bg-[#eef2ff] hover:text-[#3b6ff5] focus:outline-none focus:ring-2 focus:ring-[#3b6ff5]/30 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={isPasswordVisible ? "Sembunyikan password" : "Tampilkan password"}
            >
              {isPasswordVisible ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
        </AuthField>

        {errorMessage && <AuthNotice>{errorMessage}</AuthNotice>}

        <button
          type="submit"
          disabled={isLoading}
          className="mt-2 flex h-14 w-full items-center justify-center rounded-[20px] bg-[#3b6ff5] px-6 text-sm font-extrabold tracking-[0.12em] text-white shadow-[0_12px_28px_rgba(59,111,245,0.35)] transition hover:bg-[#2e61e8] focus:outline-none focus:ring-4 focus:ring-[#3b6ff5]/25 disabled:cursor-wait disabled:opacity-60"
        >
          {isLoading ? "MEMPROSES..." : "LOGIN"}
        </button>
      </form>
    </AuthLayout>
  );
}
