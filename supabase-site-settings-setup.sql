-- supabase-site-settings-setup.sql
-- Run this in Supabase Dashboard > SQL Editor

create table if not exists public.site_settings (
  id int primary key,
  site_name text,
  tagline text,
  email text,
  location text,
  about text,
  github text,
  linkedin text,
  twitter text,
  instagram text,
  hero_heading text,
  hero_subheading text,
  resume_link text,
  phone text,
  footer_text text,
  copyright_line text,
  footer_socials jsonb default '{}'::jsonb,
  footer_links jsonb default '[]'::jsonb,
  profile_photo_url text,
  about_photo_url text,
  updated_at timestamptz default now()
);

alter table public.site_settings enable row level security;

create policy "site_settings_select" on public.site_settings for select using (true);
create policy "site_settings_insert" on public.site_settings for insert to authenticated with check (true);
create policy "site_settings_update" on public.site_settings for update to authenticated using (true);
create policy "site_settings_delete" on public.site_settings for delete to authenticated using (true);

-- Storage bucket for portfolio media (public read)
insert into storage.buckets (id, name, public)
values ('portfolio-media', 'portfolio-media', true)
on conflict (id) do nothing;

create policy "portfolio_media_public_read" on storage.objects
  for select using (bucket_id = 'portfolio-media');

create policy "portfolio_media_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'portfolio-media');

create policy "portfolio_media_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'portfolio-media');

create policy "portfolio_media_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'portfolio-media');
