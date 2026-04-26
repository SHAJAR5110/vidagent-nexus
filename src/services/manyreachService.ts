const MANYREACH_BASE = 'https://api.manyreach.com';

function headers(apiKey: string) {
  return { 'Content-Type': 'application/json', 'X-Api-Key': apiKey };
}

async function handleResponse<T>(res: Response, context: string): Promise<T> {
  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    console.error(`[ManyReach] ${context} ${res.status}:`, raw);
    let msg = `ManyReach ${context} ${res.status}`;
    try { msg = (JSON.parse(raw) as { message?: string })?.message || raw || msg; } catch { msg = raw || msg; }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * Prospect data sent to ManyReach.
 * `screenshotUrl` maps to {{screenshotUrl}} in the email template — put the
 * HeyGen video URL here so the template variable resolves to a clickable link.
 * custom1–custom20 map to {{custom1}}…{{custom20}}.
 */
export interface ManyReachProspect {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  website?: string;
  phone?: string;
  city?: string;
  country?: string;
  jobPosition?: string;
  industry?: string;
  /** HeyGen final video URL — maps to {{screenshotUrl}} in email template */
  screenshotUrl?: string;
  logoUrl?: string;
  icebreaker?: string;
  custom1?: string;
  custom2?: string;
  custom3?: string;
  custom4?: string;
  custom5?: string;
  [key: string]: string | undefined;
}

export interface CampaignCreateParams {
  name: string;
  /** HTML body — use {{FIRST_NAME}}, {{COMPANY}}, {{ScreenshotURL}}, etc. */
  body: string;
  subject: string;
  /** Comma-separated sender emails already connected in ManyReach. Omit to use all account senders. */
  fromEmails?: string;
  fromName?: string;
  replyToEmail?: string;
  trackOpens?: boolean;
  trackClicks?: boolean;
  dailyLimit?: number;
  /** When true, set scheduleSendOnDate + hours + minutes + timeZone */
  scheduleSendOnDateEnabled?: boolean;
  /** ISO date string e.g. "2026-04-25" */
  scheduleSendOnDate?: string;
  /** 0–23 */
  scheduleSendOnDateHours?: number;
  /** 0–59 */
  scheduleSendOnDateMinutes?: number;
  /** IANA timezone e.g. "America/New_York" */
  scheduleTimeZone?: string;
}

export interface BulkImportResult {
  totalProcessed: number;
  prospectsInserted: number;
  prospectsUpdated: number;
  duplicatesInBatch: number;
  subscriptionsAdded: number;
  campaignAdded: number;
}

export interface ManyReachCampaignStats {
  campaignId: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  replyCount: number;
  bounceCount: number;
}

// ── 1. Create mailing list ────────────────────────────────────────────────────

/** POST /api/v2/lists — returns the new listId */
export async function createList(title: string, apiKey: string): Promise<number> {
  const res = await fetch(`${MANYREACH_BASE}/api/v2/lists`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ title }),
  });
  const data = await handleResponse<{ listId?: number; data?: { listId?: number } }>(res, 'createList');
  const listId = data?.listId ?? (data as { data?: { listId?: number } })?.data?.listId;
  if (!listId) throw new Error('No listId in ManyReach createList response');
  return listId;
}

// ── 2. Create campaign ────────────────────────────────────────────────────────

/**
 * POST /api/v2/campaigns
 * Creates the campaign with the email template. Variables in subject/body
 * ({{firstName}}, {{company}}, {{screenshotUrl}}, etc.) are resolved by
 * ManyReach per-prospect at send time.
 * Returns the new campaignId.
 */
export async function createCampaign(
  params: CampaignCreateParams,
  apiKey: string,
): Promise<number> {
  const body: Record<string, unknown> = {
    name: params.name,
    subject: params.subject,
    body: params.body,
    trackOpens: params.trackOpens ?? true,
    trackClicks: params.trackClicks ?? true,
  };

  // Only include sender fields if explicitly provided — otherwise ManyReach uses all account senders
  if (params.fromEmails) body.fromEmails = params.fromEmails;
  if (params.fromName)   body.fromName   = params.fromName;
  if (params.replyToEmail) body.replyToEmail = params.replyToEmail;
  if (params.dailyLimit)   body.dailyLimit   = params.dailyLimit;

  if (params.scheduleSendOnDateEnabled) {
    body.scheduleSendOnDateEnabled = true;
    body.scheduleSendOnDate = params.scheduleSendOnDate;
    body.scheduleSendOnDateHours = params.scheduleSendOnDateHours ?? 9;
    body.scheduleSendOnDateMinutes = params.scheduleSendOnDateMinutes ?? 0;
    if (params.scheduleTimeZone) body.scheduleTimeZone = params.scheduleTimeZone;
  }

  const res = await fetch(`${MANYREACH_BASE}/api/v2/campaigns`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify(body),
  });
  const data = await handleResponse<{ campaignId?: number; data?: { campaignId?: number } }>(res, 'createCampaign');
  const campaignId = data?.campaignId ?? (data as { data?: { campaignId?: number } })?.data?.campaignId;
  if (!campaignId) throw new Error('No campaignId in ManyReach createCampaign response');
  return campaignId;
}

