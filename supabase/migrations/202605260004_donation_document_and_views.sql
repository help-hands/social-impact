-- Donation records require documents, and community lists use sanitized views.

alter table public.donations_in
alter column document_id set not null;

alter table public.donations_out
alter column document_id set not null;

drop view if exists public.public_donations_in;

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
