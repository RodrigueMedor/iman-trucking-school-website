-- Add INSERT policy for profiles table to allow users to create their own profile
-- This is needed for the auto-provisioning logic in the application

create policy "Users can insert own profile"
on public.profiles for insert
with check (auth.uid() = id);

create policy "Users can update own profile"
on public.profiles for update
using (auth.uid() = id);
