-- Training programs managed from the back office. Additive only.
--
-- 1. cdl_courses.training_fee_label: the name of the training line on the
--    price sheet and receipts ("CDL Training - Sale Price" when empty), so a
--    non-CDL program is not billed as "CDL Training". Fee snapshots on
--    tuition accounts keep the label they were opened with.
-- 2. Box truck (non-CDL) and hotshot (non-CDL and CDL) courses. They start
--    INACTIVE at $0, so the website, applications and checkout are unchanged
--    until a super administrator sets a price and turns the course on in
--    Admin -> Course pricing. Existing courses are not touched.
--
-- Rollback: delete from public.cdl_courses where code in ('BOX-TRUCK',
-- 'HOTSHOT-NON-CDL', 'HOTSHOT-CDL') and nothing references them;
-- alter table public.cdl_courses drop column training_fee_label;

alter table public.cdl_courses
  add column if not exists training_fee_label text
    check (training_fee_label is null or char_length(training_fee_label) between 1 and 80);

insert into public.cdl_courses (code, name, description, active, training_fee_label)
values
  ('BOX-TRUCK', 'Box Truck Training (Non-CDL)', 'Box truck training for trucks rated 26,000 lbs or less. No CDL required.', false, 'Box Truck Training - Sale Price'),
  ('HOTSHOT-NON-CDL', 'Hotshot Training (Non-CDL)', 'Hotshot training for truck and trailer combinations rated 26,000 lbs or less.', false, 'Hotshot Training - Sale Price'),
  ('HOTSHOT-CDL', 'Hotshot Training (CDL)', 'Hotshot training for drivers operating combinations that require a CDL.', false, 'Hotshot Training - Sale Price')
on conflict (code) do nothing;
