CREATE TABLE IF NOT EXISTS public.bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'নতুন বট',
  language text NOT NULL DEFAULT 'node',
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  token_enc text,
  bot_username text,
  status text NOT NULL DEFAULT 'stopped',
  run_mode text,
  test_until timestamptz,
  last_log text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bots TO authenticated;
GRANT ALL ON public.bots TO service_role;
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own bots read" ON public.bots;
CREATE POLICY "own bots read" ON public.bots FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own bots delete" ON public.bots;
CREATE POLICY "own bots delete" ON public.bots FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS bots_user_idx ON public.bots(user_id);
REVOKE SELECT (token_enc) ON public.bots FROM authenticated;
COMMENT ON TABLE public.skill_packs IS 'DEPRECATED: skill pack system removed';