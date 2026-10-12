ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS temp_status text NOT NULL DEFAULT 'stopped';
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS temp_started_at timestamptz;
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS temp_expires_at timestamptz;
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS test_log text;
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS last_build_at timestamptz;
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz;
COMMENT ON COLUMN public.bots.run_mode IS 'DEPRECATED: replaced by temp_status';
COMMENT ON COLUMN public.bots.test_until IS 'DEPRECATED: replaced by temp_expires_at';
COMMENT ON COLUMN public.bots.status IS 'DEPRECATED: replaced by temp_status';

CREATE TABLE IF NOT EXISTS public.bot_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id uuid NOT NULL REFERENCES public.bots(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  coins_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bot_versions_bot_idx ON public.bot_versions(bot_id, created_at DESC);
GRANT SELECT ON public.bot_versions TO authenticated;
GRANT ALL ON public.bot_versions TO service_role;
ALTER TABLE public.bot_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own versions read" ON public.bot_versions;
CREATE POLICY "own versions read" ON public.bot_versions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.bot_brain (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'user_fix',
  error_signature text,
  symptom text,
  root_cause text,
  fix_summary text,
  code_snippet text,
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.bot_brain TO service_role;
ALTER TABLE public.bot_brain ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS button_emojis jsonb NOT NULL DEFAULT '{}'::jsonb;