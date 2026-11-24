-- Nomi Level 1 schema.
-- Model: every write goes through a SECURITY DEFINER RPC; clients read through get_state().
-- Tables have RLS enabled with no direct read/write policies except parties (for Realtime),
-- so hidden information (votes, power-up targets, pending wildcards) never leaks to clients.
-- Each mutation bumps parties.rev, which Realtime pushes to members so they refetch.
-- Requires: Anonymous sign-ins enabled (Authentication > Providers > Anonymous).


-- ---------------------------------------------------------------- tables
create table public.parties (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique,
  host_player_id   uuid,
  status           text not null default 'lobby' check (status in ('lobby','playing','finished')),
  lat              double precision,
  lng              double precision,
  location_label   text,
  time_per_card    int  not null default 20 check (time_per_card between 5 and 60),
  powerups_on      boolean not null default true,
  starting_points  int  not null default 60 check (starting_points between 0 and 500),
  current_round    int  not null default 0,
  winner_restaurant_id uuid,
  rev              bigint not null default 0,
  created_at       timestamptz not null default now()
);

create table public.players (
  id             uuid primary key default gen_random_uuid(),
  party_id       uuid not null references public.parties(id) on delete cascade,
  user_id        uuid not null,
  name           text not null check (char_length(name) between 1 and 20),
  color          text not null,
  face           int  not null default 0,
  ready          boolean not null default false,
  points         int  not null default 0,
  double_pending boolean not null default false,
  done_round     int  not null default 0,
  left_at        timestamptz,
  joined_at      timestamptz not null default now()
);
create unique index players_one_per_user on public.players(party_id, user_id);
alter table public.parties add constraint parties_host_fk
  foreign key (host_player_id) references public.players(id) on delete set null;

create table public.restaurants (
  id            uuid primary key default gen_random_uuid(),
  party_id      uuid not null references public.parties(id) on delete cascade,
  place_id      text not null,
  name          text not null,
  cuisine       text,
  price_level   int,
  lat           double precision,
  lng           double precision,
  address       text,
  rating        numeric,
  rating_count  int,
  phone         text,
  hours         jsonb,
  maps_uri      text,
  summary       text,
  color         text not null,
  added_by      uuid references public.players(id) on delete set null,
  in_play       boolean not null default true,
  out_round     int,
  is_wildcard   boolean not null default false,
  wildcard_round int,
  created_at    timestamptz not null default now(),
  unique (party_id, place_id)
);

create table public.rounds (
  id          uuid primary key default gen_random_uuid(),
  party_id    uuid not null references public.parties(id) on delete cascade,
  number      int  not null,
  status      text not null default 'voting' check (status in ('voting','resolved')),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  resolved_at timestamptz,
  unique (party_id, number)
);

