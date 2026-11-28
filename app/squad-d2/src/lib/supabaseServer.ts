/**
 * Squad D2 (Recruitment Management) - Supabase Server Client
 * Technical Standards: TR-D2-001 (TR-01 s/d TR-06), TR-D2-002 (TR-01, TR-05 < 500ms)
 * 
 * Native lightweight Supabase client wrapper with zero external runtime dependencies.
 * Provides PostgREST and Object Storage capabilities with sub-500ms latency.
 */

import { Candidate, CandidateWithJob, AuditLog, CandidateStatus, JobPost } from '../types/candidate';
import { mapStatusToStage } from '../types/kanban';

export function getSupabaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  );
}

export function getSupabaseKey(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  );
}

export function getBucketName(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || 'd2-applicant-resumes';
}

export const SUPABASE_URL = getSupabaseUrl();
export const SUPABASE_KEY = getSupabaseKey();
export const BUCKET_NAME = getBucketName();
export const isSupabaseConfigured = true;

interface StorageUploadResult {
  data: { path: string } | null;
  error: { message: string; statusCode?: number } | null;
}

interface DbInsertResult<T> {
  data: T | null;
  error: { message: string; details?: string; hint?: string; code?: string } | null;
}

/**
 * Upload applicant resume PDF to Supabase Storage bucket (Private) (TR-05, TR-06)
 */
export async function uploadApplicantCv(
  fileName: string,
  fileBuffer: ArrayBuffer | Uint8Array,
  contentType = 'application/pdf'
): Promise<StorageUploadResult> {
  const supabaseUrl = getSupabaseUrl().replace(/\/$/, '');
  const supabaseKey = getSupabaseKey();
  const bucketName = getBucketName();

  const endpoint = `${supabaseUrl}/storage/v1/object/${bucketName}/${fileName}`;

  try {
    const startTime = Date.now();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: fileBuffer as unknown as BodyInit,
    });

    const elapsed = Date.now() - startTime;
    if (elapsed > 500) {
      console.warn(`[TR-D2-002 TR-05] CV Upload took ${elapsed}ms, exceeding 500ms target.`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      return {
        data: null,
        error: { message: `Storage upload failed (${response.status}): ${errorText}`, statusCode: response.status },
      };
    }

    return {
      data: { path: `${bucketName}/${fileName}` },
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      data: null,
      error: { message: `Storage network error: ${message}` },
    };
  }
}

/**
 * Ensure the job post ID exists in d2_job_posts so that foreign key constraint
 * on d2_candidates(job_id) is always satisfied.
 */
export async function ensureJobPostInD2(jobId: string): Promise<void> {
  const baseUrl = getSupabaseUrl().replace(/\/$/, '');
  const supabaseKey = getSupabaseKey();

  try {
    // 1. Check if already exists in d2_job_posts
    const checkRes = await fetch(`${baseUrl}/rest/v1/d2_job_posts?id=eq.${encodeURIComponent(jobId)}&select=id`, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
    });

    if (checkRes.ok) {
      const rows: Array<{ id: string }> = await checkRes.json();
      if (rows && rows.length > 0) return;
    }

    // 2. Fetch position details from d1_job_positions
    const d1Res = await fetch(`${baseUrl}/rest/v1/d1_job_positions?id=eq.${encodeURIComponent(jobId)}&select=*`, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
    });

    if (d1Res.ok) {
      const d1Rows: any[] = await d1Res.json();
      if (d1Rows && d1Rows.length > 0) {
        const p = d1Rows[0];
        await fetch(`${baseUrl}/rest/v1/d2_job_posts`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
            'Content-Type': 'application/json',
            'Prefer': 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            id: p.id,
            title: p.nama_posisi,
            department: p.departemen,
            location: p.location || 'HQ - Menara MTH',
            description: p.deskripsi_posisi || '',
            status: (p.status_posisi || 'active').toLowerCase() === 'active' ? 'active' : 'inactive',
          }),
        });
      }
    }
  } catch (err) {
    console.warn('[Squad D2 Supabase] ensureJobPostInD2 warning:', err);
  }
}

