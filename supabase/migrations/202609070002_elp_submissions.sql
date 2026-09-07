create table if not exists public.elp_submissions (
  id text primary key,
  student_id uuid not null references auth.users(id) on delete cascade,
  applicant jsonb not null,
  responses jsonb not null,
  evaluation jsonb,
  status text not null check (status in ('PENDING_REVIEW', 'EVALUATED')),
  submitted_at timestamptz not null,
  duration text not null,
  updated_at timestamptz not null default now()
);

alter table public.elp_submissions enable row level security;

create policy "Students insert own ELP submissions"
on public.elp_submissions for insert
with check (auth.uid() = student_id);

create policy "Students read own ELP submissions"
on public.elp_submissions for select
using (auth.uid() = student_id);

create policy "Staff read all ELP submissions"
on public.elp_submissions for select
using (exists (
  select 1 from public.profiles
  where id = auth.uid() and active = true and role in ('instructor', 'admin', 'super_admin')
));

create policy "Staff update ELP submissions"
on public.elp_submissions for update
using (exists (
  select 1 from public.profiles
  where id = auth.uid() and active = true and role in ('instructor', 'admin', 'super_admin')
));

