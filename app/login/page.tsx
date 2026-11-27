'use client';

import React, { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useGreeting } from '@/lib/greeting';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [loginAttempts, setLoginAttempts] = useState<number>(0);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isPermanentlyBlocked, setIsPermanentlyBlocked] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);
  const [sessionEndNotice, setSessionEndNotice] = useState<string>('');
  const greeting = useGreeting();

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('reason');
    const notice = reason === 'location'
      ? 'Lokasi kerja akun belum dikonfigurasi untuk automatic logout. Hubungi HR Admin.'
      : reason === 'profile'
        ? 'Profil karyawan akun ini sudah tidak aktif atau belum terhubung. Hubungi HR Admin.'
        : reason === 'idle'
          ? 'Sesi Anda berakhir karena tidak ada aktivitas selama 30 menit. Silakan login kembali.'
          : reason === 'manual'
            ? 'Anda telah logout. Silakan login kembali jika ingin melanjutkan.'
            : '';

    // The URL is a browser-only external source; this keeps the static login
    // route free from a search-params suspense boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionEndNotice(notice);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (isLocked && countdown > 0) {
      timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    } else if (countdown === 0 && isLocked && !isPermanentlyBlocked) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLocked(false);
      setErrorMessage('');
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isLocked, countdown, isPermanentlyBlocked]);

  const validateEmailFormat = (emailVal: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailVal);
  };

  const handleFailedAttempt = (customMessage: string) => {
    const newAttempts = loginAttempts + 1;
    setLoginAttempts(newAttempts);

    if (newAttempts >= 5) {
      setIsLocked(true);
      setIsPermanentlyBlocked(true);
      setErrorMessage('Your account has been blocked. Please contact the IT administrator.');
    } else if (newAttempts === 4) {
      setErrorMessage(
        `${customMessage} Warning: 1 more failed attempt will block your account!`
      );
    } else if (newAttempts === 3) {
      setIsLocked(true);
      setCountdown(30);
      setErrorMessage(
        'Too many failed login attempts (3/5). Please wait 30 seconds before trying again.'
      );
    } else {
      setErrorMessage(`${customMessage} (Remaining attempts: ${5 - newAttempts})`);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (isLocked || isPermanentlyBlocked) return;

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Email and Password are required.');
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!validateEmailFormat(normalizedEmail)) {
      setErrorMessage('Invalid email format (example: name@andima.co.id).');
      return;
    }

    setIsSigningIn(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error || !data.user) {
        handleFailedAttempt('Email atau password salah.');
        return;
      }

      const { data: registeredUser, error: registerError } = await supabase
        .from('b2_register')
        .select('id, is_active, app_role')
        .eq('auth_user_id', data.user.id)
        .maybeSingle();

      if (registerError) {
        await supabase.auth.signOut();
        setErrorMessage('Akun berhasil login, tetapi data B2 Register belum dapat dibaca.');
        return;
      }

      if (registeredUser?.is_active === false) {
        await supabase.auth.signOut();
        setErrorMessage('Akun ini telah dinonaktifkan. Hubungi HR Admin.');
        return;
      }

      if (registeredUser) {
        const { data: idleSession, error: idleSessionError } = await supabase
          .rpc('d3_start_idle_session');
        const idleSessionStatus = Array.isArray(idleSession) ? idleSession[0] : null;

        if (idleSessionError || idleSessionStatus?.status !== 'ACTIVE') {
          await supabase.auth.signOut({ scope: 'local' });
          const rawMessage = idleSessionError?.message ?? '';
          setErrorMessage(
            rawMessage.includes('Work location is not configured')
              ? 'Lokasi kerja akun belum dikonfigurasi untuk automatic logout. Hubungi HR Admin.'
              : 'Sesi otomatis belum dapat disiapkan. Silakan coba login kembali atau hubungi HR Admin.',
          );
          return;
        }

        setLoginAttempts(0);
        setSuccessMessage('Login berhasil. Mengarahkan ke halaman utama...');
        window.setTimeout(() => {
          router.replace(registeredUser.app_role === 'HR' ? '/face-biometric-attendance' : '/employees');
          router.refresh();
        }, 700);
        return;
      }

      await supabase.auth.signOut();
      setErrorMessage('Akun ini belum memiliki profil B2 Register. Hubungi HR Admin.');
    } catch {
      setErrorMessage('Koneksi login belum siap. Periksa .env.local lalu coba kembali.');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden bg-[#07111F] text-[#0D1B2A] selection:bg-[#3B6FF5] selection:text-white font-[family-name:var(--font-montserrat)]">
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
      <div className="hidden md:flex absolute top-1/2 -translate-y-1/2 right-8 lg:right-16 xl:right-24 z-20 pointer-events-none flex-col items-end text-right max-w-lg">
        <div className="w-14 h-14 lg:w-16 lg:h-16 flex items-center justify-center shrink-0 mb-4">
          <img
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Logo-ANDIMA-wzx4gpZx20EFE5IYcH3jqabixELIo3.png"
            alt="Logo Andima"
            className="h-full w-full object-contain drop-shadow-[0_3px_10px_rgba(0,0,0,0.55)]"
          />
        </div>
        <h1 className="font-[family-name:var(--font-syne)] text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-wider text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)] leading-tight">
          PT. ANDIMA<br />
          <span className="font-[family-name:var(--font-syne)] text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-wider text-white drop-shadow-[0_4px_20px_rgba(0,0,0,0.9)] leading-tight">TRANSPORTINDO</span>
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
                {/* Empty until the browser knows its local hour; the nbsp keeps the line height. */}
                {greeting ? `${greeting},` : ' '}
              </h2>
              <p className="font-[family-name:var(--font-montserrat)] text-sm text-[#334155] mt-1.5 font-medium">
                Please sign in with your registered account to access the dashboard.
              </p>
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSubmit} className="space-y-6 font-[family-name:var(--font-montserrat)] relative z-10" noValidate>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-2.5">
                  Username
                </label>
                <input
                  type="email"
                  placeholder="manajemen@andima.co.id"
                  value={email}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                  disabled={isLocked || isPermanentlyBlocked}
                  className="w-full px-4.5 py-3.5 rounded-xl bg-white/70 backdrop-blur-md text-[#0D1B2A] placeholder-[#64748B] text-sm focus:outline-none transition-all disabled:opacity-50 border border-white/90 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] focus:bg-white focus:border-[#3B6FF5] focus:ring-2 focus:ring-[#3B6FF5]/30 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#0F172A] mb-2.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                    disabled={isLocked || isPermanentlyBlocked}
                    className="w-full pl-4.5 pr-12 py-3.5 rounded-xl bg-white/70 backdrop-blur-md text-[#0D1B2A] placeholder-[#64748B] text-sm focus:outline-none transition-all disabled:opacity-50 border border-white/90 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] focus:bg-white focus:border-[#3B6FF5] focus:ring-2 focus:ring-[#3B6FF5]/30 font-medium"
                  />

                  <button
                    type="button"
                    onMouseDown={() => setShowPassword(true)}
                    onMouseUp={() => setShowPassword(false)}
                    onMouseLeave={() => setShowPassword(false)}
                    onTouchStart={() => setShowPassword(true)}
                    onTouchEnd={() => setShowPassword(false)}
                    disabled={isLocked || isPermanentlyBlocked}
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

              {(errorMessage || sessionEndNotice) && (
                <div className="p-4 rounded-xl bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] text-xs sm:text-sm flex items-center gap-2.5 font-semibold backdrop-blur-md">
                  <svg className="w-5 h-5 shrink-0 fill-current" viewBox="0 0 20 20">
                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
                  </svg>
                  <span>{errorMessage || sessionEndNotice}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-4 rounded-xl bg-[#059669]/10 border border-[#059669]/30 text-[#059669] text-xs sm:text-sm flex items-center gap-2.5 font-semibold backdrop-blur-md">
                  <svg className="w-5 h-5 shrink-0 fill-current" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>{successMessage}</span>
                </div>
              )}

              {/* Tombol Login Solid Blue #3B6FF5 dengan Hover #2B5CE5 */}
              <button
                type="submit"
                disabled={isLocked || isPermanentlyBlocked || isSigningIn}
                className="w-full py-4 px-5 text-white font-extrabold rounded-xl text-sm tracking-wider uppercase transition-all mt-2 disabled:opacity-50 bg-[#3B6FF5] hover:bg-[#2B5CE5] shadow-[0_8px_25px_rgba(59,111,245,0.4)] active:scale-[0.99] cursor-pointer disabled:cursor-not-allowed font-[family-name:var(--font-montserrat)]"
              >
                {isPermanentlyBlocked
                  ? 'ACCOUNT BLOCKED'
                  : isLocked
                  ? `Please wait ${countdown}s`
                  : isSigningIn ? 'SIGNING IN…' : 'LOGIN'}
              </button>
            </form>

            <p className="relative z-10 mt-4 text-center text-sm text-[#334155]">
              Not login ?{' '}
              <Link href="/register" className="font-bold text-[#3B6FF5] hover:underline">Register</Link>
            </p>

            {/* Info Demo Credentials */}
            <div className="mt-7 p-4 rounded-xl bg-white/60 backdrop-blur-md border border-white/80 text-xs text-[#334155] space-y-1 font-[family-name:var(--font-montserrat)] shadow-sm relative z-10">
              <p className="font-bold text-[#3B6FF5]">Demo Credentials:</p>
              <p>Login menggunakan akun HRMS yang sudah dipetakan oleh HR Admin.</p>
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}
