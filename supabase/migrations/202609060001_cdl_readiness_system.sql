-- CDL Readiness Assessment System Migration
-- This migration adds the database schema for the CDL readiness assessment system

-- Extend profiles table with role if not exists
alter table public.profiles 
add column if not exists role text not null default 'student' check (role in ('student', 'instructor', 'admin'));

-- Create users table (links to auth.users)
create table if not exists public.cdl_users (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'instructor', 'admin')),
  email text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create students table
create table if not exists public.cdl_students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.cdl_users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  phone text,
  preferred_language text not null default 'en',
  consented_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create instructors table
create table if not exists public.cdl_instructors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.cdl_users(id) on delete cascade,
  display_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create courses table
create table if not exists public.cdl_courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create academic sessions table
create table if not exists public.cdl_academic_sessions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create assessments table
create table if not exists public.cdl_assessments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  version integer not null default 1,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Create assessment sections table
create table if not exists public.cdl_assessment_sections (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.cdl_assessments(id) on delete cascade,
  title text not null,
  instructions_en text not null,
  instructions_ht text not null,
  order_index integer not null,
  unique(assessment_id, order_index)
);

-- Create questions table
create table if not exists public.cdl_questions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.cdl_assessment_sections(id) on delete cascade,
  prompt text not null,
  active boolean not null default true,
  required boolean not null default true,
  order_index integer not null,
  unique(section_id, order_index)
);

-- Create answer choices table
create table if not exists public.cdl_answer_choices (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.cdl_questions(id) on delete cascade,
  text text not null,
  order_index integer not null,
  unique(question_id, order_index)
);

-- Create correct answers table
create table if not exists public.cdl_correct_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid unique not null references public.cdl_questions(id) on delete cascade,
  answer_choice_id uuid unique not null references public.cdl_answer_choices(id) on delete cascade
);

-- Create assessment assignments table
create table if not exists public.cdl_assessment_assignments (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.cdl_assessments(id),
  student_id uuid not null references public.cdl_students(id),
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  completed_at timestamptz,
  unique(assessment_id, student_id)
);

-- Create student attempts table
create table if not exists public.cdl_student_attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.cdl_assessments(id),
  student_id uuid not null references public.cdl_students(id),
  status text not null default 'NOT_STARTED' check (status in ('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'LOCKED')),
  started_at timestamptz,
  submitted_at timestamptz,
  locked_at timestamptz,
  consented_at timestamptz,
  created_at timestamptz not null default now()
);

-- Create student responses table
create table if not exists public.cdl_student_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.cdl_student_attempts(id) on delete cascade,
  question_id uuid not null references public.cdl_questions(id),
  answer_choice_id uuid not null references public.cdl_answer_choices(id),
  answered_at timestamptz not null default now(),
  unique(attempt_id, question_id)
);

-- Create section scores table
create table if not exists public.cdl_section_scores (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.cdl_student_attempts(id) on delete cascade,
  section_id uuid not null references public.cdl_assessment_sections(id),
  correct integer not null,
  total integer not null,
  points integer not null,
  unique(attempt_id, section_id)
);

-- Create final results table
create table if not exists public.cdl_final_results (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid unique not null references public.cdl_student_attempts(id) on delete cascade,
  result_number text unique not null,
  score integer not null,
  percentage integer not null,
  correct integer not null,
  incorrect integer not null,
  classification text not null,
  recommendations jsonb,
  created_at timestamptz not null default now(),
  report_path text
);

-- Create instructor notes table
create table if not exists public.cdl_instructor_notes (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.cdl_student_attempts(id) on delete cascade,
  author_id uuid not null references public.cdl_users(id),
  note text not null,
  created_at timestamptz not null default now()
);

-- Create retake permissions table
create table if not exists public.cdl_retake_permissions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.cdl_student_attempts(id),
  approved_by uuid not null references public.cdl_users(id),
  reason text,
  used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Create audit log table
create table if not exists public.cdl_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.cdl_users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);

-- Create application settings table
create table if not exists public.cdl_application_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Create class applications table
create table if not exists public.cdl_class_applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.cdl_students(id),
  course_id uuid not null references public.cdl_courses(id),
  session_id uuid not null references public.cdl_academic_sessions(id),
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  statement text,
  status text not null default 'SUBMITTED' check (status in ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED')),
  staff_notes text,
  submitted_at timestamptz default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.cdl_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create enrollments table
create table if not exists public.cdl_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.cdl_students(id),
  course_id uuid not null references public.cdl_courses(id),
  session_id uuid not null references public.cdl_academic_sessions(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, course_id, session_id)
);

