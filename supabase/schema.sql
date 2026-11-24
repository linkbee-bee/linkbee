-- Linkbee schema. Rode no SQL Editor do Supabase (projeto novo recomendado).

create table if not exists public.pages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9_.-]{3,30}$'),
  title text not null default '',
  bio text not null default '',
  avatar_url text,
  socials jsonb not null default '{}'::jsonb,
  theme jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.links (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.pages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  subtitle text not null default '' check (char_length(subtitle) <= 120),
  url text not null check (url ~* '^(https?://|mailto:|tel:)'),
  icon_url text,
  position int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists links_page_idx on public.links(page_id, position);

alter table public.pages enable row level security;
alter table public.links enable row level security;

-- Leitura publica (a pagina publica precisa ler sem login)
create policy "pages_public_read" on public.pages for select using (true);
create policy "links_public_read" on public.links for select using (active = true or user_id = auth.uid());

-- Escrita somente do dono
create policy "pages_owner_insert" on public.pages for insert with check (user_id = auth.uid());
create policy "pages_owner_update" on public.pages for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "pages_owner_delete" on public.pages for delete using (user_id = auth.uid());

create policy "links_owner_insert" on public.links for insert
  with check (user_id = auth.uid() and exists (select 1 from public.pages p where p.id = page_id and p.user_id = auth.uid()));
create policy "links_owner_update" on public.links for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "links_owner_delete" on public.links for delete using (user_id = auth.uid());

-- Cria a pagina automaticamente no cadastro (usa o username enviado no signUp)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base text := lower(regexp_replace(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)), '[^a-z0-9_.-]', '', 'g'));
  final_slug text;
begin
  if char_length(base) < 3 then base := 'user' || substr(md5(random()::text), 1, 6); end if;
  base := left(base, 30);
  final_slug := base;
  if exists (select 1 from public.pages where slug = final_slug) then
    final_slug := left(base, 23) || '-' || substr(md5(random()::text), 1, 6);
  end if;
  insert into public.pages (user_id, slug, title) values (new.id, final_slug, final_slug);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Excluir somente o Linkbee (pagina + links), mantendo a conta
create or replace function public.delete_my_page()
returns void language sql security definer set search_path = public as $$
  delete from public.pages where user_id = auth.uid();
$$;

-- Excluir a conta permanentemente (cascata apaga pagina e links)
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.delete_my_page() from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_page() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
