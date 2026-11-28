-- ============================================================================
-- SQUAD D2: APPLICATION HISTORY TABLE (Prefix: d2_)
-- Specification: FR-D2-005 (Pelacakan Riwayat Pelamar Berulang & Jalur Pendaftaran)
-- Technical Standard: TR-D2-001 (TR-04 PII, TR-10 Read-Only), TR-D2-002 (TR-02 Prefix d2_, TR-08 < 100ms lookup, TR-10 Composite Index)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.d2_application_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES public.d2_candidates(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    nik VARCHAR(16) NULL,
    full_name VARCHAR(150) NOT NULL,
    job_id UUID REFERENCES public.d1_job_positions(id) ON DELETE SET NULL,
    job_title VARCHAR(255) NOT NULL,
    application_date TIMESTAMPTZ DEFAULT NOW(),
    application_round INT DEFAULT 1,
    status VARCHAR(50) DEFAULT 'rejected', -- 'applied', 'interviewed', 'rejected', 'offered'
    assessment_score NUMERIC(5,2) NULL, -- Nilai penilaian/assessment terdahulu (FR-05.4)
    assessment_notes TEXT NULL,
    rejection_reason TEXT NULL, -- Catatan alasan tertulis penolakan (FR-05.5)
    is_read_only BOOLEAN DEFAULT TRUE, -- TR-10 & 3.b.i: Riwayat dikunci secara permanen (Read-Only)
    is_deleted BOOLEAN DEFAULT FALSE, -- Standar soft delete (tidak pernah hard delete)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR FAST REPEAT APPLICANT LOOKUP (< 100ms Target - TR-D2-002 TR-08 & TR-10)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_d2_app_history_email ON public.d2_application_history(email);
CREATE INDEX IF NOT EXISTS idx_d2_app_history_nik ON public.d2_application_history(nik);
CREATE INDEX IF NOT EXISTS idx_d2_app_history_composite_lookup ON public.d2_application_history(email, nik);
CREATE INDEX IF NOT EXISTS idx_d2_app_history_candidate_id ON public.d2_application_history(candidate_id);
CREATE INDEX IF NOT EXISTS idx_d2_app_history_is_deleted ON public.d2_application_history(is_deleted);

-- Composite Index on d2_candidates for repeat applicant detection (TR-10.a.ii)
CREATE INDEX IF NOT EXISTS idx_d2_candidates_email_nik ON public.d2_candidates(email, nik);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) (TR-D2-001 TR-01 & TR-04)
-- ============================================================================
ALTER TABLE public.d2_application_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public/service-role read-write to d2_application_history"
    ON public.d2_application_history
    FOR ALL
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE public.d2_application_history IS 'Squad D2 - Rekam jejak riwayat pelamar berulang dan alasan penolakan masa lalu (FR-D2-005)';
