create type public.app_role as enum ('admin','user');
alter table public.user_roles add column role public.app_role not null default 'user';
alter table public.user_roles alter column role drop default;
alter table public.user_roles add constraint user_roles_user_id_role_key unique (user_id, role);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "plans admin write" on public.plans for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "profile admin update" on public.profiles for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "profile admin delete" on public.profiles for delete to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "own read" on public.projects for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own update" on public.projects for update to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own delete" on public.projects for delete to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "usage read" on public.usage_logs for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "settings admin" on public.site_settings for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "kw admin" on public.flag_keywords for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "pay read" on public.payment_requests for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "pay admin update" on public.payment_requests for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "pp admin" on public.plan_providers for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "ap read" on public.aura_payments for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins insert assets" ON public.assets FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update assets" ON public.assets FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete assets" ON public.assets FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "own versions read" ON public.project_versions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
CREATE POLICY "own summaries read" ON public.chat_summaries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));
create policy "read active packs" on public.skill_packs for select using (is_active or public.has_role(auth.uid(),'admin'));
create policy "admin manage packs" on public.skill_packs for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "admin coin tx" on public.coin_transactions for select to authenticated using (public.has_role(auth.uid(),'admin'));
CREATE POLICY "read enabled photos" ON public.curated_photos FOR SELECT USING (enabled OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin photos" ON public.curated_photos FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "read enabled lotties" ON public.curated_lotties FOR SELECT USING (enabled OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin lotties" ON public.curated_lotties FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "read enabled icons" ON public.icon_favorites FOR SELECT USING (enabled OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin icons" ON public.icon_favorites FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS button_emoji_meta jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.bots ADD COLUMN IF NOT EXISTS emoji_mode text;
grant all on public.bot_jobs to service_role;