create or replace function public.backup_auth_rows()
returns jsonb language sql stable security definer set search_path = public, auth
as $$
  select jsonb_build_object(
    'users', coalesce((select jsonb_agg(to_jsonb(u)) from auth.users u), '[]'::jsonb),
    'identities', coalesce((select jsonb_agg(to_jsonb(i)) from auth.identities i), '[]'::jsonb)
  )
$$;
revoke all on function public.backup_auth_rows() from public, anon, authenticated;
grant execute on function public.backup_auth_rows() to service_role;

create or replace function public.backup_table_list()
returns text[] language sql stable security definer set search_path = public
as $$ select coalesce(array_agg(table_name::text order by table_name), '{}') from information_schema.tables where table_schema='public' and table_type='BASE TABLE' $$;
revoke all on function public.backup_table_list() from public, anon, authenticated;
grant execute on function public.backup_table_list() to service_role;

insert into public.app_secrets(name, value) values ('backup_token', encode(extensions.gen_random_bytes(32),'hex')) on conflict (name) do nothing;

do $$
declare tok text;
begin
  select value into tok from public.app_secrets where name='backup_token';
  if exists (select 1 from cron.job where jobname='hexa-daily-backup') then perform cron.unschedule('hexa-daily-backup'); end if;
  perform cron.schedule('hexa-daily-backup', '0 18 * * *', format(
    $c$select net.http_post(url := 'https://bright-ease.lovable.app/api/public/cron/backup', headers := jsonb_build_object('Content-Type','application/json','x-hexa-cron', %L), body := '{}'::jsonb, timeout_milliseconds := 300000)$c$, tok));
end $$;