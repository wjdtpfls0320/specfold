import type { Project } from './types';
import { googleFontsUrl, tokensToCss } from './tokens';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * One self-contained, clickable HTML prototype with every finished screen.
 * data-nav links switch screens (URL hash = screen id), so it works when opened
 * straight from disk. Needs internet for Tailwind CDN + Google Fonts.
 */
export function buildPrototypeHtml(p: Project): string {
  const t = p.tokens;
  const screens = p.screens.filter((s) => s.status === 'done' && s.html);
  const title = (p.specRaw.match(/^#\s+(.+)$/m)?.[1] || p.name).trim();
  const mobile = p.spec?.platform === 'mobile';
  const hasDark = !!t?.color.dark;
  const darkCss = t && hasDark ? tokensToCss(t, { dark: true }).replace(/^:root\{/, ':root[data-theme="dark"]{').replace(/\nbody\{[\s\S]*$/, '') : '';

  const sections = screens
    .map((s) => `<section class="dw-screen" id="screen-${esc(s.id)}" data-screen="${esc(s.id)}" aria-label="${esc(s.name)}">\n${s.html}\n</section>`)
    .join('\n');
  const options = screens.map((s) => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');

  return `<!doctype html>
<html lang="${p.contentLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="generator" content="Specfold">
<script src="https://cdn.tailwindcss.com"></script>
${t ? `<link rel="stylesheet" href="${googleFontsUrl(t)}">` : ''}
<style>
/* design tokens */
${t ? tokensToCss(t) : ''}
${darkCss}
/* prototype shell */
.dw-screen{display:none}
.dw-screen.on{display:block}
${mobile ? `html,body{background:#d9d6cf}
/* phone frame: transform makes position:fixed children (tab bars, bottom CTAs) pin to the frame,
   and the inner scroller keeps them pinned while the screen scrolls */
.dw-frame{max-width:390px;margin:0 auto;height:100vh;height:100dvh;position:relative;overflow:hidden;transform:translateZ(0);background:var(--color-bg);box-shadow:0 0 0 1px rgba(0,0,0,.08)}
.dw-scroll{height:100%;overflow-y:auto;overscroll-behavior:contain}` : '.dw-frame{min-height:100vh}'}
.dw-ui{position:fixed;z-index:2147483647;left:12px;top:12px;display:flex;gap:6px;font:12px/1 ui-monospace,Menlo,Consolas,monospace}
.dw-ui select,.dw-ui button{height:28px;padding:0 8px;border:1px solid #17171a;background:#f8f6f1;color:#17171a;border-radius:2px;cursor:pointer;font:inherit}
.dw-ui.hidden{display:none}
@media print{.dw-ui{display:none}.dw-screen{display:block!important;break-after:page}}
</style>
</head>
<body>
<div class="dw-frame">${mobile ? '<div class="dw-scroll">' : ''}
${sections}
${mobile ? '</div>' : ''}</div>
<div class="dw-ui" data-dw-ui>
  <select aria-label="Screen" id="dw-pick">${options}</select>
  ${hasDark ? '<button type="button" id="dw-theme">◐</button>' : ''}
  <button type="button" id="dw-hide" title="H">×</button>
</div>
<script>
(function(){
  var ids = ${JSON.stringify(screens.map((s) => s.id))};
  var pick = document.getElementById('dw-pick');
  function show(id){
    if (ids.indexOf(id) < 0) id = ids[0];
    document.querySelectorAll('.dw-screen').forEach(function(s){ s.classList.toggle('on', s.getAttribute('data-screen') === id); });
    if (pick) pick.value = id;
    if (location.hash.slice(1) !== id) history.replaceState(null, '', '#' + id);
    var sc = document.querySelector('.dw-scroll'); if (sc) sc.scrollTop = 0; else window.scrollTo(0, 0);
  }
  document.addEventListener('click', function(e){
    var nav = e.target.closest && e.target.closest('[data-nav]');
    if (nav) { e.preventDefault(); var to = nav.getAttribute('data-nav'); if (ids.indexOf(to) >= 0) show(to); return; }
    var a = e.target.closest && e.target.closest('a[href]');
    if (a && !a.closest('[data-dw-ui]')) e.preventDefault();
  });
  document.addEventListener('submit', function(e){ e.preventDefault(); });
  if (pick) pick.addEventListener('change', function(){ show(pick.value); });
  var ui = document.querySelector('[data-dw-ui]');
  document.getElementById('dw-hide').addEventListener('click', function(){ ui.classList.add('hidden'); });
  document.addEventListener('keydown', function(e){ if ((e.key === 'h' || e.key === 'H') && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) ui.classList.toggle('hidden'); });
  var th = document.getElementById('dw-theme');
  if (th) th.addEventListener('click', function(){ var r = document.documentElement; r.dataset.theme = r.dataset.theme === 'dark' ? '' : 'dark'; });
  window.addEventListener('hashchange', function(){ show(location.hash.slice(1)); });
  show(location.hash.slice(1));
})();
</script>
</body>
</html>
`;
}
