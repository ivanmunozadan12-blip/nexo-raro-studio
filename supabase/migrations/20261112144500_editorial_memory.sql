-- Persistent editorial memory: keeps a searchable history of produced and excluded topics.
create table if not exists public.editorial_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  script_id uuid references public.scripts(id) on delete set null,
  topic text not null,
  topic_key text not null,
  angle text,
  summary text,
  source_urls jsonb not null default '[]'::jsonb,
  memory_status text not null default 'produced'
    check (memory_status in ('produced','rejected','reserved')),
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists editorial_memory_user_created_idx
  on public.editorial_memory(user_id, created_at desc);
create index if not exists editorial_memory_user_topic_idx
  on public.editorial_memory(user_id, topic_key);

alter table public.editorial_memory enable row level security;

drop policy if exists "owner reads editorial memory" on public.editorial_memory;
create policy "owner reads editorial memory"
  on public.editorial_memory for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "owner inserts editorial memory" on public.editorial_memory;
create policy "owner inserts editorial memory"
  on public.editorial_memory for insert to authenticated
  with check ((select auth.uid()) = user_id);

grant select, insert on public.editorial_memory to authenticated;

-- Backfill any scripts that existed before this memory table was introduced.
insert into public.editorial_memory
  (user_id, script_id, topic, topic_key, angle, summary, source_urls, memory_status, created_at)
select s.user_id, s.id, s.title,
       trim(both '-' from regexp_replace(lower(coalesce(s.title,'')), '[^a-z0-9]+', '-', 'g')),
       s.hook, left(coalesce(s.narration,''), 1200),
       coalesce(s.source_notes, '[]'::jsonb), 'produced', s.created_at
from public.scripts s
where not exists (
  select 1 from public.editorial_memory m where m.script_id = s.id
);
