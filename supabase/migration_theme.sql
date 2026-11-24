-- Rode no SQL Editor do Supabase se o schema.sql ja tinha sido executado antes.
alter table public.pages add column if not exists theme jsonb not null default '{}'::jsonb;
