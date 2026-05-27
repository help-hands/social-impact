-- Initial Supabase/Postgres schema for the charity donation records app.

create extension if not exists "pgcrypto";

do $$
begin
  create type public.donation_status as enum ('pending', 'success', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.document_folder_type as enum ('donation_in', 'donation_out');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.roles (
  id integer primary key,
  role text not null unique
);

insert into public.roles (id, role)
values
  (1, 'admin'),
  (2, 'user')
on conflict (id) do update set role = excluded.role;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  username text not null unique,
  nic text not null unique,
  mobile text not null,
  profile_image_url text,
  reference_id text not null unique,
  role_id integer not null default 2 references public.roles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  drive_file_id text not null unique,
  url text not null,
  mime_type text not null,
  file_name text not null,
  folder_type public.document_folder_type not null,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.donations_in (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete restrict,
  donated_at timestamptz not null,
  amount_cents bigint not null check (amount_cents > 0),
  reference_id text not null unique,
  status public.donation_status not null default 'pending',
  notes text,
  document_id uuid not null references public.documents(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.donations_out (
  id uuid primary key default gen_random_uuid(),
  donee_name text not null,
  address text,
  donated_at timestamptz not null,
  amount_cents bigint not null check (amount_cents > 0),
  reference_id text not null unique,
  status public.donation_status not null default 'pending',
  notes text,
  document_id uuid not null references public.documents(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists donations_in_user_id_idx on public.donations_in(user_id);
create index if not exists donations_in_status_idx on public.donations_in(status);
create index if not exists donations_in_donated_at_idx on public.donations_in(donated_at desc);
create index if not exists donations_out_status_idx on public.donations_out(status);
create index if not exists donations_out_donated_at_idx on public.donations_out(donated_at desc);
create index if not exists documents_uploaded_by_idx on public.documents(uploaded_by);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

drop trigger if exists donations_in_set_updated_at on public.donations_in;
create trigger donations_in_set_updated_at
before update on public.donations_in
for each row execute function public.set_updated_at();

drop trigger if exists donations_out_set_updated_at on public.donations_out;
create trigger donations_out_set_updated_at
before update on public.donations_out
for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role_id = 1
  );
$$;

create or replace view public.public_donations_in as
select
  di.id,
  di.donated_at,
  di.amount_cents,
  di.reference_id,
  di.status,
  p.username as donor_username
from public.donations_in di
join public.profiles p on p.id = di.user_id
where di.status = 'success';

grant select on public.public_donations_in to authenticated;

alter table public.roles enable row level security;
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.donations_in enable row level security;
alter table public.donations_out enable row level security;

drop policy if exists "authenticated can read roles" on public.roles;
create policy "authenticated can read roles"
on public.roles for select
to authenticated
using (true);

drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid() and role_id = 2);

drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile"
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_admin())
with check (
  public.is_admin()
  or (id = auth.uid() and role_id = 2)
);

drop policy if exists "admins can read all documents" on public.documents;
create policy "admins can read all documents"
on public.documents for select
to authenticated
using (public.is_admin());

drop policy if exists "users can read own incoming donation documents" on public.documents;
create policy "users can read own incoming donation documents"
on public.documents for select
to authenticated
using (
  uploaded_by = auth.uid()
  or exists (
    select 1
    from public.donations_in di
    where di.document_id = documents.id
      and di.user_id = auth.uid()
  )
);

drop policy if exists "authenticated can read outgoing donation documents" on public.documents;
create policy "authenticated can read outgoing donation documents"
on public.documents for select
to authenticated
using (
  exists (
    select 1
    from public.donations_out doo
    where doo.document_id = documents.id
  )
);

drop policy if exists "users can read own incoming donations and admins can read all" on public.donations_in;
create policy "users can read own incoming donations and admins can read all"
on public.donations_in for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

drop policy if exists "users can create own pending incoming donation" on public.donations_in;
create policy "users can create own pending incoming donation"
on public.donations_in for insert
to authenticated
with check (
  user_id = auth.uid()
  and status = 'pending'
);

drop policy if exists "admins can update incoming donations" on public.donations_in;
create policy "admins can update incoming donations"
on public.donations_in for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "authenticated can read outgoing donations" on public.donations_out;
create policy "authenticated can read outgoing donations"
on public.donations_out for select
to authenticated
using (true);

drop policy if exists "admins can insert outgoing donations" on public.donations_out;
create policy "admins can insert outgoing donations"
on public.donations_out for insert
to authenticated
with check (public.is_admin());

drop policy if exists "admins can update outgoing donations" on public.donations_out;
create policy "admins can update outgoing donations"
on public.donations_out for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins can delete outgoing donations" on public.donations_out;
create policy "admins can delete outgoing donations"
on public.donations_out for delete
to authenticated
using (public.is_admin());
