-- lovable-cron-fallback-reviewed: rescue job is armed only while builds are active and unschedules itself when none remain
create type public.app_role as enum ('admin','user');

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name_en text not null, name_bn text not null,
  price_bdt int not null default 0,
  tokens_per_day int not null default 50000,
  max_projects int not null default 3,
  features text[] not null default '{}',
  show_badge boolean not null default true,
  allow_custom_domain boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
grant select on public.plans to anon, authenticated;
grant insert, update, delete on public.plans to authenticated;
grant all on public.plans to service_role;
alter table public.plans enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create policy "plans read" on public.plans for select using (true);
create policy "plans admin write" on public.plans for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text, name text,
  plan_id uuid references public.plans(id) on delete set null,
  tokens_used_today int not null default 0,
  last_reset_date date not null default (now() at time zone 'Asia/Dhaka')::date,
  is_banned boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "profile admin update" on public.profiles for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
create policy "profile admin delete" on public.profiles for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'নতুন প্রজেক্ট',
  code_html text not null default '',
  messages jsonb not null default '[]',
  subdomain text unique,
  is_published boolean not null default false,
  is_flagged boolean not null default false,
  flag_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.projects to anon;
grant select, insert, update, delete on public.projects to authenticated;
grant all on public.projects to service_role;
alter table public.projects enable row level security;
create policy "published read" on public.projects for select using (is_published = true);
create policy "own read" on public.projects for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own insert" on public.projects for insert to authenticated with check (user_id = auth.uid());
create policy "own update" on public.projects for update to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin')) with check (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "own delete" on public.projects for delete to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  tokens_used int not null default 0,
  provider_name text,
  created_at timestamptz not null default now()
);
create index on public.usage_logs (user_id, created_at);
grant select on public.usage_logs to authenticated;
grant all on public.usage_logs to service_role;
alter table public.usage_logs enable row level security;
create policy "usage read" on public.usage_logs for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create table public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null, base_url text not null, api_key text not null,
  model text not null,
  custom_headers jsonb not null default '{}',
  max_tokens int not null default 8000,
  temperature real not null default 0.7,
  is_active boolean not null default true,
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
grant all on public.ai_providers to service_role;
alter table public.ai_providers enable row level security;

create table public.site_settings (
  id int primary key default 1 check (id = 1),
  site_name text not null default 'Hexa AI',
  tagline text not null default 'বাংলায় বলুন, ওয়েবসাইট বানিয়ে নিন',
  logo_url text,
  announcement_text text not null default '',
  announcement_color text not null default '#4f46e5',
  announcement_active boolean not null default false,
  maintenance_mode boolean not null default false,
  support_email text not null default '',
  telegram_link text not null default '',
  rate_limit_per_minute int not null default 10,
  max_output_tokens int not null default 8000,
  free_block_publish boolean not null default false,
  require_email_verify boolean not null default false,
  system_prompt text not null default 'You are an expert web developer. Generate a COMPLETE single-file HTML website with inline CSS and JavaScript. Requirements: mobile-responsive (mobile-first), modern dark or light design as appropriate, NO lorem ipsum — use realistic Bangla/English placeholder content, NO external dependencies except Google Fonts and Tailwind CDN. Output ONLY the HTML code, no explanations.',
  payment_instructions text not null default 'বিকাশ/নগদ নম্বর: 01XXXXXXXXX (পার্সোনাল)। Send Money করে ট্রানজেকশন আইডি নিচে দিন।',
  updated_at timestamptz not null default now()
);
grant select on public.site_settings to anon, authenticated;
grant update on public.site_settings to authenticated;
grant all on public.site_settings to service_role;
alter table public.site_settings enable row level security;
create policy "settings read" on public.site_settings for select using (true);
create policy "settings admin" on public.site_settings for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.site_settings (id) values (1);

create table public.flag_keywords (
  id uuid primary key default gen_random_uuid(),
  keyword text not null unique,
  created_at timestamptz not null default now()
);
grant select, insert, delete on public.flag_keywords to authenticated;
grant all on public.flag_keywords to service_role;
alter table public.flag_keywords enable row level security;
create policy "kw admin" on public.flag_keywords for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
insert into public.flag_keywords (keyword) values ('casino'),('জুয়া'),('betting'),('phishing');

create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete cascade,
  method text not null, trx_id text not null, sender_number text,
  amount int not null default 0,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
