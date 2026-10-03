-- Remove the Dispatcher Class feature.
--
-- IRREVERSIBLE: deletes every dispatcher class, dispatcher registration and
-- their cdl_payments rows (Stripe keeps its own payment records). Export
-- cdl_dispatcher_classes, cdl_dispatcher_registrations and
-- cdl_payments where payment_type = 'dispatcher' before applying.

drop view if exists public.cdl_dispatcher_classes_public;
drop view if exists public.cdl_dispatcher_classes_admin;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'cdl_payments' and column_name = 'dispatcher_registration_id') then
    execute 'delete from public.cdl_payments where payment_type = ''dispatcher'' or dispatcher_registration_id is not null';
  else
    delete from public.cdl_payments where payment_type = 'dispatcher';
  end if;
end $$;

drop index if exists public.idx_cdl_payments_dispatcher;
alter table public.cdl_payments drop column if exists dispatcher_registration_id;

alter table public.cdl_payments drop constraint if exists cdl_payments_payment_type_check;
alter table public.cdl_payments add constraint cdl_payments_payment_type_check
  check (payment_type in ('registration', 'application'));

drop table if exists public.cdl_dispatcher_registrations;
drop table if exists public.cdl_dispatcher_classes;

notify pgrst, 'reload schema';
