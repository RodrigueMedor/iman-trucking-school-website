-- Dispatcher class scheduling, location, and seat capacity.
--
-- Adds location/schedule/seat fields to cdl_dispatcher_classes and two
-- read-only views that compute live seat availability:
--   - cdl_dispatcher_classes_public: OPEN classes only, for the public
--     registration page. Never exposes registration rows/PII, only an
--     aggregated count.
--   - cdl_dispatcher_classes_admin: ALL classes (open + closed), for the
--     staff class-management page.
--
-- A plain Postgres view executes with the privileges of its OWNER for
-- permission checks, not the querying role, so relying on the base
-- table's RLS ("open = true") to filter a view's output is unreliable.
-- Both views instead bake their access rule directly into the view's
-- WHERE clause, so the result is correct regardless of who owns the view.
--
-- Idempotent and safe to re-run.

alter table public.cdl_dispatcher_classes
  add column if not exists location text,
  add column if not exists schedule_notes text,
  add column if not exists seat_capacity integer;

alter table public.cdl_dispatcher_classes drop constraint if exists cdl_dispatcher_classes_seat_capacity_check;
alter table public.cdl_dispatcher_classes
  add constraint cdl_dispatcher_classes_seat_capacity_check
  check (seat_capacity is null or seat_capacity >= 0);

create index if not exists idx_cdl_dispatcher_registrations_class_id
  on public.cdl_dispatcher_registrations(class_id);

-- Public-facing view: OPEN classes only, computed seat availability.
create or replace view public.cdl_dispatcher_classes_public as
select
  c.id,
  c.name,
  c.description,
  c.price_cents,
  c.starts_at,
  c.ends_at,
  c.location,
  c.schedule_notes,
  c.seat_capacity,
  coalesce(r.seats_taken, 0) as seats_taken,
  case
    when c.seat_capacity is null then null
    else greatest(c.seat_capacity - coalesce(r.seats_taken, 0), 0)
  end as seats_remaining
from public.cdl_dispatcher_classes c
left join (
  select class_id, count(*) as seats_taken
  from public.cdl_dispatcher_registrations
  where payment_status = 'paid' and status <> 'CANCELED'
  group by class_id
) r on r.class_id = c.id
where c.open = true;

grant select on public.cdl_dispatcher_classes_public to anon, authenticated;

-- Staff-facing view: ALL classes, same seat math. Access is enforced in
-- the WHERE clause itself (same staff-role check used elsewhere).
create or replace view public.cdl_dispatcher_classes_admin as
select
  c.id,
  c.name,
  c.description,
  c.price_cents,
  c.starts_at,
  c.ends_at,
  c.location,
  c.schedule_notes,
  c.seat_capacity,
  c.open,
  c.created_at,
  coalesce(r.seats_taken, 0) as seats_taken,
  case
    when c.seat_capacity is null then null
    else greatest(c.seat_capacity - coalesce(r.seats_taken, 0), 0)
  end as seats_remaining
from public.cdl_dispatcher_classes c
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

-- Staff CRUD on the base table. The admin page writes through this table
-- directly and reads through cdl_dispatcher_classes_admin above.
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
