import { NextResponse } from 'next/server';
import { getSupabaseApiClient } from '@/utils/supabase/api';

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseApiClient();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100); 
    const department = searchParams.get('department') || searchParams.get('departemen');
    const status = searchParams.get('status') || searchParams.get('status_posisi');
    const search = searchParams.get('search');
    
    const start = (page - 1) * limit;
    const end = start + limit - 1;

    let query = supabase.from('d1_job_positions').select('*', { count: 'exact' });

    if (department && department !== 'ALL') {
      query = query.or(`departemen.eq.${department},department.eq.${department}`);
    }
    if (status && status !== 'ALL') {
      query = query.or(`status_posisi.eq.${status},status.eq.${status}`);
    }
    if (search) {
      query = query.or(`nama_posisi.ilike.%${search}%,name.ilike.%${search}%,position_code.ilike.%${search}%`);
    }

    const { data, count, error } = await query.order('created_at', { ascending: false }).range(start, end);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      data: {
        total: count || 0,
        page: page,
        limit: limit,
        positions: data || []
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
    
    const namaPosisi = body.nama_posisi || body.name || body.title;
    const departemen = body.departemen || body.department;
    const deskripsi = body.deskripsi_posisi || body.deskripsi || body.description;
    const statusPosisi = body.status_posisi || body.status || 'Active';
    // const positionCode = body.position_code || body.kode_posisi || `POS-${Math.floor(1000 + Math.random() * 9000)}`;

    if (!namaPosisi || !departemen) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: [{ field: 'all', message: 'Nama posisi dan departemen wajib diisi' }]
        }
      }, { status: 400 });
    }

    const payload: Record<string, any> = {
      nama_posisi: namaPosisi,
      departemen: departemen,
      status_posisi: statusPosisi,
    };

    if (deskripsi !== undefined) payload.deskripsi_posisi = deskripsi;
    // if (positionCode !== undefined) payload.position_code = positionCode;

    const { data, error } = await supabase
      .from('d1_job_positions')
      .insert([payload])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { 
        return NextResponse.json({
          success: false,
          error: { code: 'CONFLICT', message: 'Posisi dengan nama/kode ini sudah ada' }
        }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: 'Position created successfully',
      data: data
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: err.message } },
      { status: 500 }
    );
  }
}
