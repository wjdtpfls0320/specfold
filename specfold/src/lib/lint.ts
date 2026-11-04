import type { DesignTokens, LintViolation, Screen } from './types';
import { contrast, hexToRgb, hue, isKoFont, luminance, saturation } from './tokens';

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

export function lintScreen(s: Screen, t: DesignTokens, contentLang: 'ko' | 'en'): LintViolation[] {
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

export function lintProject(screens: Screen[], t: DesignTokens | null, lang: 'ko' | 'en') {
  if (!t) return [];
  const v = lintTokens(t, lang);
  screens.filter((s) => s.status === 'done').forEach((s) => v.push(...lintScreen(s, t, lang)));
  return v;
}
