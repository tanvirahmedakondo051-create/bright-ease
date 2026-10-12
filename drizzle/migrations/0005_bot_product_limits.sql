ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS daily_ai_messages integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS max_bot_projects integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS temp_host_minutes_per_day integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS max_fix_requests_per_day integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS zip_download_allowed boolean NOT NULL DEFAULT true;

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS hexahoster_url text NOT NULL DEFAULT 'https://hexahoster.xyz';

COMMENT ON COLUMN public.plans.max_published IS 'DEPRECATED: website publishing removed; use max_bot_projects';
COMMENT ON COLUMN public.plans.can_publish IS 'DEPRECATED: website publishing removed';
COMMENT ON COLUMN public.plans.can_download IS 'DEPRECATED: HTML download removed; use zip_download_allowed';
COMMENT ON COLUMN public.plans.can_view_code IS 'DEPRECATED: website source viewer removed';
COMMENT ON COLUMN public.plans.show_badge IS 'DEPRECATED: website badge removed';
COMMENT ON COLUMN public.plans.allow_custom_domain IS 'DEPRECATED: custom domains removed';
COMMENT ON COLUMN public.site_settings.grace_days IS 'DEPRECATED: hosted websites removed';
COMMENT ON COLUMN public.site_settings.delete_after_days IS 'DEPRECATED: hosted websites removed';
COMMENT ON COLUMN public.site_settings.free_block_publish IS 'DEPRECATED: website publishing removed';
COMMENT ON COLUMN public.site_settings.backend_max_tables IS 'DEPRECATED: website backend removed';
COMMENT ON COLUMN public.site_settings.backend_max_rows IS 'DEPRECATED: website backend removed';
COMMENT ON COLUMN public.site_settings.backend_master_url IS 'DEPRECATED: website backend removed';
COMMENT ON COLUMN public.site_settings.single_pass_simple IS 'DEPRECATED: website generation removed';
COMMENT ON COLUMN public.site_settings.qa_screenshots IS 'DEPRECATED: website QA removed';

CREATE TABLE IF NOT EXISTS public.bot_usage_daily (
  user_id uuid NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  ai_messages integer NOT NULL DEFAULT 0,
  fix_requests integer NOT NULL DEFAULT 0,
  temp_host_minutes integer NOT NULL DEFAULT 0,
  builds integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date),
  CONSTRAINT bot_usage_daily_nonnegative CHECK (ai_messages >= 0 AND fix_requests >= 0 AND temp_host_minutes >= 0 AND builds >= 0)
);

GRANT SELECT ON public.bot_usage_daily TO authenticated;
GRANT ALL ON public.bot_usage_daily TO service_role;
ALTER TABLE public.bot_usage_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own bot usage" ON public.bot_usage_daily;
CREATE POLICY "Users read own bot usage"
ON public.bot_usage_daily
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS bot_usage_daily_date_idx ON public.bot_usage_daily (usage_date DESC);

CREATE OR REPLACE FUNCTION public.touch_bot_usage_daily()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bot_usage_daily_touch ON public.bot_usage_daily;
CREATE TRIGGER bot_usage_daily_touch
BEFORE UPDATE ON public.bot_usage_daily
FOR EACH ROW EXECUTE FUNCTION public.touch_bot_usage_daily();