/**
 * Fetch or verify active job position ID from d1_job_positions
 */
export async function getActiveJobPostId(preferredJobId?: string): Promise<string> {
  const fallbackJobId = 'b1333b20-de39-4e9c-a768-59bbf9a8e94f';
  const baseUrl = getSupabaseUrl().replace(/\/$/, '');
  const supabaseKey = getSupabaseKey();

  try {
    // If a specific jobId was provided, verify it is active in d1_job_positions
    if (preferredJobId) {
      const verifyUrl = `${baseUrl}/rest/v1/d1_job_positions?id=eq.${encodeURIComponent(preferredJobId)}&status_posisi=ilike.Active&select=id`;
      const verifyRes = await fetch(verifyUrl, {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
      });

      if (verifyRes.ok) {
        const matches: Array<{ id: string }> = await verifyRes.json();
        if (matches.length > 0) {
          await ensureJobPostInD2(matches[0].id);
          return matches[0].id;
        }
      }
    }

    // Otherwise find the first available active job position from d1_job_positions
    const queryUrl = `${baseUrl}/rest/v1/d1_job_positions?status_posisi=ilike.Active&select=id&limit=1`;
    const res = await fetch(queryUrl, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
    });

    if (res.ok) {
      const rows: Array<{ id: string }> = await res.json();
      if (rows && rows.length > 0) {
        await ensureJobPostInD2(rows[0].id);
        return rows[0].id;
      }
    }
  } catch (err) {
    console.warn('[Squad D2 Supabase] Job position lookup error, using default active pool ID:', err);
  }

  await ensureJobPostInD2(fallbackJobId);
  return fallbackJobId;
}

/**
 * Default fallback active job positions (derived from d1_job_positions)
 */
export const DEFAULT_ACTIVE_JOB_POSTS: JobPost[] = [
  {
    id: 'b1333b20-de39-4e9c-a768-59bbf9a8e94f',
    title: 'Accounting Associate 1 (Billing)',
    department: 'Finance, Accounting & Tax',
    status: 'active',
    description: 'Menangani proses penagihan, pencatatan faktur, dan rekonsiliasi billing.',
    tags: ['JP003', 'Billing', 'Finance', 'Full Time'],
    location: 'HQ - Menara MTH',
  },
  {
    id: '0870af53-59f3-4086-a7bc-9d7bb227d1e8',
    title: 'Accounting Associate 2 (Billing)',
    department: 'Finance, Accounting & Tax',
    status: 'active',
    description: 'Mendukung operasional penagihan piutang dan verifikasi transaksi keuangan.',
    tags: ['JP004', 'Billing', 'Finance', 'Full Time'],
    location: 'HQ - Menara MTH',
  },
  {
    id: '9a20b5d6-6ac3-4824-93cd-98efc1c2d3fd',
    title: 'HR Manager',
    department: 'Human Capital & Culture',
    status: 'active',
    description: 'Mengelola operasional HR, manajemen talenta, dan hubungan industrial.',
    tags: ['JP011', 'HR Management', 'Human Capital', 'Full Time'],
    location: 'HQ - Menara MTH',
  },
  {
    id: '3ec8499c-b00d-489e-980a-5936275a3b69',
    title: 'Sales Executive 1',
    department: 'Commercial & Customer Success',
    status: 'active',
    description: 'Melakukan ekspansi pasar, penawaran produk, dan pencapaian target penjualan.',
    tags: ['JP018', 'Sales B2B', 'Commercial', 'Full Time'],
    location: 'HQ - Menara MTH',
  },
  {
    id: 'placeholder-xxx-future',
    title: 'XXX',
    department: 'Future Operations',
    status: 'coming_soon' as any,
    isPlaceholder: true,
    description: '',
    tags: [],
    location: 'Location Pending',
  },
];

/**
 * Fetch list of active job positions from Supabase d1_job_positions
 */