-- Create student scores table
create table if not exists public.cdl_student_scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.cdl_students(id),
  course_id uuid not null references public.cdl_courses(id),
  session_id uuid not null references public.cdl_academic_sessions(id),
  assessment text not null,
  assessment_at timestamptz not null,
  score decimal(7,2) not null,
  total_possible decimal(7,2) not null,
  grade text,
  comments text,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED')),
  created_by uuid not null references public.cdl_users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create score notifications table
create table if not exists public.cdl_score_notifications (
  id uuid primary key default gen_random_uuid(),
  score_id uuid not null references public.cdl_student_scores(id) on delete cascade,
  recipient text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED')),
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.cdl_users enable row level security;
alter table public.cdl_students enable row level security;
alter table public.cdl_instructors enable row level security;
alter table public.cdl_courses enable row level security;
alter table public.cdl_academic_sessions enable row level security;
alter table public.cdl_assessments enable row level security;
alter table public.cdl_assessment_sections enable row level security;
alter table public.cdl_questions enable row level security;
alter table public.cdl_answer_choices enable row level security;
alter table public.cdl_correct_answers enable row level security;
alter table public.cdl_assessment_assignments enable row level security;
alter table public.cdl_student_attempts enable row level security;
alter table public.cdl_student_responses enable row level security;
alter table public.cdl_section_scores enable row level security;
alter table public.cdl_final_results enable row level security;
alter table public.cdl_instructor_notes enable row level security;
alter table public.cdl_retake_permissions enable row level security;
alter table public.cdl_audit_logs enable row level security;
alter table public.cdl_application_settings enable row level security;
alter table public.cdl_class_applications enable row level security;
alter table public.cdl_enrollments enable row level security;
alter table public.cdl_student_scores enable row level security;
alter table public.cdl_score_notifications enable row level security;

-- Create indexes for performance
create index if not exists idx_cdl_student_attempts_student_status on public.cdl_student_attempts(student_id, status);
create index if not exists idx_cdl_student_responses_attempt on public.cdl_student_responses(attempt_id);
create index if not exists idx_cdl_section_scores_attempt on public.cdl_section_scores(attempt_id);
create index if not exists idx_cdl_section_scores_section on public.cdl_section_scores(section_id);
create index if not exists idx_cdl_audit_logs_created on public.cdl_audit_logs(created_at);
create index if not exists idx_cdl_class_applications_status_session on public.cdl_class_applications(status, session_id);
create index if not exists idx_cdl_class_applications_email on public.cdl_class_applications(email);
create index if not exists idx_cdl_student_scores_student_session on public.cdl_student_scores(student_id, session_id);
create index if not exists idx_cdl_score_notifications_score_created on public.cdl_score_notifications(score_id, created_at);

-- RLS Policies
-- Users: Students can read their own, admins/instructors can read all
create policy "Users can read own data" on public.cdl_users for select using (auth.uid() = id);
create policy "Admins can read all users" on public.cdl_users for select using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "Users can update own data" on public.cdl_users for update using (auth.uid() = id);

-- Students: Students can read own, admins/instructors can read all
create policy "Students can read own data" on public.cdl_students for select using (exists (select 1 from public.cdl_users where id = user_id and auth.uid() = id));
create policy "Admins can read all students" on public.cdl_students for select using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'instructor')));

