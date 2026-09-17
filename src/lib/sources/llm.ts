const KEY_STORAGE = 'bhulandar.llm_key'

export function getLlmKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? ''
  } catch {
    return ''
  }
}

export function setLlmKey(value: string) {
  try {
    if (value.trim()) localStorage.setItem(KEY_STORAGE, value.trim())
    else localStorage.removeItem(KEY_STORAGE)
  } catch {
    /* private mode, nothing to do */
  }
}

export function llmIsConfigured(): boolean {
  return getLlmKey().length > 8
}

function extractJson(text: string): { title: string; body: string } | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = (fenced ? fenced[1] : text).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1))
    if (typeof parsed.title === 'string' && typeof parsed.body === 'string') {
      return { title: parsed.title, body: parsed.body }
    }
  } catch {
    return null
  }
  return null
}

async function callGemini(apiKey: string, prompt: string): Promise<string | null> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  )
  if (!res.ok) return null
  const json = await res.json()
  return json?.candidates?.[0]?.content?.parts?.[0]?.text ?? null
}

async function callAnthropic(apiKey: string, prompt: string): Promise<string | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) return null
  const json = await res.json()
  return json?.content?.[0]?.text ?? null
}

export async function llmConcept(
  labels: string[],
  crossings: string[],
  brief: string,
): Promise<{ title: string; body: string } | null> {
  const apiKey = getLlmKey()
  if (!apiKey) return null

  const prompt = `You are helping an industrial designer break out of a narrow idea.

Brief: ${brief}
They have combined these concepts: ${labels.join(', ')}
Words that sit at the semantic crossing of those concepts: ${crossings.join(', ') || 'none found'}

Invent ONE specific, physical, buildable design move that genuinely fuses all of those concepts. Be concrete about form, material and gesture. It should be surprising but sketchable, not a slogan. Two or three sentences. Never use an em dash.

Reply with only JSON: {"title": "3 to 5 word name", "body": "the description"}`

  try {
    const text = apiKey.startsWith('sk-ant-')
      ? await callAnthropic(apiKey, prompt)
      : await callGemini(apiKey, prompt)
    return text ? extractJson(text) : null
  } catch {
    return null
  }
}
