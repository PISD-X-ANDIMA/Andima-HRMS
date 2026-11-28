'use client';

import React, { useState, useSyncExternalStore, FormEvent, ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseClient } from '@/lib/supabaseClient';
import { useGreeting } from '@/lib/useGreeting';
import { loginErrorMessage } from '@/lib/loginErrorMessage';
import { d4DataMode } from '@/modules/d4/web/data/mode';
import { startPreviewSession } from '@/modules/d4/web/data/preview-session';
import { IDLE_LIMIT_MS, IDLE_LOGOUT_KEY } from '@/modules/d4/web/data/idle';

// B2 (PISD-B) tidak memuat webfont, jadi var font jatuh ke system stack. Samakan.
const B2_FONT_STACK = "-apple-system, system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif";
const B2_FONT_VARS = { '--font-montserrat': B2_FONT_STACK, '--font-syne': B2_FONT_STACK } as React.CSSProperties;

const noSubscription = () => () => {};
const readIdleLogout = () => { try { return window.sessionStorage.getItem(IDLE_LOGOUT_KEY) ?? ''; } catch { return ''; } };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  // Set by an automatic logout for inactivity (IdleLogout), which clears it again once the app opens after login.
  const idleLogoutAt = useSyncExternalStore(noSubscription, readIdleLogout, () => '');
  const greeting = useGreeting();

  const validateEmailFormat = (emailVal: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailVal);
  };

  const validatePasswordStrength = (passVal: string): boolean => {
    const hasLetter = /[a-zA-Z]/.test(passVal);
    const hasDigit = /\d/.test(passVal);
    const hasSpecial = /[^a-zA-Z0-9]/.test(passVal);
    return passVal.length >= 10 && hasLetter && hasDigit && hasSpecial;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Email dan password wajib diisi.');
      return;
    }

    if (!validateEmailFormat(email)) {
      setErrorMessage('Format email tidak valid (contoh: nama@andima.co.id).');
      return;
    }

    if (!validatePasswordStrength(password)) {
      setErrorMessage(
        'Password minimal 10 karakter dan harus berisi huruf, angka, dan karakter khusus.'
      );
      return;
    }

    // Local preview: no account check and no request to Supabase; the app then shows the sample data.
    if (d4DataMode === 'fixture') {
      startPreviewSession();
      setSuccessMessage('Login berhasil! Mengalihkan ke dashboard...');
      window.setTimeout(() => { router.push('/dashboard'); }, 1200);
      return;
    }

    setIsSigningIn(true);
    void supabaseClient().auth.signInWithPassword({ email: email.toLowerCase().trim(), password })
      .then(({ error }) => {
        // supabase-js returns network errors here instead of throwing them (D4-FN-02). The attempt limit is the
        // Supabase rate limit (429); a counter kept in this page reset on refresh (D4-SEC-01).
        if (error) {
          setErrorMessage(loginErrorMessage(error));
          return;
        }

        setSuccessMessage('Login berhasil! Mengalihkan ke dashboard...');
        window.setTimeout(() => { router.push('/dashboard'); }, 1200);
      })
      .catch((cause: unknown) => setErrorMessage(loginErrorMessage(cause)))
      .finally(() => setIsSigningIn(false));
  };

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden bg-[#07111F] text-[#0D1B2A] selection:bg-[#3B6FF5] selection:text-white font-[family-name:var(--font-montserrat)]" style={B2_FONT_VARS}>
      {/* 1. BACKGROUND GAMBAR LOGISTIK FULL SCREEN */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1578575437130-527eed3abbec?q=80&w=1600&auto=format&fit=crop"
          alt="Cargo Ship Logistics"
          className="w-full h-full object-cover object-right opacity-60"
        />
        {/* Soft Blending Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0D1B2A] via-[#0D1B2A]/85 via-40% to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07111F] via-transparent to-transparent pointer-events-none" />
      </div>

      {/* Ambient Light Glows */}
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-[#18C7C0]/30 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute -bottom-20 left-1/3 w-96 h-96 bg-[#3B6FF5]/30 rounded-full blur-3xl pointer-events-none z-0" />

      {/* 2. BRAND TEXT (TITLE) MENGGUNAKAN FONT SYNE */}
      <div className="hidden lg:flex absolute top-1/2 -translate-y-1/2 right-16 xl:right-24 z-20 pointer-events-none flex-col items-end text-right max-w-lg">
        <div className="w-32 sm:w-40 lg:w-48 mb-4"><img src="/andima-logo.png" alt="Logo Andima" width={400} height={246} className="w-full h-auto object-contain drop-shadow-lg" data-testid="login-logo" /></div>
        <h1 className="font-[family-name:var(--font-syne)] text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-wider text-white drop-shadow-md leading-tight">
          PT. ANDIMA<br />
          <span className="font-[family-name:var(--font-syne)] text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-wider text-white drop-shadow-md leading-tight">TRANSPORTINDO</span>
        </h1>
      </div>

      {/* 3. FORM LOGIN CONTAINER */}
      <div className="relative z-10 min-h-screen w-full flex items-center justify-start px-6 py-8 sm:px-12 lg:px-20">
        <div className="w-full max-w-xl">

          {/* FRAME LIQUID GLASS (GLASSMORPHISM ADVANCED) */}
          <div className="p-8 sm:p-11 rounded-3xl bg-gradient-to-b from-white/85 via-white/70 to-white/60 backdrop-blur-2xl border border-white/80 shadow-[0_20px_50px_rgba(7,17,31,0.5),inset_0_2px_4px_rgba(255,255,255,0.9)] relative overflow-hidden">
            
            {/* Top Liquid Highlight Specular Glow */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-gradient-to-b from-white/80 to-transparent blur-md pointer-events-none rounded-full" />

            {/* Greeting */}
            <div className="mb-7 text-left relative z-10">
              <h2 className="font-[family-name:var(--font-syne)] text-xl sm:text-2xl font-bold text-[#0D1B2A] tracking-tight">
                {greeting},
              </h2>
              <p className="font-[family-name:var(--font-montserrat)] text-sm text-[#334155] mt-1.5 font-medium">
                Please sign in with your registered account to access the dashboard.
              </p>
            </div>

            {/* Form Fields */}
            <form id="login-form" data-testid="login-form" onSubmit={handleSubmit} className="space-y-6 font-[family-name:var(--font-montserrat)] relative z-10" noValidate>
              <div>
                <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-2.5">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  data-testid="input-email"
                  type="email"
                  placeholder="name@andima.co.id"
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  className="w-full px-4.5 py-3.5 rounded-xl bg-white/70 backdrop-blur-md text-[#0D1B2A] placeholder-[#64748B] text-sm focus:outline-none transition-all disabled:opacity-50 border border-white/90 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] focus:bg-white focus:border-[#3B6FF5] focus:ring-2 focus:ring-[#3B6FF5]/30 font-medium"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-2.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    data-testid="input-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    className="w-full pl-4.5 pr-12 py-3.5 rounded-xl bg-white/70 backdrop-blur-md text-[#0D1B2A] placeholder-[#64748B] text-sm focus:outline-none transition-all disabled:opacity-50 border border-white/90 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] focus:bg-white focus:border-[#3B6FF5] focus:ring-2 focus:ring-[#3B6FF5]/30 font-medium"
                  />

                  <button
                    type="button"
                    id="toggle-password"
                    data-testid="toggle-password"
                    aria-label="Tampilkan password"
                    onMouseDown={() => setShowPassword(true)}
                    onMouseUp={() => setShowPassword(false)}
                    onMouseLeave={() => setShowPassword(false)}
                    onTouchStart={() => setShowPassword(true)}
                    onTouchEnd={() => setShowPassword(false)}
                    tabIndex={-1}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-[#3B6FF5] p-1 transition-colors disabled:opacity-50"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908A8.982 8.982 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21M3 3l18 18" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {d4DataMode === 'fixture' && (
                <p data-testid="login-preview-note" className="p-4 rounded-xl bg-[#D97706]/10 border border-[#D97706]/30 text-[#92400E] text-xs sm:text-sm font-semibold">
                  Mode pratinjau: email dan password apa pun dengan format yang valid bisa dipakai. Login dan logout tidak mengirim atau membaca data dari server.
                </p>
              )}

              {idleLogoutAt && !errorMessage && !successMessage && (
                <div data-testid="login-idle" role="status" className="p-4 rounded-xl bg-[#B45309]/10 border border-[#B45309]/30 text-[#92400E] text-xs sm:text-sm font-semibold">
                  Anda logout otomatis pukul {idleLogoutAt} karena tidak aktif selama {Math.round(IDLE_LIMIT_MS / 60_000)} menit. Silakan login kembali.
                </div>
              )}

              {errorMessage && (
                <div id="login-error" data-testid="login-error" role="alert" className="p-4 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-xs sm:text-sm flex items-center gap-2.5 font-semibold backdrop-blur-md">
                  <svg className="w-5 h-5 shrink-0 fill-current" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div id="login-success" data-testid="login-success" role="status" className="p-4 rounded-xl bg-[#059669]/10 border border-[#059669]/30 text-[#059669] text-xs sm:text-sm flex items-center gap-2.5 font-semibold backdrop-blur-md">
                  <svg className="w-5 h-5 shrink-0 fill-current" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Tombol Login Solid Blue #3B6FF5 dengan Hover #2B5CE5 */}
              <button
                id="btn-login"
                name="btn-login"
                data-testid="btn-login"
                type="submit"
                disabled={isSigningIn}
                className="w-full py-4 px-5 text-white font-extrabold rounded-xl text-sm tracking-wider uppercase transition-all mt-2 disabled:opacity-50 bg-[#3B6FF5] hover:bg-[#2B5CE5] shadow-[0_8px_25px_rgba(59,111,245,0.4)] active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed font-[family-name:var(--font-montserrat)]"
              >
                {isSigningIn ? 'SIGNING IN…' : 'LOGIN'}
              </button>
            </form>

            <p className="relative z-10 mt-4 text-center text-sm text-[#334155]">
              Not registered?{' '}
              <Link id="link-register" data-testid="link-register" href="/register" className="font-bold text-[#3B6FF5] hover:underline">Register</Link>
            </p>

          </div>

        </div>
      </div>
    </main>
  );
}