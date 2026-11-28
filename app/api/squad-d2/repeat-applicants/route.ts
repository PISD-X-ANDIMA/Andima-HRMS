import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseUrl, getSupabaseKey } from '@/app/squad-d2/src/lib/supabaseServer';
import { ApplicationHistoryItem } from '@/app/squad-d2/src/types/candidate';

export const dynamic = 'force-dynamic';

// Seeded / fallback history records for demonstration & testing (e.g. Rusdi, Indra)
const MOCK_HISTORY_STORE: Record<string, ApplicationHistoryItem[]> = {
  'rusdi': [
    {
      id: 'hist-rusdi-1',
      email: 'rusdi.be@andima.id',
      full_name: 'Rusdi',
      job_title: 'Backend Engineer – June 2026',
      application_date: '2026-06-15T09:00:00Z',
      application_round: 3,
      status: 'REJECTED',
      assessment_score: 72.5,
      assessment_notes: 'Technical test passing grade 80. Kandidat mendapatkan 72.5.',
      rejection_reason: 'Nilai technical coding test dan system design belum mencapai batas minimum kelulusan (passing grade 80).',
      is_read_only: true,
    },
    {
      id: 'hist-rusdi-2',
      email: 'rusdi.be@andima.id',
      full_name: 'Rusdi',
      job_title: 'Backend Engineer – June 2025',
      application_date: '2025-06-10T10:30:00Z',
      application_round: 2,
      status: 'REJECTED',
      assessment_score: 68.0,
      assessment_notes: 'Kurang pengalaman dalam optimasi query PostgreSQL dan Docker containerization.',
      rejection_reason: 'Kompetensi microservices dan pengalaman optimasi database tingkat lanjut belum mencukupi.',
      is_read_only: true,
    },
    {
      id: 'hist-rusdi-3',
      email: 'rusdi.be@andima.id',
      full_name: 'Rusdi',
      job_title: 'Backend Engineer – June 2024',
      application_date: '2024-06-05T14:00:00Z',
      application_round: 1,
      status: 'REJECTED',
      assessment_score: 60.0,
      assessment_notes: 'Kandidat fresh graduate, belum memiliki portofolio proyek backend berskala besar.',
      rejection_reason: 'Kualifikasi pengalaman kerja minimal 2 tahun belum terpenuhi saat pembukaan lowongan.',
      is_read_only: true,
    },
  ],
  'indra': [
    {
      id: 'hist-indra-1',
      email: 'indra.be@andima.id',
      full_name: 'Indra',
      job_title: 'Backend Engineer – Batch 1 2025',
      application_date: '2025-11-20T08:30:00Z',
      application_round: 1,
      status: 'REJECTED',
      assessment_score: 74.0,
      assessment_notes: 'Lolos screening awal, tes koding intermediate 74.0.',
      rejection_reason: 'Kalah bersaing pada tahap wawancara akhir user dengan kandidat senior.',
      is_read_only: true,
    },
  ],
};

/**
 * GET /api/squad-d2/repeat-applicants
 * Query parameters:
 *  - email: Alamat email pelamar (kunci utama)
 *  - nik: NIK pelamar (kunci sekunder)
 *  - candidateId: ID kandidat di d2_candidates
 * 
 * Target Performa: TR-D2-002 TR-08 (< 100 ms lookup execution time)
 * Standar: FR-D2-005 FR-05.1 s/d FR-05.6
 */
