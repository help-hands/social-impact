-- Support onboarding profile creation with optional NIC and safe username checks.

alter table public.profiles
alter column nic drop not null;

create unique index if not exists profiles_username_lower_unique_idx
on public.profiles (lower(username));

create or replace function public.is_username_available(candidate_username text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select not exists (
    select 1
    from public.profiles
    where lower(username) = lower(trim(candidate_username))
  );
$$;

grant execute on function public.is_username_available(text) to authenticated;
