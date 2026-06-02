# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev       # start dev server at localhost:3000
npm run build     # production build
npm run lint      # ESLint (no separate test suite exists)
```

Env setup: `cp .env.example .env.local` and fill in `GOOGLE_MAPS_API_KEY`.

## Architecture

Single-purpose Next.js 16 App Router app — no database, no auth, no external state. Config travels in the URL.

**Pages**
- `/` (`app/page.tsx`) — main ETA widget. On load it reads trails from the `?config=` query param (or localStorage), geolocates the user, calls `/api/etas`, and renders results ranked by drive time.
- `/settings` (`app/settings/page.tsx`) — trail editor. Validates and parses Google Maps URLs/coords, saves to localStorage, and produces the shareable `?config=` URL.

**API**
- `POST /api/etas` (`app/api/etas/route.ts`) — server-side proxy to Google Routes API `computeRouteMatrix`. Exists solely to keep `GOOGLE_MAPS_API_KEY` off the client. Returns `{ results, fetchedAt }`.

**Shared utility — `lib/trails.ts`**
- `Trail` type: `{ id, name, lat, lng }`
- `parseLatLngInput(raw)` — parses four Google Maps URL formats plus bare `lat,lng`
- `encodeTrailsToParam` / `decodeTrailsFromParam` — compact JSON (`{ n, a, o }`) → base64url, used in `?config=` param
- `loadTrailsFromStorage` / `saveTrailsToStorage` — localStorage key `mtb-commute:trails:v1`
- `isShortGoogleMapsUrl` — detects `maps.app.goo.gl` links that lack embedded coords

## Key design decisions

- **No backend storage.** Trails are encoded into the shareable URL; localStorage is the per-device cache. Adding a database would be a significant architectural change.
- **Traffic delay** is computed as `duration - staticDuration` from Google's response — not a separate API field.
- `HomeContent` is wrapped in `<Suspense>` on the home page because `useSearchParams()` requires a Suspense boundary in Next.js App Router.
- `GOOGLE_MAPS_API_KEY` must remain a **server-side-only** env var (no `NEXT_PUBLIC_` prefix).
