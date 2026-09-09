-- Ensure the public class application flow has its required tables and options.
create extension if not exists pgcrypto;

create table if not exists public.cdl_courses (
  id uuid primary key default gen_random_uuid(), code text not null unique,
  name text not null, description text, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.cdl_academic_sessions (
  id uuid primary key default gen_random_uuid(), name text not null unique,
  starts_at timestamptz not null, ends_at timestamptz not null, open boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.cdl_class_applications (
  id uuid primary key default gen_random_uuid(), student_id uuid,
  course_id uuid not null references public.cdl_courses(id),
  session_id uuid not null references public.cdl_academic_sessions(id),
  first_name text not null, last_name text not null, email text not null, phone text, statement text,
  status text not null default 'SUBMITTED' check (status in ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED')),
  staff_notes text, submitted_at timestamptz default now(), reviewed_at timestamptz,
  reviewed_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

alter table public.cdl_courses enable row level security;
alter table public.cdl_academic_sessions enable row level security;
alter table public.cdl_class_applications enable row level security;
drop policy if exists "Public can read courses" on public.cdl_courses;
create policy "Public can read courses" on public.cdl_courses for select using (active = true);
drop policy if exists "Public can read sessions" on public.cdl_academic_sessions;
create policy "Public can read sessions" on public.cdl_academic_sessions for select using (open = true);
drop policy if exists "Anyone can create applications" on public.cdl_class_applications;
create policy "Anyone can create applications" on public.cdl_class_applications for insert with check (true);
drop policy if exists "Staff can read applications" on public.cdl_class_applications;
create policy "Staff can read applications" on public.cdl_class_applications for select using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','instructor'))
);
drop policy if exists "Staff can update applications" on public.cdl_class_applications;
create policy "Staff can update applications" on public.cdl_class_applications for update using (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','instructor'))
);
grant select on public.cdl_courses, public.cdl_academic_sessions to anon, authenticated;
grant insert on public.cdl_class_applications to anon, authenticated;
grant select, update on public.cdl_class_applications to authenticated;

insert into public.cdl_courses (code,name,description,active) values
  ('CDL-A','CDL Class A Training','Commercial Driver License Class A training',true),
  ('CDL-B','CDL Class B Training','Commercial Driver License Class B training',true)
on conflict (code) do update set name=excluded.name, description=excluded.description, active=true;
insert into public.cdl_academic_sessions (name,starts_at,ends_at,open) values
  ('Rolling Enrollment 2026','2026-01-01T00:00:00Z','2026-12-31T23:59:59Z',true)
on conflict (name) do update set starts_at=excluded.starts_at, ends_at=excluded.ends_at, open=true;
