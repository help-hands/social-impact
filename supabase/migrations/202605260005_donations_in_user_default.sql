-- Let Supabase assign the current authenticated user on donation-in inserts.

alter table public.donations_in
alter column user_id set default auth.uid();
