import { NextResponse } from 'next/server';
import { getSupabaseApiClient } from '@/utils/supabase/api';

export async function GET(request: Request, { params }: { params: Promise<{ competency_id: string }> }) {
  try {
    const supabase = getSupabaseApiClient();
    const { competency_id } = await params;

    const { data, error } = await supabase
      .from('d1_competencies')
      .select('*')
      .eq('id', competency_id)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Kompetensi tidak ditemukan' } },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ competency_id: string }> }) {
  try {
    const supabase = getSupabaseApiClient();
    const { competency_id } = await params;
    const body = await request.json();

    const updatePayload: Record<string, any> = {};
    if (body.competency_name !== undefined) updatePayload.competency_name = body.competency_name;
    if (body.name !== undefined) updatePayload.competency_name = body.name;
    if (body.category !== undefined) updatePayload.category = body.category;
    if (body.description !== undefined) updatePayload.description = body.description;

    const { data, error } = await supabase
      .from('d1_competencies')
      .update(updatePayload)
      .eq('id', competency_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Competency updated successfully',
      data: data
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ competency_id: string }> }) {
  return PUT(request, context);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ competency_id: string }> }) {
  try {
    const supabase = getSupabaseApiClient();
    const { competency_id } = await params;

    const { error } = await supabase
      .from('d1_competencies')
      .delete()
      .eq('id', competency_id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Competency deleted successfully'
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}
