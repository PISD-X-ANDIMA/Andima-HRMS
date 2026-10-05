'use client'

import { useEffect, useState, useMemo } from 'react'
import { Bell, ChevronRight, RefreshCw, AlertCircle, CheckCircle2, Clock3, FilePlus2, X } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import HeaderAccount from '@/components/HeaderAccount'

type CorrectionType = 'CLOCK_IN' | 'CLOCK_OUT' | 'FULL_DAY' | string
type CorrectionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | string
type AppRole = 'EMPLOYEE' | 'HR' | 'MANAGER'

export type AttendanceCorrection = {
  id: string
  correction_type: CorrectionType
  proposed_clock_in?: string | null
  proposed_clock_out?: string | null
  reason: string
  status: CorrectionStatus
  created_at: string
}

export type AttendanceItem = {
  id: string
  employee_id: string
  full_name: string
  department: string
  date: string
  clock_in: string
  clock_out: string | null
  source: string
  notes: string | null
  correction: AttendanceCorrection | null
}

type AttendanceEmployee = {
  employee_id: string
  full_name: string
  department_id: string | null
  d3_departments: { name: string } | null
}

type AttendanceQueryRow = {
  id: string
  employee_id: string
  date: string
  clock_in: string | null
  clock_out: string | null
  work_duration_minutes: number | null
  status: string | null
  source: string | null
  notes: string | null
  d3_employee: AttendanceEmployee | null
  d3_attendance_corrections: AttendanceCorrection[] | null
}

