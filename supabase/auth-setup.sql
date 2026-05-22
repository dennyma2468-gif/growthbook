-- Run AFTER setup.sql in Supabase SQL Editor
-- Also: Authentication → Providers → Email → ON
-- Optional: disable "Confirm email" for faster testing

-- 1. Walls table — links wall codes to parent accounts
create table if not exists walls (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  child_name text,
  created_at timestamptz default now()
);

create index if not exists walls_user_id_idx on walls(user_id);

alter table walls enable row level security;

drop policy if exists "walls_select_own" on walls;
create policy "walls_select_own" on walls
  for select using (auth.uid() = user_id);

drop policy if exists "walls_insert_own" on walls;
create policy "walls_insert_own" on walls
  for insert with check (auth.uid() = user_id);

drop policy if exists "walls_update_own" on walls;
create policy "walls_update_own" on walls
  for update using (auth.uid() = user_id);

-- 2. Memories — only your walls
drop policy if exists "memories_all" on memories;

drop policy if exists "memories_select_own" on memories;
create policy "memories_select_own" on memories
  for select using (
    wall_id in (select id from walls where user_id = auth.uid())
  );

drop policy if exists "memories_insert_own" on memories;
create policy "memories_insert_own" on memories
  for insert with check (
    wall_id in (select id from walls where user_id = auth.uid())
  );

drop policy if exists "memories_update_own" on memories;
create policy "memories_update_own" on memories
  for update using (
    wall_id in (select id from walls where user_id = auth.uid())
  );

drop policy if exists "memories_delete_own" on memories;
create policy "memories_delete_own" on memories
  for delete using (
    wall_id in (select id from walls where user_id = auth.uid())
  );

-- 3. Storage — only upload to your wall folders
drop policy if exists "photos_public_insert" on storage.objects;
drop policy if exists "photos_public_update" on storage.objects;

drop policy if exists "photos_auth_insert" on storage.objects;
create policy "photos_auth_insert" on storage.objects
  for insert with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] in (
      select id from walls where user_id = auth.uid()
    )
  );

drop policy if exists "photos_auth_update" on storage.objects;
create policy "photos_auth_update" on storage.objects
  for update using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] in (
      select id from walls where user_id = auth.uid()
    )
  );

-- photos_public_read stays — anyone with link can view images