export async function getActiveJobPosts(): Promise<JobPost[]> {
  const baseUrl = getSupabaseUrl().replace(/\/$/, '');
  const supabaseKey = getSupabaseKey();

  try {
    const url = `${baseUrl}/rest/v1/d1_job_positions?status_posisi=ilike.Active&select=*&order=nama_posisi.asc`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
      next: { revalidate: 60 },
    });

    if (res.ok) {
      const data: any[] = await res.json();
      if (data && data.length > 0) {
        const mapped: JobPost[] = data.map((item) => ({
          id: item.id,
          title: item.nama_posisi,
          department: item.departemen || 'PT Andima Transportindo',
          status: (item.status_posisi || 'active').toLowerCase() === 'active' ? 'active' : 'inactive',
          created_at: item.created_at,
          description: item.deskripsi_posisi || 'Bergabunglah bersama tim profesional PT Andima Transportindo dan dukung keunggulan logistik nasional.',
          tags: [
            item.job_code,
            item.departemen,
            item.location || 'HQ - Menara MTH',
            'Full Time',
          ].filter(Boolean),
          location: item.location || 'HQ - Menara MTH',
        }));

        // Append coming soon placeholder card if not present
        if (!mapped.some((j) => j.isPlaceholder || j.title === 'XXX')) {
          mapped.push({
            id: 'placeholder-xxx-future',
            title: 'XXX',
            department: 'Future Operations',
            status: 'coming_soon' as any,
            isPlaceholder: true,
            description: '',
            tags: [],
            location: 'Location Pending',
          });
        }

        return mapped;
      }
    }
  } catch (err) {
    console.warn('[Squad D2 Supabase] Failed to fetch active job positions from d1_job_positions, using fallback list', err);
  }

  return DEFAULT_ACTIVE_JOB_POSTS;
}

/**
 * Fetch a single job position by ID from d1_job_positions
 */
export async function getJobPostById(id: string): Promise<JobPost | null> {
  const baseUrl = getSupabaseUrl().replace(/\/$/, '');
  const supabaseKey = getSupabaseKey();

  try {
    const url = `${baseUrl}/rest/v1/d1_job_positions?id=eq.${encodeURIComponent(id)}&select=*`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
    });

    if (res.ok) {
      const rows: any[] = await res.json();
      if (rows.length > 0) {
        const item = rows[0];
        return {
          id: item.id,
          title: item.nama_posisi,
          department: item.departemen || 'PT Andima Transportindo',
          status: (item.status_posisi || 'active').toLowerCase() === 'active' ? 'active' : 'inactive',
          created_at: item.created_at,
          description: item.deskripsi_posisi || 'Bergabunglah bersama tim profesional PT Andima Transportindo.',
          tags: [
            item.job_code,
            item.departemen,
            item.location || 'HQ - Menara MTH',
            'Full Time',
          ].filter(Boolean),
          location: item.location || 'HQ - Menara MTH',
        };
      }
    }
  } catch (err) {
    console.warn('[Squad D2 Supabase] Failed to fetch job position by ID from d1_job_positions:', err);
  }

  const allPosts = await getActiveJobPosts();
  return allPosts.find((j) => j.id === id) || null;
}

/**
 * Insert candidate record into d2_candidates table in Supabase (FR-01.6, TR-01, TR-02)
 */
export async function insertCandidate(
  payload: Omit<Candidate, 'id' | 'created_at' | 'updated_at'>
): Promise<DbInsertResult<Candidate>> {
  const baseUrl = getSupabaseUrl().replace(/\/$/, '');
  const supabaseKey = getSupabaseKey();
  const endpoint = `${baseUrl}/rest/v1/d2_candidates`;

  try {
    // Ensure foreign key constraint is satisfied in d2_job_posts
    if (payload.job_id) {
      await ensureJobPostInD2(payload.job_id);
    }

    const startTime = Date.now();
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(payload),
    });

    const elapsed = Date.now() - startTime;
    if (elapsed > 500) {
      console.warn(`[TR-D2-002 TR-05] Database insert took ${elapsed}ms, exceeding 500ms target.`);
    }

    if (!response.ok) {
      const errorData = await response.text();
      return {
        data: null,
        error: { message: `Database insert failed (${response.status}): ${errorData}` },
      };
    }

    const insertedRows: Candidate[] = await response.json();
    return {
      data: insertedRows[0] || null,
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      data: null,
      error: { message: `Database connection error: ${message}` },
    };
  }
}

