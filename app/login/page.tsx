// "use client";

// import React, { useState, useEffect, FormEvent } from "react";
// import Image from "next/image";
// import Link from "next/link";
// import { useRouter } from "next/navigation";
// import { Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
// import { createClient } from "@/utils/supabase/client";
// import Logo from "@/components/image/Logo.png";

// export default function LoginPage() {
//   const router = useRouter();
//   const [email, setEmail] = useState("");
//   const [password, setPassword] = useState("");
//   const [showPassword, setShowPassword] = useState(false);
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [errorMessage, setErrorMessage] = useState<string | null>(null);
//   const [successMessage, setSuccessMessage] = useState<string | null>(null);
//   const [greeting, setGreeting] = useState("Good Evening");
//   const [copiedDemo, setCopiedDemo] = useState(false);

//   useEffect(() => {
//     // Dynamic greeting based on current local hour
//     const hour = new Date().getHours();
//     if (hour >= 5 && hour < 12) {
//       setGreeting("Good Morning");
//     } else if (hour >= 12 && hour < 17) {
//       setGreeting("Good Afternoon");
//     } else {
//       setGreeting("Good Evening");
//     }

//     // Check if user is already logged in, redirect to /kanban
//     try {
//       const supabase = createClient();
//       supabase.auth.getUser().then(({ data: { user } }) => {
//         if (user) {
//           router.replace("/kanban");
//         }
//       });
//     } catch {
//       // Ignore if Supabase not ready
//     }
//   }, [router]);

//   const handleFillDemo = () => {
//     setEmail("Manajemen@Andima.co.id");
//     setPassword("Manajemen123!@#");
//     setErrorMessage(null);
//     setCopiedDemo(true);
//     setTimeout(() => setCopiedDemo(false), 2000);
//   };

//   const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
//     e.preventDefault();
//     setErrorMessage(null);
//     setSuccessMessage(null);

//     const trimmedEmail = email.trim();
//     const trimmedPassword = password.trim();

//     if (!trimmedEmail || !trimmedPassword) {
//       setErrorMessage("Email/Username dan password wajib diisi.");
//       return;
//     }

//     // Support entering username 'manajemen' or full email
//     const normalizedEmail = trimmedEmail.includes("@")
//       ? trimmedEmail.toLowerCase()
//       : `${trimmedEmail.toLowerCase()}@andima.co.id`;

//     setIsSubmitting(true);

//     try {
//       const supabase = createClient();
//       const { data, error } = await supabase.auth.signInWithPassword({
//         email: normalizedEmail,
//         password: trimmedPassword,
//       });

//       if (error || !data.user) {
//         setErrorMessage("Email atau password tidak sesuai. Silakan periksa kembali kredensial Anda.");
//         setIsSubmitting(false);
//         return;
//       }

//       setSuccessMessage("Login berhasil! Mengalihkan ke halaman Kanban...");

//       // Direct to Kanban as specified: "login akan direct ke halaman kanban."
//       setTimeout(() => {
//         window.location.href = "/kanban";
//       }, 500);
//     } catch {
//       setErrorMessage("Terjadi kendala koneksi ke server. Silakan coba lagi.");
//       setIsSubmitting(false);
//     }
//   };

//   return (
//     <main className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 md:p-10 bg-[#0a1222] overflow-x-hidden font-sans">
//       {/* Background Image with Warehouse Atmosphere */}
//       <div className="absolute inset-0 z-0">
//         <Image
//           src="/images/warehouse-bg.jpg"
//           alt="PT Andima Transportindo Warehouse"
//           fill
//           priority
//           sizes="100vw"
//           className="object-cover object-center"
//         />
//         {/* Dark Industrial Tint Overlay matching reference image */}
//         <div className="absolute inset-0 bg-[#061022]/70 backdrop-blur-[1px]" />
//       </div>

