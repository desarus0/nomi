# Nomi

Nomi turns "where should we eat?" into a short party game. A host creates a party, friends join with a five-character code, everyone adds restaurants to a shared pool, and the group swipes **Yum** or **Nope** over several rounds until one restaurant is left. Players earn points when their picks move on and can spend them on power-ups (Veto, Double Vote, Wildcard).

This is the **Level 1 prototype** (FR01–FR05, FR13): a mobile-first web app for mobile Safari and Chrome.

**Stack:** React + TypeScript + Tailwind CSS (Vite) · Supabase (Postgres, Realtime, anonymous auth) · Google Places API (New) through a Vercel function.

## How it works

- **No accounts.** Each device gets an invisible Supabase *anonymous* session; a player is just a display name inside one party.
- **The server runs the game.** All writes go through Postgres functions in [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) (`create_party`, `join_party`, `submit_vote`, `play_power_up`, …). Round resolution, tie-breaking, points and power-up effects all happen in SQL, so clients can't cheat or disagree.
- **Hidden info stays hidden.** Tables have RLS with no direct read access. Clients read through `get_state()`, which hides other players' votes, power-up targets and pending Wildcards until the round results.
- **Live updates.** Every change bumps `parties.rev`. Clients subscribe to that row with Supabase Realtime and refetch, with polling as a fallback.
- **Timers.** Rounds have a server deadline (`time per card × cards`). When it passes, any client calls `tick()`, and the server resolves the round if it's due.
- **Restaurant search** calls `/api/places`. Locally that route is served by Vite; in production it's a Vercel function (`api/places.ts`). The Google key never reaches the browser. Without a key, it returns built-in sample restaurants.

### Rules decided for the open questions in the handoff

| Question | Decision |
| --- | --- |
| Ties for the last spot | All restaurants tied at the cutoff move on. If that would eliminate nothing, a random tie-break keeps exactly the top half. |
| Time running out on a card | The card is skipped; it counts as neither Yum nor Nope. |
| Rounds vs pool size | Rounds follow the pool size (top half each round until one is left). The host doesn't set them. |
| Wildcard and halving | Wildcards are added **on top** of the restaurants that move on. They can't be played in the final round (2 left). |
| Leaving mid-game | If the host leaves, the next player to have joined becomes host. A player who leaves no longer counts toward "everyone's done". |
| Late joiners | Only allowed in the lobby. |
| Party codes | Codes skip look-alike characters (0/O, 1/I/L). |

Other details: 8 players max; 4–16 restaurants; points are only spent on confirm; the next round starts 5 s after results.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com) (the free tier is fine).
2. **SQL Editor:** paste and run `supabase/migrations/0001_init.sql`.
3. **Authentication → Sign In / Providers:** turn on **Allow anonymous sign-ins**.
4. **Project Settings → API:** copy the project URL and the `anon` / publishable key.

### 2. Google Places (optional for local dev)

In Google Cloud, enable **Places API (New)** and create an API key restricted to that API. Put it in `GOOGLE_PLACES_API_KEY`. It is only used server-side.

### 3. Run locally

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev                  # http://localhost:5173 (also on your LAN for testing on a phone)
```

To play with several people on one computer, open extra players in private windows or another browser. Each one gets its own anonymous session.

### 4. Deploy (Vercel)

Import the GitHub repo in Vercel (it detects Vite) and set the environment variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `GOOGLE_PLACES_API_KEY`. Every push to `main` deploys.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with the `/api/places` route |
| `npm run build` | Type-check and build to `dist/` |
| `npm run test:db` | Runs the game-engine SQL against an in-memory Postgres (PGlite): voting, ties, veto, double vote, wildcard, timeouts, host handover, a full game to a winner, and permission checks |
| `npm run test:e2e` | Plays a full 3-player game (create, search, join, ready, Veto, Double Vote, all rounds, winner) against the live site, or pass a URL: `npm run test:e2e -- http://localhost:5173`. Screenshots go to `e2e-shots/` |
| `npm run lint` | oxlint |

## Project map

```
api/places.ts               Vercel function → Google Places
server/places.ts            Places search + sample data (shared with the dev server)
supabase/migrations/        Schema, RLS and game RPCs
supabase/tests/             Game-engine tests (PGlite)
src/lib/                    Supabase client, RPC wrappers, live party state, formatting
src/components/ui.tsx       Design-system pieces (buttons, code tiles, avatars, sheets, stamps…)
src/screens/                One file per screen (Figs. 2–14); sheets/ holds Figs. 8–11
```

## Design system

Colours have exactly one meaning each (tokens in `src/index.css`): brand green `#15803D` = Yum/ready/NEXT, red `#C9291F` = Nope/OUT/Leave, lime `#D4F542` = points and power-ups (always with black). Headings use Bricolage Grotesque 800; body text uses the system font with Inter as fallback. Touch targets are at least 44 pt, colour is never the only signal, and animations stop under Reduce Motion.

## Out of scope (Level 2/3)

Accounts, dining history, rejoining the last party, saved lists, friends, Shield/Decoy power-ups, "Suggest nearby", recommendations, deals, and Places photos (the Details screen shows a placeholder).
