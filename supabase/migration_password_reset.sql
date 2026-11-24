-- Recuperacao de senha por codigo (enviado pelo Gmail via Edge Function).
-- Rode no SQL Editor do Supabase.

create table if not exists public.password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  used boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists password_resets_user_idx on public.password_resets(user_id, created_at desc);

-- RLS ligado e SEM politicas: somente a Edge Function (service_role) acessa.
alter table public.password_resets enable row level security;
revoke all on public.password_resets from anon, authenticated;

-- Busca o usuario pelo e-mail e informa se ele tem senha (contas so-Google nao tem)
create or replace function public.user_for_reset(p_email text)
returns table (id uuid, has_password boolean)
language sql security definer set search_path = public, auth as $$
  select u.id,
         exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email')
  from auth.users u
  where lower(u.email) = lower(p_email)
  limit 1;
$$;
revoke all on function public.user_for_reset(text) from public, anon, authenticated;
grant execute on function public.user_for_reset(text) to service_role;
