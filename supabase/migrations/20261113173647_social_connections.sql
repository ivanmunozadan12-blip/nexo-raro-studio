-- Private OAuth token storage for connected publishing accounts.
create table if not exists public.social_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('youtube','tiktok')),
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, platform)
);

alter table public.social_connections enable row level security;
-- No authenticated-user policies: OAuth secrets are only accessed by server-side service-role code.
revoke all on public.social_connections from anon, authenticated;
grant all on public.social_connections to service_role;

create index if not exists social_connections_user_platform_idx
  on public.social_connections(user_id, platform);
