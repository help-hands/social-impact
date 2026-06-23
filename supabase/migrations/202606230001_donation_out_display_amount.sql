-- Optional display-only amounts for published donation-out stories.
-- Financial records and organization totals continue to use donations_out.amount_cents.

alter table public.donation_out_details
add column if not exists display_amount_cents bigint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'donation_out_details_display_amount_cents_check'
      and conrelid = 'public.donation_out_details'::regclass
  ) then
    alter table public.donation_out_details
      add constraint donation_out_details_display_amount_cents_check
      check (display_amount_cents is null or display_amount_cents > 0);
  end if;
end $$;

drop view if exists public.public_donation_out_pages;

create or replace view public.public_donation_out_pages as
select
  doo.id,
  doo.donee_name,
  doo.donated_at,
  doo.amount_cents,
  detail.display_amount_cents,
  doo.method,
  doo.reference_id,
  detail.id as detail_id,
  detail.title,
  detail.subtitle,
  detail.description,
  detail.contact_info,
  detail.updated_at as detail_updated_at
from public.donations_out doo
join public.donation_out_details detail on detail.donation_out_id = doo.id
where doo.deleted_at is null
  and doo.status = 'success'
  and detail.is_published = true;

grant select on public.public_donation_out_pages to anon, authenticated;
