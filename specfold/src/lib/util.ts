export const uid = (p = '') => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

/** Pull the first JSON object/array out of an LLM response (handles code fences and chatter). */
export function extractJson<T = any>(text: string): T {
  let s = text.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const start = s.search(/[{[]/);
  if (start < 0) throw new Error('JSON not found');
  const open = s[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close && --depth === 0) return JSON.parse(s.slice(start, i + 1));
  }
  return JSON.parse(s.slice(start));
}

export function extractTag(text: string, tag: string): string | null {
  const m = text.match(new RegExp(`<${tag}>([\\s\\S]*?)(?:</${tag}>|$)`));
  return m ? m[1].trim() : null;
}

/** Strip a <body> wrapper / code fences if a model returned a full document. */
export function cleanScreenHtml(html: string) {
  let s = html.trim().replace(/^```(?:html)?\s*/i, '').replace(/```\s*$/, '');
  const body = s.match(/<body[^>]*>([\s\S]*?)(<\/body>|$)/i);
  if (body) s = body[1];
  return repairHtml(s.replace(/<script[^>]+src=[^>]*><\/script>/gi, '').trim());
}

/**
 * Let the browser's HTML parser close whatever a cut-off reply left open (an unclosed tag,
 * attribute quote or comment). Otherwise the preview's own script after the screen gets
 * swallowed into that open attribute/element and shows up on screen as raw code.
 */
export function repairHtml(html: string) {
  if (typeof document === 'undefined' || !html) return html;
  const t = document.createElement('template');
  t.innerHTML = html;
  return t.innerHTML;
}

export function detectLang(text: string): 'ko' | 'en' {
  const ko = (text.match(/[가-힣]/g) || []).length;
  const en = (text.match(/[a-zA-Z]/g) || []).length;
  return ko * 2 >= en * 0.5 && ko > 5 ? 'ko' : 'en';
}

export function download(name: string, content: string, type = 'text/markdown') {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '') || 'project';
}

export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...a: A) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
