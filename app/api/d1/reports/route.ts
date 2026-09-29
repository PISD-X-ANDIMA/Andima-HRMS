import { NextResponse } from 'next/server';
import { getSupabaseApiClient } from '@/utils/supabase/api';

export async function GET() {
  try {
    const supabase = getSupabaseApiClient();

    const [posRes, compRes, kpiRes, historyRes] = await Promise.all([
      supabase.from('d1_job_positions').select('id, status_posisi, departemen'),
      supabase.from('d1_competencies').select('id, category'),
      supabase.from('d1_kpi_definitions').select('id, position_id, kpi_weight'),
      supabase.from('d1_gap_analysis_history').select('id, created_at')
    ]);

    const positions = posRes.data || [];
    const competencies = compRes.data || [];
    const kpis = kpiRes.data || [];
    const history = historyRes.data || [];

    const activePositions = positions.filter(p => p.status_posisi === 'Active' || (p as any).status === 'Active');
    const inactivePositions = positions.length - activePositions.length;

    const positionKpiWeights: Record<string, number> = {};
    kpis.forEach(k => {
      if (k.position_id) {
        positionKpiWeights[k.position_id] = (positionKpiWeights[k.position_id] || 0) + Number(k.kpi_weight || 0);
      }
    });

    const compliantPositions = Object.values(positionKpiWeights).filter(weight => weight === 100).length;

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total_positions: positions.length,
          active_positions: activePositions.length,
          inactive_positions: inactivePositions,
          total_competencies: competencies.length,
          total_kpi_definitions: kpis.length,
          kpi_100pct_compliant_positions: compliantPositions,
          total_gap_analysis_runs: history.length
        },
        departments_count: Array.from(new Set(positions.map(p => p.departemen || (p as any).department))).filter(Boolean).length
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}
