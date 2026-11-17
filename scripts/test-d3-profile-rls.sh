#!/usr/bin/env bash
set -euo pipefail

# Runs the BUG-D3-002 pgTAP suite without the missing historical schema
# migrations. The database is a disposable Docker container, never Supabase
# production or the regular local development stack.

d3_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
d3_docker=(docker)
d3_container="andima-d3-profile-rls-test"
d3_image="public.ecr.aws/supabase/postgres:17.6.1.095"

cleanup() {
  "${d3_docker[@]}" stop "$d3_container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if "${d3_docker[@]}" ps --format '{{.Names}}' | grep -Fxq "$d3_container"; then
  echo "Using existing disposable D3 RLS test container."
else
  "${d3_docker[@]}" run --detach --rm \
    --name "$d3_container" \
    --env POSTGRES_PASSWORD=postgres \
    --env POSTGRES_DB=postgres \
    "$d3_image" >/dev/null
fi

for d3_attempt in $(seq 1 60); do
  if "${d3_docker[@]}" exec "$d3_container" \
    psql -U postgres -d postgres -Atqc 'select 1' >/dev/null 2>&1 \
    && ! "${d3_docker[@]}" exec "$d3_container" \
      pgrep -f '/docker-entrypoint-initdb.d/migrate.sh' >/dev/null 2>&1; then
    break
  fi

  if [ "$d3_attempt" -eq 60 ]; then
    "${d3_docker[@]}" logs "$d3_container" >&2
    echo "Timed out waiting for the disposable D3 RLS test database." >&2
    exit 1
  fi

  sleep 1
done

for d3_sql in \
  "$d3_root/scripts/d3-profile-rls-bootstrap.sql" \
  "$d3_root/supabase/migrations/20261109094307_d3_employee_profile_read_scope.sql" \
  "$d3_root/supabase/migrations/20261109095043_d3_employee_profile_scope_helper.sql"; do
  "${d3_docker[@]}" exec -i -e PGPASSWORD=postgres "$d3_container" \
    psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f - < "$d3_sql"
done

d3_tap_output="$("${d3_docker[@]}" exec -i -e PGPASSWORD=postgres "$d3_container" \
  psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -f - \
  < "$d3_root/supabase/tests/d3_employee_profile_read_scope.sql")"
printf '%s\n' "$d3_tap_output"

if grep -q '^not ok' <<< "$d3_tap_output"; then
  echo "D3 RLS pgTAP suite failed." >&2
  exit 1
fi

echo "D3 RLS pgTAP suite passed."
