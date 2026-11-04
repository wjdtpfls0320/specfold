import type { ProviderId, ProviderSettings } from '../types';

export interface LLMPart {
  type: 'text' | 'image';
  text?: string;
  dataUrl?: string;
}
export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string | LLMPart[];
}
export interface StreamOpts {
  system: string;
  model: string;
  maxTokens?: number;
  json?: boolean;
  signal?: AbortSignal;
  onToken?: (chunk: string, full: string) => void;
}

export interface ProviderInfo {
  id: ProviderId;
  label: string;
  defaultBase: string;
  fastModel: string;
  strongModel: string;
  needsKey: boolean;
}

export const PROVIDERS: ProviderInfo[] = [
  { id: 'claude', label: 'Claude', defaultBase: 'https://api.anthropic.com', fastModel: 'claude-haiku-5-5', strongModel: 'claude-sonnet-5-5', needsKey: true },
  { id: 'openai', label: 'OpenAI', defaultBase: 'https://api.openai.com/v1', fastModel: 'gpt-5-mini', strongModel: 'gpt-5', needsKey: true },
  { id: 'gemini', label: 'Gemini', defaultBase: 'https://generativelanguage.googleapis.com/v1beta', fastModel: 'gemini-2.5-flash', strongModel: 'gemini-2.5-pro', needsKey: true },
  { id: 'openrouter', label: 'OpenRouter', defaultBase: 'https://openrouter.ai/api/v1', fastModel: 'anthropic/claude-haiku-5.5', strongModel: 'anthropic/claude-sonnet-5.5', needsKey: true },
  { id: 'local', label: 'Local (Ollama · LM Studio)', defaultBase: 'http://localhost:11434/v1', fastModel: 'qwen2.5:14b', strongModel: 'qwen2.5:32b', needsKey: false },
];

export function providerInfo(id: ProviderId) {
  return PROVIDERS.find((p) => p.id === id)!;
}

/** "디자인 생성 권장 / 가능 / 비권장" */
export function modelGrade(provider: ProviderId, model: string): 'recommended' | 'ok' | 'weak' {
  const m = model.toLowerCase();
  const size = m.match(/(\d+(?:\.\d+)?)b\b/);
  if (provider === 'local') {
    if (size && parseFloat(size[1]) >= 30) return 'ok';
    return 'weak';
  }
  if (size && parseFloat(size[1]) < 30) return 'weak';
  if (/(mini|nano|flash-lite|haiku|lite|small|tiny)/.test(m)) return 'ok';
  return 'recommended';
}

function splitDataUrl(dataUrl: string) {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  return m ? { mime: m[1], data: m[2] } : { mime: 'image/png', data: '' };
}

async function readSSE(res: Response, onData: (data: string) => void) {
  if (!res.body) throw new Error('No response body');
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (line.startsWith('data:')) onData(line.slice(5).trim());
    }
  }
  if (buf.trim().startsWith('data:')) onData(buf.trim().slice(5).trim());
}

async function ensureOk(res: Response) {
  if (res.ok) return;
  let msg = `${res.status} ${res.statusText}`;
  try {
    const body = await res.text();
    const j = JSON.parse(body);
    msg += ' — ' + (j.error?.message || j.message || body.slice(0, 300));
  } catch {
    /* ignore */
  }
  throw new Error(msg);
}

function toOpenAIContent(c: LLMMessage['content']) {
  if (typeof c === 'string') return c;
  return c.map((p) =>
    p.type === 'image' ? { type: 'image_url', image_url: { url: p.dataUrl } } : { type: 'text', text: p.text ?? '' },
  );
}

export async function streamChat(s: ProviderSettings, messages: LLMMessage[], opts: StreamOpts): Promise<string> {
  const base = (s.baseUrl || providerInfo(s.provider).defaultBase).replace(/\/$/, '');
  let full = '';
  const push = (t: string) => {
    if (!t) return;
    full += t;
    opts.onToken?.(t, full);
  };

  if (s.provider === 'claude') {
    const res = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      signal: opts.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': s.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: opts.model,
        max_tokens: opts.maxTokens ?? 8000,
        system: opts.system,
        stream: true,
        messages: messages.map((m) => ({
          role: m.role,
          content:
            typeof m.content === 'string'
              ? m.content
              : m.content.map((p) =>
                  p.type === 'image'
                    ? { type: 'image', source: { type: 'base64', media_type: splitDataUrl(p.dataUrl!).mime, data: splitDataUrl(p.dataUrl!).data } }
                    : { type: 'text', text: p.text ?? '' },
                ),
        })),
      }),
    });
    await ensureOk(res);
    await readSSE(res, (d) => {
      try {
        const j = JSON.parse(d);
        if (j.type === 'content_block_delta' && j.delta?.type === 'text_delta') push(j.delta.text);
        if (j.type === 'error') throw new Error(j.error?.message);
      } catch (e) {
        if (e instanceof Error && !(e instanceof SyntaxError)) throw e;
      }
    });
    return full;
  }

  if (s.provider === 'gemini') {
    const res = await fetch(`${base}/models/${encodeURIComponent(opts.model)}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      signal: opts.signal,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': s.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts:
            typeof m.content === 'string'
              ? [{ text: m.content }]
              : m.content.map((p) =>
                  p.type === 'image'
                    ? { inline_data: { mime_type: splitDataUrl(p.dataUrl!).mime, data: splitDataUrl(p.dataUrl!).data } }
                    : { text: p.text ?? '' },
                ),
        })),
        generationConfig: {
          maxOutputTokens: opts.maxTokens ?? 8000,
          ...(opts.json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    });
    await ensureOk(res);
    await readSSE(res, (d) => {
      try {
        const j = JSON.parse(d);
        const parts = j.candidates?.[0]?.content?.parts ?? [];
        for (const p of parts) if (p.text) push(p.text);
      } catch {
        /* partial */
      }
    });
    return full;
  }

  // OpenAI-compatible: openai, openrouter, local
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (s.apiKey) headers.authorization = `Bearer ${s.apiKey}`;
  if (s.provider === 'openrouter') headers['X-Title'] = 'Specfold';
  const body: Record<string, unknown> = {
    model: opts.model,
    stream: true,
    messages: [{ role: 'system', content: opts.system }, ...messages.map((m) => ({ role: m.role, content: toOpenAIContent(m.content) }))],
  };
  if (s.provider === 'openai') body.max_completion_tokens = opts.maxTokens ?? 8000;
  else body.max_tokens = opts.maxTokens ?? 8000;
  if (opts.json && s.provider === 'openai') body.response_format = { type: 'json_object' };
  const res = await fetch(`${base}/chat/completions`, { method: 'POST', signal: opts.signal, headers, body: JSON.stringify(body) });
  await ensureOk(res);
  await readSSE(res, (d) => {
    if (d === '[DONE]') return;
    try {
      const j = JSON.parse(d);
      push(j.choices?.[0]?.delta?.content ?? '');
    } catch {
      /* partial */
    }
  });
  return full;
}

export async function testConnection(s: ProviderSettings): Promise<string> {
  const out = await streamChat(s, [{ role: 'user', content: 'Reply with the single word: ok' }], {
    system: 'You are a connection test. Reply with one word.',
    model: s.fastModel,
    maxTokens: 256,
  });
  return out.trim() || 'ok';
}
