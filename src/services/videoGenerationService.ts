const HEYGEN_BASE = 'https://api.heygen.com';

function headers(apiKey: string) {
  return { 'Content-Type': 'application/json', 'X-Api-Key': apiKey };
}

// Step 1 — submit prompt, returns session_id
export async function submitVideoPrompt(
  prompt: string,
  apiKey: string,
  options?: { avatarId?: string; voiceId?: string },
): Promise<string> {
  const body: Record<string, unknown> = { prompt, orientation: 'landscape' };
  if (options?.avatarId) body.avatar_id = options.avatarId;
  if (options?.voiceId)  body.voice_id  = options.voiceId;

  const response = await fetch(`${HEYGEN_BASE}/v3/video-agents`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.message || `HeyGen submit ${response.status}`);
  }

  const data = await response.json();
  const sessionId: string = data?.data?.session_id;
  if (!sessionId) throw new Error('No session_id in HeyGen response');
  return sessionId;
}

// Step 2 — poll session until video_id appears
export async function pollSession(
  sessionId: string,
  apiKey: string,
): Promise<{ status: string; videoId: string | null }> {
  const response = await fetch(`${HEYGEN_BASE}/v3/video-agents/${sessionId}`, {
    headers: headers(apiKey),
  });
  if (!response.ok) throw new Error(`HeyGen session poll ${response.status}`);
  const data = await response.json();
  return {
    status: data?.data?.status ?? 'unknown',
    videoId: data?.data?.video_id ?? null,
  };
}

// Step 3 — poll video until completed/failed
export async function pollVideo(
  videoId: string,
  apiKey: string,
): Promise<{ status: string; videoUrl?: string; thumbnailUrl?: string; failureMessage?: string }> {
  const response = await fetch(`${HEYGEN_BASE}/v3/videos/${videoId}`, {
    headers: headers(apiKey),
  });
  if (!response.ok) throw new Error(`HeyGen video poll ${response.status}`);
  const data = await response.json();
  return {
    status: data?.data?.status ?? 'unknown',
    videoUrl: data?.data?.video_url,
    thumbnailUrl: data?.data?.thumbnail_url,
    failureMessage: data?.data?.failure_message,
  };
}
