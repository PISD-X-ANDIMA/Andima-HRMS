import { NextResponse } from 'next/server';
import { getSupabaseApiClient } from '@/utils/supabase/api';

export async function GET(request: Request, { params }: { params: Promise<{ position_id: string }> }) {
  try {
    const supabase = getSupabaseApiClient();
    const { position_id } = await params;

    // Ambil data posisi
    const { data: position, error: posError } = await supabase
      .from('d1_job_positions')
      .select('*')
      .eq('id', position_id)
      .single();

    if (posError || !position) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Posisi tidak ditemukan' } },
        { status: 404 }
      );
    }

    // Ambil relasi (Competencies, Certifications, KPIs) secara paralel
    const [compReq, certReq, kpiReq] = await Promise.all([
      supabase.from('d1_position_competency_map').select('*, d1_competencies(*)').eq('position_id', position_id),
      supabase.from('d1_position_certifications').select('*').eq('position_id', position_id),
      supabase.from('d1_kpi_definitions').select('*').eq('position_id', position_id)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...position,
        competencies: compReq.data || [],
        certifications: certReq.data || [],
        kpis: kpiReq.data || []
      }
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ position_id: string }> }) {
  try {
    const supabase = getSupabaseApiClient();
    const { position_id } = await params;
    const body = await request.json();

    const updatePayload: Record<string, any> = {};
    if (body.nama_posisi !== undefined) updatePayload.nama_posisi = body.nama_posisi;
    if (body.name !== undefined) updatePayload.nama_posisi = body.name;
    if (body.departemen !== undefined) updatePayload.departemen = body.departemen;
    if (body.department !== undefined) updatePayload.departemen = body.department;
    if (body.level_id !== undefined) updatePayload.level_id = body.level_id;
    if (body.level !== undefined) updatePayload.level_id = body.level;
    if (body.deskripsi_posisi !== undefined) updatePayload.deskripsi_posisi = body.deskripsi_posisi;
    if (body.deskripsi !== undefined) updatePayload.deskripsi_posisi = body.deskripsi;
    if (body.status_posisi !== undefined) updatePayload.status_posisi = body.status_posisi;
    if (body.status !== undefined) updatePayload.status_posisi = body.status;
    if (body.updated_at !== undefined) updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('d1_job_positions')
      .update(updatePayload)
      .eq('id', position_id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Position updated successfully',
      data: data
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ position_id: string }> }) {
  return PUT(request, context);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ position_id: string }> }) {
  try {
    const supabase = getSupabaseApiClient();
    const { position_id } = await params;

    // Soft delete sesuai FR-D1-001.8
    const { error } = await supabase
      .from('d1_job_positions')
      .update({ status_posisi: 'Inactive' })
      .eq('id', position_id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Position deleted (soft-delete) successfully'
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}