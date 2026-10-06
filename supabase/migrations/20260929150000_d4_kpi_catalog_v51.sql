-- KPI Scorecard V5.1 becomes the active assessment baseline.
-- V3.1 rows stay in the catalog so assessments made against V3.1 keep a valid reference.
-- Safe to run more than once: constraints are dropped only if present and the new unique key has a fixed name.
-- Rollback: supabase/rollbacks/20260929150000_d4_kpi_catalog_v51_down.sql
alter table public.d4_kpi_role_catalog drop constraint if exists d4_kpi_role_catalog_pkey;
alter table public.d4_kpi_role_catalog drop constraint if exists d4_kpi_role_catalog_role_name_kpi_name_key;
alter table public.d4_kpi_role_catalog drop constraint if exists d4_kpi_role_catalog_version_role_kpi_key;
-- Name Postgres generated when an earlier copy of this file added the unique key without a name.
alter table public.d4_kpi_role_catalog drop constraint if exists d4_kpi_role_catalog_source_version_role_name_kpi_name_key;
alter table public.d4_kpi_role_catalog add primary key (source_version, role_order, indicator_order);
alter table public.d4_kpi_role_catalog add constraint d4_kpi_role_catalog_version_role_kpi_key unique (source_version, role_name, kpi_name);

-- Transcribed from sheet "KPI LIST PER POSISI" of KPI_Scorecard V5.1. The workbook has no targets.
insert into public.d4_kpi_role_catalog (role_order,role_name,indicator_order,kpi_name,target,weight_percent,source_version) values
  (1,'Vice President / CEO',1,'Pencapaian Target Laba Bersih Perusahaan',null,25,'V5.1'),
  (1,'Vice President / CEO',2,'Pertumbuhan Pendapatan (Revenue Growth) YoY',null,25,'V5.1'),
  (1,'Vice President / CEO',3,'Ekspansi Layanan & Strategi Kemitraan',null,20,'V5.1'),
  (1,'Vice President / CEO',4,'Tingkat Retensi Karyawan Kunci',null,15,'V5.1'),
  (1,'Vice President / CEO',5,'Kepatuhan Hukum & Manajemen Risiko',null,15,'V5.1'),
  (2,'Director',1,'Pencapaian Target Pendapatan Operasional',null,25,'V5.1'),
  (2,'Director',2,'Eksekusi Rencana Strategis Perusahaan',null,20,'V5.1'),
  (2,'Director',3,'Efisiensi Biaya Operasional Keseluruhan',null,20,'V5.1'),
  (2,'Director',4,'Indeks Kepuasan Klien / Customer Satisfaction Score',null,20,'V5.1'),
  (2,'Director',5,'Pengembangan Inovasi Layanan Baru',null,15,'V5.1'),
  (3,'Operations Director',1,'Persentase Pengiriman Tepat Waktu (On-Time Delivery)',null,25,'V5.1'),
  (3,'Operations Director',2,'Zero Fatal Customs/Regulatory Penalty',null,25,'V5.1'),
  (3,'Operations Director',3,'Optimalisasi Kapasitas Handling & Vendor',null,20,'V5.1'),
  (3,'Operations Director',4,'SLA Resolusi Komplain Operasional',null,15,'V5.1'),
  (3,'Operations Director',5,'Indeks Produktivitas & Workload Balance Tim Operasional',null,15,'V5.1'),
  (4,'Branch Manager',1,'Pencapaian Target Revenue Cabang',null,25,'V5.1'),
  (4,'Branch Manager',2,'Pertumbuhan Klien Baru di Cabang',null,20,'V5.1'),
  (4,'Branch Manager',3,'Efisiensi Biaya Operasional Cabang',null,20,'V5.1'),
  (4,'Branch Manager',4,'SLA Waktu Handling Operasional Cabang',null,20,'V5.1'),
  (4,'Branch Manager',5,'Tingkat Retensi Karyawan Cabang',null,15,'V5.1'),
  (5,'Customs Clearance & PPJK',1,'Kecepatan Proses Customs Clearance (PIB/PEB)',null,30,'V5.1'),
  (5,'Customs Clearance & PPJK',2,'Akurasi Dokumen & Zero Nota Pembetulan',null,25,'V5.1'),
  (5,'Customs Clearance & PPJK',3,'Kepatuhan Update Regulasi Bea Cukai',null,15,'V5.1'),
  (5,'Customs Clearance & PPJK',4,'Kelancaran Koordinasi Lapangan',null,15,'V5.1'),
  (5,'Customs Clearance & PPJK',5,'Efektivitas Penanganan Jalur Merah',null,15,'V5.1'),
  (6,'Airfreight / Seafreight Ops Staff',1,'Akurasi Booking Space Maskapai/Pelayaran',null,25,'V5.1'),
  (6,'Airfreight / Seafreight Ops Staff',2,'Ketepatan Waktu Penerbitan Dokumen (AWB/BL)',null,25,'V5.1'),
  (6,'Airfreight / Seafreight Ops Staff',3,'Keberhasilan Konsolidasi Kargo',null,20,'V5.1'),
  (6,'Airfreight / Seafreight Ops Staff',4,'Zero Claim/Damage pada Kargo',null,15,'V5.1'),
  (6,'Airfreight / Seafreight Ops Staff',5,'Update Status Shipment Tepat Waktu ke Klien',null,15,'V5.1'),
  (7,'Warehousing / Logistics Staff',1,'Akurasi Inventory Gudang',null,25,'V5.1'),
  (7,'Warehousing / Logistics Staff',2,'Ketepatan Waktu Proses Inbound/Outbound',null,25,'V5.1'),
  (7,'Warehousing / Logistics Staff',3,'Zero Safety Incident di Gudang',null,20,'V5.1'),
  (7,'Warehousing / Logistics Staff',4,'Kepatuhan Penanganan Dangerous Goods',null,15,'V5.1'),
  (7,'Warehousing / Logistics Staff',5,'Utilisasi Ruang Gudang',null,15,'V5.1'),
  (8,'Implant Staff (EDI & Manifest Input)',1,'Akurasi Input Data Sistem Bea Cukai',null,35,'V5.1'),
  (8,'Implant Staff (EDI & Manifest Input)',2,'Lead Time Input Data per Job',null,25,'V5.1'),
  (8,'Implant Staff (EDI & Manifest Input)',3,'Kehadiran & Disiplin Kerja di Lokasi Klien',null,20,'V5.1'),
  (8,'Implant Staff (EDI & Manifest Input)',4,'Meminimalkan Delay Akibat Salah Input',null,10,'V5.1'),
  (8,'Implant Staff (EDI & Manifest Input)',5,'Komunikasi Cepat dengan Tim Utama',null,10,'V5.1'),
  (9,'Sales & Marketing',1,'Pencapaian Target Volume Penjualan',null,35,'V5.1'),
  (9,'Sales & Marketing',2,'Akuisisi Klien Baru',null,25,'V5.1'),
  (9,'Sales & Marketing',3,'Akurasi Pemberian Quotation/Penawaran Harga',null,15,'V5.1'),
  (9,'Sales & Marketing',4,'Win Rate dari Total Quotation',null,15,'V5.1'),
  (9,'Sales & Marketing',5,'Kualitas Serah Terima Order ke Operasional',null,10,'V5.1'),
  (10,'Finance & Administration',1,'Kecepatan Penerbitan Invoice (SLA < 24 jam)',null,25,'V5.1'),
  (10,'Finance & Administration',2,'Akurasi Pembukuan Sistem & Krishand GL',null,25,'V5.1'),
  (10,'Finance & Administration',3,'Ketepatan Waktu Pembayaran & Reimbursement',null,20,'V5.1'),
  (10,'Finance & Administration',4,'Efektivitas Collection/Penagihan Piutang',null,15,'V5.1'),
  (10,'Finance & Administration',5,'Kerapian Arsip Keuangan & Kepatuhan Pajak',null,15,'V5.1')
