-- Private video storage and idempotent daily slots.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nexo-videos', 'nexo-videos', false, 157286400, array['video/mp4'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create unique index if not exists production_jobs_user_schedule_unique
on public.production_jobs (user_id, scheduled_for);

drop policy if exists "Users can access own social analytics" on public.social_analytics;
create policy "Users can access own social analytics"
on public.social_analytics
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
