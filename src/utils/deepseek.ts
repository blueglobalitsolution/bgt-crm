const DEEPSEEK_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com';
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

/**
 * Calls the DeepSeek API (OpenAI-compatible chat completions) and returns the
 * parsed JSON object, or null on any failure. Used for business-data extraction
 * from a Google Maps / My Business page.
 */
export async function callDeepSeekJSON(
  systemPrompt: string,
  userContent: string
): Promise<Record<string, any> | null> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.warn('DEEPSEEK_API_KEY is not set — skipping DeepSeek.');
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    const res = await fetch(`${DEEPSEEK_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent },
        ],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      console.error(`DeepSeek responded with status ${res.status}`);
      return null;
    }
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) {
      try {
        return JSON.parse(content.trim());
      } catch {
        return null;
      }
    }
    return null;
  } catch (err) {
    console.error('DeepSeek call failed:', err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