create table public.votes (
  round_id      uuid not null references public.rounds(id) on delete cascade,
  player_id     uuid not null references public.players(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  choice        text not null check (choice in ('yum','nope','skip')),
  weight        int  not null default 1,
  created_at    timestamptz not null default now(),
  primary key (round_id, player_id, restaurant_id)
);

create table public.power_up_plays (
  id         uuid primary key default gen_random_uuid(),
  party_id   uuid not null references public.parties(id) on delete cascade,
  round_id   uuid not null references public.rounds(id) on delete cascade,
  player_id  uuid not null references public.players(id) on delete cascade,
  kind       text not null check (kind in ('veto','double','wildcard')),
  target_restaurant_id uuid references public.restaurants(id) on delete set null,
  cost       int  not null,
  created_at timestamptz not null default now(),
  unique (round_id, player_id)
);

create table public.round_results (
  round_id      uuid not null references public.rounds(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  yums          int  not null,
  raw_yums      int  not null default 0,
  rank          int  not null,
  advanced      boolean not null,
  vetoed        boolean not null default false,
  doubled       boolean not null default false,
  primary key (round_id, restaurant_id)
);

create table public.round_points (
  round_id  uuid not null references public.rounds(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  earned    int  not null,
  primary key (round_id, player_id)
);

alter table public.parties        enable row level security;
alter table public.players        enable row level security;
alter table public.restaurants    enable row level security;
alter table public.rounds         enable row level security;
alter table public.votes          enable row level security;
alter table public.power_up_plays enable row level security;
alter table public.round_results  enable row level security;
alter table public.round_points   enable row level security;

-- ---------------------------------------------------------------- helpers
create or replace function public._my_player(p_party uuid) returns public.players
language sql stable security definer set search_path = public as $$
  select * from players where party_id = p_party and user_id = auth.uid() and left_at is null
$$;

create or replace function public._is_member(p_party uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from players where party_id = p_party and user_id = auth.uid() and left_at is null)
$$;

-- Realtime: members can see their party row (it holds nothing secret; used for rev pings).
create policy parties_member_read on public.parties for select using (public._is_member(id));

create or replace function public._bump(p_party uuid) returns void
language sql security definer set search_path = public as $$
  update parties set rev = rev + 1 where id = p_party
$$;

create or replace function public._new_code() returns text
language plpgsql set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I/L
  c text;
begin
  loop
    c := '';
    for i in 1..5 loop
      c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from parties where code = c);
  end loop;
  return c;
end $$;

create or replace function public._player_color(n int) returns text
language sql immutable set search_path = public as $$
  select (array['#E8833A','#8E7CFF','#3A8EE6','#D9609B','#B88A5E','#5C6BC0','#7D8A99','#A0679B'])[1 + (n % 8)]
$$;

create or replace function public._restaurant_color(n int) returns text
language sql immutable set search_path = public as $$
  select (array['#1F3A5F','#D9C3A0','#9C5B3B','#5B3A6B','#3F4A5A','#6B4E3D','#4A5D73','#8A6F5A'])[1 + (n % 8)]
$$;

-- ---------------------------------------------------------------- lobby RPCs
create or replace function public.create_party(p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_party parties; v_player players;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into parties(code) values (_new_code()) returning * into v_party;
  insert into players(party_id, user_id, name, color, face, ready)
    values (v_party.id, auth.uid(), trim(p_name), _player_color(0), 0, true) returning * into v_player;
  update parties set host_player_id = v_player.id where id = v_party.id;
  return jsonb_build_object('party_id', v_party.id, 'code', v_party.code);
end $$;

-- Look up a party by code before joining (Join screen confirmation).
create or replace function public.peek_party(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'party_id', p.id, 'code', p.code, 'status', p.status,
    'host_name', h.name, 'host_color', h.color,
    'player_count', (select count(*) from players x where x.party_id = p.id and x.left_at is null),
    'restaurant_count', (select count(*) from restaurants r where r.party_id = p.id),
    'already_member', exists(select 1 from players m where m.party_id = p.id and m.user_id = auth.uid() and m.left_at is null)
  )
  from parties p left join players h on h.id = p.host_player_id
  where p.code = upper(trim(p_code))
$$;

create or replace function public.join_party(p_code text, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_party parties; v_existing players; n int;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into v_party from parties where code = upper(trim(p_code)) for update;
  if v_party.id is null then raise exception 'No party with that code'; end if;
  select * into v_existing from players where party_id = v_party.id and user_id = auth.uid();
  if v_existing.id is not null and v_existing.left_at is null then
    update players set name = trim(p_name) where id = v_existing.id;
    perform _bump(v_party.id);
    return jsonb_build_object('party_id', v_party.id, 'code', v_party.code);
  end if;
  if v_party.status <> 'lobby' then raise exception 'Voting has already started'; end if;
  select count(*) into n from players where party_id = v_party.id;
  if (select count(*) from players where party_id = v_party.id and left_at is null) >= 8 then
    raise exception 'This party is full';
  end if;
  if v_existing.id is not null then
    update players set left_at = null, name = trim(p_name), ready = false where id = v_existing.id;
  else
    insert into players(party_id, user_id, name, color, face, points)
      values (v_party.id, auth.uid(), trim(p_name), _player_color(n), n % 5, 0);
  end if;
  perform _bump(v_party.id);
  return jsonb_build_object('party_id', v_party.id, 'code', v_party.code);
end $$;

create or replace function public.update_settings(
  p_party uuid, p_lat double precision, p_lng double precision, p_location_label text,
  p_time_per_card int, p_powerups_on boolean, p_starting_points int
) returns void
language plpgsql security definer set search_path = public as $$
declare me players; v_party parties;
begin
  me := _my_player(p_party);
  select * into v_party from parties where id = p_party;
  if me.id is null or v_party.host_player_id <> me.id then raise exception 'Only the host can change settings'; end if;
  if v_party.status <> 'lobby' then raise exception 'Settings are locked once voting starts'; end if;
  update parties set lat = p_lat, lng = p_lng, location_label = p_location_label,
    time_per_card = p_time_per_card, powerups_on = p_powerups_on, starting_points = p_starting_points
  where id = p_party;
  perform _bump(p_party);
end $$;

create or replace function public.set_ready(p_party uuid, p_ready boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me players;
begin
  me := _my_player(p_party);
  if me.id is null then raise exception 'Not in this party'; end if;
  update players set ready = p_ready where id = me.id;
  perform _bump(p_party);
end $$;

create or replace function public._insert_restaurant(p_party uuid, p_player uuid, r jsonb, p_wildcard_round int)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; n int;
begin
  select count(*) into n from restaurants where party_id = p_party;
  insert into restaurants(party_id, place_id, name, cuisine, price_level, lat, lng, address, rating,
      rating_count, phone, hours, maps_uri, summary, color, added_by, in_play, is_wildcard, wildcard_round)
  values (p_party, r->>'place_id', left(r->>'name', 80), left(r->>'cuisine', 40),
      nullif(r->>'price_level','')::int, nullif(r->>'lat','')::float8, nullif(r->>'lng','')::float8,
      left(r->>'address', 200), nullif(r->>'rating','')::numeric, nullif(r->>'rating_count','')::int,
      left(r->>'phone', 40), r->'hours', left(r->>'maps_uri', 500), left(r->>'summary', 400),
      _restaurant_color(n), p_player, p_wildcard_round is null, p_wildcard_round is not null, p_wildcard_round)
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'That restaurant is already in the party';
end $$;

create or replace function public.add_restaurant(p_party uuid, p_restaurant jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare me players; v_party parties; v_id uuid;
begin
  me := _my_player(p_party);
  if me.id is null then raise exception 'Not in this party'; end if;
  select * into v_party from parties where id = p_party for update;
  if v_party.status <> 'lobby' then raise exception 'The pool is locked once voting starts'; end if;
  if (select count(*) from restaurants where party_id = p_party) >= 16 then
    raise exception 'The pool is full (16 max)';
  end if;
  v_id := _insert_restaurant(p_party, me.id, p_restaurant, null);
  perform _bump(p_party);
  return v_id;
end $$;

create or replace function public.remove_restaurant(p_restaurant uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_r restaurants; v_party parties; me players;
begin
  select * into v_r from restaurants where id = p_restaurant;
  if v_r.id is null then return; end if;
  me := _my_player(v_r.party_id);
  select * into v_party from parties where id = v_r.party_id;
  if me.id is null then raise exception 'Not in this party'; end if;
  if v_party.status <> 'lobby' then raise exception 'The pool is locked once voting starts'; end if;
  delete from restaurants where id = p_restaurant;
  perform _bump(v_r.party_id);
end $$;

create or replace function public._start_round(p_party uuid, p_number int, p_delay interval) returns void
language plpgsql security definer set search_path = public as $$
declare v_party parties; n int; v_start timestamptz := now() + p_delay;
begin
  select * into v_party from parties where id = p_party;
  select count(*) into n from restaurants where party_id = p_party and in_play;
  insert into rounds(party_id, number, starts_at, ends_at)
    values (p_party, p_number, v_start, v_start + make_interval(secs => v_party.time_per_card * n + 3));
  update parties set current_round = p_number where id = p_party;
end $$;

create or replace function public.start_voting(p_party uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me players; v_party parties;
begin
  me := _my_player(p_party);
  select * into v_party from parties where id = p_party for update;
  if me.id is null or v_party.host_player_id <> me.id then raise exception 'Only the host can start voting'; end if;
  if v_party.status <> 'lobby' then raise exception 'Voting already started'; end if;
  if (select count(*) from restaurants where party_id = p_party) < 4 then
    raise exception 'Add at least 4 restaurants first';
  end if;
  update players set points = v_party.starting_points, done_round = 0, double_pending = false
    where party_id = p_party;
  update parties set status = 'playing' where id = p_party;
  perform _start_round(p_party, 1, interval '3 seconds');
  perform _bump(p_party);
end $$;

-- ---------------------------------------------------------------- round resolution
create or replace function public._resolve_round(p_round uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_round rounds; v_party parties;
  n int; k int; cutoff int; n_adv int; n_next int;
begin
  select * into v_round from rounds where id = p_round for update;
  if v_round.status = 'resolved' then return; end if;
  select * into v_party from parties where id = v_round.party_id for update;

  -- Tally: yum weights, zeroed for vetoed restaurants.
  create temp table _tally on commit drop as
  select r.id as restaurant_id,
         exists(select 1 from power_up_plays p where p.round_id = p_round and p.kind = 'veto' and p.target_restaurant_id = r.id) as vetoed,
         coalesce((select sum(v.weight) from votes v where v.round_id = p_round and v.restaurant_id = r.id and v.choice = 'yum'), 0)::int as raw_yums,
         exists(select 1 from votes v where v.round_id = p_round and v.restaurant_id = r.id and v.choice = 'yum' and v.weight > 1) as doubled,
         random() as tiebreak
  from restaurants r
  where r.party_id = v_round.party_id and r.in_play;

  alter table _tally add column yums int;
  update _tally set yums = case when vetoed then 0 else raw_yums end;

  select count(*) into n from _tally;
  k := greatest(1, ceil(n / 2.0)::int);

  -- Everyone tied at the cutoff moves on...
  select yums into cutoff from _tally order by yums desc offset (k - 1) limit 1;
  alter table _tally add column advanced boolean;
  update _tally set advanced = (yums >= cutoff);
  select count(*) into n_adv from _tally where advanced;
  -- ...unless that would eliminate nothing; then break ties randomly to keep exactly k.
  if n_adv >= n and n > 1 then
    update _tally t set advanced = t.restaurant_id in (
      select restaurant_id from _tally order by yums desc, tiebreak limit k);
  end if;

  insert into round_results(round_id, restaurant_id, yums, raw_yums, rank, advanced, vetoed, doubled)
  select p_round, restaurant_id, yums, raw_yums,
         rank() over (order by yums desc), advanced, vetoed, doubled
  from _tally;

  update restaurants r set in_play = false, out_round = v_round.number
  from _tally t where t.restaurant_id = r.id and not t.advanced;

  -- Points: 10 per non-vetoed Yum pick that moves on.
  insert into round_points(round_id, player_id, earned)
  select p_round, pl.id,
         10 * (select count(*) from votes v join _tally t on t.restaurant_id = v.restaurant_id
               where v.round_id = p_round and v.player_id = pl.id and v.choice = 'yum'
                 and t.advanced and not t.vetoed)
  from players pl where pl.party_id = v_round.party_id;
  update players pl set points = pl.points + rp.earned
  from round_points rp where rp.round_id = p_round and rp.player_id = pl.id;

  -- Wildcards join the next round on top of the restaurants that moved on.
  update restaurants set in_play = true
  where party_id = v_round.party_id and is_wildcard and wildcard_round = v_round.number + 1;

  update rounds set status = 'resolved', resolved_at = now() where id = p_round;

  select count(*) into n_next from restaurants where party_id = v_round.party_id and in_play;
  if n_next <= 1 then
    update parties set status = 'finished',
      winner_restaurant_id = (select id from restaurants where party_id = v_round.party_id and in_play limit 1)
    where id = v_round.party_id;
  else
    perform _start_round(v_round.party_id, v_round.number + 1, interval '5 seconds');
  end if;
  perform _bump(v_round.party_id);
end $$;

create or replace function public._maybe_resolve(p_party uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_round rounds; n_active int; n_done int;
begin
  select r.* into v_round from rounds r join parties p on p.id = r.party_id
    where r.party_id = p_party and r.number = p.current_round and p.status = 'playing';
  if v_round.id is null or v_round.status = 'resolved' then return; end if;
  select count(*), count(*) filter (where done_round >= v_round.number)
    into n_active, n_done from players where party_id = p_party and left_at is null;
  if now() >= v_round.ends_at or (n_active > 0 and n_done >= n_active) then
    perform _resolve_round(v_round.id);
  end if;
end $$;

-- Any client may call this (e.g. when its timer hits zero); it only acts when due.
create or replace function public.tick(p_party uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not _is_member(p_party) then raise exception 'Not in this party'; end if;
  perform _maybe_resolve(p_party);
end $$;

create or replace function public.submit_vote(p_party uuid, p_restaurant uuid, p_choice text) returns void
language plpgsql security definer set search_path = public as $$
declare me players; v_party parties; v_round rounds; w int := 1; n_cards int; n_mine int;
begin
  me := _my_player(p_party);
  if me.id is null then raise exception 'Not in this party'; end if;
  select * into v_party from parties where id = p_party;
  select * into v_round from rounds where party_id = p_party and number = v_party.current_round;
  if v_party.status <> 'playing' or v_round.status <> 'voting' then raise exception 'This round is over'; end if;
  if now() < v_round.starts_at then raise exception 'The round has not started yet'; end if;
  if not exists(select 1 from restaurants where id = p_restaurant and party_id = p_party and in_play) then
    raise exception 'That restaurant is not in this round';
  end if;
  if p_choice = 'yum' and me.double_pending then
    w := 2;
    update players set double_pending = false where id = me.id;
  end if;
  insert into votes(round_id, player_id, restaurant_id, choice, weight)
    values (v_round.id, me.id, p_restaurant, p_choice, w)
    on conflict do nothing;

  select count(*) into n_cards from restaurants where party_id = p_party and in_play;
  select count(*) into n_mine from votes where round_id = v_round.id and player_id = me.id;
  if n_mine >= n_cards then
    update players set done_round = v_round.number where id = me.id;
  end if;
  perform _maybe_resolve(p_party);
  perform _bump(p_party);
end $$;

-- ---------------------------------------------------------------- power-ups
create or replace function public.play_power_up(p_party uuid, p_kind text, p_target uuid, p_wildcard jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare me players; v_party parties; v_round rounds; v_cost int; v_target uuid := p_target; n int;
begin
  me := _my_player(p_party);
  if me.id is null then raise exception 'Not in this party'; end if;
  select * into v_party from parties where id = p_party for update;
  if not v_party.powerups_on then raise exception 'Power-ups are off for this party'; end if;
  select * into v_round from rounds where party_id = p_party and number = v_party.current_round;
  if v_party.status <> 'playing' or v_round.status <> 'voting' then raise exception 'This round is over'; end if;
  if exists(select 1 from power_up_plays where round_id = v_round.id and player_id = me.id) then
    raise exception 'You already played a power-up this round';
  end if;
  v_cost := case p_kind when 'veto' then 40 when 'double' then 20 when 'wildcard' then 35 end;
  if v_cost is null then raise exception 'Unknown power-up'; end if;
  if me.points < v_cost then raise exception 'Not enough points'; end if;

  if p_kind = 'veto' then
    if not exists(select 1 from restaurants where id = p_target and party_id = p_party and in_play) then
      raise exception 'Pick a restaurant in this round';
    end if;
  elsif p_kind = 'double' then
    v_target := null;
    update players set double_pending = true where id = me.id;
  elsif p_kind = 'wildcard' then
    select count(*) into n from restaurants where party_id = p_party and in_play;
    if n <= 2 then raise exception 'Wildcard can''t be played in the final round'; end if;
    v_target := _insert_restaurant(p_party, me.id, p_wildcard, v_round.number + 1);
  end if;

  update players set points = points - v_cost where id = me.id;
  insert into power_up_plays(party_id, round_id, player_id, kind, target_restaurant_id, cost)
    values (p_party, v_round.id, me.id, p_kind, v_target, v_cost);
  perform _bump(p_party);
end $$;

-- ---------------------------------------------------------------- leaving
create or replace function public.leave_party(p_party uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me players; v_party parties; v_next uuid;
begin
  me := _my_player(p_party);
  if me.id is null then return; end if;
  select * into v_party from parties where id = p_party for update;
  if v_party.status = 'lobby' then
    delete from players where id = me.id;  -- frees the seat; their restaurants stay (added_by -> null)
  else
    update players set left_at = now() where id = me.id;
  end if;
  if v_party.host_player_id = me.id then
    select id into v_next from players where party_id = p_party and left_at is null and id <> me.id
      order by joined_at limit 1;
    update parties set host_player_id = v_next where id = p_party;
  end if;
  perform _maybe_resolve(p_party);
  perform _bump(p_party);
end $$;

-- ---------------------------------------------------------------- state snapshot
create or replace function public.get_state(p_party uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me players; v_party parties; v_round rounds;
begin
  me := _my_player(p_party);
  if me.id is null then raise exception 'Not in this party'; end if;
  select * into v_party from parties where id = p_party;
  select * into v_round from rounds where party_id = p_party and number = v_party.current_round;

  return jsonb_build_object(
    'now', now(),
    'me', me.id,
    'party', to_jsonb(v_party) - 'rev',
    'players', coalesce((select jsonb_agg(to_jsonb(p) - 'user_id' - 'double_pending' order by p.joined_at)
                         from players p where p.party_id = p_party), '[]'),
    'my_double_pending', me.double_pending,
    -- Pending wildcards stay hidden from everyone but the player who added them.
    'restaurants', coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at) from restaurants r
                             where r.party_id = p_party
                               and (not r.is_wildcard or r.in_play or r.out_round is not null or r.added_by = me.id)), '[]'),
    'rounds', coalesce((select jsonb_agg(to_jsonb(x) order by x.number) from rounds x where x.party_id = p_party), '[]'),
    'my_votes', coalesce((select jsonb_agg(jsonb_build_object('restaurant_id', v.restaurant_id, 'choice', v.choice, 'weight', v.weight))
                          from votes v where v.round_id = v_round.id and v.player_id = me.id), '[]'),
    -- Everyone sees who played what; targets only for your own plays or once the round is resolved.
    'power_ups', coalesce((select jsonb_agg(jsonb_build_object(
                             'id', pu.id, 'round_id', pu.round_id, 'player_id', pu.player_id, 'kind', pu.kind,
                             'cost', pu.cost, 'created_at', pu.created_at,
                             'target_restaurant_id', case when pu.player_id = me.id or rd.status = 'resolved'
                                                          then pu.target_restaurant_id end)
                             order by pu.created_at)
                           from power_up_plays pu join rounds rd on rd.id = pu.round_id
                           where pu.party_id = p_party), '[]'),
    'round_results', coalesce((select jsonb_agg(to_jsonb(rr)) from round_results rr
                               join rounds rd on rd.id = rr.round_id where rd.party_id = p_party), '[]'),
    'round_points', coalesce((select jsonb_agg(to_jsonb(rp)) from round_points rp
                              join rounds rd on rd.id = rp.round_id where rd.party_id = p_party), '[]')
  );
end $$;

-- ---------------------------------------------------------------- grants & realtime
-- Supabase grants EXECUTE to anon/authenticated by default; lock down the internal _helpers.
revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.create_party(text), public.peek_party(text), public.join_party(text, text),
  public.update_settings(uuid, double precision, double precision, text, int, boolean, int),
  public.set_ready(uuid, boolean), public.add_restaurant(uuid, jsonb), public.remove_restaurant(uuid),
  public.start_voting(uuid), public.tick(uuid), public.submit_vote(uuid, uuid, text),
  public.play_power_up(uuid, text, uuid, jsonb), public.leave_party(uuid), public.get_state(uuid)
  to authenticated;
grant execute on function public._is_member(uuid) to authenticated;

alter publication supabase_realtime add table public.parties;
