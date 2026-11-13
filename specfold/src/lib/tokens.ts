import type { ColorSet, DesignTokens } from './types';

export const KO_FONTS = [
  'Hahmlet', 'IBM Plex Sans KR', 'Gowun Batang', 'Gowun Dodum', 'Black Han Sans', 'Gothic A1', 'Nanum Myeongjo',
  'Nanum Gothic', 'Nanum Gothic Coding', 'Nanum Pen Script', 'Nanum Brush Script', 'Do Hyeon', 'Song Myung', 'Noto Sans KR',
  'Noto Serif KR', 'Jua', 'Sunflower', 'Gaegu', 'Hi Melody', 'Dongle', 'Gamja Flower', 'Orbit', 'Bagel Fat One',
  'Diphylleia', 'Gasoek One', 'Grandiflora One', 'Dokdo', 'East Sea Dokdo', 'Yeon Sung', 'Poor Story', 'Single Day',
  'Cute Font', 'Kirang Haerang', 'Stylish', 'Gugi', 'Moirai One', 'Black And White Picture', 'Gowun Batang', 'Hanna',
];

export const FONT_PAIRS: { display: string; body: string; mono?: string }[] = [
  { display: 'Hahmlet', body: 'IBM Plex Sans KR' },
  { display: 'IBM Plex Sans KR', body: 'IBM Plex Sans KR', mono: 'IBM Plex Mono' },
  { display: 'Black Han Sans', body: 'Gothic A1' },
  { display: 'Gowun Batang', body: 'Gowun Dodum' },
  { display: 'Gothic A1', body: 'Gothic A1' },
  { display: 'Nanum Myeongjo', body: 'IBM Plex Sans KR' },
  { display: 'Do Hyeon', body: 'Gothic A1' },
  { display: 'Song Myung', body: 'Nanum Gothic' },
  { display: 'Noto Serif KR', body: 'IBM Plex Sans KR', mono: 'IBM Plex Mono' },
  { display: 'Nanum Gothic', body: 'Nanum Gothic' },
  { display: 'Jua', body: 'Gowun Dodum' },
  { display: 'Nanum Gothic Coding', body: 'Nanum Gothic Coding', mono: 'Nanum Gothic Coding' },
  { display: 'Yeon Sung', body: 'Noto Serif KR' },
  { display: 'Gaegu', body: 'Gowun Dodum' },
  { display: 'Gugi', body: 'Orbit' },
  { display: 'Bagel Fat One', body: 'Gothic A1' },
  { display: 'Fraunces', body: 'Newsreader' },
  { display: 'Instrument Serif', body: 'Familjen Grotesk' },
  { display: 'Bricolage Grotesque', body: 'Newsreader' },
  { display: 'Syne', body: 'Familjen Grotesk', mono: 'IBM Plex Mono' },
  { display: 'Unbounded', body: 'Young Serif' },
];

/** Hard ceiling for any type-scale step (px). Keeps "giant numeral" layouts out of generated screens. */
export const MAX_TYPE_PX = 64;
const DEFAULT_SCALE = [12, 14, 16, 20, 28, 40, 56];

/** Largest font size a screen may use: the top of the token scale, never above MAX_TYPE_PX. */
export function typeCap(t: DesignTokens) {
  const s = (t.scale ?? []).filter((n) => n > 0);
  return Math.min(MAX_TYPE_PX, s.length ? Math.max(...s) : DEFAULT_SCALE[DEFAULT_SCALE.length - 1]);
}

export const isKoFont =(f: string) => KO_FONTS.some((k) => k.toLowerCase() === f.trim().toLowerCase());

const generic = (family: string) =>
  /myeongjo|batang|serif|hahmlet|song myung|newsreader|fraunces/i.test(family) && !/sans/i.test(family) ? 'serif' : 'sans-serif';

const q = (f: string) => `'${f.replace(/'/g, '')}', ${generic(f)}`;

function colorVars(c: ColorSet) {
  return `--color-bg:${c.bg};--color-surface:${c.surface};--color-ink:${c.ink};--color-ink-muted:${c.inkMuted};--color-primary:${c.primary};--color-accent:${c.accent};--color-line:${c.line};`;
}

export function tokensToCss(t: DesignTokens, opts: { dark?: boolean } = {}) {
  const c = opts.dark && t.color.dark ? t.color.dark : t.color;
  const mono = t.font.mono?.family || t.font.body.family;
  const scale = (t.scale?.length ? t.scale : DEFAULT_SCALE).map((s, i) => `--text-${i}:${s}px;`).join('');
  const shadows = (t.shadow || []).map((s, i) => `--shadow-${i}:${s};`).join('');
  return `:root{${colorVars(c)}--font-display:${q(t.font.display.family)};--font-body:${q(t.font.body.family)};--font-mono:'${mono}', monospace;--radius-sm:${t.radius.sm}px;--radius-md:${t.radius.md}px;--radius-lg:${t.radius.lg}px;--space:${t.space}px;${scale}${shadows}}
body{background:var(--color-bg);color:var(--color-ink);font-family:var(--font-body);margin:0;}
.font-display{font-family:var(--font-display);}.font-body{font-family:var(--font-body);}.font-mono{font-family:var(--font-mono);}`;
}

