-- Add structured profile names while keeping the existing display name field.

alter table public.profiles
add column if not exists first_name text,
add column if not exists last_name text;

update public.profiles
set
  first_name = coalesce(first_name, nullif(split_part(name, ' ', 1), '')),
  last_name = coalesce(
    last_name,
    nullif(trim(regexp_replace(name, '^[^ ]+\s*', '')), '')
  )
where first_name is null;
