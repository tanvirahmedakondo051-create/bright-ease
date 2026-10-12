create table if not exists public.bot_subtasks (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null,
  bot_id uuid not null,
  user_id uuid not null,
  sig text not null,
  key text not null,
  title text not null default '',
  status text not null default 'queued',
  attempts integer not null default 0,
  output text not null default '',
  lines integer not null default 0,
  tokens integer not null default 0,
  error text,
  heartbeat_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists bot_subtasks_job_idx on public.bot_subtasks(job_id);
create index if not exists bot_subtasks_sig_idx on public.bot_subtasks(bot_id, sig, key);
grant select on public.bot_subtasks to authenticated;
grant all on public.bot_subtasks to service_role;
alter table public.bot_subtasks enable row level security;
drop policy if exists "own subtasks read" on public.bot_subtasks;
create policy "own subtasks read" on public.bot_subtasks for select to authenticated using (auth.uid() = user_id);