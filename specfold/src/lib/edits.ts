// Find-and-replace by data-dw-id (기획서 §9 "수정 반영 방식")
function parse(html: string) {
  return new DOMParser().parseFromString(`<!doctype html><html><body>${html}</body></html>`, 'text/html');
}
const esc = (id: string) => id.replace(/["\\]/g, '\\$&');

export function applyEdit(html: string, targetId: string, replaceWith: string): string | null {
  const doc = parse(html);
  const el = doc.querySelector(`[data-dw-id="${esc(targetId)}"]`);
  if (!el) return null;
  const tpl = doc.createElement('template');
  tpl.innerHTML = replaceWith.trim();
  el.replaceWith(tpl.content);
  return doc.body.innerHTML;
}

export function getOuter(html: string, id: string): string {
  const el = parse(html).querySelector(`[data-dw-id="${esc(id)}"]`);
  return el ? el.outerHTML : '';
}

export interface ElementPatch {
  text?: string;
  padding?: string;
  margin?: string;
  fontSize?: string;
  fontWeight?: string;
  color?: string; // css var name e.g. var(--color-accent)
  background?: string;
}

/** Direct (non-AI) edits from the adjust panel. */
export function patchElement(html: string, id: string, p: ElementPatch): string | null {
  const doc = parse(html);
  const el = doc.querySelector(`[data-dw-id="${esc(id)}"]`) as HTMLElement | null;
  if (!el) return null;
  if (p.text !== undefined) {
    // replace only direct text nodes so nested icons survive
    const texts = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && n.textContent?.trim());
    if (texts.length) {
      texts[0].textContent = p.text;
      texts.slice(1).forEach((n) => n.remove());
    } else if (!el.children.length) el.textContent = p.text;
    else el.appendChild(doc.createTextNode(p.text));
  }
  const s = el.style;
  if (p.padding !== undefined) s.padding = p.padding;
  if (p.margin !== undefined) s.margin = p.margin;
  if (p.fontSize !== undefined) s.fontSize = p.fontSize;
  if (p.fontWeight !== undefined) s.fontWeight = p.fontWeight;
  if (p.color !== undefined) s.color = p.color;
  if (p.background !== undefined) s.background = p.background;
  return doc.body.innerHTML;
}

export function directText(html: string, id: string): string {
  const el = parse(html).querySelector(`[data-dw-id="${esc(id)}"]`);
  if (!el) return '';
  return Array.from(el.childNodes)
    .filter((n) => n.nodeType === 3)
    .map((n) => n.textContent?.trim())
    .filter(Boolean)
    .join(' ');
}
