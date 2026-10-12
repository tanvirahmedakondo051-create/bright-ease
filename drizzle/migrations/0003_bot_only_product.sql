ALTER TABLE public.bots ALTER COLUMN language SET DEFAULT 'python';
COMMENT ON TABLE public.projects IS 'DEPRECATED: website builder retired; product is Telegram Python bot builder (bots table)';
COMMENT ON COLUMN public.bots.token_enc IS 'DEPRECATED: users host bots themselves; token goes in their .env';
COMMENT ON COLUMN public.bots.admin_id IS 'DEPRECATED: users host bots themselves; ADMIN_ID goes in their .env';