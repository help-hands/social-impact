-- Follow-up public view fixes.
-- Migrations are versioned, so this applies changes made after 202605280005
-- may already have been marked as applied.

drop view if exists public.public_donation_out_page_media;
drop view if exists public.public_organization_stats;

create or replace view public.public_donation_out_page_media as
select
  media.id,
  media.donation_out_id,
  media.media_type,
  media.file_name,
  media.mime_type,
  media.caption,
  media.thumbnail_data_url,
  media.sort_order,
  media.created_at,
  media.updated_at
from public.donation_out_media media
join public.donation_out_details detail on detail.donation_out_id = media.donation_out_id
join public.donations_out doo on doo.id = media.donation_out_id
where doo.deleted_at is null
  and doo.status = 'success'
  and detail.is_published = true;

create or replace view public.public_organization_stats as
select
  (
    select count(*)
    from public.donations_out doo
    join public.donation_out_details detail on detail.donation_out_id = doo.id
    where doo.deleted_at is null
      and doo.status = 'success'
      and detail.is_published = true
  )::integer as donation_distribution_count,
  (
    select count(*)
    from public.profiles profile
    where profile.is_active = true
      and profile.id <> '00000000-0000-4000-8000-000000000001'
  )::integer as member_count,
  (
    select coalesce(sum(doo.amount_cents), 0)
    from public.donations_out doo
    join public.donation_out_details detail on detail.donation_out_id = doo.id
    where doo.deleted_at is null
      and doo.status = 'success'
      and detail.is_published = true
  )::bigint as documented_support_total_cents;

grant select on public.public_donation_out_page_media to anon, authenticated;
grant select on public.public_organization_stats to anon, authenticated;