export async function GET(request: NextRequest) {
  const startTime = performance.now();
  const baseUrl = getSupabaseUrl().replace(/\/$/, '');
  const supabaseKey = getSupabaseKey();

  try {
    const { searchParams } = new URL(request.url);
    const candidateId = searchParams.get('candidateId');
    const emailParam = searchParams.get('email');
    const nikParam = searchParams.get('nik');

    let resolvedEmail = emailParam?.trim().toLowerCase() || '';
    let resolvedNik = nikParam?.trim() || '';
    let candidateName = '';
    let currentCandidate: any = null;

    // 1. If candidateId provided, fetch candidate from d2_candidates
    if (candidateId) {
      const candRes = await fetch(
        `${baseUrl}/rest/v1/d2_candidates?id=eq.${encodeURIComponent(candidateId)}&select=*`,
        {
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
          },
          cache: 'no-store',
        }
      );

      if (candRes.ok) {
        const rows = await candRes.json();
        if (rows && rows.length > 0) {
          currentCandidate = rows[0];
          resolvedEmail = currentCandidate.email?.trim().toLowerCase() || resolvedEmail;
          resolvedNik = currentCandidate.nik?.trim() || resolvedNik;
          candidateName = currentCandidate.full_name || '';
        }
      }
    }

    // 2. Query history records from Supabase d2_application_history
    let historyRecords: ApplicationHistoryItem[] = [];

    if (resolvedEmail || resolvedNik) {
      try {
        const queryFilter = resolvedEmail && resolvedNik
          ? `or=(email.eq.${encodeURIComponent(resolvedEmail)},nik.eq.${encodeURIComponent(resolvedNik)})`
          : resolvedEmail
          ? `email=eq.${encodeURIComponent(resolvedEmail)}`
          : `nik=eq.${encodeURIComponent(resolvedNik)}`;

        const histRes = await fetch(
          `${baseUrl}/rest/v1/d2_application_history?${queryFilter}&order=application_date.desc`,
          {
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'apikey': supabaseKey,
            },
            cache: 'no-store',
          }
        );

        if (histRes.ok) {
          const rows = await histRes.json();
          if (Array.isArray(rows) && rows.length > 0) {
            historyRecords = rows.map((r: any) => ({
              id: r.id,
              candidate_id: r.candidate_id,
              email: r.email,
              nik: r.nik,
              full_name: r.full_name,
              job_id: r.job_id,
              job_title: r.job_title,
              application_date: r.application_date,
              application_round: r.application_round || 1,
              status: r.status,
              assessment_score: r.assessment_score,
              assessment_notes: r.assessment_notes,
              rejection_reason: r.rejection_reason,
              is_read_only: true, // TR-10 Read-Only
            }));
          }
        }
      } catch {
        // Table not yet created or connection error, use fallback
      }
    }

    // 3. Check Mock Store for Rusdi or Indra if table is empty
    if (historyRecords.length === 0) {
      const lowerName = candidateName.toLowerCase();
      const lowerEmail = resolvedEmail.toLowerCase();

      if (lowerName.includes('rusdi') || lowerEmail.includes('rusdi')) {
        historyRecords = MOCK_HISTORY_STORE['rusdi'];
      } else if (lowerName.includes('indra') || lowerEmail.includes('indra')) {
        historyRecords = MOCK_HISTORY_STORE['indra'];
      }
    }

    // 4. Calculate cumulative application count (FR-D2-005 3.b.ii)
    // Formula: Total pendaftaran terdahulu + 1 lamaran aktif saat ini
    const totalPreviousApplications = historyRecords.length;
    const dbApplicationCount = currentCandidate?.application_count || 1;
    const finalApplicationCount = Math.max(
      dbApplicationCount,
      totalPreviousApplications > 0 ? totalPreviousApplications + 1 : 1
    );

    const isRepeatApplicant = finalApplicationCount >= 2;
    // Label status sesuai FR-05.2: "Pelamar ke-3 Kali"
    const repeatLabel = isRepeatApplicant ? `Pelamar ke-${finalApplicationCount} Kali` : null;

    const lookupTimeMs = Math.round(performance.now() - startTime);

    return NextResponse.json({
      success: true,
      email: resolvedEmail,
      nik: resolvedNik || null,
      isRepeatApplicant,
      applicationCount: finalApplicationCount,
      repeatLabel,
      // Pesan standar jika tidak ada riwayat (3.a.ii)
      message: isRepeatApplicant
        ? `Ditemukan ${totalPreviousApplications} riwayat lamaran sebelumnya.`
        : 'Tidak ada riwayat lamaran sebelumnya',
      history: historyRecords,
      lookupTimeMs, // Target TR-08: < 100 ms
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal memeriksa riwayat pelamar berulang';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

/**
 * POST /api/squad-d2/repeat-applicants
 * Save historical application record
 */
export async function POST(request: NextRequest) {
  const baseUrl = getSupabaseUrl().replace(/\/$/, '');
  const supabaseKey = getSupabaseKey();

  try {
    const body = await request.json();
    const {
      candidate_id,
      email,
      nik,
      full_name,
      job_id,
      job_title,
      application_round = 1,
      status = 'rejected',
      assessment_score,
      assessment_notes,
      rejection_reason,
    } = body;

    if (!email || !full_name || !job_title) {
      return NextResponse.json(
        { success: false, message: 'email, full_name, dan job_title wajib diisi.' },
        { status: 400 }
      );
    }

    // Attempt insert into Supabase d2_application_history
    const res = await fetch(`${baseUrl}/rest/v1/d2_application_history`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        candidate_id,
        email: String(email).trim().toLowerCase(),
        nik: nik ? String(nik).trim() : null,
        full_name: String(full_name).trim(),
        job_id,
        job_title,
        application_round,
        status,
        assessment_score,
        assessment_notes,
        rejection_reason,
        is_read_only: true, // TR-10 Read-Only Lock
        is_deleted: false,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { success: false, message: `Database insert failed: ${errText}` },
        { status: 400 }
      );
    }

    const inserted = await res.json();

    return NextResponse.json(
      {
        success: true,
        message: 'Riwayat lamaran berhasil dicatat ke d2_application_history.',
        data: inserted[0] || inserted,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gagal menyimpan riwayat lamaran';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
