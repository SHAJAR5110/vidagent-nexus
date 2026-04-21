# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server at http://localhost:8080
npm run build        # Production build
npm run lint         # ESLint on all TS/TSX files
npm run test         # Run tests once (Vitest)
npm run test:watch   # Run tests in watch mode
npm run preview      # Preview production build
```

## What This System Builds

An end-to-end AI video outreach pipeline:
1. CSV prospect upload → MailTester.Ninja email verification
2. Claude AI generates a personalized 60-second video script per prospect
3. Puppeteer captures a scrolling recording of the prospect's website
4. FFmpeg composites the avatar video (PiP) over the website recording
5. HeyGen API (v2) renders the final avatar video
6. A personalized landing page (`/lp/:jobId`) embeds the video
7. ManyReach API sends the landing page link via cold email
8. Analytics pulled from ManyReach + internal job data, displayed in dashboard

## Architecture

### Frontend (this repo — `vidagent-nexus`)

Fully client-side React SPA. Data currently persisted in **localStorage** via [src/services/dataService.ts](src/services/dataService.ts). Backend integration points are stubbed — the plan is to wire them to the Node/Express backend described below.

- [src/App.tsx](src/App.tsx) — React Router v6 config; all dashboard routes wrapped in `<ProtectedRoute>`
- [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx) — mock auth via localStorage
- [src/layouts/DashboardLayout.tsx](src/layouts/DashboardLayout.tsx) — sidebar + topnav shell
- [src/services/dataService.ts](src/services/dataService.ts) — CRUD for all entities
- [src/types/data.ts](src/types/data.ts) — canonical TypeScript interfaces; update here first when changing data shapes
- `src/components/ui/` — shadcn/ui primitives; regenerate via shadcn CLI, do not edit directly

**Key libraries:** React Hook Form + Zod (forms), TanStack Query (async state), Recharts (charts), Sonner (toasts), Lucide React (icons)

### Backend (Node.js / Express — to be built)

Module layout under `/modules/`:

```
prospects/        CSV parse, MailTester.Ninja verification
campaigns/        Campaign creation + job orchestration
video-automation/ HeyGen, Puppeteer, FFmpeg, S3, Claude script, landing page
outreach/         ManyReach email sending
analytics/        Aggregate internal DB + ManyReach stats
```

**Queue**: BullMQ + Redis — all video generation is async, max 5 concurrent jobs (`MAX_CONCURRENT_VIDEO_JOBS`).  
**DB**: Supabase (check existing schema).  
**Storage**: AWS S3 — all video files; `/tmp` is staging only, never permanent.

### Video Job Pipeline (BullMQ worker steps in order)

```
Claude script → Puppeteer website capture → S3 upload → HeyGen submit
→ Poll/webhook for completion → Download video → FFmpeg composite (if website_bg)
→ S3 upload final → DB update → ManyReach send → Prospect marked 'sent'
```

On failure: log `{ jobId, step, error, timestamp }`, set `status: 'failed'`, surface in dashboard for manual retry. No automatic retries except where noted.

### Key API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/prospects/upload` | Upload CSV |
| POST | `/api/prospects/verify/:batchId` | Run email verification |
| POST | `/api/campaigns` | Create campaign + queue jobs |
| GET | `/api/video/status/:jobId` | Poll job status |
| POST | `/api/video/webhook` | HeyGen webhook callback |
| GET | `/lp/:jobId` | Serve personalized landing page |
| GET | `/api/analytics/:campaignId` | Get merged analytics |
| POST | `/api/analytics/:campaignId/sync` | Force sync ManyReach stats |

### Landing Page (`GET /lp/:jobId`)

Handlebars-rendered HTML only — no JS framework. Must load under 2 seconds. Variables: `{{firstName}}`, `{{company}}`, `{{videoUrl}}`, `{{senderName}}`, `{{ctaUrl}}`. Full-width autoplay-muted video player with CTA button below.

### Analytics Dashboard Charts

1. Funnel: Uploaded → Verified → Videos done → Sent → Opened → Replied
2. Line: Opens / Replies over time (daily)
3. Donut: Email verification breakdown (valid / invalid / risky)
4. Bar: Video job statuses (queued / processing / done / failed)
5. KPI cards: Total sent, Open rate %, Reply rate %, Bounce rate %

ManyReach analytics are **cached in DB, synced every 15 minutes** — never call their API per page load.

## Environment Variables

```
HEYGEN_API_KEY=
MAILTESTER_API_KEY=
MANYREACH_API_KEY=
ANTHROPIC_API_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_BUCKET_NAME=vidagent-videos
AWS_REGION=us-east-1
REDIS_URL=redis://localhost:6379
BASE_URL=https://yourdomain.com
MAX_CONCURRENT_VIDEO_JOBS=5
ANALYTICS_SYNC_INTERVAL_MINUTES=15
```

## Hard Rules

- Never send emails to prospects with `emailStatus: 'invalid'`
- Never use HeyGen v1 personalized video endpoints (deprecated Jan 2025) — use v2 only
- Never store `avatar_id` or `voice_id` as hardcoded values — always read from sender profile in DB
- Never store video files permanently on local disk — `/tmp` staging then S3
- Never call ManyReach analytics API per page load — use cached DB data only
- All heavy work goes through BullMQ — never block the main event loop
- Structured logging on every job step: `{ jobId, step, status, durationMs, timestamp }`

## Testing

Tests use Vitest with jsdom. Test files match `src/**/*.{test,spec}.{ts,tsx}`. Setup file at [src/test/setup.ts](src/test/setup.ts) polyfills `window.matchMedia`.
