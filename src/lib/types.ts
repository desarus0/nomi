export type PartyStatus = 'lobby' | 'playing' | 'finished';
export type PowerUpKind = 'veto' | 'double' | 'wildcard';
export type Choice = 'yum' | 'nope' | 'skip';

export interface Party {
  id: string;
  code: string;
  host_player_id: string | null;
  status: PartyStatus;
  lat: number | null;
  lng: number | null;
  location_label: string | null;
  time_per_card: number;
  powerups_on: boolean;
  starting_points: number;
  current_round: number;
  winner_restaurant_id: string | null;
  created_at: string;
}

export interface Player {
  id: string;
  party_id: string;
  name: string;
  color: string;
  face: number;
  ready: boolean;
  points: number;
  done_round: number;
  left_at: string | null;
  joined_at: string;
}

export interface Restaurant {
  id: string;
  party_id: string;
  place_id: string;
  name: string;
  cuisine: string | null;
  price_level: number | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  rating: number | null;
  rating_count: number | null;
  phone: string | null;
  hours: { weekday: string[] } | null;
  maps_uri: string | null;
  summary: string | null;
  photos: Photo[] | null;
  color: string;
  added_by: string | null;
  in_play: boolean;
  out_round: number | null;
  is_wildcard: boolean;
  wildcard_round: number | null;
}

export interface Round {
  id: string;
  party_id: string;
  number: number;
  status: 'voting' | 'resolved';
  starts_at: string;
  ends_at: string;
  resolved_at: string | null;
}

export interface PowerUpPlay {
  id: string;
  round_id: string;
  player_id: string;
  kind: PowerUpKind;
  cost: number;
  created_at: string;
  target_restaurant_id: string | null; // hidden (null) for others until the round resolves
}

export interface RoundResult {
  round_id: string;
  restaurant_id: string;
  yums: number;
  raw_yums: number;
  rank: number;
  advanced: boolean;
  vetoed: boolean;
  doubled: boolean;
}

export interface PartyState {
  now: string;
  me: string;
  party: Party;
  players: Player[];
  my_double_pending: boolean;
  restaurants: Restaurant[];
  rounds: Round[];
  my_votes: { restaurant_id: string; choice: Choice; weight: number }[];
  power_ups: PowerUpPlay[];
  round_results: RoundResult[];
  round_points: { round_id: string; player_id: string; earned: number }[];
}

/** A search result from /api/places, also the payload for add_restaurant / wildcard. */
export interface PlaceResult {
  place_id: string;
  name: string;
  cuisine: string | null;
  price_level: number | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  rating: number | null;
  rating_count: number | null;
  phone: string | null;
  hours: { weekday: string[] } | null;
  maps_uri: string | null;
  summary: string | null;
  photos: Photo[] | null;
}

/** A Google Places photo reference; served via /api/photo. Credit must be shown with the image. */
export interface Photo { name: string; attribution: string | null }

export const POWER_UPS: Record<PowerUpKind, { name: string; cost: number; effect: string; icon: 'veto' | 'double' | 'sparkle' }> = {
  veto: { name: 'Veto', cost: 40, effect: 'Cancel all Yum votes on one restaurant this round.', icon: 'veto' },
  double: { name: 'Double Vote', cost: 20, effect: 'Your next Yum counts twice.', icon: 'double' },
  wildcard: { name: 'Wildcard', cost: 35, effect: 'Add a new restaurant to the next round.', icon: 'sparkle' },
};

export const POOL_MIN = 4;
export const POOL_MAX = 16;
export const POINTS_PER_PICK = 10;
