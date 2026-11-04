import type { Project } from './types';
import { buildPreviewDoc } from './preview';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export const DEVICE_WIDTH = { mobile: 390, tablet: 768, desktop: 1280 } as const;
type Device = keyof typeof DEVICE_WIDTH;

/**
 * One self-contained, clickable HTML prototype that looks exactly like the studio preview.
 *
 * Each screen is rendered the same way the studio does it: the identical preview document
 * (buildPreviewDoc) inside an iframe at a fixed device width, scaled down to fit the window.
 * Rendering the screens straight into the page instead would let Tailwind's md:/lg: breakpoints
 * react to the real window width, so a narrower window reflowed the layout differently from the preview.
 *
 * data-nav links switch screens (URL hash = screen id). Works when opened from disk;
 * needs internet for Tailwind CDN + Google Fonts.
 */
export function buildPrototypeHtml(p: Project): string {
  const t = p.tokens;
  const screens = p.screens.filter((s) => s.status === 'done' && s.html);
  const title = (p.specRaw.match(/^#\s+(.+)$/m)?.[1] || p.name).trim();
  const hasDark = !!t?.color.dark;
  const device: Device = p.device ?? (p.spec?.platform === 'desktop' ? 'desktop' : 'mobile');

  const docs: Record<string, string[]> = {};
  for (const s of screens) {
    docs[s.id] = [buildPreviewDoc(s.html, t, { mode: 'prototype', lang: p.contentLang })];
    if (hasDark) docs[s.id].push(buildPreviewDoc(s.html, t, { mode: 'prototype', dark: true, lang: p.contentLang }));
  }
  // safe inside <script>: no "</script>" or "<!--" can survive
  const json = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');
  const options = screens.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');

  return `<!doctype html>
<html lang="${p.contentLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="generator" content="Specfold">
<style>
html,body{margin:0;height:100%;background:#e4e1da;overflow:hidden}
.stage{position:fixed;inset:0;display:flex;justify-content:center;align-items:flex-start}
.frame{position:relative;overflow:hidden;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.12)}
.frame iframe{display:block;border:0;transform-origin:0 0}
.ui{position:fixed;z-index:10;left:12px;top:12px;display:flex;gap:6px;font:12px/1 ui-monospace,Menlo,Consolas,monospace}
.ui select,.ui button{height:28px;padding:0 8px;border:1px solid #17171a;background:#f8f6f1;color:#17171a;border-radius:2px;cursor:pointer;font:inherit}
.ui button[aria-pressed="true"]{background:#17171a;color:#f8f6f1}
.ui .seg{display:flex}.ui .seg button+button{border-left:0}
.ui.hidden{display:none}
</style>
</head>
<body>
<div class="stage"><div class="frame" id="frame"><iframe id="screen" title="${esc(title)}" sandbox="allow-scripts"></iframe></div></div>
<div class="ui" id="ui">
  <select aria-label="Screen" id="pick">${options}</select>
  <div class="seg" role="group" aria-label="Device">
    <button type="button" data-dev="mobile" title="390px">M</button><button type="button" data-dev="tablet" title="768px">T</button><button type="button" data-dev="desktop" title="1280px">D</button>
  </div>
  ${hasDark ? '<button type="button" id="theme" title="Light / dark">◐</button>' : ''}
  <button type="button" id="hide" title="Hide (H)">×</button>
</div>
<script>
(function(){
  var DOCS = ${json(docs)};
  var IDS = ${json(screens.map((s) => s.id))};
  var WIDTH = ${json(DEVICE_WIDTH)};
  var device = ${json(device)}, dark = 0, current = null;
  var frame = document.getElementById('frame'), ifr = document.getElementById('screen'), pick = document.getElementById('pick'), ui = document.getElementById('ui');

  function layout(){
    var w = WIDTH[device];
    var pad = innerWidth > w + 32 ? 16 : 0;
    var s = Math.min(1, (innerWidth - pad * 2) / w);
    var h = (innerHeight - pad * 2) / s;
    frame.style.width = (w * s) + 'px'; frame.style.height = (h * s) + 'px'; frame.style.marginTop = pad + 'px';
    ifr.style.width = w + 'px'; ifr.style.height = h + 'px'; ifr.style.transform = 'scale(' + s + ')';
    document.querySelectorAll('[data-dev]').forEach(function(b){ b.setAttribute('aria-pressed', String(b.getAttribute('data-dev') === device)); });
  }
  function show(id, force){
    if (IDS.indexOf(id) < 0) id = IDS[0];
    if (id === current && !force) return;
    current = id; restores = 0;
    ifr.srcdoc = DOCS[id][dark] || DOCS[id][0];
    pick.value = id;
    if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
  }
  // the screen's bridge script reports data-nav clicks and stray links
  addEventListener('message', function(e){
    if (e.source !== ifr.contentWindow) return;
    var d = e.data || {};
    if (!d.__dw) return;
    if ((d.type === 'nav' || d.type === 'nav-attempt') && IDS.indexOf(d.to) >= 0) show(d.to);
  });
  // a second load of the same document means the screen navigated away: restore it
  var loads = 0, lastDoc = null, restores = 0;
  ifr.addEventListener('load', function(){
    if (ifr.srcdoc !== lastDoc) { lastDoc = ifr.srcdoc; loads = 1; return; }
    if (++loads > 1 && restores < 3) { restores++; ifr.srcdoc = lastDoc + ' '; }
  });
  pick.addEventListener('change', function(){ show(pick.value); });
  document.querySelectorAll('[data-dev]').forEach(function(b){ b.addEventListener('click', function(){ device = b.getAttribute('data-dev'); layout(); }); });
  var th = document.getElementById('theme');
  if (th) th.addEventListener('click', function(){ dark = dark ? 0 : 1; th.setAttribute('aria-pressed', String(!!dark)); show(current, true); });
  document.getElementById('hide').addEventListener('click', function(){ ui.classList.add('hidden'); });
  addEventListener('keydown', function(e){ if (e.key === 'h' || e.key === 'H') ui.classList.toggle('hidden'); });
  addEventListener('resize', layout);
  addEventListener('hashchange', function(){ show(location.hash.slice(1)); });
  layout();
  show(location.hash.slice(1));
})();
</script>
</body>
</html>
`;
}