grant select, insert, update on public.payment_requests to authenticated;
grant all on public.payment_requests to service_role;
alter table public.payment_requests enable row level security;
create policy "pay read" on public.payment_requests for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "pay admin update" on public.payment_requests for update to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

insert into public.plans (name_en,name_bn,price_bdt,tokens_per_day,max_projects,features,show_badge,allow_custom_domain,is_default) values
('Free','ফ্রি',0,50000,3,array['দৈনিক ৫০,০০০ টোকেন','৩টি প্রজেক্ট','Hexa ব্যাজসহ প্রকাশ','HTML ডাউনলোড'],true,false,true),
('Pro','প্রো',499,500000,-1,array['দৈনিক ৫,০০,০০০ টোকেন','আনলিমিটেড প্রজেক্ট','ব্যাজ ছাড়া প্রকাশ','কাস্টম ডোমেইন','অগ্রাধিকার সাপোর্ট'],false,true,false);

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();

alter table public.projects add column show_badge boolean not null default true;

alter table public.plans
  add column can_publish boolean not null default true,
  add column can_download boolean not null default true,
  add column can_view_code boolean not null default true,
  add column rate_limit_per_minute integer not null default 10,
  add column duration_days integer not null default 30,
  add column default_provider_id uuid references public.ai_providers(id) on delete set null;
update public.plans set duration_days = 0 where price_bdt = 0;

alter table public.profiles add column plan_expires_at timestamptz;
alter table public.profiles add column plan_ended_at timestamptz;

create table public.plan_providers (
  plan_id uuid not null references public.plans(id) on delete cascade,
  provider_id uuid not null references public.ai_providers(id) on delete cascade,
  primary key (plan_id, provider_id)
);
grant select, insert, update, delete on public.plan_providers to authenticated;
grant all on public.plan_providers to service_role;
alter table public.plan_providers enable row level security;
create policy "pp admin" on public.plan_providers for all to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.aura_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  plan_id uuid not null references public.plans(id) on delete cascade,
  invoice_id text unique,
  amount integer not null default 0,
  status text not null default 'pending',
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.aura_payments to authenticated;
grant all on public.aura_payments to service_role;
alter table public.aura_payments enable row level security;
create policy "ap read" on public.aura_payments for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create trigger aura_touch before update on public.aura_payments for each row execute function public.touch_updated_at();

alter table public.site_settings add column aurapay_enabled boolean not null default true;

