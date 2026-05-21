-- Run this in Supabase Dashboard → SQL Editor

-- 1. Table for photo metadata
create table if not exists memories (
  id text primary key,
  wall_id text not null,
  storage_path text not null,
  image_url text not null,
  caption text,
  tags jsonb default '[]',
  mime_type text default 'image/jpeg',
  keep boolean default true,
  display_size text default 'medium',
  is_highlight boolean default false,
  display_order int default 0,
  created_at timestamptz default now()
);

create index if not exists memories_wall_id_idx on memories(wall_id);

-- 2. RLS (open for MVP — tighten when you add auth)
alter table memories enable row level security;

drop policy if exists "memories_all" on memories;
create policy "memories_all" on memories
  for all using (true) with check (true);

-- 3. Storage bucket: Dashboard → Storage → New bucket → name "photos" → Public bucket ON
-- Then run these storage policies:

drop policy if exists "photos_public_read" on storage.objects;
create policy "photos_public_read" on storage.objects
  for select using (bucket_id = 'photos');

drop policy if exists "photos_public_insert" on storage.objects;
create policy "photos_public_insert" on storage.objects
  for insert with check (bucket_id = 'photos');

drop policy if exists "photos_public_update" on storage.objects;
create policy "photos_public_update" on storage.objects
  for update using (bucket_id = 'photos');
