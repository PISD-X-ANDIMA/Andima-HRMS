import { NextResponse } from 'next/server';
import { getSupabaseApiClient } from '@/utils/supabase/api';

export async function GET(request: Request, { params }: { params: Promise<{ position_id: string }> }) {
  try {
    const supabase = getSupabaseApiClient();
    const { position_id } = await params;

    const { data, error } = await supabase
      .from('d1_position_certifications')
      .select('*')
      .eq('position_id', position_id);

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

export async function POST(request: Request, { params }: { params: Promise<{ position_id: string }> }) {
  try {
    const supabase = getSupabaseApiClient();
    const { position_id } = await params;
    const body = await request.json();

    const certName = body.certification_name || body.name || body.title;
    const issuingAuth = body.issuing_authority || body.issuing_organization || body.publisher;

    if (!certName) {
      return NextResponse.json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Nama sertifikasi (certification_name) wajib diisi' }
      }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('d1_position_certifications')
      .insert([{
        position_id: position_id,
        certification_name: certName,
        issuing_authority: issuingAuth || 'LSP / Instansi Berwenang',
        regulation_reference: body.regulation_reference || null,
        is_required: body.is_required !== undefined ? body.is_required : true,
        notes: body.notes || null
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({
          success: false,
          error: { code: 'CONFLICT', message: 'Sertifikasi dengan nama ini sudah ada di posisi ini' }
        }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Certification added successfully',
      data: data
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}
