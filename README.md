# mtb-commute

A single-page widget that shows **live traffic-aware drive times** from your phone's current location to your saved mountain bike trailheads, ranked fastest-first. Built to be deployed as one Vercel URL that you paste into a WhatsApp group — anyone in the group taps it and sees their own ETAs.

## How it works

1. You open `/settings` once, paste 4 Google Maps URLs (or `lat,lng` pairs) for your trailheads, and click **Save & generate link**.
2. The page produces a shareable URL that has all 4 trail locations encoded in the query string (no database needed).
3. You paste that URL once in WhatsApp. When anyone taps it, the page asks for their location (browser permission), calls Google's Routes API with traffic data, and shows ranked ETAs.

No accounts, no Meta approval, no backend state — just a URL.

## Setup

### 1. Get a Google Maps Platform API key

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/google/maps-apis/credentials).
2. Create an API key.
3. In [APIs & Services → Library](https://console.cloud.google.com/apis/library), enable the **Routes API**.
4. Restrict the key to the Routes API and (after deploy) to your Vercel domain via the HTTP referrer restriction.

Pricing: traffic-aware route matrix calls are ~$5 per 1,000 requests. Google gives every account **$200 of free Maps credits per month**, which covers ~40,000 calls — way more than a friend group will use.

### 2. Local development

```bash
cp .env.example .env.local
# edit .env.local and paste your key
npm run dev
```

Open http://localhost:3000/settings to add your trails.

### 3. Deploy to Vercel

```bash
npx vercel deploy
# then set the env var:
npx vercel env add GOOGLE_MAPS_API_KEY production
npx vercel deploy --prod
```

Or use the Vercel dashboard: import the repo, add `GOOGLE_MAPS_API_KEY` under Project Settings → Environment Variables, deploy.

### 4. Share the link

1. Open `https://your-app.vercel.app/settings` on your phone.
2. Add the 4 trails (paste Google Maps URLs from the Maps app's Share → Copy link).
3. Tap **Save & generate link** → **Copy shareable link**.
4. Paste in WhatsApp. Pin the message.

## Supported location formats on the settings page

- `37.7749, -122.4194` — direct lat,lng paste
- `https://www.google.com/maps/place/.../@37.7749,-122.4194,15z/...` — long URLs from desktop Maps
- `https://www.google.com/maps?q=37.7749,-122.4194`
- URLs containing `!3d37.7749!4d-122.4194` (Maps mobile share)

> Short links like `https://maps.app.goo.gl/xxxx` **don't contain coordinates** — open the link in a browser, wait for it to expand into the long URL, then copy that.

## Stack

- Next.js 16 (App Router) on Vercel Fluid Compute
- Google Routes API `computeRouteMatrix` with `routingPreference: TRAFFIC_AWARE`
- Browser geolocation (per-user)
- Tailwind CSS v4
- Zero backend storage — config travels in the URL