create table public.app_secrets (
  name text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
grant all on public.app_secrets to service_role;
alter table public.app_secrets enable row level security;

alter table public.site_settings
  add column ns1 text not null default '',
  add column ns2 text not null default '',
  add column ns3 text not null default '',
  add column ns4 text not null default '',
  add column server_ip text not null default '',
  add column hosting_domain text not null default '',
  add column plan_prompt text NOT NULL DEFAULT 'You are a friendly Bangla-speaking website planning assistant. Discuss, ask ONE clarifying question at a time (max 3) with 3-4 quick-tap options, then output detailed build plan in Bangla as numbered checklist. End with: ''প্ল্যান ঠিক আছে? ✅ অনুমোদন করলে বিল্ড মোডে যান।'' NEVER write code in Plan Mode.',
  add column build_prompt text NOT NULL DEFAULT 'You are an elite frontend developer. Generate COMPLETE single-file HTML. 5 RULES: 1) Visual hierarchy — one headline, subtext, CTA. Max 2 fonts. 2) Self-audit: hero striking in 3s? Premium on phone? 3) Design system: ONE primary + ONE accent + neutrals, max 4 colors. 4) Spacing: 80px/48px sections, 8px grid. 5) Every button works, no dead links. Mobile-first. NO lorem ipsum — realistic Bangla content. Output ONLY raw HTML <!DOCTYPE html> to </html>. No markdown, no JSON, no explanations.',
  add column grace_days int NOT NULL DEFAULT 7,
  add column delete_after_days int NOT NULL DEFAULT 30,
  add column support_whatsapp text NOT NULL DEFAULT '',
  add column agent_port int NOT NULL DEFAULT 8443,
  add column agent_host text NOT NULL DEFAULT '',
  add column tokens_per_coin integer not null default 10000,
  add column backend_max_tables integer not null default 10,
  add column backend_max_rows integer not null default 10000,
  add column backend_master_url text not null default '',
  add column single_pass_simple boolean NOT NULL DEFAULT false,
  add column qa_screenshots boolean NOT NULL DEFAULT true;
ALTER TABLE public.site_settings ALTER COLUMN max_output_tokens SET DEFAULT 16000;
UPDATE public.site_settings SET max_output_tokens = GREATEST(max_output_tokens, 16000) WHERE id = 1;

alter table public.projects
  add column custom_domain text unique,
  add column domain_status text not null default 'pending',
  add column domain_checked_at timestamptz,
  add column domain_found_ns text[] not null default '{}',
  add column published_html text,
  add column published_code_hash text,
  add column published_version int NOT NULL DEFAULT 0,
  add column changes_since_publish int NOT NULL DEFAULT 0,
  add column github_repo text,
  add column deploy_status text NOT NULL DEFAULT 'none',
  add column deploy_message text NOT NULL DEFAULT '',
  add column deployed_url text,
  add column deployed_at timestamptz,
  add column project_type text not null default 'html' check (project_type in ('html','react')),
  add column files jsonb not null default '[]'::jsonb,
  add column build_status text not null default 'none',
  add column build_log text not null default '',
  add column backend_enabled boolean not null default false,
  add column dns_status text NOT NULL DEFAULT 'none',
  add column plan_session_id uuid,
  add column plan_answers jsonb,
  add column spec_json jsonb,
  add column spec_checksum text,
  add column spec_version integer;

ALTER TABLE public.plans ADD COLUMN max_published integer NOT NULL DEFAULT 1;
UPDATE public.plans SET max_projects = -1;
UPDATE public.plans SET max_published = CASE WHEN price_bdt = 0 THEN 1 ELSE 10 END;

create or replace function public.guard_project_fields()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if auth.uid() is not null and not public.has_role(auth.uid(),'admin') then
    if new.is_published is distinct from old.is_published
       or new.is_flagged is distinct from old.is_flagged
       or new.flag_reason is distinct from old.flag_reason
       or new.subdomain is distinct from old.subdomain
       or new.show_badge is distinct from old.show_badge
       or new.user_id is distinct from old.user_id
       or new.custom_domain is distinct from old.custom_domain
       or new.domain_status is distinct from old.domain_status
       or new.domain_checked_at is distinct from old.domain_checked_at
       or new.domain_found_ns is distinct from old.domain_found_ns
       or new.published_html is distinct from old.published_html
       or new.published_code_hash is distinct from old.published_code_hash
       or new.published_version is distinct from old.published_version
       or new.changes_since_publish is distinct from old.changes_since_publish
       or new.deploy_status is distinct from old.deploy_status
       or new.deploy_message is distinct from old.deploy_message
       or new.deployed_url is distinct from old.deployed_url
       or new.deployed_at is distinct from old.deployed_at
       or new.build_status is distinct from old.build_status
       or new.build_log is distinct from old.build_log
       or new.backend_enabled is distinct from old.backend_enabled then
      raise exception 'not allowed';
    end if;
  end if;
  return new;
end $function$;
revoke execute on function public.guard_project_fields() from public, anon, authenticated;
create trigger projects_guard before update on public.projects for each row execute function public.guard_project_fields();

create or replace function public.guard_project_insert()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
begin
  if auth.uid() is not null and not public.has_role(auth.uid(),'admin') then
    new.is_published := false; new.is_flagged := false; new.subdomain := null;
    new.custom_domain := null; new.domain_status := 'pending'; new.domain_found_ns := '{}';
    new.published_html := null; new.published_code_hash := null; new.published_version := 0; new.changes_since_publish := 0;
  end if;
  return new;
end $function$;
revoke execute on function public.guard_project_insert() from public, anon, authenticated;
create trigger projects_guard_ins before insert on public.projects for each row execute function public.guard_project_insert();

CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('animation','icon','illustration','background')),
  type text NOT NULL CHECK (type IN ('lottie','svg','png','css')),
  url_or_code text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed in users read assets" ON public.assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert assets" ON public.assets FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update assets" ON public.assets FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete assets" ON public.assets FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

