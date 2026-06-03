# captions.events — Fork Notes

Forked from [elevenlabs/captions.events](https://github.com/elevenlabs/captions.events). This fork adds an OBS overlay viewer route, keyterms support, VAD billing optimization, and fixes a breaking API change.

---

## What changed from upstream

### Bug fix: ElevenLabs SDK upgraded + model ID corrected
The upstream repo used `@elevenlabs/react@0.9.1` with model ID `scribe_realtime_v2` and WebSocket endpoint `realtime-beta` — both of which ElevenLabs deprecated. Upgraded to `@elevenlabs/react@1.6.4` / `@elevenlabs/client@1.9.0` and corrected model ID to `scribe_v2_realtime`.
- `components/broadcaster-interface.tsx` — model ID fix
- `package.json` / `pnpm-lock.yaml` — SDK upgrade

### New: OBS overlay route `/view-obs/[uid]`
A stripped-down viewer page with transparent background, large white text with drop shadow, captions anchored to the bottom — designed to be added directly as an OBS Browser Source with "Allow transparency" enabled.
- `app/view-obs/[uid]/page.tsx`
- `app/view-obs/layout.tsx`
- `components/obs-viewer.tsx`

Supports URL params: `?size=sm|md|lg|xl`, `?color=white|yellow|green`, `?position=bottom|top`, `?bg=1`

`?bg=1` wraps each caption line in a semi-transparent black background span (padding 5px) — classic broadcast caption style. Drop shadow is disabled when bg is active.

### New: Keyterms on broadcast page
Before starting a recording, a "Key Terms" field lets you enter comma-separated words/phrases (e.g. `Anthropic, Claude, TypeScript`) that bias ElevenLabs Scribe toward recognizing those terms. Persisted in localStorage per event so they survive page reloads.
- `components/broadcaster-interface.tsx`

### New: Supabase grants migration
The upstream migrations create tables with RLS but don't grant permissions to the `anon` and `authenticated` roles, which causes `permission denied` errors on fresh Supabase projects.
- `supabase/migrations/20260603000000_grants.sql`

### VAD enabled
`commitStrategy: "vad"` is explicitly set on `scribe.connect()` so the server only processes audio when speech is detected — silence is not billed.
- `components/broadcaster-interface.tsx`

### Quota badge on broadcaster
A green/yellow/red badge in the Broadcasting Controls card header shows remaining ElevenLabs characters (account-wide, from `/api/scribe-quota`). Polls every 120s. The number reflects ElevenLabs' server-side tally which updates with unknown latency — treat it as directional, not precise. The API key requires `user_read` permission for this to work.
- `app/api/scribe-quota/route.ts`
- `components/broadcaster-interface.tsx`

### DB size badge on broadcaster
A second green/yellow/red badge next to the ElevenLabs quota badge shows Postgres database size vs the free tier limit (`25.4 / 500 MB`). Calls the Supabase Management API (`POST /v1/projects/{ref}/database/query`) to run `SELECT sum(pg_database_size(datname)) FROM pg_database` — summing all databases in the cluster matches the number Supabase shows in the dashboard (single-database queries undercount). Also fetches the org plan (`GET /v1/organizations/{org_id}`) to determine the limit dynamically (free=500MB, pro/team=8GB) — no hardcoded values. Polls every 120s. Requires `SUPABASE_ACCESS_TOKEN` (a Supabase CLI personal access token) and `SUPABASE_PROJECT_REF` in `.env.local`.

Color thresholds: green < 60% used, yellow 60–85%, red > 85%.
- `app/api/supabase-usage/route.ts`
- `components/broadcaster-interface.tsx`

### Keyterm length validation
ElevenLabs rejects keyterms longer than 20 characters with a WebSocket 1008 error that crashes the session. Added client-side validation in `handleStartRecording` that throws a user-friendly error before connecting if any keyterm exceeds 20 characters.
- `components/broadcaster-interface.tsx`

### 1006 WebSocket error suppressed on stop
When you click Stop, the WebSocket closes with code 1006 (unclean close) and was triggering the `onError` handler, showing a spurious "Transcription error" alert. An `isStoppingRef` flag suppresses `onError` during intentional disconnects.
**Note:** this may be masking legitimate errors that happen to coincide with a stop — worth revisiting if errors go silently missing.
- `components/broadcaster-interface.tsx`

### Misc
- `next.config.mjs` — disabled Next.js dev tools indicator (`devIndicators: false`)
- `.gitignore` — added `supabase/.temp/` (contains project connection URLs)
- `pnpm-workspace.yaml` — approved build scripts for `sharp` and `supabase`

---

## Getting this running on a new machine

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier is fine)
- An [ElevenLabs](https://elevenlabs.io) account with a Scribe-enabled API key
- A GitHub OAuth App

### 1. Install dependencies
```bash
npm install -g pnpm
pnpm install
```

### 2. Set up Supabase
- Create a new project at supabase.com
- Go to **Settings → API** and copy the **Project URL** and **Publishable key** (`sb_publishable_...`)
- In **Authentication → Providers → GitHub**, enable GitHub and paste your OAuth app credentials (see step 4)
- Run migrations — link the CLI and push:
```bash
SUPABASE_ACCESS_TOKEN=<your_supabase_access_token> \
  node_modules/.pnpm/supabase@2.54.11/node_modules/supabase/bin/supabase \
  link --project-ref <your_project_ref> --password <your_db_password>

SUPABASE_ACCESS_TOKEN=<your_supabase_access_token> \
  node_modules/.pnpm/supabase@2.54.11/node_modules/supabase/bin/supabase \
  db push --password <your_db_password> --yes
```
Or paste each file in `supabase/migrations/` into the Supabase SQL Editor and run them in order.

### 3. Create a GitHub OAuth App
- GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
- **Homepage URL**: `http://localhost:3000`
- **Callback URL**: `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`
- Copy the Client ID and Client Secret into Supabase → Authentication → Providers → GitHub

### 4. Configure environment variables
Create `.env.local` in the project root:
```
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ELEVENLABS_API_KEY=sk_...
SUPABASE_ACCESS_TOKEN=sbp_...   # Supabase CLI personal access token
SUPABASE_PROJECT_REF=<project-ref>
```

### 5. Run
```bash
pnpm dev
```
Open `http://localhost:3000`, sign in with GitHub, create an event.

### 6. OBS setup
- **Audience viewer URL**: `http://localhost:3000/view/<event-uid>` — share with phone viewers
- **OBS Browser Source URL**: `http://localhost:3000/view-obs/<event-uid>`
  - In OBS Browser Source properties, check **"Allow transparency"**
  - Suggested size: 1920×300 for a bottom strip, or 1920×1080 for full overlay

### 7. Deploy to Vercel (optional)
- Import repo at vercel.com → New Project
- Add the same 5 env vars, set `NEXT_PUBLIC_SITE_URL` to your Vercel URL
- Update the GitHub OAuth App callback to `https://<your-vercel-url>/auth/callback` (pointing to your app, not Supabase — Supabase handles the relay)

### Notes
- Translation on the viewer page requires Chrome 138+ with built-in AI features enabled. Viewers on other browsers see captions without translation.
- Keyterms are stored in `localStorage` per event UID, so they survive reloads but are browser-local.
