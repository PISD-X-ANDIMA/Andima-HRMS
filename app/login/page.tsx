// "use client";

// import { FormEvent, useState } from "react";
// import { useRouter } from "next/navigation";
// import CustomButton from "@/components/CustomButton";
// import { createClient } from "@/utils/supabase/client";

// export default function LoginPage() {
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [errorMessage, setErrorMessage] = useState<string | null>(null);
//   const [isLoading, setIsLoading] = useState(false);
//   const router = useRouter();

//   const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
//     event.preventDefault();
//     setErrorMessage(null);
//     setIsLoading(true);

//     const supabase = createClient();
//     const { error } = await supabase.auth.signInWithPassword({ email, password });

//     if (error) {
//       setErrorMessage("Email atau password tidak valid.");
//       setIsLoading(false);
//       return;
//     }

//     router.replace("/employees");
//     router.refresh();
//   };

//   return (
//     <main className="flex min-h-screen items-center justify-center bg-neutral-100 p-6 font-sans">
//       <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xs">
//         <h1 className="text-2xl font-bold text-slate-900">Masuk HRMS</h1>
//         <p className="mt-2 text-slate-600">Gunakan akun yang sudah disiapkan oleh administrator.</p>

//         <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
//           <div>
//             <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="email">
//               Email
//             </label>
//             <input
//               id="email"
//               type="email"
//               autoComplete="email"
//               value={email}
//               onChange={(event) => setEmail(event.target.value)}
//               required
//               className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
//             />
//           </div>

//           <div>
//             <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="password">
//               Password
//             </label>
//             <input
//               id="password"
//               type="password"
//               autoComplete="current-password"
//               value={password}
//               onChange={(event) => setPassword(event.target.value)}
//               required
//               className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-slate-900 outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900"
//             />
//           </div>

//           {errorMessage && (
//             <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
//               {errorMessage}
//             </p>
//           )}

//           <CustomButton type="submit" disabled={isLoading}>
//             {isLoading ? "Memproses..." : "Masuk"}
//           </CustomButton>
//         </form>
//       </section>
//     </main>
//   );
// }



"use client";

import React, {
  useState,
  useEffect,
  FormEvent,
  ChangeEvent,
} from "react";

