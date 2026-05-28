-- Browser-generated image thumbnails used as quick-loading cover previews.

alter table public.donation_out_media
add column if not exists thumbnail_data_url text;
