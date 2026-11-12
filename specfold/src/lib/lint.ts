import type { DesignTokens, LintViolation, Screen } from './types';
import { contrast, hexToRgb, hue, isKoFont, luminance, saturation, typeCap } from './tokens';

type Platform = 'mobile' | 'desktop' | 'both';

const BANNED_FONTS = /(?:^|[\s'",:(])(Inter|Roboto|Arial|Helvetica|Open Sans|Lato|Montserrat|Poppins|system-ui|-apple-system|Segoe UI)(?=[\s'",;)]|$)/i;
const TW_PALETTE = /\b(?:bg|text|border|from|via|to|ring|fill|stroke|decoration|outline|divide|shadow)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;
const PURPLE_TW = /\b(?:from|via|to)-(?:indigo|violet|purple|fuchsia)-\d{2,3}\b/;
const FAKE = /lorem ipsum|dolor sit amet|\bfeature [123]\b|\bjohn doe\b|\bjane doe\b|\bacme\b|홍길동|기능 [123]\b/i;
const EMOJI = /\p{Extended_Pictographic}/u;

function rgbStrToHex(s: string) {
  const m = s.match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (!m) return null;
  return '#' + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, '0')).join('');
}
const norm = (h: string) => {
  const rgb = hexToRgb(h);
  return rgb ? '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('') : h.toLowerCase();
};

export function tokenColors(t: DesignTokens) {
  const set = new Set<string>();
  const add = (c: Record<string, string> | undefined) => c && Object.values(c).forEach((v) => typeof v === 'string' && set.add(norm(v)));
  add(t.color as any);
  add(t.color.dark as any);
  ['#ffffff', '#000000'].forEach((c) => set.add(c)); // pure white/black overlays tolerated
  return set;
}

export function lintTokens(t: DesignTokens, contentLang: 'ko' | 'en'): LintViolation[] {
  const v: LintViolation[] = [];
  const fams = [t.font.display.family, t.font.body.family];
  for (const f of fams) if (BANNED_FONTS.test(` ${f} `)) v.push({ rule: 'banned-font', severity: 'fix', detail: `token font: ${f}` });
  if (contentLang === 'ko' && !fams.some(isKoFont)) v.push({ rule: 'missing-ko-font', severity: 'fix', detail: `${fams.join(' / ')} — no Hangul support` });
  const sets = [t.color, ...(t.color.dark ? [t.color.dark] : [])];
  for (const c of sets) {
    const pairs: [string, string, string, number][] = [
      ['ink', c.ink, c.bg, 4.5],
      ['ink/surface', c.ink, c.surface, 4.5],
      ['inkMuted', c.inkMuted, c.bg, 4.5],
    ];
    for (const [name, a, b, min] of pairs) {
      const r = contrast(a, b);
      if (r < min) v.push({ rule: 'contrast', severity: 'fix', detail: `${name} ${a} on ${b} = ${r.toFixed(2)}:1 (< ${min})` });
    }
  }
  return v;
}

// ---- oversized type ----
const TW_TEXT_PX: Record<string, number> = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36, '5xl': 48, '6xl': 60, '7xl': 72, '8xl': 96, '9xl': 128 };
const TW_TEXT = /^((?:[\w-]+:)*)text-(?:\[(?:length:)?([^\]]+)\]|(xs|sm|base|lg|[2-9]?xl))(?:\/\S+)?$/;
const BREAKPOINT = /(?:^|:)(?:sm|md|lg|xl|2xl):/;
const INLINE_TAG = /^(span|small|sub|sup|b|strong|em|i|abbr|u)$/i;

/** Largest px a CSS font-size value can resolve to (clamp → its real result, vw against the design width). */
function cssSizePx(val: string, vw: number, parent: number, scale: number[]): number | null {
  const s = val.trim().toLowerCase().replace(/\s*!important$/, '').replace(/_/g, ' ');
  const tok = s.match(/^var\(\s*--text-(\d+)\s*(?:,[^)]*)?\)$/);
  if (tok) return scale[Number(tok[1])] ?? null;
  const fn = s.match(/^(clamp|min|max)\((.+)\)$/);
  if (fn) {
    const args = fn[2].split(',').map((x) => cssSizePx(x, vw, parent, scale));
    const known = args.filter((x): x is number => x !== null);
    if (!known.length) return null;
    if (known.length < args.length) return Math.max(...known); // e.g. calc() inside: assume the worst case
    if (fn[1] === 'clamp' && known.length === 3) return Math.max(known[0], Math.min(known[1], known[2]));
    return fn[1] === 'min' ? Math.min(...known) : Math.max(...known);
  }
  const m = s.match(/^(\d*\.?\d+)(px|rem|em|vw|%)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return m[2] === 'px' ? n : m[2] === 'rem' ? n * 16 : m[2] === 'em' ? n * parent : m[2] === 'vw' ? (n * vw) / 100 : (n * parent) / 100;
}

