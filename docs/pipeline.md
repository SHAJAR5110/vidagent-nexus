# Video Job Pipeline

## BullMQ Worker Steps (in order)
```
Prospect selected
→ Puppeteer records website → backend/uploads/videos/{jobId}.mp4
→ Upload MP4 to HeyGen /v1/asset → video_asset_id
→ HeyGen v2 generate (circle avatar PiP + website background) → video_id
→ Poll HeyGen every 10s until completed → video_url
→ DB update (prospect.videoUrl = video_url, videoStatus: 'done')
→ Delete local uploads/videos/{jobId}.mp4
→ ManyReach email sent with video_url in screenshotUrl field
→ Prospect marked 'sent'
```
On failure: log `{ jobId, step, error, timestamp }`, set `videoStatus: 'failed'`.

## Recorder Behavior (Puppeteer)
- Backend module: `backend/src/modules/recorder/recorder.ts`
- Entry: `recordWebsite(url, jobId): Promise<string>` → returns local MP4 path
- Full flow (record + upload + delete): `recordAndUpload(url, jobId, heygenApiKey)`
- Viewport: 1920×1080, headless, 25fps
- Sequence: navigate (networkidle2) → 2s pause → smooth scroll (~12s) → 1s pause → stop
- Output: `backend/uploads/videos/{jobId}.mp4` (staging only, deleted after HeyGen upload)

## Queue Config
- BullMQ + Redis (`REDIS_URL`)
- Max concurrent: `MAX_CONCURRENT_RECORDINGS` (3–5)
- All recording + HeyGen jobs are async — never block main event loop

## Cleanup Cron (daily)
Delete `backend/uploads/videos/` files older than 7 days.

## Error Log Shape
`{ jobId, step: 'recording|asset-upload|heygen-generate|heygen-poll|email|verification', error, timestamp }`

## Key API Routes
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/recordings/start` | Queue recording + HeyGen jobs |
| GET | `/api/recordings/status/:jobId` | Poll job status |
| POST | `/api/prospects/upload` | CSV upload + parse |
| POST | `/api/prospects/verify/:batchId` | Run email verification |
| POST | `/api/email/campaign` | Create ManyReach list + campaign + start |
| GET | `/api/email/export/:campaignId` | CSV export |
| GET | `/api/analytics/:campaignId` | Cached analytics |
| POST | `/api/analytics/:campaignId/sync` | Force ManyReach sync |
