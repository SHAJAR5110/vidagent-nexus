# HeyGen API

## 4a — Upload Video Asset
`POST https://api.heygen.com/v1/asset`
Headers: `X-Api-Key`, `Content-Type: video/mp4`
Body: raw MP4 binary
Response: `{ data: { id: "video_asset_id" } }`

## 4b — Generate Avatar Video
`POST https://api.heygen.com/v2/video/generate`
Headers: `X-Api-Key`, `Content-Type: application/json`

```json
{
  "caption": false,
  "dimension": { "width": 1920, "height": 1080 },
  "video_inputs": [{
    "character": {
      "type": "avatar", "scale": 0.5, "avatar_style": "circle",
      "offset": { "x": -0.35, "y": 0.35 },
      "talking_style": "stable", "avatar_id": "<from DB>"
    },
    "voice": {
      "type": "text", "speed": 1, "pitch": 0, "duration": "0.5",
      "voice_id": "<from DB>", "emotion": "Excited", "input_text": "<script>"
    },
    "background": { "type": "video", "play_style": "freeze", "video_asset_id": "<from 4a>" }
  }]
}
```
Response: `{ data: { video_id: "abc123" } }`
Avatar offset: `x: -0.35, y: 0.35` = bottom-left. Positive x→right, positive y→up.

## 4c — Poll Status
`GET https://api.heygen.com/v1/video_status.get?video_id={id}`
Response: `{ data: { status, video_url, thumbnail_url, error } }`
Poll every 10s. On `completed` → store `video_url` in DB. On `failed` → set `videoStatus: failed`.

## Service file
`src/services/videoGenerationService.ts`
- `uploadVideoAsset(blob, apiKey): Promise<string>` → asset id
- `generateVideo(params, apiKey): Promise<string>` → video_id
- `pollVideoStatus(videoId, apiKey): Promise<HeyGenStatusResult>`
