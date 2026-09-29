import { NextResponse } from 'next/server';
import { getSupabaseApiClient } from '@/utils/supabase/api';

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseApiClient();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const start = (page - 1) * limit;
    const end = start + limit - 1;

    let query = supabase.from('d1_competencies').select('*', { count: 'exact' });

    if (category && category !== 'ALL') {
      query = query.eq('category', category);
    }
    if (search) {
      query = query.or(`competency_name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, count, error } = await query.range(start, end);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        total: count || 0,
        page,
        limit,
        competencies: data || []
      }
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

    const competencyName = body.competency_name || body.name || body.nama_kompetensi;
    const category = body.category || body.kategori || 'General';
    const description = body.description || body.deskripsi || null;

    if (!competencyName) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Nama kompetensi (competency_name) wajib diisi' } },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('d1_competencies')
      .insert([{
        competency_name: competencyName,
        category: category,
        description: description
      }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { success: false, error: { code: 'CONFLICT', message: 'Kompetensi dengan nama ini sudah ada' } },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Competency created successfully',
      data: data
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}