export function googleFontsUrl(t: DesignTokens) {
  const fams = new Map<string, Set<number>>();
  for (const f of [t.font.display, t.font.body, t.font.mono]) {
    if (!f?.family) continue;
    const s = fams.get(f.family) ?? new Set<number>();
    (f.weights?.length ? f.weights : [400]).forEach((w) => s.add(w));
    s.add(400);
    fams.set(f.family, s);
  }
  const parts = [...fams].map(([fam, ws]) => `family=${encodeURIComponent(fam).replace(/%20/g, '+')}:wght@${[...ws].sort((a, b) => a - b).join(';')}`);
  return `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap`;
}

// ---- color math ----
export function hexToRgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  if (h.length === 8) h = h.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function luminance([r, g, b]: [number, number, number]) {
  const f = (v: number) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrast(a: string, b: string) {
  const ra = hexToRgb(a), rb = hexToRgb(b);
  if (!ra || !rb) return 21;
  const la = luminance(ra), lb = luminance(rb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function hue(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 0;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

export function saturation(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  return max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
}

export function themeOf(t: DesignTokens): 'light' | 'dark' | 'mid' {
  const rgb = hexToRgb(t.color.bg);
  if (!rgb) return 'light';
  const l = luminance(rgb);
  if (l < 0.08) return 'dark';
  if (l > 0.85 && saturation(t.color.bg) < 0.25) return 'light';
  return 'mid';
}

export function hueBucket(hex: string) {
  if (saturation(hex) < 0.12) return 'neutral';
  const h = hue(hex);
  const names = ['red', 'orange', 'yellow', 'lime', 'green', 'teal', 'cyan', 'blue', 'indigo', 'violet', 'magenta', 'pink'];
  return names[Math.floor(((h + 15) % 360) / 30)];
}

/** Normalizes a possibly-partial tokens object from an LLM into a full DesignTokens. */
export function normalizeTokens(raw: any, fallback: DesignTokens = FALLBACK_TOKENS): DesignTokens {
  const t = raw || {};
  const c = t.color || {};
  const pick = (k: keyof ColorSet) => (typeof c[k] === 'string' && hexToRgb(c[k]) ? c[k] : fallback.color[k]);
  const font = (f: any, fb: any) => (f && f.family ? { family: String(f.family), weights: Array.isArray(f.weights) ? f.weights.map(Number).filter(Boolean) : fb.weights } : fb);
  const out: DesignTokens = {
    color: { bg: pick('bg'), surface: pick('surface'), ink: pick('ink'), inkMuted: pick('inkMuted'), primary: pick('primary'), accent: pick('accent'), line: pick('line') },
    font: { display: font(t.font?.display, fallback.font.display), body: font(t.font?.body, fallback.font.body) },
    scale: Array.isArray(t.scale) && t.scale.length ? t.scale.map((n: unknown) => Math.min(Number(n), MAX_TYPE_PX)) : fallback.scale,
    space: Number(t.space) || fallback.space,
    radius: { sm: num(t.radius?.sm, fallback.radius.sm), md: num(t.radius?.md, fallback.radius.md), lg: num(t.radius?.lg, fallback.radius.lg) },
    shadow: Array.isArray(t.shadow) ? t.shadow.map(String) : fallback.shadow,
    motion: { signature: String(t.motion?.signature ?? fallback.motion.signature) },
    background: { treatment: String(t.background?.treatment ?? fallback.background.treatment) },
  };
  if (t.font?.mono?.family) out.font.mono = font(t.font.mono, { family: 'IBM Plex Mono', weights: [400] });
  if (c.dark && typeof c.dark === 'object') {
    const d = c.dark;
    out.color.dark = {
      bg: d.bg || out.color.ink, surface: d.surface || out.color.ink, ink: d.ink || out.color.bg, inkMuted: d.inkMuted || out.color.line,
      primary: d.primary || out.color.bg, accent: d.accent || out.color.accent, line: d.line || out.color.inkMuted,
    };
  }
  return out;
}
const num = (v: any, fb: number) => (v === undefined || v === null || isNaN(Number(v)) ? fb : Number(v));

/** Used when a model returns incomplete tokens (the first style preset, 종이 신문). */
const FALLBACK_TOKENS: DesignTokens = {
  color: { bg: '#F3EEE4', surface: '#FBF8F2', ink: '#1C1A16', inkMuted: '#5E584D', primary: '#1C1A16', accent: '#D9481C', line: '#D8D0C1' },
  font: { display: { family: 'Hahmlet', weights: [700, 900] }, body: { family: 'IBM Plex Sans KR', weights: [400, 600] } },
  scale: [...DEFAULT_SCALE],
  space: 8,
  radius: { sm: 2, md: 4, lg: 8 },
  shadow: ['0 1px 0 rgba(0,0,0,.06)'],
  motion: { signature: '제목이 위에서 아래로 인쇄되듯 차례로 나타남' },
  background: { treatment: '미세한 종이 노이즈 질감' },
};

export function setTokenPath(t: DesignTokens, path: string, value: unknown): DesignTokens {
  const out: any = structuredClone(t);
  const keys = path.split('.');
  let cur = out;
  for (let i = 0; i < keys.length - 1; i++) {
    cur[keys[i]] = cur[keys[i]] ?? {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
  return normalizeTokens(out, t);
}
