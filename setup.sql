-- ABHISHEK BASIL JOY / PORTFOLIO CLOUD SETUP
-- Run once in your OWN Supabase project's SQL Editor.
-- AFTER creating an account in Authentication -> Users, run the final owner SQL
-- at the bottom with your real Auth User UUID substituted.

create extension if not exists pgcrypto;

create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.site_admins enable row level security;
-- No public SELECT/INSERT/UPDATE policies: only SQL administrators can appoint admins.

create or replace function public.is_site_admin()
returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from public.site_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_site_admin() from public;
grant execute on function public.is_site_admin() to authenticated;

create table if not exists public.site_settings (
  id text primary key check (id = 'main'),
  name text not null default 'Abhishek Basil Joy',
  eyebrow text not null default 'FILMMAKER / EDITOR / CURIOUS HUMAN',
  headline text not null default 'NOT MADE TO FIT THE FRAME.',
  subheadline text not null default 'Stories and visual experiments driven by curiosity.',
  manifesto text not null default 'A quieter home for films and ideas. Stay curious.',
  about text not null default '',
  instagram text not null default 'https://www.instagram.com/abhishek.basil/',
  contact text not null default 'Have a story in mind? Say hello.',
  email text not null default '',
  education jsonb not null default '[]'::jsonb,
  cloud_ready boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.site_settings enable row level security;
create policy "Anyone can read the site" on public.site_settings for select to anon, authenticated using (true);
create policy "Admin can add site details" on public.site_settings for insert to authenticated with check (public.is_site_admin());
create policy "Admin can update site details" on public.site_settings for update to authenticated using (public.is_site_admin()) with check (public.is_site_admin());

grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;

create table if not exists public.portfolio_projects (
  id text primary key,
  title text not null,
  subtitle text not null default '',
  kind text not null default 'creative' check(kind in ('featured','creative','live','ai-adaptation','ai-short')),
  description text not null default '',
  cover_url text not null default '',
  video_url text not null default '',
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.portfolio_projects enable row level security;
create policy "Anyone can read published films, admins may read drafts"
on public.portfolio_projects for select to anon, authenticated
using (published = true or (select auth.role()) = 'authenticated' and public.is_site_admin());
create policy "Admin can add films" on public.portfolio_projects for insert to authenticated with check (public.is_site_admin());
create policy "Admin can edit films" on public.portfolio_projects for update to authenticated using (public.is_site_admin()) with check (public.is_site_admin());
create policy "Admin can delete films" on public.portfolio_projects for delete to authenticated using (public.is_site_admin());
grant select on public.portfolio_projects to anon, authenticated;
grant insert,update,delete on public.portfolio_projects to authenticated;

-- Public files are watchable without signing in. Only you can upload/delete.
insert into storage.buckets (id,name,public)
values ('portfolio-media','portfolio-media',true)
on conflict (id) do update set public = true;

create policy "Only site owner may upload media"
on storage.objects for insert to authenticated
with check (bucket_id = 'portfolio-media' and public.is_site_admin());
create policy "Only site owner may update media"
on storage.objects for update to authenticated
using (bucket_id = 'portfolio-media' and public.is_site_admin())
with check (bucket_id = 'portfolio-media' and public.is_site_admin());
create policy "Only site owner may delete media"
on storage.objects for delete to authenticated
using (bucket_id = 'portfolio-media' and public.is_site_admin());
create policy "Site owner may list uploaded media"
on storage.objects for select to authenticated
using (bucket_id = 'portfolio-media' and public.is_site_admin());

-- IMPORTANT OWNER STEP, after adding a single user in Authentication > Users:
-- Substitute with YOUR actual Auth User UUID, then run that statement separately:
-- insert into public.site_admins(user_id) values ('YOUR-AUTH-USER-UUID-HERE');

-- Never add a service_role key to public website files.

-- For sites set up using an older version, run this to add the editable manifesto:
-- alter table public.site_settings add column if not exists manifesto text not null default 'A quieter home for films and ideas. Stay curious.';

-- If upgrading an existing Supabase schema, run separately before activating the new starter:
-- alter table public.portfolio_projects drop constraint if exists portfolio_projects_kind_check;
-- alter table public.portfolio_projects add constraint portfolio_projects_kind_check check (kind in ('featured','creative','live','ai-adaptation','ai-short'));

-- For existing Supabase projects upgraded from an earlier ABJ website:
-- alter table public.site_settings add column if not exists email text not null default '';
-- alter table public.portfolio_projects add column if not exists subtitle text not null default '';
