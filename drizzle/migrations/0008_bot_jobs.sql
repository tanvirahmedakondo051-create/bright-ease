create table if not exists public.bot_jobs (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  user_id uuid not null,
  status text not null default 'queued',
  events jsonb not null default '[]'::jsonb,
  input jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  attempts integer not null default 0,
  heartbeat_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.bot_jobs enable row level security;
create policy "bot_jobs_select_own" on public.bot_jobs for select to authenticated using (auth.uid() = user_id);
grant select on public.bot_jobs to authenticated;
create index if not exists bot_jobs_bot_active_idx on public.bot_jobs (bot_id, status);