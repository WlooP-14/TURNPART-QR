-- Dedicated TURNPART-QR objects in mapel_storeroom. Existing store_* objects are untouched.
create table public.turnpart_handover_records (
  id uuid primary key,
  job_id text not null check (char_length(job_id) between 1 and 180),
  job_code text not null check (char_length(job_code) between 1 and 180),
  source_sheet text not null check (source_sheet in ('Sheet5','JobDispatched')),
  handover_type text not null check (handover_type in ('full','partial')),
  part_keys text[] not null check (cardinality(part_keys) between 1 and 500 and array_ndims(part_keys)=1 and array_position(part_keys,null) is null),
  created_at timestamptz not null default now()
);
create index turnpart_handover_records_created_id_idx on public.turnpart_handover_records(created_at,id);
alter table public.turnpart_handover_records enable row level security;
revoke all on table public.turnpart_handover_records from public, anon, authenticated;
grant select on table public.turnpart_handover_records to anon, authenticated;
grant all on table public.turnpart_handover_records to service_role;
create policy "Read shared turnpart marks" on public.turnpart_handover_records
  for select to anon, authenticated using (true);
comment on table public.turnpart_handover_records is
  'TURNPART-QR append-only shared part marks. Only the dedicated validating Edge Function writes here. Contains no names, signatures or PDFs.';