import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [errorMessage, setErrorMessage] = useState<string>("");
  const [successMessage, setSuccessMessage] = useState<string>("");

  const [loginAttempts, setLoginAttempts] = useState<number>(0);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isPermanentlyBlocked, setIsPermanentlyBlocked] =
    useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [greeting, setGreeting] = useState<string>("Good Morning");

  const router = useRouter();

  useEffect(() => {
    const hour = new Date().getHours();

    if (hour >= 3 && hour < 12) {
      setGreeting("Good Morning");
    } else if (hour >= 12 && hour < 17) {
      setGreeting("Good Afternoon");
    } else {
      setGreeting("Good Evening");
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    if (isLocked && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (
      countdown === 0 &&
      isLocked &&
      !isPermanentlyBlocked
    ) {
      setIsLocked(false);
      setErrorMessage("");
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [isLocked, countdown, isPermanentlyBlocked]);

  const validateEmailFormat = (emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  const validatePasswordStrength = (passwordValue: string): boolean => {
    const hasLetter = /[a-zA-Z]/.test(passwordValue);
    const hasDigit = /\d/.test(passwordValue);
    const hasSpecial = /[^a-zA-Z0-9]/.test(passwordValue);

    return (
      passwordValue.length >= 10 &&
      hasLetter &&
      hasDigit &&
      hasSpecial
    );
  };

  const handleFailedAttempt = (customMessage: string) => {
    const newAttempts = loginAttempts + 1;

    setLoginAttempts(newAttempts);

    if (newAttempts >= 5) {
      setIsLocked(true);
      setIsPermanentlyBlocked(true);

      setErrorMessage(
        "Your account has been blocked. Please contact the IT administrator."
      );
    } else if (newAttempts === 4) {
      setErrorMessage(
        `${customMessage} Warning: 1 more failed attempt will block your account!`
      );
    } else if (newAttempts === 3) {
      setIsLocked(true);
      setCountdown(30);

      setErrorMessage(
        "Too many failed login attempts (3/5). Please wait 30 seconds before trying again."
      );
    } else {
      setErrorMessage(
        `${customMessage} (Remaining attempts: ${5 - newAttempts})`
      );
    }
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    if (isLocked || isPermanentlyBlocked || isLoading) {
      return;
    }

    if (!email.trim() || !password.trim()) {
      setErrorMessage("Email and Password are required.");
      return;
    }

    if (!validateEmailFormat(email)) {
      setErrorMessage(
        "Invalid email format (example: name@andima.co.id)."
      );
      return;
    }


    setIsLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        handleFailedAttempt("Email atau password tidak valid.");
        setIsLoading(false);
        return;
      }

      setLoginAttempts(0);

      setSuccessMessage(
        "Login successful! Redirecting to Management Dashboard..."
      );

      setTimeout(() => {
        router.replace("/employees");
        router.refresh();
      }, 1000);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        "Terjadi kesalahan saat menghubungkan ke server."
      );

      setIsLoading(false);
    }
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#07111F] text-[#0D1B2A] selection:bg-[#3B6FF5] selection:text-white font-[family-name:var(--font-montserrat)]">

      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1578575437130-527eed3abbec?q=80&w=1600&auto=format&fit=crop"
          alt="Cargo Ship Logistics"
          className="w-full h-full object-cover object-right opacity-60"
        />

        <div className="absolute inset-0 bg-gradient-to-r from-[#0D1B2A] via-[#0D1B2A]/85 via-40% to-transparent pointer-events-none" />

        <div className="absolute inset-0 bg-gradient-to-t from-[#07111F] via-transparent to-transparent pointer-events-none" />
      </div>

      <div className="absolute -top-20 -left-20 w-96 h-96 bg-[#18C7C0]/30 rounded-full blur-3xl pointer-events-none z-0" />

      <div className="absolute -bottom-20 left-1/3 w-96 h-96 bg-[#3B6FF5]/30 rounded-full blur-3xl pointer-events-none z-0" />

      <div className="hidden md:flex absolute top-1/2 -translate-y-1/2 right-8 lg:right-16 xl:right-24 z-20 pointer-events-none flex-col items-end text-right max-w-lg">

        <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center text-white font-bold shadow-xl shadow-[#3B6FF5]/30 bg-[#3B6FF5] shrink-0 mb-4">

          <svg
            className="w-8 h-8 lg:w-9 lg:h-9 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364-1.457-2.823-1.07-4"
            />
          </svg>
        </div>

        <h1 className="font-[family-name:var(--font-syne)] text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-wider text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)] leading-tight">
          PT. ANDIMA
          <br />
          <span className="font-[family-name:var(--font-syne)] text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-wider text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)] leading-tight">
            TRANSPORTINDO
          </span>
        </h1>
      </div>

      <div className="relative z-10 h-full w-full flex items-center justify-start px-6 sm:px-12 lg:px-20">

        <div className="w-full max-w-xl">

          <div className="p-8 sm:p-11 rounded-3xl bg-gradient-to-b from-white/85 via-white/70 to-white/60 backdrop-blur-2xl border border-white/80 shadow-[0_20px_50px_rgba(7,17,31,0.5),inset_0_2px_4px_rgba(255,255,255,0.9)] relative overflow-hidden">

            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-gradient-to-b from-white/80 to-transparent blur-md pointer-events-none rounded-full" />

            <div className="mb-7 text-left relative z-10">

              <h2 className="font-[family-name:var(--font-syne)] text-xl sm:text-2xl font-bold text-[#0D1B2A] tracking-tight">
                {greeting},
              </h2>

              <p className="font-[family-name:var(--font-montserrat)] text-sm text-[#334155] mt-1.5 font-medium">
                Please sign in with your registered account to access the dashboard.
              </p>

            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-6 font-[family-name:var(--font-montserrat)] relative z-10"
              noValidate
            >

              <div>

                <label
                  className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-2.5"
                  htmlFor="email"
                >
                  Username
                </label>

                <input
                  id="email"
                  type="email"
                  placeholder="manajemen@andima.co.id"
                  value={email}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setEmail(event.target.value)
                  }
                  disabled={
                    isLocked ||
                    isPermanentlyBlocked ||
                    isLoading
                  }
                  autoComplete="email"
                  className="w-full px-4.5 py-3.5 rounded-xl bg-white/70 backdrop-blur-md text-[#0D1B2A] placeholder-[#64748B] text-sm focus:outline-none transition-all disabled:opacity-50 border border-white/90 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] focus:bg-white focus:border-[#3B6FF5] focus:ring-2 focus:ring-[#3B6FF5]/30 font-medium"
                />

              </div>

              <div>

                <label
                  className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-2.5"
                  htmlFor="password"
                >
                  Password
                </label>

                <div className="relative">

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setPassword(event.target.value)
                    }
                    disabled={
                      isLocked ||
                      isPermanentlyBlocked ||
                      isLoading
                    }
                    autoComplete="current-password"
                    className="w-full pl-4.5 pr-12 py-3.5 rounded-xl bg-white/70 backdrop-blur-md text-[#0D1B2A] placeholder-[#64748B] text-sm focus:outline-none transition-all disabled:opacity-50 border border-white/90 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] focus:bg-white focus:border-[#3B6FF5] focus:ring-2 focus:ring-[#3B6FF5]/30 font-medium"
                  />

                  <button
                    type="button"
                    onMouseDown={() => setShowPassword(true)}
                    onMouseUp={() => setShowPassword(false)}
                    onMouseLeave={() => setShowPassword(false)}
                    onTouchStart={() => setShowPassword(true)}
                    onTouchEnd={() => setShowPassword(false)}
                    disabled={
                      isLocked ||
                      isPermanentlyBlocked ||
                      isLoading
                    }
                    tabIndex={-1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#3B6FF5] p-1 transition-colors disabled:opacity-50"
                  >

                    {showPassword ? (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />

                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.8}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908A8.982 8.982 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21M3 3l18 18"
                        />
                      </svg>
                    )}

                  </button>

                </div>

              </div>

              {errorMessage && (
                <div className="p-4 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-xs sm:text-sm flex items-center gap-2.5 font-semibold backdrop-blur-md">

                  <svg
                    className="w-5 h-5 shrink-0 fill-current"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
                  </svg>

                  <span>{errorMessage}</span>

                </div>
              )}

              {successMessage && (
                <div className="p-4 rounded-xl bg-[#059669]/10 border border-[#059669]/30 text-[#059669] text-xs sm:text-sm flex items-center gap-2.5 font-semibold backdrop-blur-md">

                  <svg
                    className="w-5 h-5 shrink-0 fill-current"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>

                  <span>{successMessage}</span>

                </div>
              )}

              <button
                type="submit"
                disabled={
                  isLocked ||
                  isPermanentlyBlocked ||
                  isLoading
                }
                className="w-full py-4 px-5 text-white font-extrabold rounded-xl text-sm tracking-wider uppercase transition-all mt-2 disabled:opacity-50 bg-[#3B6FF5] hover:bg-[#2B5CE5] shadow-[0_8px_25px_rgba(59,111,245,0.4)] active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed font-[family-name:var(--font-montserrat)]"
              >

                {isPermanentlyBlocked
                  ? "ACCOUNT BLOCKED"
                  : isLoading
                  ? "SIGNING IN..."
                  : isLocked
                  ? `Please wait ${countdown}s`
                  : "LOGIN"}

              </button>

            </form>

          </div>

        </div>

      </div>

    </main>
  );
}