//       {/* Main Container: Flex with Card on Left/Center & Logo on Right */}
//       <div className="relative z-10 w-full max-w-5xl flex flex-col lg:flex-row items-center justify-center lg:justify-between gap-10 lg:gap-14 py-6">
//         {/* ========================================================= */}
//         {/* LEFT / CENTER: Frosted Glass Login Card                   */}
//         {/* ========================================================= */}
//         <div className="w-full max-w-[430px] rounded-[32px] bg-white/80 md:bg-white/85 backdrop-blur-xl p-7 sm:p-9 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/60 text-slate-800 animate-in fade-in zoom-in-95 duration-200">
//           {/* Header */}
//           <div className="mb-6">
//             <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
//               {greeting}
//             </h1>
//             <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed">
//               Please sign in with your registered account to access the dashboard
//             </p>
//           </div>

//           {/* Form */}
//           <form onSubmit={handleSubmit} noValidate className="space-y-4">
//             {/* Field 1: Email / Username */}
//             <div>
//               <label
//                 htmlFor="login-email"
//                 className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1.5"
//               >
//                 Email / Username
//               </label>
//               <input
//                 id="login-email"
//                 type="text"
//                 value={email}
//                 onChange={(e) => setEmail(e.target.value)}
//                 placeholder="Enter email or username..."
//                 autoComplete="username"
//                 disabled={isSubmitting}
//                 className="w-full h-12 px-4 rounded-2xl bg-white border border-slate-200/90 shadow-[inset_0_1px_3px_rgba(0,0,0,0.04)] text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all disabled:opacity-60"
//               />
//             </div>

//             {/* Field 2: Password */}
//             <div>
//               <label
//                 htmlFor="login-password"
//                 className="block text-xs sm:text-sm font-semibold text-slate-800 mb-1.5"
//               >
//                 Password
//               </label>
//               <div className="relative w-full">
//                 <input
//                   id="login-password"
//                   type={showPassword ? "text" : "password"}
//                   value={password}
//                   onChange={(e) => setPassword(e.target.value)}
//                   placeholder="Enter password..."
//                   autoComplete="current-password"
//                   disabled={isSubmitting}
//                   className="w-full h-12 px-4 pr-11 rounded-2xl bg-white border border-slate-200/90 shadow-[inset_0_1px_3px_rgba(0,0,0,0.04)] text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all disabled:opacity-60"
//                 />
//                 <button
//                   type="button"
//                   onClick={() => setShowPassword((prev) => !prev)}
//                   tabIndex={-1}
//                   disabled={isSubmitting}
//                   className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-700 hover:text-slate-900 transition-colors p-1"
//                   aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
//                 >
//                   {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
//                 </button>
//               </div>
//             </div>

//             {/* Error Notification */}
//             {errorMessage && (
//               <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2 animate-in fade-in duration-150">
//                 <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
//                 <span>{errorMessage}</span>
//               </div>
//             )}

//             {/* Success Notification */}
//             {successMessage && (
//               <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 animate-in fade-in duration-150">
//                 <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
//                 <span>{successMessage}</span>
//               </div>
//             )}

//             {/* Submit Button */}
//             <button
//               type="submit"
//               disabled={isSubmitting}
//               className="w-full h-12 rounded-xl bg-[#2563eb] hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm tracking-wider uppercase shadow-md shadow-blue-500/25 transition-all duration-150 flex items-center justify-center gap-2 select-none disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.01]"
//             >
//               {isSubmitting ? (
//                 <>
//                   <Loader2 className="w-4 h-4 animate-spin" />
//                   <span>MEMERIKSA...</span>
//                 </>
//               ) : (
//                 <span>LOGIN</span>
//               )}
//             </button>
//           </form>

//           {/* Subtext: Not login? Register */}
//           <div className="mt-4 text-center">
//             <span className="text-xs text-slate-600 font-medium">
//               Not login?{" "}
//               <Link
//                 href="/register"
//                 className="font-bold text-slate-900 hover:text-blue-600 underline-offset-2 hover:underline transition-colors"
//               >
//                 Register
//               </Link>
//             </span>
//           </div>

