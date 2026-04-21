import { Lead } from '@/types/data';

const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are a world-class B2B sales copywriter.
Write a SHORT, punchy video script (max 60 seconds when spoken, ~130 words).
The script is spoken by a human to camera.
Tone: warm, direct, not salesy. No buzzwords.
Output ONLY the script text. No stage directions. No labels. No formatting.`;

export async function generateScriptForLead(
  lead: Lead,
  campaignDescription: string,
  apiKey: string,
): Promise<string> {
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{
        role: 'user',
        parts: [{
          text: `Prospect: ${lead.firstName} ${lead.lastName} at ${lead.company}
Their website: ${lead.website}
What they do: ${lead.companyDescription}

What we offer: ${campaignDescription}

Write a personalized video script that:
1. Opens with something specific about their company (from the description above)
2. Bridges naturally to what we offer
3. Ends with a soft CTA`,
        }],
      }],
      generationConfig: { temperature: 0.7 },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini API ${response.status}`);
  }

  const data = await response.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from Gemini');
  return text.trim();
}
