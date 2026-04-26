# Database & Schema

## Supabase Tables

| Table | Notes |
|-------|-------|
| `leads` | snake_case columns; camelCase mapped in `toLead()` |
| `videos` | includes `heygen_video_id`, `heygen_session_id` (legacy), `video_url` |
| `api_keys` | PK: `(user_id, service)` — upsert on conflict |
| `email_logs` | per-prospect send log |
| `analytics` | ManyReach stats cache (sync every 15 min) |

`api_keys` service values: `apify`, `gemini`, `heygen`, `heygen_avatar_id`, `heygen_voice_id`, `manyreach`

## Key Type Shapes (`src/types/data.ts`)

```ts
Lead { id, userId, firstName, lastName, email, company, website, companyDescription,
       status: 'uploaded'|'verifying'|'valid'|'invalid',
       verificationCode?: 'ok'|'ko'|'mb', verificationMessage?, mxServer?, verifiedAt? }

Video { id, userId, leadId, name, script, avatarId?, voiceId?,
        heygenVideoId?,    // v2: video_id from /v2/video/generate
        heygenSessionId?,  // legacy — kept for DB compat only
        status: 'pending'|'generating_script'|'script_ready'|'processing'|'completed'|'failed',
        videoUrl?, thumbnailUrl?, errorMessage? }

Campaign { id, userId, name, leadIds[], videoId,
           status: 'draft'|'scheduled'|'running'|'completed', scheduledAt? }
```

## Analytics Record
`{ campaignId, totalSent, totalReplies, totalClicked, totalOpened, replyRate, lastSyncedAt }`
`replyRate = (totalReplies / totalSent) * 100`

## Email Log Record
`{ id, prospectId, manyreachCampaignId, manyreachListId, status: 'sent'|'failed', sentAt, videoUrl }`

## Env Vars
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
PORT=3000
REDIS_URL=redis://localhost:6379
MAX_CONCURRENT_RECORDINGS=5
ANALYTICS_SYNC_INTERVAL_MINUTES=15
```
API keys (millionverifier, heygen, manyreach) are stored in Supabase by the user — not in .env.
