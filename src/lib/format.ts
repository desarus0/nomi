import type { Party, Restaurant } from './types';

export function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s&]/gu, '').split(/\s+/).filter((w) => w && w !== '&');
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export const price = (n: number | null) => (n ? '$'.repeat(n) : '');

/** Restaurant tile text colour: dark on light tiles (e.g. sand), white otherwise. */
export function onColor(hex: string) {
  const v = parseInt(hex.slice(1), 16);
  const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#1A1A1A' : '#FFFFFF';
}

export function distanceMiles(party: Pick<Party, 'lat' | 'lng'>, r: Pick<Restaurant, 'lat' | 'lng'>): number | null {
  if (party.lat == null || party.lng == null || r.lat == null || r.lng == null) return null;
  const R = 3958.8, rad = Math.PI / 180;
  const dLat = (r.lat - party.lat) * rad, dLng = (r.lng - party.lng) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(party.lat * rad) * Math.cos(r.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const fmtMiles = (mi: number | null) => (mi == null ? null : `${mi < 10 ? mi.toFixed(1) : Math.round(mi)} mi`);

export function travel(mi: number | null) {
  if (mi == null) return null;
  const walk = Math.max(1, Math.round(mi * 20)), drive = Math.max(2, Math.round(mi * 3 + 2));
  return { walk: walk <= 60 ? `${walk} min walk` : null, drive: `${drive} min drive` };
}

/** "Cuisine · $$ · 0.4 mi" */
export function metaLine(party: Pick<Party, 'lat' | 'lng'>, r: Restaurant | (Pick<Restaurant, 'cuisine' | 'price_level' | 'lat' | 'lng'>)) {
  return [r.cuisine, price(r.price_level), fmtMiles(distanceMiles(party, r))].filter(Boolean).join(' · ');
}

/** Today's opening hours from Google's Monday-first weekday descriptions. */
export function todayHours(r: Pick<Restaurant, 'hours'>): string | null {
  const days = r.hours?.weekday;
  if (!days || days.length !== 7) return null;
  const idx = (new Date().getDay() + 6) % 7;
  return days[idx].replace(/^[^:]+:\s*/, '');
}

export function mapsUrl(r: Pick<Restaurant, 'maps_uri' | 'name' | 'lat' | 'lng' | 'place_id'>) {
  if (r.maps_uri) return r.maps_uri;
  const q = encodeURIComponent(r.name);
  return r.place_id.startsWith('sample-') || r.lat == null
    ? `https://www.google.com/maps/search/?api=1&query=${q}`
    : `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${r.place_id}`;
}

export function directionsUrl(r: Pick<Restaurant, 'name' | 'lat' | 'lng' | 'place_id'>) {
  const dest = r.lat != null ? `${r.lat},${r.lng}` : encodeURIComponent(r.name);
  const pid = r.place_id.startsWith('sample-') ? '' : `&destination_place_id=${r.place_id}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}${pid}`;
}

export function ago(iso: string, nowMs: number) {
  const s = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 1000));
  if (s < 5) return 'now';
  if (s < 60) return `${s}s`;
  return `${Math.round(s / 60)}m`;
}

export const roundsFor = (n: number) => (n <= 1 ? 0 : Math.ceil(Math.log2(n)));

/** Deterministic per-player shuffle so each player sees cards in their own order. */
export function shuffleFor<T extends { id: string }>(items: T[], seed: string): T[] {
  const h = (s: string) => { let x = 2166136261; for (const c of s) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619); } return x >>> 0; };
  return [...items].sort((a, b) => h(seed + a.id) - h(seed + b.id));
}

/** Same-origin URL for a Places photo (our /api/photo proxy keeps the API key server-side). */
export const photoSrc = (name: string, width = 800) => `/api/photo?name=${encodeURIComponent(name)}&w=${width}`;
