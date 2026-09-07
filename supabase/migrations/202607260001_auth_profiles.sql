create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'student' check (role in ('student', 'instructor', 'admin', 'super_admin', 'employee')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('super_admin', 'admin') and active = true
  )
$$;

create policy "Users read own profile"
on public.profiles for select
using (auth.uid() = id);

create policy "Staff read profiles"
on public.profiles for select
using (
  public.is_super_admin()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'instructor' and p.active = true
  )
);
