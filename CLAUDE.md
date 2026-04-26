# VidAgent Nexus

Personalized Loom-style outreach at scale — circle avatar overlaid on a Puppeteer recording of the prospect's website, sent via ManyReach cold email.

## Commands
```bash
npm run dev        # frontend dev server at http://localhost:8080
npm run build
npm run lint
npm run test
```

## Pipeline (end-to-end)
CSV upload → email verify (Apify/MillionVerifier) → Puppeteer records website → upload MP4 to HeyGen → HeyGen v2 renders avatar video → video URL → ManyReach sends cold email
Full detail: [docs/pipeline.md](docs/pipeline.md)

## Architecture
React SPA (`vidagent-nexus`) + Node.js backend (`../backend`). All third-party API calls go through the backend. Supabase for auth, DB, and API key storage.

## Key Files

**Frontend**
- [src/App.tsx](src/App.tsx) — Router config; all dashboard routes under `ProtectedRoute`
- [src/types/data.ts](src/types/data.ts) — canonical interfaces (`Lead`, `Video`, `Campaign`); update here first
- [src/services/dataService.ts](src/services/dataService.ts) — all Supabase CRUD
- [src/services/videoGenerationService.ts](src/services/videoGenerationService.ts) — HeyGen v2 (upload asset, generate, poll)
- [src/services/emailVerificationService.ts](src/services/emailVerificationService.ts) — Apify/MillionVerifier, 25/batch
- [src/services/scriptGenerationService.ts](src/services/scriptGenerationService.ts) — Gemini script generation
- [src/services/manyreachService.ts](src/services/manyreachService.ts) — ManyReach v2 campaign flow
- [src/lib/supabase.ts](src/lib/supabase.ts) — Supabase client (reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`)
- `src/components/ui/` — shadcn/ui; do not edit directly, regenerate via `npx shadcn@latest add`

**Backend** (`../backend/src/`)
- `modules/recorder/recorder.ts` — Puppeteer records website → saves `uploads/videos/{jobId}.mp4`
- `modules/recorder/recordAndUpload.ts` — record → upload to HeyGen → delete local file → returns `videoAssetId`

**Pages** (all under `src/pages/dashboard/`)
- `LeadsPage` — CSV upload + Apify email verify
- `CreateVideoPage` — Gemini scripts + HeyGen v2 generate + poll
- `CampaignsPage` — ManyReach campaign management
- `SettingsPage` — save API keys to Supabase

## Spec Docs (read when working in that area)
- [docs/heygen-api.md](docs/heygen-api.md) — HeyGen asset upload, generate, poll endpoints
- [docs/manyreach-api.md](docs/manyreach-api.md) — ManyReach 4-step flow, template variables
- [docs/pipeline.md](docs/pipeline.md) — BullMQ worker steps, recorder behavior, API routes
- [docs/database.md](docs/database.md) — Supabase tables, type shapes, env vars

## Hard Rules
- Never send email if `emailStatus !== 'valid'`
- Never use HeyGen v3 — v2 only (`/v2/video/generate`)
- Never hardcode `avatar_id` or `voice_id` — always read from Supabase
- Never store video files permanently locally — `uploads/videos/` is staging only
- Never call ManyReach analytics on page load — use cached DB data
- Never block the main event loop — all jobs go through BullMQ
- Always limit concurrent jobs to `MAX_CONCURRENT_RECORDINGS` (3–5)
- Always log `{ jobId, step, error, timestamp }` on every job failure
- Always clean up local staging videos older than 7 days (daily cron)
