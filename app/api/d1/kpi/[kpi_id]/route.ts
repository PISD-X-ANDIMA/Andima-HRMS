import { NextResponse } from 'next/server';
import { getSupabaseApiClient } from '@/utils/supabase/api';

export async function PUT(request: Request, { params }: { params: Promise<{ kpi_id: string }> }) {
  try {
    const supabase = getSupabaseApiClient();
    const { kpi_id } = await params;
    const body = await request.json();

    const updatePayload: Record<string, any> = {};
    if (body.kpi_name !== undefined) updatePayload.kpi_name = body.kpi_name;
    if (body.name !== undefined) updatePayload.kpi_name = body.name;
    if (body.kpi_target !== undefined) updatePayload.kpi_target = body.kpi_target;
    if (body.target !== undefined) updatePayload.kpi_target = body.target;
    if (body.kpi_weight !== undefined) updatePayload.kpi_weight = body.kpi_weight;
    if (body.weight !== undefined) updatePayload.kpi_weight = body.weight;
    if (body.measurement_unit !== undefined) updatePayload.measurement_unit = body.measurement_unit;
    if (body.target_period !== undefined) updatePayload.target_period = body.target_period;

    const { data, error } = await supabase
      .from('d1_kpi_definitions')
      .update(updatePayload)
      .eq('id', kpi_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'KPI definition updated successfully',
      data: data
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ kpi_id: string }> }) {
  return PUT(request, context);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ kpi_id: string }> }) {
  try {
    const supabase = getSupabaseApiClient();
    const { kpi_id } = await params;

    const { error } = await supabase
      .from('d1_kpi_definitions')
      .delete()
      .eq('id', kpi_id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'KPI definition deleted successfully'
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}
