-- Authoritative state for each online room. Holds every hand and seat token,
-- so it is readable only by the service role (the `game` Edge Function).
create table if not exists public.game_rooms (
  code text primary key check (code ~ '^[A-Z0-9]{6}$'),
  state jsonb not null,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.game_rooms enable row level security;
-- Intentionally no policies: anon / authenticated clients get no access at all.
revoke all on public.game_rooms from anon, authenticated;

create index if not exists game_rooms_updated_at_idx on public.game_rooms (updated_at);

comment on table public.game_rooms is 'Online 29 game rooms (private; accessed only by the game Edge Function).';
