-- Seed a system profile for historical/offline donation records and allow admins
-- to create incoming donations for selected users.

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'community-donor@social-impact.local',
  crypt(gen_random_uuid()::text, gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"],"system":true}'::jsonb,
  '{"system":true,"name":"Community Donor"}'::jsonb,
  now(),
  now(),
  false,
  false
)
on conflict (id) do nothing;

insert into public.profiles (
  id,
  name,
  first_name,
  last_name,
  username,
  nic,
  mobile,
  profile_image_url,
  reference_id,
  role_id
)
values (
  '00000000-0000-4000-8000-000000000001',
  'Community Donor',
  'Community',
  'Donor',
  'community_donor',
  null,
  '0000000000',
  null,
  'COMMUNITY-DONOR',
  2
)
on conflict (id) do update
set
  name = excluded.name,
  first_name = excluded.first_name,
  last_name = excluded.last_name,
  username = excluded.username,
  reference_id = excluded.reference_id,
  updated_at = now();

drop policy if exists "admins can insert incoming donations" on public.donations_in;
create policy "admins can insert incoming donations"
on public.donations_in for insert
to authenticated
with check (
  public.is_admin()
  and status = 'pending'
);
