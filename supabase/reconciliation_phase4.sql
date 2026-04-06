-- Reconciliation persistence + manual review approval

create table if not exists public.bank_statement_uploads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  uploaded_by uuid references public.profiles(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete cascade,
  bank_name text not null default 'techcombank',
  account_holder text,
  statement_month text,
  file_name text,
  status text not null default 'draft',
  saved_at timestamptz,
  notes text
);

create table if not exists public.bank_statement_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  upload_id uuid not null references public.bank_statement_uploads(id) on delete cascade,
  row_number integer,
  statement_date date,
  partner_name text,
  partner_bank text,
  details text,
  transaction_no text,
  debit numeric(14,2) default 0,
  credit numeric(14,2) default 0,
  balance numeric(14,2) default 0,
  direction text,
  amount numeric(14,2) default 0,
  match_status text default 'unreviewed',
  matched_transaction_id integer references public.transactions(id) on delete set null,
  review_reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz
);

create index if not exists idx_bank_statement_uploads_profile_month on public.bank_statement_uploads(profile_id, statement_month);
create index if not exists idx_bank_statement_entries_upload on public.bank_statement_entries(upload_id);
create index if not exists idx_bank_statement_entries_status on public.bank_statement_entries(match_status);

alter table public.bank_statement_uploads enable row level security;
alter table public.bank_statement_entries enable row level security;

drop policy if exists "bank_statement_uploads_select" on public.bank_statement_uploads;
create policy "bank_statement_uploads_select" on public.bank_statement_uploads
for select
using (
  public.get_user_role() in ('owner','secretary')
  or uploaded_by = auth.uid()
  or profile_id = auth.uid()
);

drop policy if exists "bank_statement_uploads_insert" on public.bank_statement_uploads;
create policy "bank_statement_uploads_insert" on public.bank_statement_uploads
for insert
with check (
  public.get_user_role() in ('owner','secretary')
  or uploaded_by = auth.uid()
);

drop policy if exists "bank_statement_uploads_update" on public.bank_statement_uploads;
create policy "bank_statement_uploads_update" on public.bank_statement_uploads
for update
using (
  public.get_user_role() in ('owner','secretary')
  or uploaded_by = auth.uid()
)
with check (
  public.get_user_role() in ('owner','secretary')
  or uploaded_by = auth.uid()
);

drop policy if exists "bank_statement_entries_select" on public.bank_statement_entries;
create policy "bank_statement_entries_select" on public.bank_statement_entries
for select
using (
  public.get_user_role() in ('owner','secretary')
  or exists (
    select 1
    from public.bank_statement_uploads u
    where u.id = upload_id
      and (u.uploaded_by = auth.uid() or u.profile_id = auth.uid())
  )
);

drop policy if exists "bank_statement_entries_insert" on public.bank_statement_entries;
create policy "bank_statement_entries_insert" on public.bank_statement_entries
for insert
with check (
  public.get_user_role() in ('owner','secretary')
);

drop policy if exists "bank_statement_entries_update" on public.bank_statement_entries;
create policy "bank_statement_entries_update" on public.bank_statement_entries
for update
using (
  public.get_user_role() in ('owner','secretary')
)
with check (
  public.get_user_role() in ('owner','secretary')
);
