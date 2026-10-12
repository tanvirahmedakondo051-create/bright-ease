-- lovable-cron-fallback-reviewed: armed only on enqueue, unschedules itself after the queue drains; rescues builds whose worker died
create or replace function public.kick_bot_job(_id uuid, _origin text)
returns void language plpgsql security definer set search_path to 'public','extensions' as $$
declare sec text;
begin
  select value into sec from public.app_secrets where name = 'job_token';
  if not exists (select 1 from cron.job where jobname = 'hexa-bot-jobs') then
    perform cron.schedule('hexa-bot-jobs', '* * * * *', format('select public.sweep_bot_jobs(%L)', _origin));
  end if;
  perform net.http_post(
    url := _origin || '/api/public/bot-job-run',
    headers := jsonb_build_object('Content-Type','application/json','X-Hexa-Job', _id::text, 'X-Hexa-Sig', encode(extensions.hmac(_id::text, sec, 'sha256'), 'hex')),
    body := '{}'::jsonb,
    timeout_milliseconds := 1800000
  );
end $$;

create or replace function public.sweep_bot_jobs(_origin text)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare j record; n integer := 0;
begin
  update public.bot_jobs set status='failed', error='সার্ভার কাজটি শেষ করতে পারেনি। আবার চেষ্টা করুন।', updated_at=now()
   where status in ('queued','running') and heartbeat_at < now() - interval '3 minutes' and attempts >= 3;
  for j in select id from public.bot_jobs where status in ('queued','running') and heartbeat_at < now() - interval '3 minutes' and attempts < 3 order by created_at limit 3 loop
    update public.bot_jobs set heartbeat_at = now() where id = j.id;
    perform public.kick_bot_job(j.id, _origin);
    n := n + 1;
  end loop;
  if not exists (select 1 from public.bot_jobs where status in ('queued','running')) then
    perform cron.unschedule('hexa-bot-jobs');
  end if;
  return n;
end $$;