-- Privacy-safe financing referral tracking.
--
-- Liberty did not provide a status API or webhook. This table records only
-- IMAN-side milestones and staff follow-up; it never stores credit, income,
-- SSN, approval, denial, rate, or other lender application data.

create table if not exists public.cdl_financing_referrals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  student_id uuid not null references public.cdl_students(id) on delete cascade,
  application_id uuid references public.cdl_class_applications(id) on delete set null,
  status text not null default 'REFERRED'
    check (status in ('REFERRED', 'STUDENT_REPORTED_SUBMITTED', 'FOLLOW_UP_NEEDED', 'CLOSED')),
  referral_count integer not null default 1 check (referral_count > 0),
  first_referred_at timestamptz not null default now(),
  last_referred_at timestamptz not null default now(),
  staff_notes text not null default '',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_cdl_financing_referrals_status
  on public.cdl_financing_referrals(status, last_referred_at desc);

drop trigger if exists cdl_financing_referrals_touch_updated_at on public.cdl_financing_referrals;
create trigger cdl_financing_referrals_touch_updated_at
before update on public.cdl_financing_referrals
for each row execute procedure public.iman_touch_updated_at();

alter table public.cdl_financing_referrals enable row level security;

drop policy if exists "Students read own financing referral" on public.cdl_financing_referrals;
create policy "Students read own financing referral" on public.cdl_financing_referrals
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Staff read financing referrals" on public.cdl_financing_referrals;
create policy "Staff read financing referrals" on public.cdl_financing_referrals
  for select to authenticated using (public.is_iman_staff());

drop policy if exists "Staff update financing referrals" on public.cdl_financing_referrals;
create policy "Staff update financing referrals" on public.cdl_financing_referrals
  for update to authenticated using (public.is_iman_staff()) with check (public.is_iman_staff());

revoke all on public.cdl_financing_referrals from anon, authenticated;
grant select on public.cdl_financing_referrals to authenticated;
grant update (status, staff_notes, updated_by) on public.cdl_financing_referrals to authenticated;

create or replace function public.record_financing_referral()
returns public.cdl_financing_referrals
language plpgsql
security definer
set search_path = public
as $$
declare
  student public.cdl_students;
  training_application_id uuid;
  referral public.cdl_financing_referrals;
begin
  select * into student
  from public.cdl_students
  where user_id = auth.uid();

  if student.id is null then
    raise exception 'student_profile_required' using errcode = '42501';
  end if;

  select id into training_application_id
  from public.cdl_class_applications
  where user_id = auth.uid() and application_type = 'TRAINING'
  order by created_at desc
  limit 1;

  insert into public.cdl_financing_referrals (
    user_id, student_id, application_id, status
  ) values (
    auth.uid(), student.id, training_application_id, 'REFERRED'
  )
  on conflict (user_id) do update set
    student_id = excluded.student_id,
    application_id = coalesce(excluded.application_id, public.cdl_financing_referrals.application_id),
    referral_count = public.cdl_financing_referrals.referral_count + 1,
    last_referred_at = now()
  returning * into referral;

  return referral;
end;
$$;

revoke all on function public.record_financing_referral() from public;
grant execute on function public.record_financing_referral() to authenticated;
