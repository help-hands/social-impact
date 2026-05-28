-- Public detail pages and ordered media for donation-out records.

create table if not exists public.donation_out_details (
  id uuid primary key default gen_random_uuid(),
  donation_out_id uuid not null unique references public.donations_out(id) on delete cascade,
  title text,
  subtitle text,
  description text,
  contact_info text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.donation_out_media (
  id uuid primary key default gen_random_uuid(),
  donation_out_id uuid not null references public.donations_out(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete restrict,
  media_type text not null check (media_type in ('image', 'video')),
  file_name text not null,
  mime_type text not null,
  caption text,
  thumbnail_data_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists donation_out_media_donation_out_id_idx
on public.donation_out_media(donation_out_id, sort_order);

drop trigger if exists donation_out_details_set_updated_at on public.donation_out_details;
create trigger donation_out_details_set_updated_at
before update on public.donation_out_details
for each row execute function public.set_updated_at();

drop trigger if exists donation_out_media_set_updated_at on public.donation_out_media;
create trigger donation_out_media_set_updated_at
before update on public.donation_out_media
for each row execute function public.set_updated_at();

alter table public.donation_out_details enable row level security;
alter table public.donation_out_media enable row level security;

drop policy if exists "admins can manage donation out details" on public.donation_out_details;
create policy "admins can manage donation out details"
on public.donation_out_details for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "authenticated can read published donation out details" on public.donation_out_details;
create policy "authenticated can read published donation out details"
on public.donation_out_details for select
to authenticated
using (
  public.is_admin()
  or (
    is_published = true
    and exists (
      select 1
      from public.donations_out doo
      where doo.id = donation_out_details.donation_out_id
        and doo.deleted_at is null
        and doo.status = 'success'
    )
  )
);

drop policy if exists "admins can manage donation out media" on public.donation_out_media;
create policy "admins can manage donation out media"
on public.donation_out_media for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "authenticated can read published donation out media" on public.donation_out_media;
create policy "authenticated can read published donation out media"
on public.donation_out_media for select
to authenticated
using (
  public.is_admin()
  or exists (
    select 1
    from public.donation_out_details detail
    join public.donations_out doo on doo.id = detail.donation_out_id
    where detail.donation_out_id = donation_out_media.donation_out_id
      and detail.is_published = true
      and doo.deleted_at is null
      and doo.status = 'success'
  )
);

drop policy if exists "service role can read donation out details" on public.donation_out_details;
create policy "service role can read donation out details"
on public.donation_out_details for select
to service_role
using (true);

drop policy if exists "service role can read donation out media" on public.donation_out_media;
create policy "service role can read donation out media"
on public.donation_out_media for select
to service_role
using (true);
