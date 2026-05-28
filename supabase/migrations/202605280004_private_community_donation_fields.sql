-- Keep community donation lists useful while avoiding donor identity/document leaks.

drop view if exists public.community_donations_in;

create or replace view public.community_donations_in as
select
  di.id,
  case
    when public.is_admin() or di.user_id = auth.uid() then di.user_id
    else null
  end as user_id,
  di.donated_at,
  di.amount_cents,
  di.method,
  di.reference_id,
  di.status,
  di.created_at,
  di.updated_at,
  case
    when public.is_admin() or di.user_id = auth.uid() then di.document_id
    else null
  end as document_id,
  di.user_id = auth.uid() as is_own,
  case
    when public.is_admin() or di.user_id = auth.uid() then p.username
    else null
  end as donor_username,
  p.reference_id as donor_reference_id
from public.donations_in di
join public.profiles p on p.id = di.user_id
where di.deleted_at is null;

grant select on public.community_donations_in to authenticated;

drop view if exists public.public_donations_in;

create or replace view public.public_donations_in as
select
  di.id,
  di.donated_at,
  di.amount_cents,
  di.method,
  di.reference_id,
  di.status,
  p.reference_id as donor_reference_id
from public.donations_in di
join public.profiles p on p.id = di.user_id
where di.deleted_at is null
  and di.status = 'success';

grant select on public.public_donations_in to authenticated;