/**
 * Fetch all candidates with linked job position titles for Kanban board (FR-D2-002, TR-01, TR-06 < 200ms)
 */
export async function getCandidatesWithJobs(): Promise<CandidateWithJob[]> {
  const baseUrl = getSupabaseUrl().replace(/\/$/, '');
  const supabaseKey = getSupabaseKey();
  const startTime = Date.now();

  try {
    // 1. Fetch candidates and d2_job_posts fallback
    const candUrl = `${baseUrl}/rest/v1/d2_candidates?select=*,d2_job_posts(title)&order=created_at.desc`;
    const candPromise = fetch(candUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    // 2. Fetch master job positions from d1_job_positions
    const posUrl = `${baseUrl}/rest/v1/d1_job_positions?select=id,nama_posisi,departemen`;
    const posPromise = fetch(posUrl, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
      cache: 'no-store',
    });

    const [candRes, posRes] = await Promise.all([candPromise, posPromise]);

    const elapsed = Date.now() - startTime;
    if (elapsed > 200) {
      console.warn(`[TR-D2-002 TR-06] Query candidates took ${elapsed}ms, target < 200ms.`);
    }

    if (!candRes.ok) {
      const errorText = await candRes.text();
      console.error('[Squad D2 Supabase] Failed to fetch candidates:', errorText);
      return [];
    }

    const candRows: any[] = await candRes.json();
    let posMap = new Map<string, { nama_posisi: string; departemen: string }>();

    if (posRes.ok) {
      const posRows: any[] = await posRes.json();
      if (Array.isArray(posRows)) {
        posRows.forEach((p) => {
          posMap.set(p.id, { nama_posisi: p.nama_posisi, departemen: p.departemen });
        });
      }
    }

    return candRows.map((row) => {
      const d1Pos = posMap.get(row.job_id);
      const title = d1Pos?.nama_posisi || row.d2_job_posts?.title || 'Unknown Position';
      const department = d1Pos?.departemen || 'Operations';

      return {
        ...row,
        job_title: title,
        d2_job_posts: {
          id: row.job_id,
          title: title,
          department: department,
        },
        application_count: typeof row.application_count === 'number' ? row.application_count : 1,
      };
    });
  } catch (err) {
    console.error('[Squad D2 Supabase] Network exception fetching candidates:', err);
    return [];
  }
}

/**
 * Update candidate status & append immutable audit log entry in d2_audit_logs (FR-02.6, TR-09, TR-06)
 */