export default function AttendancePageUI() {
  const [attendances, setAttendances] = useState<AttendanceItem[]>([])
  const [selectedItem, setSelectedItem] = useState<AttendanceItem | null>(null)
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'APPROVED'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [appRole, setAppRole] = useState<AppRole | null>(null)
  const [viewerEmployeeId, setViewerEmployeeId] = useState('')
  const [viewerName, setViewerName] = useState('')
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false)
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false)
  const [correctionType, setCorrectionType] = useState<CorrectionType>('CLOCK_IN')
  const [proposedClockIn, setProposedClockIn] = useState('')
  const [proposedClockOut, setProposedClockOut] = useState('')
  const [correctionReason, setCorrectionReason] = useState('')
  const [incentiveNote, setIncentiveNote] = useState('')

  // Fetch data dari Supabase (Disamakan persis dengan halaman Attendance Productivity)
  async function fetchAttendanceData() {
    try {
      setLoading(true)
      setErrorMessage('')
      const supabase = createClient()

      let query = supabase
        .from('d3_attendances')
        .select(`
          id,
          employee_id,
          date,
          clock_in,
          clock_out,
          status,
          notes,
          d3_employee!fk_d3_attendances_d3_employee (
            employee_id,
            full_name,
            department_id,
            d3_departments!fk_d3_employee_d3_departments (
              name
            )
          ),
          d3_attendance_corrections (
            id,
            correction_type,
            proposed_clock_in,
            proposed_clock_out,
            reason,
            status,
            created_at
          )
        `)
        .order('date', { ascending: false })

      if (appRole === 'EMPLOYEE' && viewerEmployeeId) {
        query = query.eq('employee_id', viewerEmployeeId)
      }

      const { data, error } = await query

      if (error) {
        console.warn('Supabase fetch query notice:', error.message)
        setErrorMessage(
          error.code === '42501'
            ? 'Akses dashboard memerlukan akun HRMS yang telah dipetakan.'
            : 'Data presensi belum dapat dimuat dari Supabase.'
        )
        setAttendances([])
        setSelectedItem(null)
        return
      }

      if (data) {
        const formatted: AttendanceItem[] = (data as unknown as AttendanceQueryRow[]).map((item) => {
          const emp = item.d3_employee
          const corrList = item.d3_attendance_corrections || []
          const corr = corrList.length > 0 ? corrList[0] : null

          return {
            id: item.id || `ATT-${item.employee_id}`,
            employee_id: emp?.employee_id || item.employee_id || 'EMP-AND-000',
            full_name: emp?.full_name || 'Karyawan',
            department: emp?.d3_departments?.name || 'Umum',
            date: item.date || new Date().toISOString().split('T')[0],
            clock_in: item.clock_in ? (item.clock_in.includes('T') ? item.clock_in : `${item.date}T${item.clock_in}`) : `${item.date}T08:00:00`,
            clock_out: item.clock_out ? (item.clock_out.includes('T') ? item.clock_out : `${item.date}T${item.clock_out}`) : null,
            source: item.source || 'Fingerprint Main Gate',
            notes: item.notes || null,
            correction: corr
              ? {
                  id: corr.id,
                  correction_type: corr.correction_type || 'CLOCK_IN',
                  proposed_clock_in: corr.proposed_clock_in,
                  proposed_clock_out: corr.proposed_clock_out,
                  reason: corr.reason || 'Koreksi presensi',
                  status: corr.status || 'PENDING',
                  created_at: corr.created_at ? new Date(corr.created_at).toLocaleString('id-ID') : item.date,
                }
              : null,
          }
        })

        setAttendances(formatted)
        if (formatted.length > 0) {
          setSelectedItem(formatted[0])
        } else {
          setSelectedItem(null)
        }
      }
    } catch (err: unknown) {
      console.error('Error fetching attendance from Supabase:', err)
      setErrorMessage(
        err instanceof Error ? err.message : 'Terjadi kesalahan saat menghubungkan ke Supabase.'
      )
      setAttendances([])
      setSelectedItem(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    async function loadAccountAccess() {
      const supabase = createClient()
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData.user) return

      const { data: access, error: accessError } = await supabase
        .from('d3_user_access')
        .select('app_role, employee_id')
        .eq('auth_user_id', userData.user.id)
        .maybeSingle()

      if (!mounted || accessError || !access) return
      const name = userData.user.user_metadata?.full_name
      setAppRole(access.app_role as AppRole)
      setViewerEmployeeId(access.employee_id)
      setViewerName(typeof name === 'string' && name.trim() ? name.trim() : userData.user.email?.split('@')[0] || 'Employee')
    }

    void loadAccountAccess()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    // Data loading is intentionally triggered after the authenticated role is known.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (appRole) void fetchAttendanceData()
    // fetchAttendanceData reads the authenticated session and active role.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appRole, viewerEmployeeId])

  // Action Handler Persetujuan / Penolakan Koreksi
  async function handleUpdateCorrectionStatus(status: 'APPROVED' | 'REJECTED') {
    if (!selectedItem?.correction) return

    try {
      const supabase = createClient()
      const correctionId = selectedItem.correction.id
      const correctionUpdate: { status: string; reviewed_by?: string } = { status, reviewed_by: viewerEmployeeId || undefined }

      const { error: correctionError } = await supabase
        .from('d3_attendance_corrections')
        .update(correctionUpdate)
        .eq('id', correctionId)

      if (correctionError) throw correctionError

      const attendanceUpdate: { clock_in?: string; clock_out?: string } = {}
      if (status === 'APPROVED') {
        if (selectedItem.correction.proposed_clock_in) {
          attendanceUpdate.clock_in = selectedItem.correction.proposed_clock_in
        }
        if (selectedItem.correction.proposed_clock_out) {
          attendanceUpdate.clock_out = selectedItem.correction.proposed_clock_out
        }
        if (Object.keys(attendanceUpdate).length > 0) {
          const { error: attendanceError } = await supabase
            .from('d3_attendances')
            .update(attendanceUpdate)
            .eq('id', selectedItem.id)
          if (attendanceError) throw attendanceError
        }
      }

      const updatedItem = {
        ...selectedItem,
        ...(status === 'APPROVED' ? attendanceUpdate : {}),
        correction: { ...selectedItem.correction, status },
      }
      const updatedAttendances = attendances.map((item) => item.id === selectedItem.id ? updatedItem : item)
      setAttendances(updatedAttendances)
      setSelectedItem(updatedItem)
      setActionMessage({
        type: 'success',
        text: `Koreksi absensi ${selectedItem.full_name} berhasil ${status === 'APPROVED' ? 'disetujui dan diterapkan' : 'ditolak'}.`,
      })
      setTimeout(() => setActionMessage(null), 4000)
    } catch (err: unknown) {
      setActionMessage({
        type: 'error',
        text: `Gagal memperbarui koreksi: ${err instanceof Error ? err.message : 'Terjadi kesalahan'}`,
      })
      setTimeout(() => setActionMessage(null), 4000)
    }
  }

  async function handleSubmitCorrection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedItem || !viewerEmployeeId || correctionReason.trim().length < 10) return

    setIsSubmittingCorrection(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('d3_attendance_corrections')
      .insert({
        attendance_id: selectedItem.id,
        requested_by: viewerEmployeeId,
        correction_type: correctionType,
        proposed_clock_in: proposedClockIn ? `${selectedItem.date}T${proposedClockIn}:00` : null,
        proposed_clock_out: proposedClockOut ? `${selectedItem.date}T${proposedClockOut}:00` : null,
        reason: correctionReason.trim(),
        status: 'PENDING',
      })
      .select('id, correction_type, proposed_clock_in, proposed_clock_out, reason, status, created_at')
      .single()

    if (error) {
      setActionMessage({ type: 'error', text: error.message || 'Pengajuan koreksi gagal disimpan.' })
      setIsSubmittingCorrection(false)
      return
    }

    if (incentiveNote.trim()) {
      const { error: noteError } = await supabase
        .from('d3_attendances')
        .update({ notes: incentiveNote.trim() })
        .eq('id', selectedItem.id)
      if (noteError) {
        setActionMessage({ type: 'error', text: `Koreksi tersimpan, tetapi catatan insentif gagal disimpan: ${noteError.message}` })
      }
    }

    const correction: AttendanceCorrection = {
      ...data,
      created_at: new Date(data.created_at).toLocaleString('id-ID'),
    }
    const updated = attendances.map((item) => item.id === selectedItem.id ? { ...item, correction } : item)
    setAttendances(updated)
    setSelectedItem({ ...selectedItem, correction })
    setIsCorrectionOpen(false)
    setCorrectionReason('')
    setProposedClockIn('')
    setProposedClockOut('')
    setIncentiveNote('')
    setActionMessage({ type: 'success', text: 'Koreksi berhasil diajukan dan menunggu persetujuan HR.' })
    setIsSubmittingCorrection(false)
    setTimeout(() => setActionMessage(null), 4000)
  }

  // Helper perhitungan durasi kerja dengan batas minimum 7 jam.
  const calculateDuration = (clockIn: string, clockOut: string | null) => {
    if (!clockOut) return { text: 'Incomplete', isUnderMin: true }
    const start = new Date(clockIn).getTime()
    const end = new Date(clockOut).getTime()
    if (isNaN(start) || isNaN(end)) return { text: 'Incomplete', isUnderMin: true }
    const diffHours = (end - start) / (1000 * 60 * 60)
    return {
      text: `${diffHours.toFixed(1)} Jam`,
      isUnderMin: diffHours < 7.0,
    }
  }

  // Filter Data Tab & Search
  const filteredData = useMemo(() => {
    return attendances.filter((item) => {
      const matchesSearch =
        item.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.employee_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.department.toLowerCase().includes(searchQuery.toLowerCase())

      if (!matchesSearch) return false
      if (activeTab === 'ALL') return true
      return item.correction?.status === activeTab
    })
  }, [attendances, searchQuery, activeTab])

  if (appRole === 'EMPLOYEE') {
    const employeeItem = selectedItem || attendances[0]
    const pendingCount = attendances.filter((item) => item.correction?.status === 'PENDING').length

    return (
      <>
        <div className="min-h-screen bg-[#f7f8ff] text-[#121b2e]">
          <header className="sticky top-0 z-30 flex h-16 items-center border-b border-[#d9e2fc] bg-white px-4 shadow-[0_1px_1px_rgba(0,0,0,0.05)] sm:px-6">
            <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3">
              <div className="hidden items-center gap-3 sm:flex"><span className="font-bold">ANDIMA HRMS</span><span className="h-5 border-l border-[#d9e2fc]" /><span className="text-xs font-semibold text-[#3f4940]">HRMS</span><ChevronRight size={13} className="text-[#4d5f81]/50" /><span className="text-xs font-semibold text-[#006838]">My Attendance</span></div>
              <span className="text-sm font-bold sm:hidden">Attendance</span>
              <div className="flex items-center gap-2 sm:gap-3"><button type="button" onClick={fetchAttendanceData} className="grid size-9 place-items-center rounded-lg text-[#4d5f81] hover:bg-[#f1f3ff]" aria-label="Refresh"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /></button><button type="button" className="relative grid size-9 place-items-center rounded-lg text-[#4d5f81]" aria-label="Notifikasi"><Bell size={17} /><span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#d64545]" /></button><HeaderAccount /></div>
            </div>
          </header>
          <section className="border-b border-[#d9e2fc] bg-white px-4 py-5 sm:px-6"><div className="mx-auto max-w-[1600px]"><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#006838]">Employee self service</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.4px]">Riwayat Presensi Saya</h1><p className="mt-1 text-sm text-[#4d5f81]">Halo, {viewerName || 'Employee'}. Tinjau detail kehadiran dan ajukan koreksi bila ada data yang perlu diperbaiki.</p></div></section>
          {actionMessage && <div className={`mx-4 mt-4 flex items-center gap-2 rounded-lg border p-3 text-xs font-semibold sm:mx-6 ${actionMessage.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}`}><CheckCircle2 size={16} />{actionMessage.text}</div>}
          {errorMessage && <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 sm:mx-6"><AlertCircle size={16} />{errorMessage}</div>}
          <main className="mx-auto grid max-w-[1600px] gap-5 px-4 py-6 xl:grid-cols-[minmax(0,1fr)_390px] sm:px-6">
            <section className="overflow-hidden rounded-xl border border-[#becabd]/45 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]"><div className="flex items-center justify-between border-b border-[#becabd]/35 px-5 py-4"><div><h2 className="text-sm font-bold">Riwayat kehadiran</h2><p className="mt-1 text-xs text-[#4d5f81]">{attendances.length} catatan presensi tercatat</p></div><span className="rounded-full bg-[#edf6ff] px-2.5 py-1 text-[10px] font-bold text-[#1971c2]">{pendingCount} koreksi pending</span></div>{loading ? <div className="flex min-h-[260px] items-center justify-center text-xs text-[#4d5f81]"><RefreshCw size={18} className="mr-2 animate-spin text-[#006838]" />Memuat riwayat presensi...</div> : attendances.length === 0 ? <div className="flex min-h-[260px] items-center justify-center p-6 text-center text-xs text-[#4d5f81]">Belum ada riwayat presensi.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-xs"><thead><tr className="border-b border-[#becabd]/35 bg-[#f7f8ff] text-[10px] font-bold uppercase tracking-[0.08em] text-[#4d5f81]"><th className="px-4 py-3">Tanggal</th><th className="px-3 py-3">Clock in / out</th><th className="px-3 py-3">Durasi</th><th className="px-3 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{attendances.map((row) => { const duration = calculateDuration(row.clock_in, row.clock_out); const selected = employeeItem?.id === row.id; return <tr key={row.id} onClick={() => setSelectedItem(row)} className={`cursor-pointer transition hover:bg-[#f7f8ff] ${selected ? 'bg-[#eaf7f0]' : ''}`}><td className="px-4 py-3.5 font-semibold">{row.date}</td><td className="px-3 py-3.5 text-[#4d5f81]">{new Date(row.clock_in).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB <span className="mx-1 text-[#becabd]">/</span> {row.clock_out ? `${new Date(row.clock_out).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB` : '-'}</td><td className="px-3 py-3.5"><span className={duration.isUnderMin ? 'font-semibold text-[#b7791f]' : 'font-semibold'}>{duration.text}</span></td><td className="px-3 py-3.5"><div className="flex flex-wrap gap-1"><span className={`rounded px-2 py-0.5 text-[10px] font-bold ${duration.isUnderMin ? 'bg-[#fef9c3] text-[#b7791f]' : 'bg-[#eaf7f0] text-[#16834b]'}`}>{duration.isUnderMin ? 'DI BAWAH 7 JAM' : 'MEMENUHI 7 JAM'}</span>{row.correction && <span className="rounded bg-[#edf6ff] px-2 py-0.5 text-[10px] font-bold text-[#1971c2]">Koreksi: {row.correction.status}</span>}</div></td></tr> })}</tbody></table></div>}</section>
            {employeeItem && <aside className="h-fit rounded-xl border border-[#becabd]/45 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"><div className="flex items-start justify-between border-b border-[#becabd]/35 pb-3"><div><span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#4d5f81]">Detail presensi</span><h2 className="mt-1 text-sm font-bold">{employeeItem.date}</h2><p className="text-xs text-[#4d5f81]">{employeeItem.employee_id} • {employeeItem.department}</p></div><Clock3 size={18} className="text-[#006838]" /></div><div className="mt-4 space-y-2 rounded-xl border border-[#becabd]/35 bg-[#f7f8ff] p-3 text-xs"><div className="flex justify-between text-[#4d5f81]"><span>Clock In</span><strong>{new Date(employeeItem.clock_in).toLocaleTimeString('id-ID')} WIB</strong></div><div className="flex justify-between text-[#4d5f81]"><span>Clock Out</span><strong>{employeeItem.clock_out ? `${new Date(employeeItem.clock_out).toLocaleTimeString('id-ID')} WIB` : 'Belum ada scan'}</strong></div><div className="flex justify-between border-t border-[#becabd]/35 pt-2 text-[#4d5f81]"><span>Sumber</span><strong className="text-[#1971c2]">{employeeItem.source}</strong></div>{employeeItem.notes && <div className="border-t border-[#becabd]/35 pt-2 text-[#4d5f81]"><span className="font-semibold">Catatan insentif/lembur:</span><p className="mt-1 text-[#121b2e]">{employeeItem.notes}</p></div>}</div>{employeeItem.correction ? <div className="mt-4 rounded-xl border border-[#b9d6ff] bg-[#edf6ff] p-3.5 text-xs"><div className="flex justify-between font-bold text-[#1e3765]"><span>Pengajuan koreksi</span><span>{employeeItem.correction.status}</span></div><p className="mt-2 text-[#4d5f81]">{employeeItem.correction.reason}</p></div> : <p className="mt-4 rounded-xl border border-dashed border-[#becabd] p-3 text-center text-xs italic text-[#4d5f81]">Belum ada pengajuan koreksi untuk tanggal ini.</p>}<button type="button" disabled={!!employeeItem.correction || isSubmittingCorrection} onClick={() => { setCorrectionType('CLOCK_IN'); setIsCorrectionOpen(true) }} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#16834b] py-2.5 text-xs font-bold text-white hover:bg-[#006838] disabled:cursor-not-allowed disabled:opacity-50"><FilePlus2 size={14} />{employeeItem.correction ? 'Koreksi sudah diajukan' : 'Ajukan koreksi'}</button></aside>}
          </main>
        </div>
        {isCorrectionOpen && employeeItem && <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f2342]/45 p-4"><section role="dialog" aria-modal="true" className="w-full max-w-lg rounded-xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-[#d9e2fc] px-5 py-4"><div><h2 className="text-lg font-bold">Ajukan koreksi presensi</h2><p className="mt-1 text-xs text-[#4d5f81]">Tanggal {employeeItem.date} akan dikirim ke HR untuk ditinjau.</p></div><button type="button" onClick={() => setIsCorrectionOpen(false)} className="rounded p-1.5 text-[#4d5f81] hover:bg-[#f1f3ff]" aria-label="Tutup"><X size={18} /></button></div><form onSubmit={handleSubmitCorrection} className="space-y-4 p-5"><label className="block text-xs font-bold text-[#121b2e]">Tipe koreksi<select value={correctionType} onChange={(event) => setCorrectionType(event.target.value as CorrectionType)} className="mt-1 w-full rounded-lg border border-[#d9e2fc] bg-white px-3 py-2.5 text-xs font-normal outline-none focus:border-[#069494]"><option value="CLOCK_IN">Perbaikan Clock In</option><option value="CLOCK_OUT">Perbaikan Clock Out</option><option value="FULL_DAY">Perbaikan satu hari penuh</option></select></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Clock In yang benar<input type="time" value={proposedClockIn} onChange={(event) => setProposedClockIn(event.target.value)} className="mt-1 w-full rounded-lg border border-[#d9e2fc] px-3 py-2.5 text-xs font-normal" /></label><label className="text-xs font-bold">Clock Out yang benar<input type="time" value={proposedClockOut} onChange={(event) => setProposedClockOut(event.target.value)} className="mt-1 w-full rounded-lg border border-[#d9e2fc] px-3 py-2.5 text-xs font-normal" /></label></div><label className="block text-xs font-bold">Catatan lembur / insentif (opsional)<textarea value={incentiveNote} onChange={(event) => setIncentiveNote(event.target.value)} className="mt-1 min-h-16 w-full resize-y rounded-lg border border-[#d9e2fc] p-3 text-xs font-normal outline-none focus:border-[#069494]" placeholder="Isi jika jam kerja melebihi jam formal dan membutuhkan catatan insentif" /></label><label className="block text-xs font-bold">Alasan pengajuan<textarea required minLength={10} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} className="mt-1 min-h-24 w-full resize-y rounded-lg border border-[#d9e2fc] p-3 text-xs font-normal outline-none focus:border-[#069494]" placeholder="Jelaskan alasan koreksi (minimal 10 karakter)" /></label><div className="flex justify-end gap-2 border-t border-[#d9e2fc] pt-4"><button type="button" onClick={() => setIsCorrectionOpen(false)} className="rounded-lg px-3 py-2 text-xs font-bold text-[#4d5f81] hover:bg-[#f1f3ff]">Batal</button><button type="submit" disabled={isSubmittingCorrection || correctionReason.trim().length < 10} className="inline-flex items-center gap-2 rounded-lg bg-[#16834b] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><FilePlus2 size={14} />{isSubmittingCorrection ? 'Mengirim...' : 'Kirim pengajuan'}</button></div></form></section></div>}
      </>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-[#f7f8ff] text-[#121b2e]">
        {/* HEADER */}
        <header className="sticky top-0 z-30 flex h-16 items-center border-b border-[#d9e2fc] bg-white px-4 shadow-[0_1px_1px_rgba(0,0,0,0.05)] sm:px-6">
          <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3">
            <div className="hidden min-w-0 items-center gap-3 sm:flex">
              <span className="font-bold text-[#121b2e]">ANDIMA HRMS</span>
              <span className="h-5 border-l border-[#d9e2fc]" />
              <span className="text-xs font-semibold text-[#3f4940]">HRMS</span>
              <ChevronRight size={13} className="text-[#4d5f81]/50" />
              <span className="truncate text-xs font-semibold text-[#006838]">Attendance & Correction</span>
            </div>
            <span className="text-sm font-bold text-[#121b2e] sm:hidden">Attendance</span>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={fetchAttendanceData}
                title="Refresh Data dari Supabase"
                className="grid size-9 place-items-center rounded-lg text-[#4d5f81] transition hover:bg-[#f1f3ff]"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>

              <button type="button" className="relative grid size-9 place-items-center rounded-lg text-[#4d5f81] transition hover:bg-[#f1f3ff]" aria-label="Notifikasi">
                <Bell size={17} />
                <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-[#d64545]" />
              </button>
              <HeaderAccount />
            </div>
          </div>
        </header>

        {/* SECTION TITLE & TABS */}
        <section className="border-b border-[#d9e2fc] bg-white px-4 py-5 sm:px-6">
          <div className="mx-auto flex max-w-[1600px] flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h1 className="text-2xl font-bold tracking-[-0.4px] text-[#121b2e]">Attendance & Correction Management</h1>
              <p className="mt-1 text-sm text-[#4d5f81]">
                Kelola riwayat presensi, validasi minimum 7 jam kerja, dan persetujuan koreksi absensi yang terhubung ke database Supabase.
              </p>
            </div>
            {/* <span className="inline-flex w-fit items-center rounded-full border border-[#006838]/25 bg-[#eaf7f0] px-3 py-1.5 text-xs font-bold text-[#006838]">
              Role: HR / Manager
            </span> */}
          </div>

          {actionMessage && (
            <div
              className={`mx-auto mt-4 flex max-w-[1600px] items-center gap-2 rounded-lg border p-3 text-xs font-semibold ${
                actionMessage.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {actionMessage.type === 'success' ? <CheckCircle2 size={16} className="shrink-0" /> : <AlertCircle size={16} className="shrink-0" />}
              <span>{actionMessage.text}</span>
            </div>
          )}

          {errorMessage && (
            <div className="mx-auto mt-4 flex max-w-[1600px] items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="mx-auto mt-5 flex max-w-[1600px] flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-wrap gap-1 border-b border-[#d9e2fc] text-xs font-semibold">
              <button
                onClick={() => setActiveTab('ALL')}
                className={`pb-2 px-3 transition ${
                  activeTab === 'ALL'
                    ? 'border-b-2 border-[#069494] text-[#006838] font-bold'
                    : 'text-[#4d5f81] hover:text-[#121b2e]'
                }`}
              >
                Semua ({attendances.length})
              </button>
              <button
                onClick={() => setActiveTab('PENDING')}
                className={`pb-2 px-3 transition ${
                  activeTab === 'PENDING'
                    ? 'border-b-2 border-[#069494] text-[#006838] font-bold'
                    : 'text-[#4d5f81] hover:text-[#121b2e]'
                }`}
              >
                Menunggu Persetujuan ({attendances.filter((i) => i.correction?.status === 'PENDING').length})
              </button>
              <button
                onClick={() => setActiveTab('APPROVED')}
                className={`pb-2 px-3 transition ${
                  activeTab === 'APPROVED'
                    ? 'border-b-2 border-[#069494] text-[#006838] font-bold'
                    : 'text-[#4d5f81] hover:text-[#121b2e]'
                }`}
              >
                Disetujui ({attendances.filter((i) => i.correction?.status === 'APPROVED').length})
              </button>
            </div>

            <input
              type="text"
              placeholder="Cari nama, NIP, atau divisi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-[#d9e2fc] bg-[#f1f3ff] px-3 py-2 text-xs outline-none transition placeholder:text-[#4d5f81]/70 focus:border-[#069494] focus:ring-2 focus:ring-[#069494]/15 sm:w-64"
            />
          </div>
        </section>

        {/* MAIN BODY: TABLE + DRAWER */}
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-6 xl:flex-row sm:px-6">
          <div className="min-w-0 flex-1 overflow-hidden rounded-xl border border-[#becabd]/45 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center text-xs text-[#4d5f81]">
                <RefreshCw size={18} className="mr-2 animate-spin text-[#006838]" />
                <span>Memuat data kehadiran karyawan dari Supabase...</span>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center p-6 text-center text-xs text-[#4d5f81]">
                <AlertCircle size={32} className="text-[#becabd]" />
                <p className="mt-2 font-bold text-[#121b2e]">Tidak ada data presensi</p>
                <p className="mt-1">Tidak ada data yang cocok dengan kriteria filter atau pencarian Anda.</p>
              </div>
            ) : (
              <div className="overflow-x-auto flex-1">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#becabd]/35 bg-[#f7f8ff] text-[10px] font-bold uppercase tracking-[0.08em] text-[#4d5f81]">
                      <th className="px-4 py-3">Employee</th>
                      <th className="px-3 py-3">Tanggal</th>
                      <th className="px-3 py-3">Clock In / Out</th>
                      <th className="px-3 py-3">Durasi Kerja</th>
                      <th className="px-3 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredData.map((row) => {
                      const duration = calculateDuration(row.clock_in, row.clock_out)
                      const isSelected = selectedItem?.id === row.id

                      const clockInTime = new Date(row.clock_in)
                      const clockOutTime = row.clock_out ? new Date(row.clock_out) : null

                      return (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedItem(row)}
                          className={`cursor-pointer transition hover:bg-[#f7f8ff] ${
                            isSelected ? 'bg-[#eaf7f0]' : ''
                          }`}
                        >
                          <td className="px-4 py-3.5">
                            <div className="text-xs font-bold text-[#121b2e]">{row.full_name}</div>
                            <div className="mt-0.5 text-[10px] text-[#4d5f81]">{row.employee_id} • {row.department}</div>
                          </td>
                          <td className="px-3 py-3.5 font-medium text-[#3f4940]">{row.date}</td>
                          <td className="px-3 py-3.5 text-[#4d5f81]">
                            <div>
                              In:{' '}
                              {!isNaN(clockInTime.getTime())
                                ? clockInTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                                : '-'}{' '}
                              WIB
                            </div>
                            <div>
                              Out:{' '}
                              {clockOutTime && !isNaN(clockOutTime.getTime())
                                ? `${clockOutTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB`
                                : '-'}
                            </div>
                          </td>
                          <td className="px-3 py-3.5">
                            <span className={`font-semibold ${duration.isUnderMin ? 'text-[#b7791f]' : 'text-[#121b2e]'}`}>
                              {duration.text}
                            </span>
                            {duration.isUnderMin && (
                              <span className="mt-0.5 block text-[9px] font-bold text-[#b7791f]">&lt; 7 Jam Kerja</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5">
                            <div className="flex flex-col gap-1 items-start">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  duration.isUnderMin ? 'bg-[#fef9c3] text-[#b7791f]' : 'bg-[#eaf7f0] text-[#16834b]'
                                }`}
                              >
                                {duration.isUnderMin ? 'DI BAWAH 7 JAM' : 'MEMENUHI 7 JAM'}
                              </span>
                              {row.correction && (
                                <span
                                  className={`rounded px-2 py-0.5 text-[9px] font-bold ${
                                    row.correction.status === 'APPROVED'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : row.correction.status === 'REJECTED'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-[#edf6ff] text-[#1971c2]'
                                  }`}
                                >
                                  Koreksi: {row.correction.status}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* DRAWER PANEL DETAIL (KANAN) */}
          {selectedItem && (
            <div className="w-full shrink-0 overflow-y-auto rounded-xl border border-[#becabd]/45 bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] xl:w-[400px]">
              <div className="space-y-4">
                <div className="flex items-start justify-between border-b border-[#becabd]/35 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#4d5f81]">
                      Detail Presensi & Audit
                    </span>
                    <h3 className="mt-0.5 text-sm font-bold text-[#121b2e]">
                      {selectedItem.full_name}
                    </h3>
                    <p className="text-xs text-[#4d5f81]">{selectedItem.employee_id} • Tanggal {selectedItem.date}</p>
                  </div>
                </div>

                <div className="space-y-2 rounded-xl border border-[#becabd]/35 bg-[#f7f8ff] p-3 text-xs">
                  <div className="border-b border-[#becabd]/35 pb-1 font-bold text-[#121b2e]">
                    Data Log Original (Raw Fingerprint)
                  </div>
                  <div className="flex justify-between text-[#4d5f81]">
                    <span>Clock In:</span>
                    <span className="font-mono font-semibold">
                      {new Date(selectedItem.clock_in).toLocaleTimeString('id-ID')} WIB
                    </span>
                  </div>
                  <div className="flex justify-between text-[#4d5f81]">
                    <span>Clock Out:</span>
                    <span className="font-mono font-semibold">
                      {selectedItem.clock_out
                        ? `${new Date(selectedItem.clock_out).toLocaleTimeString('id-ID')} WIB`
                        : 'Tidak ada scan'}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-[#becabd]/35 pt-1 text-[11px] text-[#4d5f81]">
                    <span>Sumber Data:</span>
                    <span className="font-semibold text-[#1971c2]">{selectedItem.source}</span>
                  </div>
                </div>

                {selectedItem.correction ? (
                  <div
                    className={`space-y-2 rounded-xl border p-3.5 text-xs ${
                      selectedItem.correction.status === 'APPROVED'
                        ? 'border-emerald-200 bg-emerald-50/70'
                        : selectedItem.correction.status === 'REJECTED'
                        ? 'border-red-200 bg-red-50/70'
                        : 'border-[#b9d6ff] bg-[#edf6ff]'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold text-[#1e3765]">
                      <span>Pengajuan Koreksi Absensi</span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          selectedItem.correction.status === 'APPROVED'
                            ? 'bg-emerald-200 text-emerald-900'
                            : selectedItem.correction.status === 'REJECTED'
                            ? 'bg-red-200 text-red-900'
                            : 'bg-[#b9d6ff] text-[#1971c2]'
                        }`}
                      >
                        {selectedItem.correction.status}
                      </span>
                    </div>

                    <div className="space-y-1 text-[#4d5f81]">
                      <div>
                        <span className="font-semibold">Tipe Koreksi:</span> {selectedItem.correction.correction_type}
                      </div>
                      {selectedItem.correction.proposed_clock_in && (
                        <div>
                          <span className="font-semibold">Clock In Diajukan:</span> {selectedItem.correction.proposed_clock_in} WIB
                        </div>
                      )}
                      {selectedItem.correction.proposed_clock_out && (
                        <div>
                          <span className="font-semibold">Clock Out Diajukan:</span> {selectedItem.correction.proposed_clock_out} WIB
                        </div>
                      )}
                    </div>

                    <div className="border-t border-black/10 pt-2">
                      <span className="block font-semibold text-[#4d5f81]">Alasan Pengajuan (Wajib):</span>
                      <p className="mt-1 rounded border border-black/10 bg-white p-2 text-[11px] italic text-[#121b2e]">
                        &quot;{selectedItem.correction.reason}&quot;
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#becabd] bg-[#f7f8ff] p-3 text-center text-xs italic text-[#4d5f81]">
                    Tidak ada pengajuan koreksi aktif untuk tanggal ini.
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <div className="text-xs font-bold text-[#121b2e]">Progress & History Trail</div>
                  <div className="space-y-3 border-l-2 border-[#d9e2fc] pl-3 text-xs">
                    <div className="relative">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 absolute -left-[17px] top-1"></div>
                      <div className="font-semibold text-[#121b2e]">Log Presensi Diterima</div>
                      <div className="text-[10px] text-[#4d5f81]">Sistem Fingerprint • {selectedItem.date}</div>
                    </div>
                    {selectedItem.correction && (
                      <div className="relative">
                        <div className="absolute -left-[17px] top-1 size-2 rounded-full bg-[#1971c2]"></div>
                        <div className="font-semibold text-[#1971c2]">Pengajuan Koreksi Dibuat</div>
                        <div className="text-[10px] text-[#4d5f81]">
                          Oleh Pegawai • {selectedItem.correction.created_at}
                        </div>
                      </div>
                    )}
                    {selectedItem.correction && selectedItem.correction.status !== 'PENDING' && (
                      <div className="relative">
                        <div
                          className={`absolute -left-[17px] top-1 size-2 rounded-full ${
                            selectedItem.correction.status === 'APPROVED' ? 'bg-emerald-600' : 'bg-red-600'
                          }`}
                        ></div>
                        <div
                          className={`font-semibold ${
                            selectedItem.correction.status === 'APPROVED' ? 'text-emerald-700' : 'text-red-700'
                          }`}
                        >
                          Koreksi {selectedItem.correction.status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}
                        </div>
                        <div className="text-[10px] text-[#4d5f81]">Oleh HR Admin</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {selectedItem.correction?.status === 'PENDING' && (
                <div className="mt-4 flex gap-2 border-t border-[#becabd]/35 pt-4">
                  <button
                    type="button"
                    onClick={() => handleUpdateCorrectionStatus('APPROVED')}
                    className="flex-1 rounded-lg bg-[#16834b] py-2 text-xs font-bold text-white transition hover:bg-[#006838]"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateCorrectionStatus('REJECTED')}
                    className="flex-1 rounded-lg bg-[#d64545] py-2 text-xs font-bold text-white transition hover:bg-[#b4232b]"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
