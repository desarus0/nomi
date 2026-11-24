// Vercel serverless function: GET /api/places?q=pho&lat=..&lng=..
// Keeps GOOGLE_PLACES_API_KEY on the server.
import { searchPlaces } from '../server/places.js';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const num = (k: string) => {
    const v = url.searchParams.get(k);
    return v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null;
  };
  try {
    const results = await searchPlaces(url.searchParams.get('q') ?? '', num('lat'), num('lng'), process.env.GOOGLE_PLACES_API_KEY);
    return Response.json({ results }, { headers: { 'Cache-Control': 'private, max-age=60' } });
  } catch (e) {
    console.error(e);
    return Response.json({ error: 'Restaurant search is unavailable right now.' }, { status: 502 });
  }
}
