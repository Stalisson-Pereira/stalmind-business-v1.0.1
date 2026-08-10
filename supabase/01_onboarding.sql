-- STALMIND BUSINESS OS
-- Production onboarding for Supabase Auth.
-- Run after the existing DATABASE FOUNDATION v1.

alter table public.organizations
  add column if not exists slug text;

alter table public.organizations
  add column if not exists default_tax_rate numeric(5,2) not null default 23;

create unique index if not exists organizations_slug_unique_idx
  on public.organizations(slug)
  where slug is not null;

create or replace function public.slugify(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(value, '')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  org_id uuid;
  org_name text;
  base_slug text;
  final_slug text;
  counter integer := 0;
begin
  org_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'company_name'), ''), 'Minha Empresa');
  base_slug := coalesce(nullif(public.slugify(org_name), ''), 'empresa');
  final_slug := base_slug;

  while exists (select 1 from public.organizations where slug = final_slug) loop
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  end loop;

  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set full_name = excluded.full_name,
        avatar_url = excluded.avatar_url,
        updated_at = now();

  insert into public.organizations (
    name,
    slug,
    email,
    country,
    currency,
    locale,
    timezone,
    default_tax_rate
  ) values (
    org_name,
    final_slug,
    new.email,
    'PT',
    'EUR',
    'pt-PT',
    'Europe/Lisbon',
    23
  )
  returning id into org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (org_id, new.id, 'owner');

  insert into public.subscriptions (
    organization_id,
    plan,
    status,
    trial_ends_at
  ) values (
    org_id,
    'free',
    'trialing',
    now() + interval '14 days'
  );

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
