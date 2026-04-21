interface MailTesterResponse {
  email: string;
  user: string;
  domain: string;
  mx: string;
  code: 'ok' | 'ko' | 'mb';
  message: string;
  connections: number;
}

export interface VerificationResult {
  code: 'ok' | 'ko' | 'mb';
  message: string;
  mx: string;
  isValid: boolean;
}

// Only code=ok + message=Accepted is truly valid.
// Catch-All (mb), Rejected/Timeout/No Mx/SPAM Block (ko) are all invalid.
export async function verifyEmail(email: string, apiKey: string): Promise<VerificationResult> {
  const url = `https://happy.mailtester.ninja/ninja?email=${encodeURIComponent(email)}&key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data: MailTesterResponse = await response.json();
  return {
    code: data.code,
    message: data.message,
    mx: data.mx || '',
    isValid: data.code === 'ok' && data.message === 'Accepted',
  };
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Process emails in chunks, respecting the 11/10s rate limit.
// 5 concurrent per 600ms = ~8/s, safely under the limit.
export async function verifyEmailsInBatches(
  emails: string[],
  apiKey: string,
  onResult: (email: string, result: VerificationResult | null, error?: string) => void,
): Promise<void> {
  const CHUNK_SIZE = 5;
  const CHUNK_DELAY_MS = 600;

  for (let i = 0; i < emails.length; i += CHUNK_SIZE) {
    const chunk = emails.slice(i, i + CHUNK_SIZE);

    await Promise.all(
      chunk.map(async (email) => {
        try {
          const result = await verifyEmail(email, apiKey);
          onResult(email, result);
        } catch (err) {
          onResult(email, null, err instanceof Error ? err.message : 'Unknown error');
        }
      }),
    );

    if (i + CHUNK_SIZE < emails.length) {
      await delay(CHUNK_DELAY_MS);
    }
  }
}
