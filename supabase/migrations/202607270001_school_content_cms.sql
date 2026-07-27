create table if not exists public.school_content (
  id uuid primary key default gen_random_uuid(),
  page text not null,
  section_key text not null,
  section_label text not null default '',
  title text not null default '',
  body text not null default '',
  bullets text not null default '',
  image_url text not null default '',
  button_text text not null default '',
  button_url text not null default '',
  sort_order integer not null default 100,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page, section_key)
);

alter table public.school_content enable row level security;
drop policy if exists "public reads school content" on public.school_content;
create policy "public reads school content" on public.school_content for select using (published = true or public.is_super_admin());
drop policy if exists "super admins manage school content" on public.school_content;
create policy "super admins manage school content" on public.school_content for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
grant select on public.school_content to anon, authenticated;
grant insert, update, delete on public.school_content to authenticated;

insert into storage.buckets (id, name, public) values ('school-media', 'school-media', true)
on conflict (id) do update set public = true;
drop policy if exists "public reads school media" on storage.objects;
create policy "public reads school media" on storage.objects for select using (bucket_id = 'school-media');
drop policy if exists "super admins upload school media" on storage.objects;
create policy "super admins upload school media" on storage.objects for insert to authenticated with check (bucket_id = 'school-media' and public.is_super_admin());
drop policy if exists "super admins update school media" on storage.objects;
create policy "super admins update school media" on storage.objects for update to authenticated using (bucket_id = 'school-media' and public.is_super_admin()) with check (bucket_id = 'school-media' and public.is_super_admin());
drop policy if exists "super admins delete school media" on storage.objects;
create policy "super admins delete school media" on storage.objects for delete to authenticated using (bucket_id = 'school-media' and public.is_super_admin());

insert into public.school_content (page, section_key, section_label, title, body, button_text, button_url, sort_order) values
('home','hero','Orlando’s career-focused CDL school','Your road to a professional driving career.','Build real-world driving skills with experienced instructors, hands-on Class A CDL training, and support from enrollment through graduation.','Start your application','/contact-form/',1),
('home','overview','A better way to begin your driving career','Training built for the road ahead.','At Iman Trucking School, we combine practical Class A CDL instruction, experienced guidance, and personalized support to help students prepare for a professional career in trucking.','Request information','/contact-form/',2),
('home','why-choose','Why choose Iman','Everything you need to train with confidence.','A supportive, practical learning experience designed around the needs of aspiring professional drivers.','','',3),
('home','program','Class A CDL program','Practical preparation for real driving responsibilities.','Our program brings classroom fundamentals and hands-on practice together, helping students understand the vehicle, the rules, and the decisions professional drivers make every day.','Explore Class A CDL','/class-a-cdl/',4),
('home','enrollment','Enrollment','Accelerate your earnings with a CDL in just 4 weeks.','Speak with admissions about upcoming classes, scheduling options, program requirements, and the support available to help you begin.','Open enrollment form','/contact-form/',90),
('our-program','hero','Career-focused training','Our CDL Training Program','Build the practical knowledge, safe-driving habits and confidence required to pursue a professional Class A driving career.','','',1),
('class-a-cdl','hero','License information','Class A CDL','A Class A Commercial Driver’s License opens the door to operating combination vehicles and pursuing a wide range of professional driving opportunities.','','',1),
('cdl-training','hero','Professional driver preparation','CDL Training','Learn the essential safety, inspection and driving skills employers expect from entry-level commercial drivers.','','',1),
('cdl-training-program-orlando-florida','hero','Orlando, Florida','CDL Training Program in Orlando','Prepare for your CDL at a conveniently located Orlando training facility with flexible schedules and hands-on instruction.','','',1),
('truck-driving-school','hero','A practical career education','Truck Driving School','Choose a trucking school that combines professional instruction, real equipment and personalized support.','','',1),
('truck-driving-school-orlando-florida','hero','Train in Central Florida','Truck Driving School in Orlando','Start your professional driving journey at an Orlando trucking school focused on practical skills, safety and student success.','','',1),
('cdl-license-information','hero','Understand the process','CDL License Information','Learn the major steps involved in earning a commercial driver’s license and preparing for a professional driving career.','','',1),
('cdl-permit-tests','hero','Prepare with confidence','CDL Permit Tests','A Commercial Learner’s Permit is an important early milestone. Focus your study on the knowledge areas that support safe commercial driving.','','',1),
('how-to-become-a-truck-driver','hero','Your next career move','How to Become a Truck Driver','A professional driving career begins with understanding the requirements, choosing the right training and completing the licensing process.','','',1),
('advantages-of-attending-a-cdl-training-school','hero','Why structured training works','Advantages of CDL Training School','A professional CDL school gives aspiring drivers equipment access, qualified instruction and a clearer path through the licensing process.','','',1),
('amazon-career-choice','hero','Education benefit opportunity','Amazon Career Choice','Eligible Amazon employees may be able to use Career Choice education benefits toward approved career training.','','',1),
('testimonials','hero','Student experiences','Student Testimonials','Hear what students value about the instruction, practice and support they receive during their CDL journey.','','',1),
('gallery','hero','Life at Iman','School Gallery','See students, instructors, equipment and hands-on training experiences from the Iman Trucking School community.','','',1),
('contact-us','hero','We are here to help','Contact Iman Trucking School','Connect with admissions, visit the Orlando location or request more information about training.','','',1),
('contact-form','hero','Start your journey','Enrollment Contact Form','Tell us how to reach you and an admissions representative will help you explore the next step.','','',1),
('payment','hero','Student services','Student Payment','Get clear assistance with payment instructions and student-account questions.','','',1),
('kreyol','hero','Nou pale Kreyòl','Iman Trucking School — Kreyòl','Chwazi Kreyòl nan selektè lang lan pou tradui tout sit la, fòm yo ak enfòmasyon sou pwogram nan.','','',1),
('privacy-policy','hero','Website information','Privacy Policy','This notice explains how information submitted through this website may be collected, used and protected.','','',1),
('terms-of-use-page','hero','Website information','Terms of Use','These terms describe the conditions for using the Iman Trucking School website and its informational resources.','','',1)
on conflict (page, section_key) do nothing;
