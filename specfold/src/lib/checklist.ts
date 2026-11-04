import type { CheckItem, CheckResult, Lang } from './types';

export const CHECK_IDS = [
  'summary', 'audience', 'platform', 'screens', 'screen_elements', 'flow', 'mood', 'avoid',
  'references', 'content', 'brand', 'priority', 'states',
] as const;
export const ESSENTIAL = new Set(['summary', 'audience', 'platform', 'screens', 'screen_elements', 'flow', 'mood', 'avoid']);

/** "뻔한 단어" → 대체 표현 (언어별, 기획서 §6·§7) */
export const VAGUE_WORDS: Record<Lang, Record<string, string[]>> = {
  ko: {
    깔끔: ['여백이 넓은', '선이 가는', '신문처럼 정돈된'],
    모던: ['직각이 많은', '큰 숫자가 중심인', '금속처럼 차가운'],
    심플: ['요소가 세 개뿐인', '흑백 위주의', '한 가지 색만 쓰는'],
    세련: ['잡지 표지 같은', '호텔 로비처럼 조용한', '굵기 대비가 큰'],
    직관: ['버튼이 엄지 닿는 곳에 있는', '한 화면 한 가지 일만 하는', '숫자가 먼저 보이는'],
    트렌디: ['포스터처럼 과감한', '형광색 포인트의', '손으로 오린 듯한'],
    고급: ['금박 같은 포인트의', '넓은 여백과 세리프의', '어두운 바탕의'],
  },
  en: {
    clean: ['generous whitespace', 'hairline rules', 'newspaper-ordered'],
    modern: ['hard right angles', 'big-numeral led', 'cool and metallic'],
    sleek: ['magazine-cover', 'quiet like a hotel lobby', 'high weight contrast'],
    minimal: ['only three elements', 'mostly black and white', 'a single color'],
    intuitive: ['thumb-reachable actions', 'one task per screen', 'numbers first'],
    simple: ['few elements', 'monochrome', 'single accent'],
    elegant: ['serif with wide margins', 'gold-leaf accents', 'dark backdrop'],
  },
};

const has = (s: string, re: RegExp) => re.test(s);
function sectionBody(text: string, re: RegExp) {
  const m = text.match(re);
  return m ? (m[1] || '').trim() : '';
}

export function findVague(text: string, lang: Lang) {
  const words = VAGUE_WORDS[lang];
  const lower = text.toLowerCase();
  return Object.keys(words).filter((w) => lower.includes(w));
}

/** Instant, offline completeness check. The AI check (P1) refines it. */
export function localCheck(text: string): CheckResult {
  const t = text;
  const L = t.toLowerCase();
  const item = (id: string, ok: boolean, vague = false, note?: string, suggestions?: string[]): CheckItem => ({
    id, status: ok ? (vague ? 'vague' : 'ok') : 'missing', note, suggestions,
  });

  const summaryLine = sectionBody(t, /(?:한 줄 소개|one[- ]liner|summary)\s*[:：]\s*(.+)/i);
  const audience = sectionBody(t, /(?:사용자|대상|audience|users?)\s*[:：]\s*(.+)/i);
  const platform = has(L, /모바일|데스크톱|데스크탑|태블릿|반응형|mobile|desktop|tablet|responsive|\bios\b|android/);
  const screenHeads = (t.match(/^#{2,4}\s*\d*\.?\s*.+$/gm) || []).length;
  const screens = has(L, /화면|screens?|pages?/) && screenHeads >= 2;
  const elements = has(L, /들어갈 것|구성|요소|contains|elements|includes?/);
  const flow = has(t, /→|->|이동|흐름|flow|navigat/);
  const moodBody = sectionBody(t, /(?:이런 느낌|분위기|mood|feel(?:s| like)?)\s*[:：]\s*(.+)/i);
  const moodAny = moodBody || (has(L, /분위기|mood|느낌/) ? 'x' : '');
  const vagueKo = findVague(moodBody || t, 'ko');
  const vagueEn = findVague(moodBody || t, 'en');
  const vagueWords = [...vagueKo, ...vagueEn];
  const moodVague = !!moodAny && (moodBody.length < 6 || vagueWords.length > 0) && moodBody.split(/[,，、]/).length < 3;
  const avoid = has(L, /싫음|싫어|피하고|피할|avoid|don't want|do not want|not like/);
  const refs = has(L, /참고|레퍼런스|reference|inspired|like (?:the )?\w+ app/);
  const content = has(L, /콘텐츠 예시|실제 문구|content|sample|예시\s*[:：]/) && /\d/.test(t);
  const brand = has(L, /로고|브랜드|logo|brand|색은|color is/);
  const priority = has(L, /가장 중요|우선순위|most important|priority/);
  const states = has(L, /빈 (?:화면|목록|상태)|로딩|오류|에러|empty state|loading|error|로그인 전/);

  const sugg = vagueWords.length
    ? vagueWords.flatMap((w) => VAGUE_WORDS.ko[w] ?? VAGUE_WORDS.en[w] ?? []).slice(0, 3)
    : undefined;

  return {
    source: 'local',
    questions: [],
    items: [
      item('summary', !!summaryLine || t.trim().split('\n').length > 1, !!summaryLine && summaryLine.length < 8),
      item('audience', !!audience, !!audience && audience.length < 8),
      item('platform', platform),
      item('screens', screens, screens && screenHeads < 3),
      item('screen_elements', elements),
      item('flow', flow),
      item('mood', !!moodAny, moodVague, moodVague ? vagueWords.join(', ') : undefined, moodVague ? sugg : undefined),
      item('avoid', avoid),
      item('references', refs),
      item('content', content),
      item('brand', brand),
      item('priority', priority),
      item('states', states),
    ],
  };
}

export const TEMPLATE: Record<Lang, string> = {
  ko: `# [서비스 이름]
한 줄 소개:
사용자: (누가 / 어떤 상황에서)
플랫폼: 모바일 / 데스크톱 / 둘 다

## 분위기
- 이런 느낌: (형용사 3개)
- 이런 느낌은 싫음:
- 참고: (사이트/앱 + 좋은 점)

## 화면
### 1. 홈
- 들어갈 것:
- 가장 중요한 것:
- 이동: (어떤 버튼 → 어느 화면)

## 기능
-

## 실제 콘텐츠 예시
-
`,
  en: `# [Service name]
One-liner:
Users: (who / in what situation)
Platform: mobile / desktop / both

## Mood
- Feels like: (3 adjectives)
- Does NOT feel like:
- References: (site/app + what you like about it)

## Screens
### 1. Home
- Contains:
- Most important:
- Goes to: (which button → which screen)

## Features
-

## Real content examples
-
`,
};
