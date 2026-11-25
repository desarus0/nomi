// Vercel serverless function: GET /api/photo?name=places/X/photos/Y&w=800
// Redirects to Google's image URL so the API key never reaches the browser.
// The redirect is cached at Vercel's CDN, so repeat views of the same photo don't bill again.
import { photoUrl } from '../server/places.js';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  try {
    const target = await photoUrl(url.searchParams.get('name') ?? '', Number(url.searchParams.get('w') ?? 800), process.env.GOOGLE_PLACES_API_KEY);
    if (!target) return new Response('Not found', { status: 404 });
    return new Response(null, {
      status: 302,
      headers: { Location: target, 'Cache-Control': 'public, max-age=3600, s-maxage=21600' },
    });
  } catch (e) {
    console.error(e);
    return new Response('Photo unavailable', { status: 502 });
  }
}
