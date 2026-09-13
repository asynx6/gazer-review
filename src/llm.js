const base = process.env.LLM_BASE_URL || 'https://api.b.ai/v1';
const TIMEOUT = Number(process.env.LLM_TIMEOUT_MS || 90000);

async function attempt(messages, opts) {
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT),
    headers: {
      'Authorization': `Bearer ${process.env.LLM_API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || 'qwen3.8-flash',
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 2000,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const e = new Error(`LLM HTTP ${res.status}: ${body.slice(0, 300)}`);
    e.retryable = res.status === 429 || res.status >= 500;
    throw e;
  }
  const data = await res.json().catch(() => {
    throw new Error('LLM balikin non-JSON (check Accept header / provider)');
  });
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM balikin content kosong');
  return content;
}

export async function chat(messages, opts = {}) {
  try {
    return await attempt(messages, opts);
  } catch (e) {
    const netFail = /timeout|aborted|fetch failed|ECONN|non-JSON/i.test(e.message) || e.retryable;
    if (!netFail) throw e;
    await new Promise((r) => setTimeout(r, 2000)); // satu retry, jeda 2s
    return attempt(messages, opts);
  }
}