/** Short text that is mostly digits: "2", "23,600", "09:00", "38%", "2건". */
function isNumeral(text: string) {
  const s = text.replace(/\s/g, '');
  const digits = (s.match(/\d/g) || []).length;
  return s.length > 0 && s.length <= 12 && digits > 0 && digits * 2 >= s.length;
}

/**
 * Finds type that is blown up past the scale: any text above the cap, a number more than twice the
 * size of its unit ("2" next to "건"), or several display-size numbers on one screen.
 */
function oversizedType(doc: Document, t: DesignTokens, platform: Platform): string[] {
  const vw = platform === 'mobile' ? 390 : 1280;
  const scale = t.scale ?? [];
  const cap = typeCap(t);
  const steps = [...new Set(scale.filter((n) => n > 0 && n <= cap))].sort((a, b) => a - b);
  const displayFrom = steps.length > 1 ? steps[steps.length - 2] : 40; // numbers above this count as "display size"

  const rules: { sel: string; val: string }[] = [];
  doc.querySelectorAll('style').forEach((st) => {
    const css = (st.textContent || '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const fs = m[2].match(/(?:^|;)\s*font-size\s*:\s*([^;]+)/i);
      if (fs) rules.push({ sel: m[1].trim(), val: fs[1] });
    }
  });

  const ownSize = (el: Element, parent: number): number | null => {
    const inline = (el.getAttribute('style') || '').match(/(?:^|;)\s*font-size\s*:\s*([^;]+)/i);
    if (inline) return cssSizePx(inline[1], vw, parent, scale);
    let best = null as number | null;
    const take = (n: number | null) => { if (n !== null && (best === null || n > best)) best = n; };
    for (const c of (el.getAttribute('class') || '').split(/\s+/)) {
      const m = c.match(TW_TEXT);
      if (!m || (platform === 'mobile' && BREAKPOINT.test(m[1]))) continue;
      take(m[3] ? TW_TEXT_PX[m[3]] : cssSizePx(m[2], vw, parent, scale));
    }
    if (best !== null) return best;
    for (const r of rules) {
      try { if (el.matches(r.sel)) take(cssSizePx(r.val, vw, parent, scale)); } catch { /* @keyframes steps etc. */ }
    }
    return best;
  };

  const px = new Map<Element, number>();
  const runs: { el: Element; text: string; px: number }[] = [];
  const walk = (el: Element, inherited: number) => {
    if (/^(style|script|svg|template)$/i.test(el.tagName)) return;
    const size = ownSize(el, inherited) ?? inherited;
    px.set(el, size);
    const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
    if (own) runs.push({ el, text: own, px: size });
    Array.from(el.children).forEach((c) => walk(c, size));
  };
  Array.from(doc.body.children).forEach((c) => walk(c, 16));

  const out: string[] = [];
  const label = (r: { text: string; px: number }) => `"${r.text.slice(0, 16)}" ${Math.round(r.px)}px`;

  const over = runs.filter((r) => r.px > cap + 0.5);
  if (over.length) out.push(`${[...new Set(over.map(label))].slice(0, 3).join(', ')} > max ${cap}px`);

  const numerals = runs.filter((r) => isNumeral(r.text));
  for (const r of numerals) {
    if (r.px < 28) continue;
    const near = [...Array.from(r.el.children), r.el.previousElementSibling, r.el.nextElementSibling];
    const unit = near.find((u): u is Element => {
      if (!u || !INLINE_TAG.test(u.tagName)) return false;
      const txt = (u.textContent || '').trim();
      return txt.length > 0 && txt.length <= 4 && !/\d/.test(txt) && r.px > (px.get(u) ?? r.px) * 2 + 0.5;
    });
    if (unit) { out.push(`${label(r)} vs unit "${(unit.textContent || '').trim()}" ${Math.round(px.get(unit)!)}px (number over 2x its unit)`); break; }
  }

  const display = numerals.filter((r) => r.px > displayFrom + 0.5);
  if (display.length > 1) out.push(`${display.length} numerals above ${displayFrom}px (${display.slice(0, 3).map((r) => `"${r.text.slice(0, 16)}"`).join(', ')}) — keep at most one`);
  return out;
}

