'use client';

import React, { useState, useRef, useTransition, useId, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  CheckCircle2,
  AlertCircle,
  FileText,
  X,
  Loader2,
  Briefcase,
  MapPin,
  ArrowLeft,
  UploadCloud,
  Check,
} from 'lucide-react';
import { RegistrationWayUi, JobPost } from '../../types/candidate';
import Header from '@/components/Header';
import { DEFAULT_ACTIVE_JOB_POSTS } from '../../lib/supabaseServer';

function RegistrationFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawJobId = searchParams.get('jobId');

  const [jobId, setJobId] = useState<string | null>(rawJobId);
  const [selectedJob, setSelectedJob] = useState<JobPost | null>(null);

  const [fullName, setFullName] = useState('');
  const [nik, setNik] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [registrationWay, setRegistrationWay] = useState<RegistrationWayUi>('recommendation');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ message: string; candidateId?: string } | null>(null);
  const [registeredEmailPopup, setRegisteredEmailPopup] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fullNameId = useId();
  const nikId = useId();
  const emailId = useId();

  // Find job information via /api/squad-d2/jobs endpoint if jobId is present
  useEffect(() => {
    if (rawJobId) {
      setJobId(rawJobId);
      const fallbackMatch = DEFAULT_ACTIVE_JOB_POSTS.find((j) => j.id === rawJobId);
      if (fallbackMatch) {
        setSelectedJob(fallbackMatch);
      }

      fetch(`/api/squad-d2/jobs?id=${encodeURIComponent(rawJobId)}`)
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.data) {
            setSelectedJob(json.data);
          } else if (!fallbackMatch) {
            setSelectedJob({
              id: rawJobId,
              title: 'Specialized Position',
              department: 'PT Andima Transportindo',
              status: 'active',
              location: 'HQ - Menara MTH',
            });
          }
        })
        .catch((err) => {
          console.warn('Failed to fetch job metadata from API:', err);
        });
    } else {
      setSelectedJob(null);
      setJobId(null);
    }
  }, [rawJobId]);

  // Validate form fields locally before submission
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!fullName.trim()) {
      errors.fullName = 'Full Name must be filled!';
    } else if (fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters!';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) {
      errors.email = 'Email must be filled!';
    } else if (!emailRegex.test(email.trim())) {
      errors.email = 'Invalid email format (example: nama@domain.com).';
    }

    if (nik.trim() && !/^\d{16}$/.test(nik.trim())) {
      errors.nik = 'NIK must be exactly 16 digits numerical (sesuai KTP).';
    }

    if (!selectedFile) {
      errors.cvFile = 'Curriculum Vitae (PDF) must be uploaded!';
    } else {
      if (!selectedFile.name.toLowerCase().endsWith('.pdf') && selectedFile.type !== 'application/pdf') {
        errors.cvFile = 'Invalid file format. The resume must be in .pdf format.';
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        errors.cvFile = 'The CV file size exceeds the 5 MB limit!';
      }
    }

    if (!registrationWay) {
      errors.registrationWay = 'Select one of the registration options.';
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFileChange = (file: File | null) => {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setClientErrors((prev) => ({
        ...prev,
        cvFile: 'Invalid file format. The resume must be in .pdf format.',
      }));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setClientErrors((prev) => ({
        ...prev,
        cvFile: 'The CV file size exceeds the 5 MB limit.',
      }));
      return;
    }

    setClientErrors((prev) => {
      const next = { ...prev };
      delete next.cvFile;
      return next;
    });
    setSelectedFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const resetForm = () => {
    setFullName('');
    setNik('');
    setEmail('');
    setPhoneNumber('');
    setRegistrationWay('recommendation');
    setSelectedFile(null);
    setClientErrors({});
    setServerError(null);
    setSuccessInfo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validateForm()) {
      return;
    }

    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('fullName', fullName);
    if (nik.trim()) formData.append('nik', nik.trim());
    formData.append('email', email);
    if (phoneNumber) formData.append('phoneNumber', phoneNumber);
    formData.append('registrationWay', registrationWay);
    if (jobId) {
      formData.append('jobId', jobId);
    }
    formData.append('cvFile', selectedFile);

    const submittedEmail = email.trim();

    startTransition(async () => {
      try {
        // Send directly to the /api/squad-d2/register endpoint
        const response = await fetch('/api/squad-d2/register', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          if (result.errors) {
            const mappedErrors: Record<string, string> = {};
            Object.entries(result.errors).forEach(([k, msgs]) => {
              mappedErrors[k] = Array.isArray(msgs) ? msgs.join(', ') : String(msgs);
            });
            setClientErrors(mappedErrors);
          }
          setServerError(result.message || 'Gagal mengirim pendaftaran.');
        } else {
          setRegisteredEmailPopup(submittedEmail);
          setSuccessInfo({
            message: result.message,
            candidateId: result.candidateId,
          });
          resetForm();
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Terjadi kendala jaringan saat mengirim form';
        setServerError(msg);
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col text-slate-800 font-sans antialiased w-full">
      {/* Top Navbar */}
      <Header onMenuClick={() => window.dispatchEvent(new Event('open-sidebar'))} />

      {/* Main Page Body Container - Full Width from Left to Right */}
      <main className="flex-1 flex flex-col min-w-0 w-full px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-6 sm:py-8">
        {/* Back Link to Job List */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => router.push('/jobs')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Job List</span>
          </button>
        </div>

        {/* Page Title & Subtitle */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0d1527] tracking-tight">
            REGISTRATION FORM
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Multi-track candidate application portal for PT Andima Transportindo.
          </p>
        </div>

        {/* Selected Job Post Banner */}
        {selectedJob && (
          <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-blue-50/90 border border-blue-200/90 text-blue-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs animate-in fade-in duration-200 w-full">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Briefcase className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                    Selected Position
                  </span>
                  {selectedJob.location && (
                    <span className="text-xs text-blue-800 flex items-center gap-1 font-medium">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{selectedJob.location}</span>
                    </span>
                  )}
                </div>
                <h2 className="font-extrabold text-slate-900 text-base sm:text-lg mt-0.5 truncate">
                  {selectedJob.title}
                </h2>
                {selectedJob.department && (
                  <p className="text-xs text-slate-600 truncate">
                    {selectedJob.department}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => router.push('/jobs')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-white hover:bg-blue-50 px-4 py-2 rounded-xl border border-blue-200 transition-colors shrink-0 shadow-2xs self-end sm:self-center"
            >
              Change Position
            </button>
          </div>
        )}

        {/* Success Banner */}
        {successInfo && (
          <div className="mb-6 p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-start gap-4 shadow-xs animate-in fade-in duration-200 w-full">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-bold text-emerald-950 text-base">Pendaftaran Berhasil Terkirim!</h3>
              <p className="text-sm text-emerald-800 mt-1">{successInfo.message}</p>
              {successInfo.candidateId && (
                <p className="text-xs text-emerald-700 mt-2 font-mono bg-emerald-100/70 inline-block px-2.5 py-1 rounded-md">
                  Candidate ID: {successInfo.candidateId}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSuccessInfo(null)}
              className="text-emerald-700 hover:text-emerald-950 p-1"
              aria-label="Tutup notifikasi sukses"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Server Error Alert */}
        {serverError && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3 shadow-xs animate-in fade-in duration-200 w-full">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-rose-950 text-sm">Gagal Mengirim Formulir</h4>
              <p className="text-xs text-rose-800 mt-1">{serverError}</p>
            </div>
            <button
              type="button"
              onClick={() => setServerError(null)}
              className="text-rose-700 hover:text-rose-950 p-1"
              aria-label="Tutup pesan error"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main White Card Container - Full Width */}
        <div className="w-full bg-white rounded-2xl md:rounded-3xl border border-slate-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-8 md:p-10">
          <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-6 sm:space-y-7 w-full">
            {/* FIELD 1: FULL NAME */}
            <div className="w-full">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] shrink-0" />
                <label htmlFor={fullNameId} className="text-xs font-bold tracking-wider text-slate-800 uppercase">
                  FULL NAME
                </label>
              </div>

              <div
                className={`relative rounded-2xl border border-neutral-700 bg-neutral-100 transition-all duration-150 shadow-[1px_2px_0px_rgba(0,0,0,0.35)] focus-within:shadow-[1px_3px_0px_rgba(59,130,246,0.6)] focus-within:border-blue-600 w-full ${
                  clientErrors.fullName ? 'border-rose-500 shadow-[1px_2px_0px_rgba(239,68,68,0.4)]' : ''
                }`}
              >
                <input
                  id={fullNameId}
                  name="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (clientErrors.fullName) {
                      setClientErrors((prev) => {
                        const n = { ...prev };
                        delete n.fullName;
                        return n;
                      });
                    }
                  }}
                  placeholder="Enter your full name..."
                  className="w-full h-14 md:h-16 px-5 bg-transparent text-sm md:text-base font-normal text-slate-800 placeholder:text-neutral-400 focus:outline-none rounded-2xl"
                  disabled={isPending}
                />
              </div>
              {clientErrors.fullName && (
                <p className="mt-1.5 text-xs text-rose-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{clientErrors.fullName}</span>
                </p>
              )}
            </div>

            {/* FIELD 2: EMAIL */}
            <div className="w-full">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] shrink-0" />
                <label htmlFor={emailId} className="text-xs font-bold tracking-wider text-slate-800 uppercase">
                  EMAIL
                </label>
              </div>

              <div
                className={`relative rounded-2xl border border-neutral-700 bg-neutral-100 transition-all duration-150 shadow-[1px_2px_0px_rgba(0,0,0,0.35)] focus-within:shadow-[1px_3px_0px_rgba(59,130,246,0.6)] focus-within:border-blue-600 w-full ${
                  clientErrors.email ? 'border-rose-500 shadow-[1px_2px_0px_rgba(239,68,68,0.4)]' : ''
                }`}
              >
                <input
                  id={emailId}
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (clientErrors.email) {
                      setClientErrors((prev) => {
                        const n = { ...prev };
                        delete n.email;
                        return n;
                      });
                    }
                  }}
                  placeholder="Enter your Email..."
                  className="w-full h-14 md:h-16 px-5 bg-transparent text-sm md:text-base font-normal text-slate-800 placeholder:text-neutral-400 focus:outline-none rounded-2xl"
                  disabled={isPending}
                />
              </div>
              {clientErrors.email && (
                <p className="mt-1.5 text-xs text-rose-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{clientErrors.email}</span>
                </p>
              )}
            </div>

            {/* FIELD 2.5: NIK (Nomor Induk Kependudukan - FR-D2-005: 16 Digits) */}
            <div className="w-full">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] shrink-0" />
                  <label htmlFor={nikId} className="text-xs font-bold tracking-wider text-slate-800 uppercase">
                    NIK (NOMOR INDUK KEPENDUDUKAN)
                  </label>
                </div>
                <span className="text-[11px] text-slate-400 font-normal">Kunci Pendeteksi Sekunder (16 Digit)</span>
              </div>

              <div
                className={`relative rounded-2xl border border-neutral-700 bg-neutral-100 transition-all duration-150 shadow-[1px_2px_0px_rgba(0,0,0,0.35)] focus-within:shadow-[1px_3px_0px_rgba(59,130,246,0.6)] focus-within:border-blue-600 w-full ${
                  clientErrors.nik ? 'border-rose-500 shadow-[1px_2px_0px_rgba(239,68,68,0.4)]' : ''
                }`}
              >
                <input
                  id={nikId}
                  name="nik"
                  type="text"
                  maxLength={16}
                  value={nik}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setNik(val);
                    if (clientErrors.nik) {
                      setClientErrors((prev) => {
                        const n = { ...prev };
                        delete n.nik;
                        return n;
                      });
                    }
                  }}
                  placeholder="Enter 16-digit NIK (contoh: 320101...)..."
                  className="w-full h-14 md:h-16 px-5 bg-transparent text-sm md:text-base font-normal text-slate-800 placeholder:text-neutral-400 focus:outline-none rounded-2xl"
                  disabled={isPending}
                />
              </div>
              {clientErrors.nik && (
                <p className="mt-1.5 text-xs text-rose-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{clientErrors.nik}</span>
                </p>
              )}
            </div>

            {/* ================================================================= */}
            {/* FIELD 3: CURRICULUM VITAE (PDF) - FULL WIDTH DROPZONE             */}
            {/* ================================================================= */}
            <div className="w-full">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] shrink-0" />
                <label className="text-xs font-bold tracking-wider text-slate-800 uppercase">
                  CURRICULUM VITAE (PDF)
                </label>
              </div>

              {/* Upload Dropzone Box (Full Width, Matching Image 1) */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative w-full rounded-2xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center p-8 sm:p-12 md:p-14 cursor-pointer ${
                  dragActive
                    ? 'border-blue-600 bg-blue-50/70 scale-[0.995]'
                    : clientErrors.cvFile
                    ? 'border-rose-500 bg-rose-50/30'
                    : 'border-neutral-700 bg-neutral-200/80 hover:bg-neutral-200'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                  disabled={isPending}
                />

                {/* Upload Icon (Tray with arrow up) */}
                <div className="mb-3 text-neutral-600 flex items-center justify-center">
                  <svg
                    className="w-14 h-14"
                    viewBox="0 0 56 56"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M28 10L16 22H24V34H32V22H40L28 10Z"
                      fill="currentColor"
                    />
                    <path
                      d="M12 36V44H44V36H40V40H16V36H12Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>

                <p className="text-xs md:text-sm font-bold tracking-widest text-neutral-600 uppercase text-center">
                  UPLOAD YOUR FILE HERE
                </p>

                {/* Selected File Card Preview */}
                {selectedFile && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-4 flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-300 shadow-sm text-xs font-semibold text-slate-800 max-w-full"
                  >
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="truncate max-w-[200px] sm:max-w-xs md:max-w-md">{selectedFile.name}</span>
                    <span className="text-slate-400 font-normal shrink-0">
                      ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-full ml-1"
                      aria-label="Hapus file terpilih"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {clientErrors.cvFile && (
                <p className="mt-1.5 text-xs text-rose-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{clientErrors.cvFile}</span>
                </p>
              )}
            </div>

            {/* ================================================================= */}
            {/* FIELD 4: REGISTRATION WAY (Matching Image 1)                      */}
            {/* ================================================================= */}
            <div className="pt-1 w-full">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] shrink-0" />
                <label className="text-xs font-bold tracking-wider text-slate-800 uppercase">
                  REGISTRATION WAY
                </label>
              </div>

              <div className="flex items-center gap-8 pl-1">
                {/* Option 1: Scouting */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="radio"
                      name="registrationWay"
                      value="scouting"
                      checked={registrationWay === 'scouting'}
                      onChange={() => setRegistrationWay('scouting')}
                      className="sr-only"
                      disabled={isPending}
                    />
                    <div
                      className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${
                        registrationWay === 'scouting'
                          ? 'border-[#8b5cf6] bg-white'
                          : 'border-slate-400 group-hover:border-slate-600 bg-white'
                      }`}
                    >
                      {registrationWay === 'scouting' && (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6]" />
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Scouting</span>
                </label>

                {/* Option 2: Recommendation */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="radio"
                      name="registrationWay"
                      value="recommendation"
                      checked={registrationWay === 'recommendation'}
                      onChange={() => setRegistrationWay('recommendation')}
                      className="sr-only"
                      disabled={isPending}
                    />
                    <div
                      className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${
                        registrationWay === 'recommendation'
                          ? 'border-[#8b5cf6] bg-white'
                          : 'border-slate-400 group-hover:border-slate-600 bg-white'
                      }`}
                    >
                      {registrationWay === 'recommendation' && (
                        <div className="w-2.5 h-2.5 rounded-full bg-[#8b5cf6]" />
                      )}
                    </div>
                  </div>
                  <span className="text-sm font-medium text-slate-700">Recommendation</span>
                </label>
              </div>

              {clientErrors.registrationWay && (
                <p className="mt-1.5 text-xs text-rose-600 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{clientErrors.registrationWay}</span>
                </p>
              )}
            </div>

            {/* ================================================================= */}
            {/* SUBMIT BUTTON (Right Aligned, Solid Blue, Matching Image 1)       */}
            {/* ================================================================= */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isPending}
                className={`bg-[#1d4ed8] hover:bg-blue-700 active:bg-blue-800 text-white font-bold rounded-xl px-12 py-3 shadow-md shadow-blue-500/20 transition-all duration-150 flex items-center justify-center gap-2 text-sm sm:text-base select-none ${
                  isPending ? 'opacity-70 cursor-not-allowed' : 'hover:scale-[1.01]'
                }`}
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Pop up Notifikasi Pendaftaran Berhasil */}
      {registeredEmailPopup && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100 flex flex-col items-center text-center transform transition-all animate-in zoom-in-95 duration-200">
            {/* Tombol X untuk menutup pop up notif */}
            <button
              type="button"
              onClick={() => setRegisteredEmailPopup(null)}
              className="absolute top-4 right-4 rounded-full p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Tutup notifikasi"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon status */}
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mb-4 shadow-xs">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            {/* Judul Notifikasi */}
            <h3 className="text-xl font-extrabold text-slate-900 mb-2">
              Pendaftaran Berhasil!
            </h3>

            {/* Isi Notifikasi sesuai instruksi user */}
            <p className="text-sm text-slate-600 leading-relaxed">
              Anda telah terdaftar. Silahkan check email (<span className="font-bold text-blue-600 break-all">{registeredEmailPopup}</span>) anda!
            </p>

            {/* Tombol aksi */}
            <div className="mt-6 w-full">
              <button
                type="button"
                onClick={() => setRegisteredEmailPopup(null)}
                className="w-full py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition-all hover:scale-[1.01]"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RegistrationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <RegistrationFormContent />
    </Suspense>
  );
}