//           {/* Demo Credentials Box */}
//           <div
//             onClick={handleFillDemo}
//             title="Klik untuk mengisi formulir otomatis dengan akun demo"
//             className="mt-6 rounded-2xl bg-white/95 p-3.5 border border-slate-200/90 shadow-2xs hover:border-blue-400 hover:bg-blue-50/40 transition-all cursor-pointer group select-none text-left"
//           >
//             <div className="flex items-center justify-between">
//               <span className="text-xs font-bold text-blue-600 group-hover:text-blue-700 flex items-center gap-1.5">
//                 <Sparkles className="w-3.5 h-3.5" />
//                 Kredensial Pengujian ( Demo )
//               </span>
//               <span className="text-[10px] text-slate-400 group-hover:text-blue-600 transition-colors">
//                 {copiedDemo ? "✓ Diterapkan!" : "Klik untuk auto-fill"}
//               </span>
//             </div>
//             <div className="mt-1.5 text-[11px] sm:text-xs text-slate-700 font-medium leading-relaxed">
//               <p>
//                 <span className="text-slate-500">Email :</span>{" "}
//                 <span className="font-semibold text-slate-900">Manajemen@Andima.co.id</span>
//               </p>
//               <p className="mt-0.5">
//                 <span className="text-slate-500">Password :</span>{" "}
//                 <span className="font-semibold text-slate-900">Manajemen123!@#</span>
//               </p>
//             </div>
//           </div>
//         </div>

//         {/* ========================================================= */}
//         {/* RIGHT: Company Logo & PT. ANDIMA TRANSPORTINDO            */}
//         {/* ========================================================= */}
//         <div className="flex flex-col items-center lg:items-start text-center lg:text-left select-none">
//           {/* AST Logo */}
//           <div className="relative w-36 h-24 sm:w-44 sm:h-28 mb-3 drop-shadow-lg">
//             <Image
//               src={Logo}
//               alt="Logo PT. Andima Transportindo"
//               fill
//               priority
//               className="object-contain"
//             />
//           </div>

//           {/* Company Name */}
//           <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-wider leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.7)]">
//             PT. ANDIMA
//             <br />
//             TRANSPORTINDO
//           </h2>
//         </div>
//       </div>
//     </main>
//   );
// }

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

import React, { useState, useEffect, FormEvent, ChangeEvent } from "react";

import { useRouter } from "next/navigation";

import { createClient } from "@/utils/supabase/client";
import Image from "next/image";
import Logo from "@/components/image/Logo.png";
import Link from "next/link";

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
    } else if (countdown === 0 && isLocked && !isPermanentlyBlocked) {
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

    return passwordValue.length >= 10 && hasLetter && hasDigit && hasSpecial;
  };

  const handleFailedAttempt = (customMessage: string) => {
    const newAttempts = loginAttempts + 1;

    setLoginAttempts(newAttempts);

    if (newAttempts >= 5) {
      setIsLocked(true);
      setIsPermanentlyBlocked(true);

      setErrorMessage(
        "Your account has been blocked. Please contact the IT administrator.",
      );
    } else if (newAttempts === 4) {
      setErrorMessage(
        `${customMessage} Warning: 1 more failed attempt will block your account!`,
      );
    } else if (newAttempts === 3) {
      setIsLocked(true);
      setCountdown(30);

      setErrorMessage(
        "Too many failed login attempts (3/5). Please wait 30 seconds before trying again.",
      );
    } else {
      setErrorMessage(
        `${customMessage} (Remaining attempts: ${5 - newAttempts})`,
      );
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
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
      setErrorMessage("Invalid email format (example: name@andima.co.id).");
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
        "Login successful! Redirecting to Management Dashboard...",
      );

      setTimeout(() => {
        router.replace("/jobs");
        router.refresh();
      }, 1000);
    } catch (error) {
      console.error(error);

      setErrorMessage("Terjadi kesalahan saat menghubungkan ke server.");

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
        <Image
          src={Logo}
          alt="Logo PT. Andima Transportindo"
          className="w-auto h-20"
        />

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
                Please sign in with your registered account to access the
                dashboard.
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
                  disabled={isLocked || isPermanentlyBlocked || isLoading}
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
                    disabled={isLocked || isPermanentlyBlocked || isLoading}
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
                    disabled={isLocked || isPermanentlyBlocked || isLoading}
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
                disabled={isLocked || isPermanentlyBlocked || isLoading}
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
              <p className="relative z-10 mt-4 text-center text-sm text-[#334155]">
                Not login ?{" "}
                <Link
                  href="/register"
                  className="font-bold text-[#3B6FF5] hover:underline"
                >
                  Register
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
