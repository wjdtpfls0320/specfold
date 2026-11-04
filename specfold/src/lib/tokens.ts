import type { ColorSet, DesignTokens, Direction } from './types';

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
  { display: 'Fraunces', body: 'Newsreader' },
  { display: 'Instrument Serif', body: 'Familjen Grotesk' },
  { display: 'Bricolage Grotesque', body: 'Newsreader' },
  { display: 'Syne', body: 'Familjen Grotesk', mono: 'IBM Plex Mono' },
  { display: 'Unbounded', body: 'Young Serif' },
];

export const isKoFont = (f: string) => KO_FONTS.some((k) => k.toLowerCase() === f.trim().toLowerCase());

const generic = (family: string) =>
  /myeongjo|batang|serif|hahmlet|song myung|newsreader|fraunces/i.test(family) && !/sans/i.test(family) ? 'serif' : 'sans-serif';

const q = (f: string) => `'${f.replace(/'/g, '')}', ${generic(f)}`;

function colorVars(c: ColorSet) {
  return `--color-bg:${c.bg};--color-surface:${c.surface};--color-ink:${c.ink};--color-ink-muted:${c.inkMuted};--color-primary:${c.primary};--color-accent:${c.accent};--color-line:${c.line};`;
}

export function tokensToCss(t: DesignTokens, opts: { dark?: boolean } = {}) {
  const c = opts.dark && t.color.dark ? t.color.dark : t.color;
  const mono = t.font.mono?.family || t.font.body.family;
  const scale = (t.scale?.length ? t.scale : [12, 14, 16, 20, 28, 40, 56]).map((s, i) => `--text-${i}:${s}px;`).join('');
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
export function normalizeTokens(raw: any, fallback: DesignTokens = PRESETS[0].tokens): DesignTokens {
  const t = raw || {};
  const c = t.color || {};
  const pick = (k: keyof ColorSet) => (typeof c[k] === 'string' && hexToRgb(c[k]) ? c[k] : fallback.color[k]);
  const font = (f: any, fb: any) => (f && f.family ? { family: String(f.family), weights: Array.isArray(f.weights) ? f.weights.map(Number).filter(Boolean) : fb.weights } : fb);
  const out: DesignTokens = {
    color: { bg: pick('bg'), surface: pick('surface'), ink: pick('ink'), inkMuted: pick('inkMuted'), primary: pick('primary'), accent: pick('accent'), line: pick('line') },
    font: { display: font(t.font?.display, fallback.font.display), body: font(t.font?.body, fallback.font.body) },
    scale: Array.isArray(t.scale) && t.scale.length ? t.scale.map(Number) : fallback.scale,
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

function preset(
  name: { ko: string; en: string }, theme: string, display: [string, number[]], body: [string, number[]],
  colors: [string, string, string, string, string, string, string], feature: { ko: string; en: string },
  radius: [number, number, number], motion: string, bg: string, mono?: string,
): { name: { ko: string; en: string }; theme: string; feature: { ko: string; en: string }; tokens: DesignTokens } {
  const [bgc, surface, ink, inkMuted, primary, accent, line] = colors;
  return {
    name, theme, feature,
    tokens: {
      color: { bg: bgc, surface, ink, inkMuted, primary, accent, line },
      font: { display: { family: display[0], weights: display[1] }, body: { family: body[0], weights: body[1] }, ...(mono ? { mono: { family: mono, weights: [400, 500] } } : {}) },
      scale: [12, 14, 16, 20, 28, 40, 56],
      space: 8,
      radius: { sm: radius[0], md: radius[1], lg: radius[2] },
      shadow: ['0 1px 0 rgba(0,0,0,.06)'],
      motion: { signature: motion },
      background: { treatment: bg },
    },
  };
}

// design-prompts.md §8
export const PRESETS = [
  preset({ ko: '종이 신문', en: 'Broadsheet' }, 'light', ['Hahmlet', [700, 900]], ['IBM Plex Sans KR', [400, 600]],
    ['#F3EEE4', '#FBF8F2', '#1C1A16', '#5E584D', '#1C1A16', '#D9481C', '#D8D0C1'],
    { ko: '굵은 세리프 제목, 가는 구분선, 단 나눔', en: 'Heavy serif headlines, hairline rules, columns' }, [2, 4, 8],
    '제목이 위에서 아래로 인쇄되듯 차례로 나타남', '미세한 종이 노이즈 질감'),
  preset({ ko: '형광 계기판', en: 'Phosphor Gauge' }, 'dark', ['IBM Plex Sans KR', [700]], ['IBM Plex Sans KR', [400, 500]],
    ['#0F1211', '#171C1A', '#E6EDE8', '#9AA59F', '#E6EDE8', '#C6F432', '#2A322E'],
    { ko: '모노 숫자, 선 그리드 배경, 촘촘한 정보', en: 'Mono numerals, line-grid background, dense info' }, [2, 4, 6],
    '숫자가 0에서 실제 값으로 빠르게 올라감', '1px 선 그리드 패턴', 'IBM Plex Mono'),
  preset({ ko: '브루탈 포스터', en: 'Brutal Poster' }, 'light', ['Black Han Sans', [400]], ['Gothic A1', [400, 700]],
    ['#FFFFFF', '#F4F4F4', '#111111', '#444444', '#111111', '#2F3BFF', '#111111'],
    { ko: '두꺼운 테두리, 직각, 그림자 대신 오프셋 면', en: 'Thick borders, right angles, offset slabs' }, [0, 0, 0],
    '블록이 옆에서 미끄러져 들어와 딱 멈춤', '굵은 대각선 줄무늬 띠 하나'),
  preset({ ko: '동네 손글씨', en: 'Neighborhood Hand' }, 'mid', ['Gowun Batang', [700]], ['Gowun Dodum', [400]],
    ['#EFE6D4', '#F8F1E3', '#3B2F23', '#6E5E4C', '#3B2F23', '#B5532A', '#D9CBB2'],
    { ko: '따뜻한 종이 질감, 둥근 형태, 큰 사진', en: 'Warm paper texture, round shapes, big photos' }, [10, 18, 28],
    '사진이 살짝 기울어진 채 내려앉음', '크래프트지 질감 + 따뜻한 방사형 그라데이션'),
  preset({ ko: '스위스 그리드', en: 'Swiss Grid' }, 'light', ['Gothic A1', [900]], ['Gothic A1', [400]],
    ['#F2F2EF', '#FFFFFF', '#141414', '#555555', '#141414', '#E3241B', '#CFCFCA'],
    { ko: '엄격한 12단 그리드, 큰 숫자, 비대칭', en: 'Strict 12-col grid, big numerals, asymmetry' }, [0, 0, 2],
    '그리드 선이 먼저 그려지고 내용이 채워짐', '희미한 12단 컬럼 가이드'),
  preset({ ko: '고요한 숲', en: 'Quiet Forest' }, 'mid', ['Nanum Myeongjo', [800]], ['IBM Plex Sans KR', [400]],
    ['#E4E8E1', '#EEF1EB', '#1F2A24', '#4F5C54', '#1F2A24', '#7A5C2E', '#C5CEC4'],
    { ko: '넓은 여백, 느린 페이드, 세이지 그라데이션', en: 'Wide margins, slow fades, sage gradient' }, [4, 8, 14],
    '느린 페이드 인 (600ms)', '세이지 색 두 겹 그라데이션'),
  preset({ ko: '레트로 팝', en: 'Retro Pop' }, 'color', ['Do Hyeon', [400]], ['Gothic A1', [500, 700]],
    ['#FFD84D', '#FFF3C4', '#1A1A1A', '#3D3A2E', '#1A1A1A', '#C8205A', '#1A1A1A'],
    { ko: '굵은 윤곽선, 스티커 같은 요소, 기울임', en: 'Thick outlines, sticker elements, tilts' }, [6, 14, 999],
    '스티커가 튕기듯 붙음', '물방울 도트 패턴'),
  preset({ ko: '심야 라운지', en: 'Late Lounge' }, 'dark', ['Song Myung', [400]], ['Nanum Gothic', [400, 700]],
    ['#17131C', '#211B28', '#EDE6F2', '#A99DB5', '#EDE6F2', '#E8A54B', '#3A3142'],
    { ko: '깊은 어둠 위 금빛 강조, 큰 세리프, 노이즈 질감', en: 'Gold on deep dark, big serif, grain' }, [2, 6, 12],
    '금빛 선이 천천히 그어짐', '노이즈 질감 + 아래쪽 은은한 금빛 광원'),
];

export function presetAsDirection(i: number, lang: 'ko' | 'en'): Direction {
  const p = PRESETS[i];
  return { name: p.name[lang], mood: p.feature[lang], rationale: p.feature[lang], tokens: structuredClone(p.tokens) };
}

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