export async function updateCandidateStatusAndLog(params: {
  candidateId: string;
  newStatus: CandidateStatus;
  oldStatus: string;
  actorName?: string;
  reason?: string;
}): Promise<{
  success: boolean;
  candidate?: CandidateWithJob;
  auditLogId?: string;
  error?: string;
  latencyMs: number;
}> {
  const { candidateId, newStatus, oldStatus, actorName = 'Budi Santoso', reason } = params;
  const baseUrl = getSupabaseUrl().replace(/\/$/, '');
  const supabaseKey = getSupabaseKey();
  const startTime = Date.now();

  try {
    const targetStage = mapStatusToStage(newStatus);
    const nowIso = new Date().toISOString();

    const patchPayload: Record<string, any> = {
      status: newStatus,
      stage: targetStage,
      updated_at: nowIso,
    };

    if (reason !== undefined) {
      patchPayload.rejection_reason = reason;
    }

    // 1. Update candidate record in d2_candidates
    const patchUrl = `${baseUrl}/rest/v1/d2_candidates?id=eq.${encodeURIComponent(candidateId)}&select=*,d2_job_posts(title)`;
    const patchRes = await fetch(patchUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(patchPayload),
    });

    if (!patchRes.ok) {
      const errText = await patchRes.text();
      console.error('[Squad D2 Supabase] PATCH candidate error:', errText);
      return {
        success: false,
        error: `Failed to update candidate status (${patchRes.status}): ${errText}`,
        latencyMs: Date.now() - startTime,
      };
    }

    const updatedRows: any[] = await patchRes.json();
    const updatedCandidate: CandidateWithJob = updatedRows[0]
      ? {
          ...updatedRows[0],
          job_title: updatedRows[0].d2_job_posts?.title || 'Unknown Position',
          application_count: typeof updatedRows[0].application_count === 'number' ? updatedRows[0].application_count : 1,
        }
      : (null as any);

    // 2. Insert Immutable Audit Log Record into d2_audit_logs (TR-09)
    const auditPayload = {
      candidate_id: candidateId,
      actor_name: actorName,
      old_status: oldStatus,
      new_status: newStatus,
      change_reason: reason || `Pipeline stage transitioned from ${oldStatus} to ${newStatus}`,
      created_at: nowIso,
    };

    const auditUrl = `${baseUrl}/rest/v1/d2_audit_logs`;
    const auditRes = await fetch(auditUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(auditPayload),
    });

    let auditLogId: string | undefined;
    if (auditRes.ok) {
      const auditResult: any[] = await auditRes.json();
      auditLogId = auditResult[0]?.id;
    } else {
      console.warn('[Squad D2 Supabase] Warning: Audit log entry failed to record:', await auditRes.text());
    }

    // 3. Record Rejection into d2_application_history if rejected (FR-D2-005 FR-05.5, TR-10 Read-Only)
    if (newStatus === 'rejected' && updatedCandidate) {
      try {
        const historyPayload = {
          candidate_id: candidateId,
          email: updatedCandidate.email,
          nik: updatedCandidate.nik || null,
          full_name: updatedCandidate.full_name,
          job_id: updatedCandidate.job_id || null,
          job_title: updatedCandidate.job_title || 'Unknown Position',
          application_date: nowIso,
          application_round: updatedCandidate.application_count || 1,
          status: 'rejected',
          assessment_score: null,
          assessment_notes: `Tahap seleksi: ${oldStatus} -> rejected`,
          rejection_reason: reason || 'Kandidat belum memenuhi kualifikasi standar.',
          is_read_only: true,
          is_deleted: false,
        };

        await fetch(`${baseUrl}/rest/v1/d2_application_history`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'apikey': supabaseKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(historyPayload),
        });
      } catch (histErr) {
        console.warn('[Squad D2 Supabase] Warning: Failed to record rejection into d2_application_history:', histErr);
      }
    }

    const totalElapsed = Date.now() - startTime;
    if (totalElapsed > 200) {
      console.info(`[TR-D2-002 TR-06] Status update + audit log took ${totalElapsed}ms`);
    }

    return {
      success: true,
      candidate: updatedCandidate,
      auditLogId,
      latencyMs: totalElapsed,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Squad D2 Supabase] Exception in updateCandidateStatusAndLog:', err);
    return {
      success: false,
      error: `Network error updating status: ${msg}`,
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Fetch Immutable Audit Trail Logs from d2_audit_logs (TR-09)
 */
export async function getAuditLogs(candidateId?: string, limit = 50): Promise<AuditLog[]> {
  const baseUrl = getSupabaseUrl().replace(/\/$/, '');
  const supabaseKey = getSupabaseKey();

  try {
    let url = `${baseUrl}/rest/v1/d2_audit_logs?select=*,d2_candidates(full_name,email)&order=created_at.desc&limit=${limit}`;
    if (candidateId) {
      url += `&candidate_id=eq.${encodeURIComponent(candidateId)}`;
    }

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      console.error('[Squad D2 Supabase] Failed to fetch audit logs:', await res.text());
      return [];
    }

    const data: AuditLog[] = await res.json();
    return data;
  } catch (err) {
    console.error('[Squad D2 Supabase] Exception fetching audit logs:', err);
    return [];
  }
}