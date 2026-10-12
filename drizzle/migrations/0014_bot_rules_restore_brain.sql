ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS pending_questions jsonb;
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS pending_answers jsonb;
ALTER TABLE public.bot_brain ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'fix';
ALTER TABLE public.bot_brain ADD COLUMN IF NOT EXISTS bot_type text;
ALTER TABLE public.bot_brain ADD COLUMN IF NOT EXISTS pattern jsonb;
ALTER TABLE public.bot_brain ADD COLUMN IF NOT EXISTS quality integer;
CREATE INDEX IF NOT EXISTS bot_brain_kind_type_idx ON public.bot_brain (kind, bot_type, created_at DESC);