INSERT INTO public.assets (name, category, type, url_or_code, tags) VALUES
('অরোরা গ্রেডিয়েন্ট','background','css','background: linear-gradient(135deg,#4f46e5 0%,#06b6d4 100%);','{gradient,blue}'),
('সানসেট','background','css','background: linear-gradient(135deg,#f97316 0%,#facc15 100%);','{gradient,orange}'),
('ফরেস্ট','background','css','background: linear-gradient(135deg,#065f46 0%,#34d399 100%);','{gradient,green}'),
('মিডনাইট','background','css','background: linear-gradient(180deg,#0f172a 0%,#1e1b4b 100%);','{dark,gradient}'),
('ডট প্যাটার্ন','background','css','background-color:#ffffff; background-image: radial-gradient(#cbd5e1 1px, transparent 1px); background-size: 16px 16px;','{pattern,dots,light}'),
('গ্রিড প্যাটার্ন','background','css','background-color:#0b1020; background-image: linear-gradient(#1e293b 1px,transparent 1px), linear-gradient(90deg,#1e293b 1px,transparent 1px); background-size: 32px 32px;','{pattern,grid,dark}');

CREATE TABLE public.project_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version_number int NOT NULL,
  code_html text NOT NULL,
  changelog_bn text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version_number)
);
GRANT SELECT ON public.project_versions TO authenticated;
GRANT ALL ON public.project_versions TO service_role;
ALTER TABLE public.project_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own versions read" ON public.project_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

CREATE TABLE public.github_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  github_username text NOT NULL DEFAULT '',
  avatar_url text NOT NULL DEFAULT '',
  access_token_encrypted text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.github_connections TO service_role;
ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.usage_logs ADD COLUMN tokens_saved integer NOT NULL DEFAULT 0;
CREATE TABLE public.chat_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  summary_text text NOT NULL,
  up_to_message_id int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.chat_summaries(project_id, up_to_message_id DESC);
GRANT SELECT ON public.chat_summaries TO authenticated;
GRANT ALL ON public.chat_summaries TO service_role;
ALTER TABLE public.chat_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own summaries read" ON public.chat_summaries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND (p.user_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

alter table public.profiles add column sites_deleted_at timestamptz;

ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;

