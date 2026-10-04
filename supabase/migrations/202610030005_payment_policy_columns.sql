-- Production never received 202609190002_payment_policy_signature, but the
-- application and student guard triggers (202610030001/0002) read these
-- columns, so every student insert/update failed with
-- 42703 record "new" has no field "payment_policy_accepted_at".
-- That migration can't be replayed as-is: it also alters
-- cdl_dispatcher_registrations, dropped in 202610030003.

alter table public.cdl_class_applications
  add column if not exists payment_policy_accepted_at timestamptz,
  add column if not exists payment_policy_signature text,
  add column if not exists payment_policy_version text;

alter table public.cdl_students
  add column if not exists payment_policy_accepted_at timestamptz,
  add column if not exists payment_policy_signature text,
  add column if not exists payment_policy_version text;

-- Student accounts created before profile provisioning can lack their
-- cdl_users and cdl_students rows, which breaks applications, profile edits
-- and financing referrals. cdl_students.user_id references cdl_users.
insert into public.cdl_users (id, role, email)
select u.id, 'student', u.email
from auth.users u
join public.profiles p on p.id = u.id
where p.role = 'student'
on conflict (id) do nothing;

insert into public.cdl_students (user_id, first_name, last_name, email)
select u.id,
       coalesce(nullif(u.raw_user_meta_data ->> 'first_name', ''), split_part(coalesce(u.email, 'Student'), '@', 1)),
       coalesce(u.raw_user_meta_data ->> 'last_name', ''),
       u.email
from auth.users u
join public.cdl_users cu on cu.id = u.id
join public.profiles p on p.id = u.id
where p.role = 'student'
  and not exists (select 1 from public.cdl_students s where s.user_id = u.id)
on conflict (user_id) do nothing;

notify pgrst, 'reload schema';
