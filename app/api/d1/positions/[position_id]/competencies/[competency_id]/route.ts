import { NextResponse } from 'next/server';
import { getSupabaseApiClient } from '@/utils/supabase/api';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ position_id: string; competency_id: string }> }
) {
  try {
    const supabase = getSupabaseApiClient();
    const { position_id, competency_id } = await params;
    const body = await request.json();

    const updatePayload: Record<string, any> = {};
    if (body.minimum_level !== undefined) updatePayload.minimum_level = body.minimum_level;
    if (body.is_required !== undefined) updatePayload.is_required = body.is_required;

    const { data, error } = await supabase
      .from('d1_position_competency_map')
      .update(updatePayload)
      .match({ position_id, competency_id })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Competency requirement updated successfully',
      data: data
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ position_id: string; competency_id: string }> }
) {
  return PUT(request, context);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ position_id: string; competency_id: string }> }
) {
  try {
    const supabase = getSupabaseApiClient();
    const { position_id, competency_id } = await params;

    const { error } = await supabase
      .from('d1_position_competency_map')
      .delete()
      .match({ position_id, competency_id });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Competency removed successfully'
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}