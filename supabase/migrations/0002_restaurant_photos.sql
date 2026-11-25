-- Restaurant photos: store up to 3 Google Places photo references (resource name + author credit).
-- Images are served through /api/photo so the Places API key stays server-side.

alter table public.restaurants add column photos jsonb;

create or replace function public._insert_restaurant(p_party uuid, p_player uuid, r jsonb, p_wildcard_round int)
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; n int; v_photos jsonb;
begin
  select count(*) into n from restaurants where party_id = p_party;
  -- Keep only well-formed photo entries, at most 3.
  select jsonb_agg(jsonb_build_object('name', p->>'name', 'attribution', left(p->>'attribution', 80)))
    into v_photos
  from (select value as p from jsonb_array_elements(
          case when jsonb_typeof(r->'photos') = 'array' then r->'photos' else '[]'::jsonb end) limit 3) x
  where (p->>'name') ~ '^places/[A-Za-z0-9_-]+/photos/[A-Za-z0-9_-]+$';

  insert into restaurants(party_id, place_id, name, cuisine, price_level, lat, lng, address, rating,
      rating_count, phone, hours, maps_uri, summary, photos, color, added_by, in_play, is_wildcard, wildcard_round)
  values (p_party, r->>'place_id', left(r->>'name', 80), left(r->>'cuisine', 40),
      nullif(r->>'price_level','')::int, nullif(r->>'lat','')::float8, nullif(r->>'lng','')::float8,
      left(r->>'address', 200), nullif(r->>'rating','')::numeric, nullif(r->>'rating_count','')::int,
      left(r->>'phone', 40), r->'hours', left(r->>'maps_uri', 500), left(r->>'summary', 400), v_photos,
      _restaurant_color(n), p_player, p_wildcard_round is null, p_wildcard_round is not null, p_wildcard_round)
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'That restaurant is already in the party';
end $$;

revoke all on function public._insert_restaurant(uuid, uuid, jsonb, int) from public, anon, authenticated;
