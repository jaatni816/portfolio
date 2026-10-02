-- ============================================================
--  Homepage section tables  (hero + images + journey)
--  Supabase Dashboard -> SQL Editor -> paste -> Run
--  Ye script idempotent hai — baar baar chala sakte ho.
-- ============================================================

-- ---------- HERO SECTION (single row, id = 1) ----------
create table if not exists public.hero_section (
  id            int primary key default 1,
  title         text,
  role          text,
  tagline       text,
  photo_url     text,
  photo_caption text,
  updated_at    timestamptz default now()
);

alter table public.hero_section enable row level security;

create policy "hero_select" on public.hero_section
  for select using (true);
create policy "hero_insert" on public.hero_section
  for insert to authenticated with check (true);
create policy "hero_update" on public.hero_section
  for update to authenticated using (true);

-- ---------- IMAGES / GALLERY CARDS ----------
create table if not exists public.gallery_items (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  text       text,
  image_url  text,
  link_url   text,
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table public.gallery_items enable row level security;

create policy "gallery_select" on public.gallery_items
  for select using (true);
create policy "gallery_insert" on public.gallery_items
  for insert to authenticated with check (true);
create policy "gallery_update" on public.gallery_items
  for update to authenticated using (true);
create policy "gallery_delete" on public.gallery_items
  for delete to authenticated using (true);

-- ---------- JOURNEY CARDS (timeline) ----------
create table if not exists public.journey_items (
  id         uuid primary key default gen_random_uuid(),
  year       text not null,
  title      text not null,
  description text,
  status     text,
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table public.journey_items enable row level security;

create policy "journey_select" on public.journey_items
  for select using (true);
create policy "journey_insert" on public.journey_items
  for insert to authenticated with check (true);
create policy "journey_update" on public.journey_items
  for update to authenticated using (true);
create policy "journey_delete" on public.journey_items
  for delete to authenticated using (true);

-- ============================================================
--  Storage: 'project-images' bucket PUBLIC hona chahiye,
--  warna image upload ke baad preview load nahi hoga.
--  Agar bucket pehle se public hai to ye line optional hai.
-- ============================================================
-- update storage.buckets set public = true where id = 'project-images';
