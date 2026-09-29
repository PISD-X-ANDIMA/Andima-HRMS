import { NextResponse } from 'next/server';
import { getSupabaseApiClient } from '@/utils/supabase/api';

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseApiClient();
    const { searchParams } = new URL(request.url);
    const positionId = searchParams.get('position_id');

    let query = supabase.from('d1_kpi_definitions').select('*');
    if (positionId) {
      query = query.eq('position_id', positionId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: data || []
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabaseApiClient();
    const body = await request.json();
    
    let kpiList: any[] = [];
    let positionId = body.position_id;

    if (Array.isArray(body)) {
      kpiList = body;
    } else if (Array.isArray(body.kpis)) {
      kpiList = body.kpis;
    } else {
      kpiList = [body];
    }

    if (kpiList.length === 0) {
      return NextResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Daftar KPI (kpis) tidak boleh kosong' }
      }, { status: 400 });
    }

    if (body.validate_total_weight !== false && kpiList.length > 1) {
      const totalWeight = kpiList.reduce((sum: number, kpi: any) => sum + Number(kpi.kpi_weight || kpi.weight || 0), 0);
      if (totalWeight !== 100) {
        return NextResponse.json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: `Total bobot KPI harus 100%. saat ini: ${totalWeight}%` }
        }, { status: 400 });
      }
    }

    const kpiPayload = kpiList.map((kpi: any) => ({
      position_id: kpi.position_id || positionId,
      kpi_name: kpi.kpi_name || kpi.name || kpi.title,
      kpi_target: kpi.kpi_target || kpi.target,
      kpi_weight: Number(kpi.kpi_weight || kpi.weight || 0),
      measurement_unit: kpi.measurement_unit || kpi.unit || null,
      target_period: kpi.target_period || kpi.period || 'Annual'
    }));

    const { data, error } = await supabase
      .from('d1_kpi_definitions')
      .insert(kpiPayload)
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'KPI definitions created successfully',
      data: data
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}
