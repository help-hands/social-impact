-- Store donation amounts as integer cents instead of decimal display values.

drop view if exists public.community_donations_in;
drop view if exists public.community_donations_out;
drop view if exists public.public_donations_in;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'donations_in'
      and column_name = 'amount'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'donations_in'
      and column_name = 'amount_cents'
  ) then
    alter table public.donations_in rename column amount to amount_cents;
    alter table public.donations_in
      alter column amount_cents type bigint
      using round(amount_cents * 100)::bigint;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'donations_in'
      and column_name = 'amount_cents'
  ) then
    alter table public.donations_in
      alter column amount_cents type bigint
      using amount_cents::bigint;
  end if;
end $$;

alter table public.donations_in
drop constraint if exists donations_in_amount_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.donations_in'::regclass
      and conname = 'donations_in_amount_cents_check'
  ) then
    alter table public.donations_in
      add constraint donations_in_amount_cents_check check (amount_cents > 0);
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'donations_out'
      and column_name = 'amount'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'donations_out'
      and column_name = 'amount_cents'
  ) then
    alter table public.donations_out rename column amount to amount_cents;
    alter table public.donations_out
      alter column amount_cents type bigint
      using round(amount_cents * 100)::bigint;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'donations_out'
      and column_name = 'amount_cents'
  ) then
    alter table public.donations_out
      alter column amount_cents type bigint
      using amount_cents::bigint;
  end if;
end $$;

alter table public.donations_out
drop constraint if exists donations_out_amount_check;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.donations_out'::regclass
      and conname = 'donations_out_amount_cents_check'
  ) then
    alter table public.donations_out
      add constraint donations_out_amount_cents_check check (amount_cents > 0);
  end if;
end $$;

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
join public.profiles p on p.id = di.user_id;

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
from public.donations_out;

grant select on public.community_donations_out to authenticated;