-- Assessments: Public can read active assessments
create policy "Public can read active assessments" on public.cdl_assessments for select using (active = true);
create policy "Admins can manage assessments" on public.cdl_assessments for all using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Assessment sections: Public can read for active assessments
create policy "Public can read assessment sections" on public.cdl_assessment_sections for select using (exists (select 1 from public.cdl_assessments where id = assessment_id and active = true));
create policy "Admins can manage assessment sections" on public.cdl_assessment_sections for all using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Questions: Public can read for active assessments
create policy "Public can read questions" on public.cdl_questions for select using (exists (select 1 from public.cdl_assessment_sections s join public.cdl_assessments a on s.assessment_id = a.id where s.id = section_id and a.active = true));
create policy "Admins can manage questions" on public.cdl_questions for all using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Answer choices: Public can read for active assessments
create policy "Public can read answer choices" on public.cdl_answer_choices for select using (exists (select 1 from public.cdl_questions q join public.cdl_assessment_sections s on q.section_id = s.id join public.cdl_assessments a on s.assessment_id = a.id where q.id = question_id and a.active = true));
create policy "Admins can manage answer choices" on public.cdl_answer_choices for all using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Correct answers: Only admins can read
create policy "Admins can read correct answers" on public.cdl_correct_answers for select using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'instructor')));
create policy "Admins can manage correct answers" on public.cdl_correct_answers for all using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Student attempts: Students can read own, admins/instructors can read all
create policy "Students can read own attempts" on public.cdl_student_attempts for select using (exists (select 1 from public.cdl_users where id = (select user_id from public.cdl_students where id = student_id) and auth.uid() = id));
create policy "Admins can read all attempts" on public.cdl_student_attempts for select using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'instructor')));
create policy "Students can create attempts" on public.cdl_student_attempts for insert with check (exists (select 1 from public.cdl_users where id = (select user_id from public.cdl_students where id = student_id) and auth.uid() = id));
create policy "Students can update own attempts" on public.cdl_student_attempts for update using (exists (select 1 from public.cdl_users where id = (select user_id from public.cdl_students where id = student_id) and auth.uid() = id));

-- Student responses: Students can read own, admins/instructors can read all
create policy "Students can read own responses" on public.cdl_student_responses for select using (exists (select 1 from public.cdl_student_attempts where id = attempt_id and student_id = (select id from public.cdl_students where user_id = auth.uid())));
create policy "Admins can read all responses" on public.cdl_student_responses for select using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'instructor')));
create policy "Students can create responses" on public.cdl_student_responses for insert with check (exists (select 1 from public.cdl_student_attempts where id = attempt_id and student_id = (select id from public.cdl_students where user_id = auth.uid())));

-- Final results: Students can read own, admins/instructors can read all
create policy "Students can read own results" on public.cdl_final_results for select using (exists (select 1 from public.cdl_student_attempts where id = attempt_id and student_id = (select id from public.cdl_students where user_id = auth.uid())));
create policy "Admins can read all results" on public.cdl_final_results for select using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'instructor')));

-- Class applications: Students can read own, admins/instructors can read all
create policy "Students can read own applications" on public.cdl_class_applications for select using (student_id = (select id from public.cdl_students where user_id = auth.uid()) or email = (select email from auth.users where id = auth.uid()));
create policy "Admins can read all applications" on public.cdl_class_applications for select using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'instructor')));
create policy "Anyone can create applications" on public.cdl_class_applications for insert with check (true);
create policy "Admins can update applications" on public.cdl_class_applications for update using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'instructor')));

-- Enrollments: Students can read own, admins/instructors can read all
create policy "Students can read own enrollments" on public.cdl_enrollments for select using (student_id = (select id from public.cdl_students where user_id = auth.uid()));
create policy "Admins can read all enrollments" on public.cdl_enrollments for select using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'instructor')));
create policy "Admins can manage enrollments" on public.cdl_enrollments for all using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'instructor')));

-- Student scores: Students can read own published, admins/instructors can read all
create policy "Students can read own published scores" on public.cdl_student_scores for select using (student_id = (select id from public.cdl_students where user_id = auth.uid()) and status = 'PUBLISHED');
create policy "Admins can read all scores" on public.cdl_student_scores for select using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'instructor')));
create policy "Admins can manage scores" on public.cdl_student_scores for all using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'instructor')));

-- Courses and sessions: Public can read active
create policy "Public can read courses" on public.cdl_courses for select using (active = true);
create policy "Admins can manage courses" on public.cdl_courses for all using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
create policy "Public can read sessions" on public.cdl_academic_sessions for select using (open = true);
create policy "Admins can manage sessions" on public.cdl_academic_sessions for all using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Audit logs: Only admins can read
create policy "Admins can read audit logs" on public.cdl_audit_logs for select using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Application settings: Admins can manage
create policy "Admins can manage settings" on public.cdl_application_settings for all using (public.is_super_admin() or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Insert default demo data
insert into public.cdl_courses (code, name, description) values
('CDL-A', 'CDL Class A Training', 'Comprehensive Class A CDL training program')
on conflict (code) do nothing;

insert into public.cdl_academic_sessions (name, starts_at, ends_at) values
('Fall 2026', '2026-09-01'::timestamptz, '2026-12-31'::timestamptz)
on conflict (name) do nothing;

insert into public.cdl_assessments (title, version) values
('English Readiness Assessment', 1)
on conflict do nothing;