on conflict (source_version, role_order, indicator_order) do update set
  role_name = excluded.role_name,
  kpi_name = excluded.kpi_name,
  target = excluded.target,
  weight_percent = excluded.weight_percent;

-- Each assessment records the catalog version it was scored against.
alter table public.d4_kpi_assessments
  add column if not exists definition_version text not null default 'V3.1' check (definition_version in ('V3.1', 'V5.1'));
alter table public.d4_kpi_assessments alter column definition_version set default 'V5.1';

create or replace function public.d4_calculate_kpi_assessment() returns trigger
language plpgsql set search_path = public as $$
declare
  role_title text;
  indicator_count integer;
  total_weight integer;
  template_name text;
  template_weight integer;
  line jsonb;
  raw_score integer;
  weighted_total numeric := 0;
  all_scored boolean := true;
  item integer;
begin
  select min(role_name), count(*), sum(weight_percent)
    into role_title, indicator_count, total_weight
    from public.d4_kpi_role_catalog
    where source_version = new.definition_version and role_order = new.role_order;
  if indicator_count <> 5 or total_weight <> 100 or new.role_name is distinct from role_title then
    raise exception 'Jabatan KPI dan total bobot harus sesuai katalog %', new.definition_version;
  end if;

  for item in 1..5 loop
    select kpi_name, weight_percent into template_name, template_weight
      from public.d4_kpi_role_catalog
      where source_version = new.definition_version and role_order = new.role_order and indicator_order = item;
    line := new.lines -> (item - 1);
    if line->>'indicator_order' is distinct from item::text
       or line->>'kpi_name' is distinct from template_name
       or line->>'weight_percent' is distinct from template_weight::text then
      raise exception 'Indikator % harus sesuai katalog KPI %', item, new.definition_version;
    end if;
    if line->>'raw_score' is null or line->>'raw_score' = '' then
      all_scored := false;
    else
      raw_score := (line->>'raw_score')::integer;
      if raw_score < 1 or raw_score > 5 then
        raise exception 'Skor indikator % harus antara 1 dan 5', item;
      end if;
      weighted_total := weighted_total + template_weight * raw_score / 100.0;
    end if;
  end loop;

  if new.status = 'completed' and not all_scored then
    raise exception 'Seluruh lima indikator harus dinilai sebelum diselesaikan';
  end if;
  new.overall_score := case when all_scored then round(weighted_total, 2) else null end;
  return new;
end;
$$;
