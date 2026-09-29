import { NextResponse } from 'next/server';
import { getSupabaseApiClient } from '@/utils/supabase/api';

export async function GET(request: Request, { params }: { params: Promise<{ employee_id: string }> }) {
  try {
    const supabase = getSupabaseApiClient();
    const { employee_id } = await params;
    const { searchParams } = new URL(request.url);
    let positionId = searchParams.get('position_id');

    let positionName = 'Position Standard';
    let employeeName = `Employee ${employee_id}`;

    if (!positionId) {
      const { data: empData } = await supabase
        .from('employees')
        .select('position_id, full_name, name')
        .or(`id.eq.${employee_id},employee_id.eq.${employee_id}`)
        .maybeSingle();

      if (empData) {
        positionId = empData.position_id;
        employeeName = empData.full_name || empData.name || employeeName;
      }
    }

    if (!positionId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'position_id diperlukan untuk gap analysis' } },
        { status: 400 }
      );
    }

    const { data: posData } = await supabase
      .from('d1_job_positions')
      .select('nama_posisi, name')
      .eq('id', positionId)
      .maybeSingle();

    if (posData) {
      positionName = posData.nama_posisi || posData.name || positionName;
    }

    const { data: requiredComps, error: reqError } = await supabase
      .from('d1_position_competency_map')
      .select(`
        competency_id,
        minimum_level,
        is_required,
        d1_competencies ( competency_name, category )
      `)
      .eq('position_id', positionId);

    if (reqError) throw reqError;

    const { data: empComps } = await supabase
      .from('employee_competencies')
      .select('competency_id, current_level, level')
      .or(`employee_id.eq.${employee_id},id.eq.${employee_id}`);

    const actualComps = empComps || [
      { competency_id: 'comp-001', current_level: 3 }
    ];
    const summary = {
      total_competencies: (requiredComps || []).length,
      kompeten: 0,
      sedang: 0,
      signifikan: 0
    };

    const gaps = (requiredComps || []).map((req: any) => {
      const actual = actualComps.find((c: any) => c.competency_id === req.competency_id);
      const level_current = actual ? Number((actual as any).current_level || (actual as any).level || 0) : 0;
      const level_required = Number(req.minimum_level || 1);

      const gapValue = level_current - level_required;
      let gapStatus = "";
      let recommendation = "";

      if (gapValue >= 0) {
        gapStatus = "Kompeten";
        recommendation = "Maintain";
        summary.kompeten += 1;
      } else if (gapValue === -1) {
        gapStatus = "Kesenjangan Sedang";
        recommendation = "Latih";
        summary.sedang += 1;
      } else {
        gapStatus = "Kesenjangan Signifikan";
        recommendation = "Prioritas Pelatihan";
        summary.signifikan += 1;
      }

      return {
        competency_id: req.competency_id,
        competency_name: req.d1_competencies?.competency_name || req.competency_id,
        category: req.d1_competencies?.category || 'Technical',
        level_required: level_required,
        level_current: level_current,
        gap: gapValue,
        gap_status: gapStatus,
        recommendation: recommendation,
        is_required: req.is_required !== undefined ? req.is_required : true
      };
    });

    try {
      await supabase.from('d1_gap_analysis_history').insert([{
        employee_id: employee_id,
        position_id: positionId
      }]);
    } catch {
    }

    return NextResponse.json({
      success: true,
      data: {
        employee_id: employee_id,
        employee_name: employeeName,
        position_id: positionId,
        position_name: positionName,
        analysis_date: new Date().toISOString().split('T')[0],
        gaps: gaps,
        summary: summary
      }
    });

  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}
