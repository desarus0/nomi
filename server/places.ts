// Restaurant search, shared by the Vercel function (api/places.ts) and the Vite dev server.
// Uses Google Places API (New) Text Search when GOOGLE_PLACES_API_KEY is set, otherwise
// returns made-up sample restaurants so the app works locally without a key.

export interface PlaceResult {
  place_id: string;
  name: string;
  cuisine: string | null;
  price_level: number | null; // 1–4
  lat: number | null;
  lng: number | null;
  address: string | null;
  rating: number | null;
  rating_count: number | null;
  phone: string | null;
  hours: { weekday: string[] } | null; // Monday-first descriptions, as Google returns them
  maps_uri: string | null;
  summary: string | null;
  /** Up to 3 Google photo resource names (places/X/photos/Y) with the required author credit. */
  photos: { name: string; attribution: string | null }[] | null;
}

const FIELDS = [
  'id', 'displayName', 'primaryTypeDisplayName', 'priceLevel', 'location', 'shortFormattedAddress',
  'formattedAddress', 'rating', 'userRatingCount', 'nationalPhoneNumber', 'regularOpeningHours',
  'googleMapsUri', 'editorialSummary', 'photos',
].map((f) => `places.${f}`).join(',');

const PRICE: Record<string, number> = {
  PRICE_LEVEL_FREE: 1, PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

interface GooglePlace {
  id: string;
  displayName?: { text: string };
  primaryTypeDisplayName?: { text: string };
  priceLevel?: string;
  location?: { latitude: number; longitude: number };
  shortFormattedAddress?: string;
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  googleMapsUri?: string;
  editorialSummary?: { text: string };
  photos?: { name: string; authorAttributions?: { displayName?: string }[] }[];
}

export async function searchPlaces(
  q: string, lat: number | null, lng: number | null, apiKey: string | undefined,
): Promise<PlaceResult[]> {
  const query = q.trim().slice(0, 80);
  if (query.length < 2) return [];
  if (!apiKey) return mockSearch(query, lat, lng);

  const body: Record<string, unknown> = { textQuery: query, includedType: 'restaurant', maxResultCount: 8 };
  if (lat != null && lng != null) {
    body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 8000 } };
  }
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Places API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { places?: GooglePlace[] };
  return (data.places ?? []).map((p) => ({
    place_id: p.id,
    name: p.displayName?.text ?? 'Unnamed',
    cuisine: cleanCuisine(p.primaryTypeDisplayName?.text),
    price_level: p.priceLevel ? PRICE[p.priceLevel] ?? null : null,
    lat: p.location?.latitude ?? null,
    lng: p.location?.longitude ?? null,
    address: p.shortFormattedAddress ?? p.formattedAddress ?? null,
    rating: p.rating ?? null,
    rating_count: p.userRatingCount ?? null,
    phone: p.nationalPhoneNumber ?? null,
    hours: p.regularOpeningHours?.weekdayDescriptions ? { weekday: p.regularOpeningHours.weekdayDescriptions } : null,
    maps_uri: p.googleMapsUri ?? null,
    summary: p.editorialSummary?.text ?? null,
    photos: p.photos?.length
      ? p.photos.slice(0, 3).map((ph) => ({ name: ph.name, attribution: ph.authorAttributions?.[0]?.displayName ?? null }))
      : null,
  }));
}

function cleanCuisine(t: string | undefined) {
  if (!t) return null;
  return t.replace(/ Restaurant$/i, '') || t;
}

// ------------------------------------------------------------------ sample data (no API key)
const SAMPLE: [string, string, number, number][] = [
  ['Golden Lotus Pho', 'Vietnamese', 1, 4.5], ['Taqueria El Sol', 'Mexican', 1, 4.4],
  ['Bao Down', 'Taiwanese', 2, 4.6], ['Slice Society', 'Pizza', 1, 4.2], ['Smokehouse 89', 'Barbecue', 2, 4.3],
  ['Sushi Tora', 'Japanese', 2, 4.7], ['Burger Lab', 'Hamburger', 1, 4.1], ['Curry Leaf', 'Indian', 2, 4.5],
  ['Cluck & Co.', 'Fried chicken', 1, 4.4], ['Cluckers Hot Chicken', 'Fried chicken', 2, 4.0],
  ['Golden Dragon', 'Chinese', 2, 4.2], ['Noodle Theory', 'Ramen', 2, 4.6], ['Little Athens', 'Greek', 2, 4.4],
  ['Seoul Kitchen', 'Korean', 2, 4.5], ['La Piazza', 'Italian', 3, 4.3], ['Falafel Corner', 'Middle Eastern', 1, 4.6],
  ['Green Bowl', 'Vegetarian', 2, 4.4], ['Thai Basil', 'Thai', 2, 4.3], ['Le Petit Bistro', 'French', 3, 4.7],
  ['Mama Injera', 'Ethiopian', 2, 4.8], ['Dough Theory', 'Donut', 1, 4.3], ['Casa Arepa', 'Venezuelan', 1, 4.5],
  ['Harbor Fish House', 'Seafood', 3, 4.2], ['Big Sky Diner', 'Diner', 1, 4.0],
];

function mockSearch(q: string, lat: number | null, lng: number | null): PlaceResult[] {
  const needle = q.toLowerCase();
  const baseLat = lat ?? 37.7596, baseLng = lng ?? -122.4269;
  return SAMPLE.map(([name, cuisine, price, rating], i) => ({ name, cuisine, price, rating, i }))
    .filter((r) => r.name.toLowerCase().includes(needle) || r.cuisine.toLowerCase().includes(needle))
    .slice(0, 8)
    .map(({ name, cuisine, price, rating, i }) => {
      const a = (i * 137.5 * Math.PI) / 180, d = 0.003 + (i % 7) * 0.0025;
      return {
        place_id: `sample-${i}`,
        name, cuisine, price_level: price,
        lat: baseLat + d * Math.sin(a), lng: baseLng + d * Math.cos(a),
        address: `${100 + i * 37} Sample St`,
        rating, rating_count: 120 + i * 53,
        phone: `(415) 555-01${String(i).padStart(2, '0')}`,
        hours: { weekday: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
          .map((d) => `${d}: 11:00 AM – ${i % 2 ? '10:00' : '9:30'} PM`) },
        maps_uri: null,
        summary: `Sample ${cuisine.toLowerCase()} spot (add a Google Places key for real data).`,
        photos: null,
      };
    });
}

// ------------------------------------------------------------------ photos
const PHOTO_NAME = /^places\/[A-Za-z0-9_-]+\/photos\/[A-Za-z0-9_-]+$/;

/**
 * Resolves a Places photo resource name to a short-lived public image URL (no API key in it),
 * so the browser can load the image directly without ever seeing our key.
 */
export async function photoUrl(name: string, width: number, apiKey: string | undefined): Promise<string | null> {
  if (!apiKey || !PHOTO_NAME.test(name)) return null;
  const w = Math.min(1600, Math.max(100, Math.round(width) || 800));
  const res = await fetch(`https://places.googleapis.com/v1/${name}/media?maxWidthPx=${w}&skipHttpRedirect=true`, {
    headers: { 'X-Goog-Api-Key': apiKey },
  });
  if (!res.ok) throw new Error(`Places photo ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { photoUri?: string };
  return data.photoUri ?? null;
}