create table public.skill_packs (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name_bn text not null,
  icon text not null default '✨',
  system_prompt text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.skill_packs to anon, authenticated;
grant insert, update, delete on public.skill_packs to authenticated;
grant all on public.skill_packs to service_role;
alter table public.skill_packs enable row level security;
create policy "read active packs" on public.skill_packs for select using (is_active or public.has_role(auth.uid(),'admin'));
create policy "admin manage packs" on public.skill_packs for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

create table public.project_analysis (
  id uuid primary key default gen_random_uuid(),
  project_id uuid unique not null references public.projects(id) on delete cascade,
  file_map_json jsonb not null default '[]',
  framework text not null default '',
  entry_file text not null default '',
  file_count integer not null default 0,
  analyzed_at timestamptz not null default now()
);
grant select on public.project_analysis to authenticated;
grant all on public.project_analysis to service_role;
alter table public.project_analysis enable row level security;
create policy "owner reads analysis" on public.project_analysis for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

alter table public.projects add column skill_pack_id uuid references public.skill_packs(id) on delete set null;

insert into public.skill_packs (slug, name_bn, icon, sort_order, system_prompt) values
('shop','দোকান','🛒',1,'SKILL PACK: E-COMMERCE SHOP. Build a product grid with cards (image, name, price in Bangladeshi Taka formatted like ৳১,২৫০ or ৳1,250, "কার্টে যোগ করুন" button). Include a working cart drawer in vanilla JS (add/remove, quantity, subtotal in ৳, localStorage). Include category filter, featured/discount badges, a simple checkout form (name, phone, address, payment: ক্যাশ অন ডেলিভারি / বিকাশ / নগদ), delivery info, trust badges and WhatsApp order button.'),
('restaurant','রেস্টুরেন্ট','🍔',2,'SKILL PACK: RESTAURANT. Include an appetizing hero, menu organized in sections (নাস্তা, মেইন কোর্স, ডেজার্ট, পানীয়) with prices in ৳, a food photo gallery grid, opening hours, a table reservation form (name, phone, date, time, guests), a location section with an embedded Google Maps iframe (maps.google.com/maps?q=...&output=embed), delivery/order buttons and customer reviews.'),
('portfolio','পোর্টফোলিও','💼',3,'SKILL PACK: PORTFOLIO. Personal hero with name, role and photo, about section, project showcase grid with hover details and links, animated skills bars with percentages, experience/education timeline, testimonials, a contact form and a prominent "CV ডাউনলোড" button (link to cv.pdf with download attribute), plus social links.'),
('blog','ব্লগ','📝',4,'SKILL PACK: BLOG. Featured post hero, article card grid (cover, category tag, title, excerpt, date, read time), category sidebar/filter, a sample full article layout with good typography for Bangla reading (line-height 1.8), author box, newsletter subscribe form and search UI.'),
('agency','এজেন্সি','🏢',5,'SKILL PACK: AGENCY. Bold hero with value proposition and CTA, services grid with icons, process steps, case studies/portfolio, client logos strip, stats counters, team section, pricing packages in ৳, testimonials, FAQ and a lead/contact form.'),
('coaching','কোচিং','🎓',6,'SKILL PACK: COACHING CENTER. Hero with admission CTA, courses/batches cards (class, subject, schedule, monthly fee in ৳), teacher profiles, results/success stats (GPA-5 count etc.), admission form (student name, class, guardian phone), class routine table, notice board, testimonials from students/guardians and location/contact.'),
('taste','টেস্ট (প্রিমিয়াম পলিশ)','✨',1,'TASTE — PREMIUM PRODUCT POLISH (Stripe / Linear / Vercel level). Apply on top of the site type: restraint (one neutral surface, one brand color, one accent), big confident type with tight display headings, generous whitespace and max width ~1200px, hairline borders and soft layered shadows, precise 8px grids, real product feel (UI mockups, stat strips, logo rows, comparison tables), varied layouts (split, bento, timeline, full-bleed), 150-250ms micro-interactions, subtle gradient glows, specific Bangla copy with numbers, consistent radius and button styles, tinted dark sections with 4.5:1 contrast, product-grade nav and footer, and every page fully complete.');

alter table public.profiles add column coins numeric(10,2) not null default 0;
alter table public.plans add column bonus_coins integer not null default 10,
  add column daily_coins integer not null default 1,
  add column coin_cap integer not null default 15;
alter table public.aura_payments add column coins_granted boolean not null default false;

create table public.coin_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount numeric(10,2) not null,
  type text not null check (type in ('bonus','refill','purchase','spend')),
  reason text not null default '',
  created_at timestamptz not null default now()
);
grant select on public.coin_transactions to authenticated;
grant all on public.coin_transactions to service_role;
alter table public.coin_transactions enable row level security;
create policy "own coin tx" on public.coin_transactions for select to authenticated using (auth.uid() = user_id);
create policy "admin coin tx" on public.coin_transactions for select to authenticated using (public.has_role(auth.uid(),'admin'));
create index coin_tx_user on public.coin_transactions(user_id, created_at desc);

create or replace function public.add_coins(_user uuid, _amount numeric, _type text, _reason text)
returns numeric language plpgsql security definer set search_path = public as $$
declare b numeric;
begin
  update public.profiles set coins = greatest(0, coins + _amount) where id = _user returning coins into b;
  insert into public.coin_transactions(user_id, amount, type, reason) values (_user, _amount, _type, coalesce(_reason,''));
  return b;
end $$;
revoke execute on function public.add_coins(uuid,numeric,text,text) from public, anon, authenticated;
grant execute on function public.add_coins(uuid,numeric,text,text) to service_role;

create or replace function public.daily_coin_refill()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with t as (
    select p.id, least(coalesce(pl.coin_cap,15), p.coins + coalesce(pl.daily_coins,1)) - p.coins as add
    from public.profiles p left join public.plans pl on pl.id = p.plan_id
    where p.coins < coalesce(pl.coin_cap,15) and not p.is_banned
  ), u as (
    update public.profiles p set coins = p.coins + t.add from t where p.id = t.id and t.add > 0 returning p.id, t.add
  )
  insert into public.coin_transactions(user_id, amount, type, reason) select id, add, 'refill', 'দৈনিক রিফিল' from u;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.daily_coin_refill() from public, anon, authenticated;
grant execute on function public.daily_coin_refill() to service_role;

create or replace function public.guard_profile_coins()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.has_role(auth.uid(),'admin') and new.coins is distinct from old.coins then
    raise exception 'not allowed';
  end if;
  return new;
