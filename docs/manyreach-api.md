# ManyReach API

Base: `https://api.manyreach.com` | Auth: `X-Api-Key` header
Service: `src/services/manyreachService.ts`

## 4-Step Flow

**1 — Create list**
`POST /api/v2/lists` `{ "title": "Campaign Name" }` → `{ listId }`

**2 — Create campaign**
`POST /api/v2/campaigns`
Key fields: `name, subject, body, fromEmails, fromName, replyToEmail, trackOpens, trackClicks, dailyLimit`
Scheduling: `scheduleSendOnDateEnabled: true, scheduleSendOnDate, scheduleSendOnDateHours, scheduleSendOnDateMinutes, scheduleTimeZone`
→ `{ campaignId }`

**3 — Bulk add prospects**
`POST /api/v2/prospects/bulk?listId=123&campaignId=456&addOnlyIfNew=false`
Body: `{ prospects: [{ email, firstName, company, website, screenshotUrl }] }`
`screenshotUrl` = HeyGen video URL → resolves as `{{screenshotUrl}}` in template.

**4 — Start campaign**
`POST /api/v2/campaigns/{id}/start`

## Analytics Sync (every 15 min)
`GET /api/v2/campaigns/{id}` → `sentCount, openCount, clickCount, replyCount, bounceCount`
Cache in Supabase `analytics` table. Never call on page load.

## Template Variables
`{{firstName}}` `{{lastName}}` `{{email}}` `{{company}}` `{{website}}` `{{screenshotUrl}}` (video URL goes here) `{{custom1}}`…`{{custom20}}`

## Email Log (Supabase `email_logs`)
`{ id, prospectId, manyreachCampaignId, manyreachListId, status, sentAt, videoUrl }`
