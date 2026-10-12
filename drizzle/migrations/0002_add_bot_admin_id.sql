ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS admin_id text;
COMMENT ON COLUMN public.bots.admin_id IS 'Telegram numeric user or chat ID exposed to bot processes as BOT_ADMIN_ID';