// ── 3. Bulk add prospects to list + campaign ──────────────────────────────────

/**
 * POST /api/v2/prospects/bulk?listId=X&campaignId=Y
 * Creates prospects in ManyReach, adds them to the list, and enrolls them in
 * the campaign in one call. `screenshotUrl` on each prospect should be set to
 * the HeyGen video URL so {{screenshotUrl}} resolves in the email template.
 */
export async function bulkAddProspects(
  listId: number,
  campaignId: number,
  prospects: ManyReachProspect[],
  apiKey: string,
): Promise<BulkImportResult> {
  const url = `${MANYREACH_BASE}/api/v2/prospects/bulk?listId=${listId}&campaignId=${campaignId}&addOnlyIfNew=false`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ prospects }),
  });
  return handleResponse<BulkImportResult>(res, 'bulkAddProspects');
}

// ── 4. Start campaign ─────────────────────────────────────────────────────────

/**
 * POST /api/v2/campaigns/{id}/start
 * Starts sending immediately (or on the scheduled date if scheduleSendOnDateEnabled).
 * Returns the new campaign status string.
 */
export async function startCampaign(campaignId: number, apiKey: string): Promise<string> {
  const res = await fetch(`${MANYREACH_BASE}/api/v2/campaigns/${campaignId}/start`, {
    method: 'POST',
    headers: headers(apiKey),
  });
  const data = await handleResponse<{ status?: string; data?: { status?: string } }>(res, 'startCampaign');
  return data?.status ?? (data as { data?: { status?: string } })?.data?.status ?? 'running';
}

// ── 5. Pause campaign ─────────────────────────────────────────────────────────

export async function pauseCampaign(campaignId: number, apiKey: string): Promise<string> {
  const res = await fetch(`${MANYREACH_BASE}/api/v2/campaigns/${campaignId}/pause`, {
    method: 'POST',
    headers: headers(apiKey),
  });
  const data = await handleResponse<{ status?: string }>(res, 'pauseCampaign');
  return data?.status ?? 'paused';
}

// ── 6. Get campaign stats (for analytics sync) ────────────────────────────────

/**
 * GET /api/v2/campaigns/{id}/stats
 * Use for the 15-minute analytics sync. Do NOT call on every dashboard load.
 */
export async function getCampaignStats(
  campaignId: number,
  apiKey: string,
  dateStart?: string,
  dateEnd?: string,
): Promise<ManyReachCampaignStats> {
  const params = new URLSearchParams();
  if (dateStart) params.set('dateStart', dateStart);
  if (dateEnd) params.set('dateEnd', dateEnd);
  const qs = params.toString() ? `?${params.toString()}` : '';

  const res = await fetch(`${MANYREACH_BASE}/api/v2/campaigns/${campaignId}/stats${qs}`, {
    headers: { 'X-Api-Key': apiKey },
  });
  const raw = await handleResponse<{ campaignId?: number; sentSeries?: unknown } & Record<string, unknown>>(res, 'getCampaignStats');

  // Return a flat stats object — full series data is in raw if needed
  const campaign = await fetch(`${MANYREACH_BASE}/api/v2/campaigns/${campaignId}`, {
    headers: { 'X-Api-Key': apiKey },
  }).then(r => r.json()) as {
    campaignId?: number;
    sentCount?: number;
    openCount?: number;
    clickCount?: number;
    replyCount?: number;
    bounceCount?: number;
  };

  return {
    campaignId,
    sentCount: campaign.sentCount ?? 0,
    openCount: campaign.openCount ?? 0,
    clickCount: campaign.clickCount ?? 0,
    replyCount: campaign.replyCount ?? 0,
    bounceCount: campaign.bounceCount ?? 0,
  };
}
