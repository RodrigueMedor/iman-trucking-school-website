-- Dispatcher class sessions: schedule, delivery mode, location, instructor,
-- registration deadline, seat capacity, and an explicit lifecycle status.
--
-- Additive only. The existing `open` boolean column is left untouched for
-- backward compatibility; going forward, `status` is the source of truth
-- for whether a session accepts new registrations. Existing rows default
-- to status = 'OPEN' to match their current open = true state.
--
-- Idempotent and safe to re-run.

alter table public.cdl_dispatcher_classes
  add column if not exists registration_deadline timestamptz,
  add column if not exists days_of_week text,
  add column if not exists class_time text,
  add column if not exists delivery_mode text,
  add column if not exists location text,
  add column if not exists instructor_id uuid references public.cdl_instructors(id) on delete set null,
  add column if not exists seat_capacity integer,
  add column if not exists status text;

alter table public.cdl_dispatcher_classes drop constraint if exists cdl_dispatcher_classes_delivery_mode_check;
alter table public.cdl_dispatcher_classes
  add constraint cdl_dispatcher_classes_delivery_mode_check
  check (delivery_mode is null or delivery_mode in ('online', 'in_person'));

alter table public.cdl_dispatcher_classes drop constraint if exists cdl_dispatcher_classes_seat_capacity_check;
alter table public.cdl_dispatcher_classes
  add constraint cdl_dispatcher_classes_seat_capacity_check
  check (seat_capacity is null or seat_capacity >= 0);

alter table public.cdl_dispatcher_classes drop constraint if exists cdl_dispatcher_classes_status_check;
alter table public.cdl_dispatcher_classes
  add constraint cdl_dispatcher_classes_status_check
  check (status is null or status in ('OPEN', 'FULL', 'CLOSED', 'COMPLETED'));

update public.cdl_dispatcher_classes
set status = case when open then 'OPEN' else 'CLOSED' end
where status is null;

alter table public.cdl_dispatcher_classes
  alter column status set default 'OPEN';

create index if not exists idx_cdl_dispatcher_registrations_class_id
  on public.cdl_dispatcher_registrations(class_id);

create index if not exists idx_cdl_dispatcher_classes_instructor_id
  on public.cdl_dispatcher_classes(instructor_id);

-- A plain Postgres view executes with the privileges of its OWNER for
-- permission checks, not the querying role, so relying on the base
-- table's RLS to filter a view's output is unreliable. Both views below
-- bake their access rule directly into the WHERE clause instead.

-- Public-facing view: status = 'OPEN' sessions only, computed seat
-- availability. Never exposes registration rows/PII, only an aggregated
-- count. A session whose seats are exhausted still shows status 'OPEN'
-- here (the base row's manual status is unchanged) but seats_remaining
-- reaches 0 so the frontend can label it "Full" without a trigger.
create or replace view public.cdl_dispatcher_classes_public as
select
  c.id,
  c.name,
  c.description,
  c.price_cents,
  c.starts_at,
  c.ends_at,
  c.registration_deadline,
  c.days_of_week,
  c.class_time,
  c.delivery_mode,
  c.location,
  c.instructor_id,
  i.display_name as instructor_name,
  c.seat_capacity,
  c.status,
  coalesce(r.seats_taken, 0) as seats_taken,
  case
    when c.seat_capacity is null then null
    else greatest(c.seat_capacity - coalesce(r.seats_taken, 0), 0)
  end as seats_remaining
from public.cdl_dispatcher_classes c
left join public.cdl_instructors i on i.id = c.instructor_id
left join (
  select class_id, count(*) as seats_taken
  from public.cdl_dispatcher_registrations
  where payment_status = 'paid' and status <> 'CANCELED'
  group by class_id
) r on r.class_id = c.id
where c.status = 'OPEN';

grant select on public.cdl_dispatcher_classes_public to anon, authenticated;

-- Staff-facing view: every session regardless of status, same seat math,
-- for the admin class-management page.
create or replace view public.cdl_dispatcher_classes_admin as
select
  c.id,
  c.name,
  c.description,
  c.price_cents,
  c.starts_at,
  c.ends_at,
  c.registration_deadline,
  c.days_of_week,
  c.class_time,
  c.delivery_mode,
  c.location,
  c.instructor_id,
  i.display_name as instructor_name,
  c.seat_capacity,
  c.status,
  c.open,
  c.created_at,
  coalesce(r.seats_taken, 0) as seats_taken,
  case
    when c.seat_capacity is null then null
    else greatest(c.seat_capacity - coalesce(r.seats_taken, 0), 0)
  end as seats_remaining
from public.cdl_dispatcher_classes c
left join public.cdl_instructors i on i.id = c.instructor_id
left join (
  select class_id, count(*) as seats_taken
  from public.cdl_dispatcher_registrations
  where payment_status = 'paid' and status <> 'CANCELED'
  group by class_id
) r on r.class_id = c.id
where public.is_super_admin() or exists (
  select 1 from public.profiles
  where id = auth.uid() and role in ('admin', 'instructor', 'super_admin') and active = true
);

grant select on public.cdl_dispatcher_classes_admin to authenticated;

-- Staff CRUD on the base table (mirrors the existing staff-update policy
-- pattern already used for cdl_dispatcher_registrations). The admin page
-- writes through this table directly and reads through the admin view.
drop policy if exists "Staff can insert dispatcher classes" on public.cdl_dispatcher_classes;
create policy "Staff can insert dispatcher classes" on public.cdl_dispatcher_classes for insert with check (
  public.is_super_admin() or exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'instructor', 'super_admin') and active = true
  )
);
drop policy if exists "Staff can update dispatcher classes" on public.cdl_dispatcher_classes;
create policy "Staff can update dispatcher classes" on public.cdl_dispatcher_classes for update using (
  public.is_super_admin() or exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'instructor', 'super_admin') and active = true
  )
);
drop policy if exists "Staff can delete dispatcher classes" on public.cdl_dispatcher_classes;
create policy "Staff can delete dispatcher classes" on public.cdl_dispatcher_classes for delete using (
  public.is_super_admin() or exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'instructor', 'super_admin') and active = true
  )
);

grant insert, update, delete on public.cdl_dispatcher_classes to authenticated;

-- Staff also need to read instructors to populate the admin page's
-- instructor picker; mirrors existing staff-read patterns elsewhere.
drop policy if exists "Staff can read instructors" on public.cdl_instructors;
create policy "Staff can read instructors" on public.cdl_instructors for select using (
  public.is_super_admin() or exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'instructor', 'super_admin') and active = true
  )
);