end $$;
revoke execute on function public.guard_profile_coins() from public, anon, authenticated;
create trigger profiles_coin_guard before update on public.profiles for each row execute function public.guard_profile_coins();

-- New users get a profile, signup bonus and 'user' role; the very first account also becomes admin.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid; bonus int;
begin
  select id, bonus_coins into pid, bonus from public.plans where is_default order by created_at limit 1;
  insert into public.profiles (id, email, name, plan_id, coins)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), pid, coalesce(bonus,10));
  insert into public.coin_transactions(user_id, amount, type, reason) values (new.id, coalesce(bonus,10), 'bonus', 'সাইনআপ বোনাস');
  insert into public.user_roles (user_id, role) values (new.id, 'user');
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.has_role(uuid, app_role) from public, anon;
grant execute on function public.has_role(uuid, app_role) to authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

CREATE TABLE public.task_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  task_id text NOT NULL,
  progress_percent integer NOT NULL DEFAULT 0,
  completed_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  pending_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  partial_html text NOT NULL DEFAULT '',
  prompt text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'running',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days'
);
CREATE INDEX task_checkpoints_project_idx ON public.task_checkpoints(project_id, created_at DESC);
GRANT SELECT ON public.task_checkpoints TO authenticated;
GRANT ALL ON public.task_checkpoints TO service_role;
ALTER TABLE public.task_checkpoints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read checkpoints" ON public.task_checkpoints FOR SELECT TO authenticated USING (auth.uid() = user_id);

create table public.backend_tables (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  table_name text not null,
  schema_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (project_id, table_name)
);
grant select, delete on public.backend_tables to authenticated;
grant all on public.backend_tables to service_role;
alter table public.backend_tables enable row level security;
create policy "owner reads tables" on public.backend_tables for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));
create policy "owner deletes tables" on public.backend_tables for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

create table public.backend_rows (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  table_name text not null,
  data jsonb not null default '{}'::jsonb,
  owner_id uuid,
  created_at timestamptz not null default now()
);
create index backend_rows_pt on public.backend_rows(project_id, table_name, created_at desc);
grant select, delete on public.backend_rows to authenticated;
grant all on public.backend_rows to service_role;
alter table public.backend_rows enable row level security;
create policy "owner reads rows" on public.backend_rows for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));
create policy "owner deletes rows" on public.backend_rows for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

create table public.site_users (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  email text not null,
  name text not null default '',
  password_hash text not null default '',
  provider text not null default 'email',
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  unique (project_id, email)
);
grant select, delete on public.site_users to authenticated;
grant all on public.site_users to service_role;
alter table public.site_users enable row level security;
create policy "owner reads site users" on public.site_users for select to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));
create policy "owner deletes site users" on public.site_users for delete to authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.user_id = auth.uid()));

