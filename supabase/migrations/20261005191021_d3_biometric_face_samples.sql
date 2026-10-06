-- Private image samples used only by the account-bound D3 biometric flow.
-- Files live in Storage; this table stores paths only, never public URLs.

alter table public.d3_face_biometric_templates
  add column if not exists sample_paths jsonb not null default '[]'::jsonb
  check (
    jsonb_typeof(sample_paths) = 'array'
    and jsonb_array_length(sample_paths) between 0 and 5
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'd3-biometric-face-samples',
  'd3-biometric-face-samples',
  false,
  5242880,
  array['image/webp', 'image/jpeg']
)
on conflict (id) do nothing;

create policy "D3 users read their own biometric face samples"
on storage.objects for select to authenticated
using (
  bucket_id = 'd3-biometric-face-samples'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "D3 users insert their own biometric face samples"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'd3-biometric-face-samples'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "D3 users replace their own biometric face samples"
on storage.objects for update to authenticated
using (
  bucket_id = 'd3-biometric-face-samples'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'd3-biometric-face-samples'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "D3 users remove their own biometric face samples"
on storage.objects for delete to authenticated
using (
  bucket_id = 'd3-biometric-face-samples'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
