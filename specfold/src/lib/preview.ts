import type { DesignTokens } from './types';
import { googleFontsUrl, tokensToCss } from './tokens';

// Only these external origins may load inside the sandboxed preview (기획서 §12).
const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' https://cdn.tailwindcss.com",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  'font-src https://fonts.gstatic.com',
  'img-src data: blob: https://picsum.photos https://fastly.picsum.photos',
  "connect-src 'none'",
  "form-action 'none'",
].join('; ');

// Injected into every preview iframe. Talks to the parent only via postMessage.
const BRIDGE = `
(function(){
  var mode = '__MODE__';
  var hoverEl = null, selEl = null;
  var style = document.createElement('style');
  style.textContent = '.__dw-hover{outline:2px dashed #2340D6!important;outline-offset:2px!important;cursor:crosshair!important}.__dw-sel{outline:2px solid #2340D6!important;outline-offset:2px!important}';
  document.head.appendChild(style);
  function target(e){ var t = e.target; return t && t.closest ? t.closest('[data-dw-id]') : null; }
  function describe(el){
    var cs = getComputedStyle(el);
    return { id: el.getAttribute('data-dw-id'), tag: el.tagName.toLowerCase(), text: (el.innerText||'').trim().slice(0,80),
      outer: el.outerHTML.slice(0, 4000),
      styles: { fontSize: cs.fontSize, fontWeight: cs.fontWeight, padding: cs.padding, margin: cs.margin, color: cs.color, background: cs.backgroundColor } };
  }
  document.addEventListener('mouseover', function(e){
    if (mode !== 'select') return;
    var el = target(e); if (hoverEl && hoverEl !== el) hoverEl.classList.remove('__dw-hover');
    hoverEl = el; if (el) el.classList.add('__dw-hover');
  }, true);
  document.addEventListener('click', function(e){
    if (mode === 'select') {
      e.preventDefault(); e.stopPropagation();
      var el = target(e); if (!el) return;
      if (selEl) selEl.classList.remove('__dw-sel');
      selEl = el; el.classList.add('__dw-sel');
      parent.postMessage({ __dw: true, type: 'select', el: describe(el) }, '*');
      return;
    }
    var nav = e.target.closest && e.target.closest('[data-nav]');
    if (nav) { e.preventDefault(); parent.postMessage({ __dw: true, type: 'nav', to: nav.getAttribute('data-nav') }, '*'); return; }
    var a = e.target.closest && e.target.closest('a[href]');
    if (a) e.preventDefault();
  }, true);
  document.addEventListener('submit', function(e){ e.preventDefault(); }, true);
  window.addEventListener('message', function(e){
    var d = e.data || {};
    if (!d.__dw) return;
    if (d.type === 'mode') { mode = d.mode; if (hoverEl) hoverEl.classList.remove('__dw-hover'); if (mode !== 'select' && selEl) selEl.classList.remove('__dw-sel'); }
    if (d.type === 'tokens') { var s = document.getElementById('dw-tokens'); if (s) s.textContent = d.css; }
    if (d.type === 'clear') { if (selEl) selEl.classList.remove('__dw-sel'); selEl = null; }
  });
})();`;

export function buildPreviewDoc(
  html: string,
  tokens: DesignTokens | null,
  opts: { mode?: 'prototype' | 'select' | 'static'; dark?: boolean; lang?: string } = {},
) {
  const css = tokens ? tokensToCss(tokens, { dark: opts.dark }) : '';
  const fonts = tokens ? `<link rel="stylesheet" href="${googleFontsUrl(tokens)}">` : '';
  const bridge = opts.mode === 'static' ? '' : `<script>${BRIDGE.replace('__MODE__', opts.mode ?? 'prototype')}</script>`;
  return `<!doctype html><html lang="${opts.lang ?? 'ko'}"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://cdn.tailwindcss.com"></script>
${fonts}
<style id="dw-tokens">${css}</style>
</head><body>${html}${bridge}</body></html>`;
}

/** A compact text summary of a screen for prompts (P4 consistency, P7 export). */
export function summarizeScreen(html: string, max = 1400) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const lines: string[] = [];
  doc.querySelectorAll('[data-dw-id]').forEach((el) => {
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent?.trim())
      .filter(Boolean)
      .join(' ')
      .slice(0, 60);
    const nav = el.getAttribute('data-nav');
    const cls = (el.getAttribute('class') || '').split(/\s+/).slice(0, 6).join(' ');
    lines.push(`${el.tagName.toLowerCase()}#${el.getAttribute('data-dw-id')}${nav ? ` →${nav}` : ''}${own ? ` "${own}"` : ''}${cls ? ` [${cls}]` : ''}`);
  });
  const out = lines.join('\n');
  return out.length > max ? out.slice(0, max) + '\n…' : out;
}

export function navLinks(html: string): string[] {
  const set = new Set<string>();
  html.replace(/data-nav=["']([^"']+)["']/g, (_, id) => {
    set.add(id);
    return '';
  });
  return [...set];
}
