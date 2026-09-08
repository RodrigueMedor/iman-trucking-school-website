-- Add INSERT policy for cdl_users table to allow users to create their own user record
-- This is needed for the user registration flow (though trigger should handle it, this provides a fallback)

create policy "Users can insert own user record"
on public.cdl_users for insert
with check (auth.uid() = id);
