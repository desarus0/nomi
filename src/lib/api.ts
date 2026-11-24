import { ensureSession, supabase } from './supabase';
import type { Choice, PartyState, PlaceResult, PowerUpKind } from './types';

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  await ensureSession();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(friendly(error.message));
  return data as T;
}

function friendly(msg: string) {
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Can’t reach the server. Check your connection.';
  return msg;
}

export interface PartyPeek {
  party_id: string;
  code: string;
  status: 'lobby' | 'playing' | 'finished';
  host_name: string | null;
  host_color: string | null;
  player_count: number;
  restaurant_count: number;
  already_member: boolean;
}

export const api = {
  createParty: (name: string) => rpc<{ party_id: string; code: string }>('create_party', { p_name: name }),
  peekParty: (code: string) => rpc<PartyPeek | null>('peek_party', { p_code: code }),
  joinParty: (code: string, name: string) => rpc<{ party_id: string; code: string }>('join_party', { p_code: code, p_name: name }),
  getState: (party: string) => rpc<PartyState>('get_state', { p_party: party }),
  updateSettings: (party: string, s: { lat: number | null; lng: number | null; label: string | null; timePerCard: number; powerupsOn: boolean; startingPoints: number }) =>
    rpc<void>('update_settings', {
      p_party: party, p_lat: s.lat, p_lng: s.lng, p_location_label: s.label,
      p_time_per_card: s.timePerCard, p_powerups_on: s.powerupsOn, p_starting_points: s.startingPoints,
    }),
  setReady: (party: string, ready: boolean) => rpc<void>('set_ready', { p_party: party, p_ready: ready }),
  addRestaurant: (party: string, r: PlaceResult) => rpc<string>('add_restaurant', { p_party: party, p_restaurant: r }),
  removeRestaurant: (id: string) => rpc<void>('remove_restaurant', { p_restaurant: id }),
  startVoting: (party: string) => rpc<void>('start_voting', { p_party: party }),
  vote: (party: string, restaurant: string, choice: Choice) =>
    rpc<void>('submit_vote', { p_party: party, p_restaurant: restaurant, p_choice: choice }),
  playPowerUp: (party: string, kind: PowerUpKind, target: string | null, wildcard: PlaceResult | null) =>
    rpc<void>('play_power_up', { p_party: party, p_kind: kind, p_target: target, p_wildcard: wildcard }),
  tick: (party: string) => rpc<void>('tick', { p_party: party }),
  leave: (party: string) => rpc<void>('leave_party', { p_party: party }),
};

export async function searchRestaurants(q: string, lat: number | null, lng: number | null, signal?: AbortSignal): Promise<PlaceResult[]> {
  const params = new URLSearchParams({ q });
  if (lat != null && lng != null) { params.set('lat', String(lat)); params.set('lng', String(lng)); }
  const res = await fetch(`/api/places?${params}`, { signal });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? 'Search failed');
  return body.results as PlaceResult[];
}
