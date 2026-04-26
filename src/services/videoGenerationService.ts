const HEYGEN_BASE = 'https://api.heygen.com';
const HEYGEN_UPLOAD_BASE = 'https://upload.heygen.com';

function jsonHeaders(apiKey: string) {
  return { 'Content-Type': 'application/json', 'X-Api-Key': apiKey };
}

export interface HeyGenVideoParams {
  /** Use avatarId OR talkingPhotoId — one is required. avatarId takes priority if both provided. */
  avatarId?: string;
  talkingPhotoId?: string;
  voiceId: string;
  inputText: string;
  /** Website recording asset id from uploadVideoAsset(). Omit to use a plain color background. */
  videoAssetId?: string;
  /** Fallback background color when no videoAssetId. @default '#1a1a2e' */
  backgroundColor?: string;
  /** @default 'Excited' */
  emotion?: string;
  /** @default 1 */
  speed?: number;
}

export interface HeyGenStatusResult {
  status: 'processing' | 'completed' | 'failed' | 'pending' | string;
  videoUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

// Step 1 — upload the Puppeteer website recording as a HeyGen video asset
// Doc: https://docs.heygen.com/reference/upload-asset
export async function uploadVideoAsset(
  videoBlob: Blob,
  apiKey: string,
): Promise<string> {
  const response = await fetch(`${HEYGEN_UPLOAD_BASE}/v1/asset`, {
    method: 'POST',
    headers: { 'Content-Type': 'video/mp4', 'X-Api-Key': apiKey },
    body: videoBlob,
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    let msg = `HeyGen asset upload ${response.status}`;
    try { msg = (JSON.parse(raw) as { message?: string })?.message || raw || msg; } catch { msg = raw || msg; }
    throw new Error(msg);
  }

  const data = await response.json();
  const assetId: string = data?.data?.id;
  if (!assetId) throw new Error('No asset id in HeyGen upload response');
  return assetId;
}

// Step 2 — generate the avatar video (circle PiP, bottom-left) over the website background
// Doc: https://movio-api.readme.io/reference/create-an-avatar-video-v2
export async function generateVideo(
  params: HeyGenVideoParams,
  apiKey: string,
): Promise<string> {
  const body = {
    caption: false,
    dimension: { width: 1920, height: 1080 },
    video_inputs: [
      {
        character: params.avatarId
          ? {
              type: 'avatar',
              scale: 0.5,
              avatar_style: 'circle',
              offset: { x: -0.35, y: 0.35 },
              talking_style: 'stable',
              avatar_id: params.avatarId,
            }
          : {
              type: 'talking_photo',
              scale: 0.5,
              avatar_style: 'circle',
              offset: { x: -0.35, y: 0.35 },
              talking_style: 'stable',
              talking_photo_id: params.talkingPhotoId,
            },
        voice: {
          type: 'text',
          speed: params.speed ?? 1,
          pitch: 0,
          duration: '0.5',
          voice_id: params.voiceId,
          emotion: params.emotion ?? 'Excited',
          input_text: params.inputText,
        },
        background: params.videoAssetId
          ? { type: 'video', play_style: 'freeze', video_asset_id: params.videoAssetId }
          : { type: 'color', value: params.backgroundColor ?? '#1a1a2e' },
      },
    ],
  };

  const response = await fetch(`${HEYGEN_BASE}/v2/video/generate`, {
    method: 'POST',
    headers: jsonHeaders(apiKey),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    let msg = `HeyGen generate ${response.status}`;
    try { msg = (JSON.parse(raw) as { message?: string })?.message || raw || msg; } catch { msg = raw || msg; }
    throw new Error(msg);
  }

  const data = await response.json();
  const videoId: string = data?.data?.video_id;
  if (!videoId) throw new Error(`No video_id in HeyGen response: ${JSON.stringify(data)}`);
  return videoId;
}

// Step 3 — poll until completed or failed
export async function pollVideoStatus(
  videoId: string,
  apiKey: string,
): Promise<HeyGenStatusResult> {
  const response = await fetch(
    `${HEYGEN_BASE}/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
    { headers: { 'X-Api-Key': apiKey } },
  );

  if (!response.ok) throw new Error(`HeyGen status poll ${response.status}`);

  const data = await response.json();
  return {
    status: data?.data?.status ?? 'unknown',
    videoUrl: data?.data?.video_url,
    thumbnailUrl: data?.data?.thumbnail_url,
    error: data?.data?.error ?? undefined,
  };
}