export function lintScreen(s: Screen, t: DesignTokens, contentLang: 'ko' | 'en', platform: Platform = 'both'): LintViolation[] {
  const html = s.html || '';
  const v: LintViolation[] = [];
  const add = (rule: LintViolation['rule'], severity: LintViolation['severity'], detail: string) => v.push({ rule, severity, detail, screenId: s.id });

  // banned fonts
  const ff = html.match(/font-family\s*:\s*([^;"}]+)/gi) || [];
  const bad = ff.find((x) => BANNED_FONTS.test(x));
  if (bad) add('banned-font', 'fix', bad.slice(0, 80));
  if (/class="[^"]*\bfont-sans\b/.test(html)) add('banned-font', 'fix', 'Tailwind default font-sans');

  // purple gradient on bright background
  const grads = html.match(/(?:linear|radial|conic)-gradient\([^)]*(?:\([^)]*\)[^)]*)*\)/gi) || [];
  const bgLight = (() => {
    const rgb = hexToRgb(t.color.bg);
    return rgb ? luminance(rgb) > 0.6 : true;
  })();
  const purpleInGrad = grads.some((g) =>
    (g.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi) || []).some((c) => {
      const hex = c.startsWith('#') ? c : rgbStrToHex(c);
      if (!hex) return false;
      const h = hue(hex);
      return h >= 250 && h <= 290 && saturation(hex) > 0.25;
    }),
  );
  if (bgLight && (purpleInGrad || (/\bbg-gradient-to-/.test(html) && PURPLE_TW.test(html)))) add('purple-gradient', 'fix', 'purple/indigo gradient on light background');

  // off-token colors
  const allowed = tokenColors(t);
  const found = new Set<string>();
  const stripped = html.replace(/&#x?[0-9a-f]+;/gi, '').replace(/data-[\w-]+="[^"]*"/g, '');
  (stripped.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []).forEach((h) => {
    if (!allowed.has(norm(h))) found.add(h);
  });
  (html.match(/rgba?\(\s*\d+[,\s]+\d+[,\s]+\d+/gi) || []).forEach((c) => {
    const hex = rgbStrToHex(c);
    if (hex && !allowed.has(norm(hex))) found.add(c + ')');
  });
  const tw = html.match(TW_PALETTE) || [];
  tw.slice(0, 5).forEach((c) => found.add(c));
  const offenders = [...found];
  if (offenders.length) add('off-token-color', 'fix', offenders.slice(0, 6).join(', '));

  // card overuse
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const all = doc.body.querySelectorAll('*').length || 1;
  const cards = Array.from(doc.body.querySelectorAll('[class]')).filter((el) => {
    const c = el.getAttribute('class') || '';
    return /\brounded(-\w+)?\b/.test(c) && /\bshadow(-\w+)?\b/.test(c);
  });
  const sigs = new Map<string, number>();
  cards.forEach((el) => {
    const c = el.getAttribute('class') || '';
    const sig = (c.match(/\brounded(-[\w[\]-]+)?\b/)?.[0] || '') + '|' + (c.match(/\bshadow(-[\w[\]-]+)?\b/)?.[0] || '');
    sigs.set(sig, (sigs.get(sig) || 0) + 1);
  });
  const maxSig = Math.max(0, ...sigs.values());
  if (maxSig >= 5 || (maxSig >= 3 && maxSig / Math.max(1, doc.body.querySelectorAll('section,article,li,div').length) > 0.3))
    add('card-overuse', 'warn', `${maxSig} elements share the same rounded+shadow card (of ${all})`);

  // template layout: big heading + 2 buttons, then 3 cards in a row
  const h1 = doc.body.querySelector('h1');
  const threeGrid = Array.from(doc.body.querySelectorAll('[class*="grid-cols-3"]')).some((g) => g.children.length === 3);
  if (h1 && threeGrid) {
    const heroBtns = h1.parentElement?.querySelectorAll('a,button').length ?? 0;
    if (heroBtns >= 2) add('template-layout', 'warn', 'hero (h1 + 2 CTAs) → 3 equal cards');
  }

  // one number/letter blown up far past the rest of the type
  const big = oversizedType(doc, t, platform);
  if (big.length) add('oversized-type', 'fix', big.join('; '));

  // fake content
  const text = doc.body.textContent || '';
  const fake = text.match(FAKE);
  if (fake) add('fake-content', 'fix', `"${fake[0]}"`);

  // emoji as icons
  const emo = text.match(EMOJI);
  if (emo) add('emoji-icon', 'warn', `emoji "${emo[0]}" used`);

  // Hangul without Korean font
  if (/[가-힣]/.test(text)) {
    const fams = [t.font.display.family, t.font.body.family];
    if (!fams.some(isKoFont)) add('missing-ko-font', 'fix', 'Hangul content, but tokens have no Korean font');
  }
  return v;
}

export function lintProject(screens: Screen[], t: DesignTokens | null, lang: 'ko' | 'en', platform: Platform = 'both') {
  if (!t) return [];
  const v = lintTokens(t, lang);
  screens.filter((s) => s.status === 'done').forEach((s) => v.push(...lintScreen(s, t, lang, platform)));
  return v;
}
