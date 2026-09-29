import { NextResponse } from 'next/server';
import { getSupabaseApiClient } from '@/utils/supabase/api';

export async function GET(request: Request, { params }: { params: Promise<{ position_id: string }> }) {
  try {
    const supabase = getSupabaseApiClient();
    const { position_id } = await params;

    const { data, error } = await supabase
      .from('d1_position_competency_map')
      .select(`
        competency_id,
        minimum_level,
        is_required,
        d1_competencies ( competency_name )
      `)
      .eq('position_id', position_id);

    if (error) throw error;

    // Formatting data agar sesuai dengan struktur respons FR-D1-005
    const formattedData = (data || []).map((item: any) => ({
      competency_id: item.competency_id,
      competency_name: item.d1_competencies?.competency_name || null,
      minimum_level: item.minimum_level,
      is_required: item.is_required
    }));

    return NextResponse.json({
      success: true,
      data: formattedData
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ position_id: string }> }) {
  try {
    const supabase = getSupabaseApiClient();
    const { position_id } = await params;
    const body = await request.json();

    if (!body.competency_id || body.minimum_level === undefined) {
      return NextResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'competency_id dan minimum_level wajib diisi' }
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('d1_position_competency_map')
      .insert([{
        position_id: position_id,
        competency_id: body.competency_id,
        minimum_level: body.minimum_level,
        is_required: body.is_required !== undefined ? body.is_required : true
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({
          success: false,
          error: { code: 'CONFLICT', message: 'Kompetensi ini sudah menjadi persyaratan posisi ini' }
        }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Competency added successfully',
      data: data
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}
