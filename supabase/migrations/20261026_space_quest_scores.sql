-- Космические миссии МП. Только игровые псевдонимы, без ФИО/контактных данных.
create table if not exists public.space_quest_scores (
  id text primary key,
  name text not null check (char_length(name) between 2 and 25),
  docking smallint not null default 0 check (docking between 0 and 100),
  landing smallint not null default 0 check (landing between 0 and 100),
  orbit smallint not null default 0 check (orbit between 0 and 100),
  debris smallint not null default 0 check (debris between 0 and 100),
  total smallint generated always as (docking + landing + orbit + debris) stored,
  updated_at timestamptz not null default now()
);
create index if not exists space_quest_scores_total_idx on public.space_quest_scores(total desc, updated_at asc);
alter table public.space_quest_scores enable row level security;
-- Нет публичных политик: чтение и запись только в Edge Function с service_role.

create or replace function public.space_quest_upsert_best(
  p_id text, p_name text, p_docking integer, p_landing integer, p_orbit integer, p_debris integer
) returns void language sql security definer set search_path = public as $$
 insert into public.space_quest_scores (id, name, docking, landing, orbit, debris)
 values (p_id, p_name, p_docking, p_landing, p_orbit, p_debris)
 on conflict (id) do update set
   name = excluded.name,
   docking = greatest(public.space_quest_scores.docking, excluded.docking),
   landing = greatest(public.space_quest_scores.landing, excluded.landing),
   orbit = greatest(public.space_quest_scores.orbit, excluded.orbit),
   debris = greatest(public.space_quest_scores.debris, excluded.debris),
   updated_at = now();
$$;
revoke all on function public.space_quest_upsert_best(text,text,integer,integer,integer,integer) from public,anon,authenticated;
grant execute on function public.space_quest_upsert_best(text,text,integer,integer,integer,integer) to service_role;
