create extension if not exists pgcrypto;

create table if not exists public.dragonfilm_users (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  username_lower text not null unique,
  password_hash text not null,
  password_salt text not null,
  password_iterations integer not null default 120000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dragonfilm_user_data (
  user_id uuid primary key references public.dragonfilm_users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.dragonfilm_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists dragonfilm_users_updated_at on public.dragonfilm_users;
create trigger dragonfilm_users_updated_at
before update on public.dragonfilm_users
for each row execute function public.dragonfilm_set_updated_at();

drop trigger if exists dragonfilm_user_data_updated_at on public.dragonfilm_user_data;
create trigger dragonfilm_user_data_updated_at
before update on public.dragonfilm_user_data
for each row execute function public.dragonfilm_set_updated_at();

alter table public.dragonfilm_users enable row level security;
alter table public.dragonfilm_user_data enable row level security;

create index if not exists dragonfilm_users_username_lower_idx
on public.dragonfilm_users (username_lower);
