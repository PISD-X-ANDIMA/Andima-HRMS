#!/usr/bin/env bash
# Mengekspor data D4 dari Supabase live (hanya membaca) ke 02_data.sql di folder ini.
# 02_data.sql tidak ikut di-commit (lihat .gitignore), karena berisi data pegawai.
# Butuh pg_dump versi 17 atau lebih baru, karena Supabase memakai Postgres 17. Di Mac: brew install postgresql@17
# Connection string diambil dari Supabase Dashboard > Connect (Session pooler), dan diketik saat diminta, tidak disimpan.
set -euo pipefail

cd "$(dirname "$0")"
PG_DUMP="${PG_DUMP:-pg_dump}"
"$PG_DUMP" --version

read -r -s -p "Connection string Supabase: " SUPABASE_DB_URL
echo

"$PG_DUMP" "$SUPABASE_DB_URL" --data-only --inserts --no-owner --no-privileges \
  -t public.position_requirements \
  -t public.d4_kpi_catalog_versions \
  -t public.d4_kpi_role_catalog \
  -t public.d4_position_kpi_roles \
  -t public.d4_competency_assessments \
  -t public.d4_performance_evaluations \
  -t public.d4_kpi_assessments \
  -t public.d4_kpi_daily_entries \
  -t public.d4_development_needs \
  -t public.d4_development_need_versions \
  -t public.d4_training_records \
  -t public.d4_training_versions \
  -f 02_data.sql

echo "Selesai: $(grep -c '^INSERT INTO' 02_data.sql) baris data di 02_data.sql"
