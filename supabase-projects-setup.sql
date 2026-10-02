-- ============================================================
--  Projects table — Project Manager ke liye
--  Supabase Dashboard -> SQL Editor -> paste -> Run
--  Ye script idempotent hai — baar baar chala sakte ho.
-- ============================================================

-- ---------- Naya projects table (agar pehle se nahi hai) ----------
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  slug        text not null unique,
  description text,
  tech_stack  text[] default '{}',
  features    text[] default '{}',
  year        text,
  role        text,
  image_url   text,
  live_url    text,
  github_url  text,
  featured    boolean default false,
  created_at  timestamptz default now()
);

-- ---------- Purane table me missing columns add karo ----------
alter table public.projects add column if not exists description text;
alter table public.projects add column if not exists tech_stack text[] default '{}';
alter table public.projects add column if not exists features  text[] default '{}';
alter table public.projects add column if not exists year       text;
alter table public.projects add column if not exists role       text;
alter table public.projects add column if not exists image_url  text;
alter table public.projects add column if not exists live_url   text;
alter table public.projects add column if not exists github_url text;
alter table public.projects add column if not exists featured   boolean default false;
alter table public.projects add column if not exists created_at timestamptz default now();

-- ---------- RLS + policies ----------
alter table public.projects enable row level security;

create policy "projects_select" on public.projects for select using (true);
create policy "projects_insert" on public.projects for insert to authenticated with check (true);
create policy "projects_update" on public.projects for update to authenticated using (true);
create policy "projects_delete" on public.projects for delete to authenticated using (true);

-- ============================================================
--  Storage: 'project-images' bucket PUBLIC hona chahiye,
--  warna screenshot upload ke baad preview load nahi hoga.
--  Agar bucket pehle se public hai to ye line optional hai.
-- ============================================================
-- update storage.buckets set public = true where id = 'project-images';