CREATE TABLE public.curated_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  url text NOT NULL,
  alt text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'unsplash',
  source_url text NOT NULL DEFAULT '',
  license text NOT NULL DEFAULT 'Unsplash License',
  attribution_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.curated_lotties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  json_url text NOT NULL,
  title text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'lottiefiles',
  source_url text NOT NULL DEFAULT '',
  license text NOT NULL DEFAULT 'Lottie Simple License',
  attribution_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.icon_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icon_set text NOT NULL,
  name text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (icon_set, name)
);
CREATE TABLE public.pexels_cache (
  query text PRIMARY KEY,
  results jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.curated_photos, public.curated_lotties, public.icon_favorites TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curated_photos, public.curated_lotties, public.icon_favorites TO authenticated;
GRANT ALL ON public.curated_photos, public.curated_lotties, public.icon_favorites, public.pexels_cache TO service_role;
ALTER TABLE public.curated_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curated_lotties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.icon_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pexels_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read enabled photos" ON public.curated_photos FOR SELECT USING (enabled OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin photos" ON public.curated_photos FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "read enabled lotties" ON public.curated_lotties FOR SELECT USING (enabled OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin lotties" ON public.curated_lotties FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "read enabled icons" ON public.icon_favorites FOR SELECT USING (enabled OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin icons" ON public.icon_favorites FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.curated_photos (category, url, alt, tags) VALUES
('hero-business','https://images.unsplash.com/photo-1497366216548-37526070297c','Bright modern open-plan office','{business,corporate,office,saas}'),
('hero-business','https://images.unsplash.com/photo-1521737604893-d14cc237f11d','Team collaborating around laptops','{business,startup,agency,team}'),
('hero-technology','https://images.unsplash.com/photo-1518770660439-4636190af475','Close-up of a circuit board','{technology,saas,hardware,tech}'),
('hero-technology','https://images.unsplash.com/photo-1498050108023-c5249f4df085','Laptop with code on a desk','{technology,developer,coding,saas}'),
('hero-creative','https://images.unsplash.com/photo-1513364776144-60967b0f800f','Paint brushes and colorful palette','{creative,art,portfolio,design}'),
('hero-nature','https://images.unsplash.com/photo-1506905925346-21bda4d32df4','Mountain peaks above clouds','{nature,travel,landscape}'),
('hero-abstract','https://images.unsplash.com/photo-1557672172-298e090bd0f1','Soft colorful gradient shapes','{abstract,gradient,background}'),
('team','https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d','Portrait of a smiling man','{team,portrait,testimonial}'),
('team','https://images.unsplash.com/photo-1494790108377-be9c29b29330','Portrait of a smiling woman','{team,portrait,testimonial}'),
('food','https://images.unsplash.com/photo-1504674900247-0877df9cc836','Plated gourmet dish','{food,restaurant,menu}'),
('food','https://images.unsplash.com/photo-1517248135467-4c7edcad34c4','Warm restaurant interior','{food,restaurant,cafe}'),
('product','https://images.unsplash.com/photo-1523275335684-37898b6baf30','Minimal wristwatch product shot','{product,shop,ecommerce,watch}'),
('product','https://images.unsplash.com/photo-1542291026-7eec264c27ff','Red sneaker product shot','{product,shop,ecommerce,fashion}'),
('office','https://images.unsplash.com/photo-1524758631624-e2822e304c36','Stylish workspace with plants','{office,workspace,interior}'),
('lifestyle','https://images.unsplash.com/photo-1529156069898-49953e39b3ac','Friends laughing together','{lifestyle,community,people}');
UPDATE public.curated_photos SET source_url = 'https://unsplash.com/photos/' || substring(url from 'photo-[0-9a-f-]+');

INSERT INTO public.curated_lotties (category, json_url, title, tags) VALUES
('hero','https://assets2.lottiefiles.com/packages/lf20_jcikwtux.json','People signing up','{hero,signup,people,community}'),
('loading_success','https://assets4.lottiefiles.com/packages/lf20_x62chJ.json','Paper plane','{loading,send,contact,message}'),
('loading_success','https://assets7.lottiefiles.com/packages/lf20_ktwnwv5m.json','Success check','{success,done,form}'),
('fun_celebration','https://assets6.lottiefiles.com/packages/lf20_u4yrau.json','Confetti cannons','{celebration,party,event,success}');

INSERT INTO public.icon_favorites (icon_set, name, tags) VALUES
('lucide','search','{search}'),('lucide','shield-check','{security,trust}'),('lucide','users','{team,users,community}'),
('lucide','zap','{fast,speed,power}'),('lucide','rocket','{launch,startup,growth}'),('lucide','mail','{email,contact}'),('lucide','phone','{phone,contact,call}'),
('lucide','map-pin','{location,address,map}'),('lucide','clock','{time,hours}'),('lucide','star','{rating,review}'),
('lucide','shopping-cart','{cart,shop}'),('lucide','truck','{delivery,shipping}'),('lucide','check-circle','{check,success,feature}'),
('mdi','whatsapp','{whatsapp,chat,social}'),('mdi','facebook','{facebook,social}'),('mdi','silverware-fork-knife','{restaurant,food,menu}'),
('ph','sparkle','{magic,ai,premium}'),('tabler','chart-line','{analytics,growth,stats}'),('carbon','calendar','{calendar,booking,reservation}');

CREATE TABLE public.plan_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  prompt text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'intake',
  current_step integer NOT NULL DEFAULT 1,
  total_steps integer NOT NULL DEFAULT 1,
  question_set jsonb NOT NULL DEFAULT '{}'::jsonb,
  answers_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan_markdown text,
  spec_json jsonb,
  spec_checksum text,
  spec_version integer,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plan_sessions TO authenticated;
GRANT ALL ON public.plan_sessions TO service_role;
ALTER TABLE public.plan_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read plan sessions" ON public.plan_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  mode text NOT NULL DEFAULT 'build',
  input jsonb NOT NULL DEFAULT '{}'::jsonb,
  origin text NOT NULL,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX generation_jobs_project_idx ON public.generation_jobs(project_id, created_at DESC);
GRANT SELECT ON public.generation_jobs TO authenticated;
GRANT ALL ON public.generation_jobs TO service_role;
ALTER TABLE public.generation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own jobs" ON public.generation_jobs FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

INSERT INTO public.app_secrets (name, value) VALUES ('cron_token', encode(extensions.gen_random_bytes(32), 'hex')) ON CONFLICT (name) DO NOTHING;
INSERT INTO public.app_secrets (name, value) VALUES ('job_token', encode(extensions.gen_random_bytes(32), 'hex')) ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.kick_job(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
declare j record; sec text;
begin
  select * into j from public.generation_jobs where id = _id;
  if not found then return; end if;
  select value into sec from public.app_secrets where name = 'job_token';
  update public.generation_jobs set attempts = attempts + 1, heartbeat_at = now(), status = 'running', updated_at = now() where id = _id;
  if not exists (select 1 from cron.job where jobname = 'hexa-job-rescue') then
    perform cron.schedule('hexa-job-rescue', '* * * * *', 'select public.rescue_jobs()');
  end if;
  perform net.http_post(
    url := j.origin || '/api/public/generate',
    headers := jsonb_build_object('Content-Type','application/json','X-Hexa-Job', _id::text, 'X-Hexa-Sig', encode(extensions.hmac(_id::text, sec, 'sha256'), 'hex')),
    body := '{}'::jsonb,
    timeout_milliseconds := 900000
  );
end $$;

CREATE OR REPLACE FUNCTION public.job_push(_id uuid, _events jsonb, _status text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare s text;
begin
  update public.generation_jobs
    set events = events || coalesce(_events, '[]'::jsonb),
        status = case when status = 'cancelled' then status else coalesce(_status, status) end,
        heartbeat_at = now(), updated_at = now()
    where id = _id returning status into s;
  return s;
end $$;

CREATE OR REPLACE FUNCTION public.rescue_jobs()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare j record; cp record; n integer := 0;
begin
  for j in select * from public.generation_jobs where status in ('running','queued') and heartbeat_at < now() - interval '2 minutes' limit 20 loop
    if j.attempts >= 3 then
      update public.generation_jobs set status = 'error', error = 'সার্ভার কাজটি শেষ করতে পারেনি। আবার চেষ্টা করুন।',
        events = events || jsonb_build_array(jsonb_build_object('t','error','msg','সার্ভার কাজটি শেষ করতে পারেনি। আবার চেষ্টা করুন।')), updated_at = now()
        where id = j.id;
    else
      select * into cp from public.task_checkpoints where project_id = j.project_id and status = 'running' and created_at >= j.created_at order by created_at desc limit 1;
      if found then
        update public.task_checkpoints set status = 'paused' where id = cp.id;
        update public.generation_jobs set input = input || jsonb_build_object('resumeId', cp.id::text, 'mode', 'build') where id = j.id;
      end if;
      perform public.kick_job(j.id);
      n := n + 1;
    end if;
  end loop;
  delete from public.generation_jobs where created_at < now() - interval '7 days';
  if not exists (select 1 from public.generation_jobs where status in ('running','queued')) then
    perform cron.unschedule('hexa-job-rescue');
  end if;
  return n;
end $$;

REVOKE ALL ON FUNCTION public.kick_job(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.job_push(uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rescue_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kick_job(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.job_push(uuid, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.rescue_jobs() TO service_role;

SELECT cron.schedule('hexa-expiry-hourly', '17 * * * *', $$
  SELECT net.http_post(
    url := 'https://project--9ef74417-b752-4da1-b748-efea4185bbe3.lovable.app/api/public/cron/expiry',
    headers := jsonb_build_object('Content-Type','application/json','X-Hexa-Cron', (SELECT value FROM public.app_secrets WHERE name = 'cron_token')),
    body := '{}'::jsonb
  );
$$);
select cron.schedule('hexa-coin-refill', '0 18 * * *', $$ select public.daily_coin_refill(); $$);
SELECT cron.schedule('hexa-checkpoint-cleanup', '30 19 * * *', $$DELETE FROM public.task_checkpoints WHERE expires_at < now()$$);