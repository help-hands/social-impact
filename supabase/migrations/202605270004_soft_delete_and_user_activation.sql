-- Soft-delete donation records and allow admins to activate/deactivate users.

alter table public.profiles
add column if not exists is_active boolean not null default true;

alter table public.donations_in
add column if not exists deleted_at timestamptz,
add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

alter table public.donations_out
add column if not exists deleted_at timestamptz,
add column if not exists deleted_by uuid references public.profiles(id) on delete set null;

create index if not exists donations_in_deleted_at_idx on public.donations_in(deleted_at);
create index if not exists donations_out_deleted_at_idx on public.donations_out(deleted_at);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role_id = 1
      and p.is_active = true
  );
$$;

drop view if exists public.community_donations_in;
drop view if exists public.community_donations_out;

create or replace view public.community_donations_in as
select
  di.id,
  di.user_id,
  di.donated_at,
  di.amount_cents,
  di.reference_id,
  di.status,
  di.created_at,
  di.updated_at,
  p.username as donor_username,
  p.reference_id as donor_reference_id
from public.donations_in di
join public.profiles p on p.id = di.user_id
where di.deleted_at is null;

grant select on public.community_donations_in to authenticated;

create or replace view public.community_donations_out as
select
  id,
  donee_name,
  donated_at,
  amount_cents,
  reference_id,
  status,
  created_at,
  updated_at
from public.donations_out
where deleted_at is null;

grant select on public.community_donations_out to authenticated;

drop policy if exists "users can read own incoming donations and admins can read all" on public.donations_in;
create policy "users can read own incoming donations and admins can read all"
on public.donations_in for select
to authenticated
using (
  public.is_admin()
  or (user_id = auth.uid() and deleted_at is null)
);

drop policy if exists "authenticated can read outgoing donations" on public.donations_out;
create policy "authenticated can read outgoing donations"
on public.donations_out for select
to authenticated
using (
  public.is_admin()
  or deleted_at is null
);
