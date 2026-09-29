import { NextResponse } from 'next/server';
import { getSupabaseApiClient } from '@/utils/supabase/api';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ position_id: string; certification_id: string }> }
) {
  try {
    const supabase = getSupabaseApiClient();
    const { position_id, certification_id } = await params;
    const body = await request.json();

    const updatePayload: Record<string, any> = {};
    if (body.certification_name !== undefined) updatePayload.certification_name = body.certification_name;
    if (body.name !== undefined) updatePayload.certification_name = body.name;
    if (body.issuing_authority !== undefined) updatePayload.issuing_authority = body.issuing_authority;
    if (body.regulation_reference !== undefined) updatePayload.regulation_reference = body.regulation_reference;
    if (body.is_required !== undefined) updatePayload.is_required = body.is_required;
    if (body.notes !== undefined) updatePayload.notes = body.notes;

    const { data, error } = await supabase
      .from('d1_position_certifications')
      .update(updatePayload)
      .match({ id: certification_id, position_id: position_id })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Certification updated successfully',
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
  context: { params: Promise<{ position_id: string; certification_id: string }> }
) {
  return PUT(request, context);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ position_id: string; certification_id: string }> }
) {
  try {
    const supabase = getSupabaseApiClient();
    const { position_id, certification_id } = await params;

    const { error } = await supabase
      .from('d1_position_certifications')
      .delete()
      .match({ id: certification_id, position_id: position_id });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Certification deleted successfully'
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}
