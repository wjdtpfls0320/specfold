// Style presets — the design directions a user can pick in step 3 (design-prompts.md §8).
// Each one is a distinct, named style family (editorial, neo-brutalism, bento, claymorphism, …) of the
// kind designer-written style prompts and skills catalogue, re-expressed as tokens plus a short brief
// (`guide`) that P4/P5 follow, and a mini preview drawn in that style.
import type { DesignTokens, Direction } from './types';

type L = { ko: string; en: string };
export interface MiniVars { name: string; first: string; summary: string; cta: string }

export interface StylePreset {
  id: string;
  name: L;
  /** Style family this preset belongs to. */
  genre: L;
  theme: 'light' | 'dark' | 'mid' | 'color';
  /** One-line look. */
  feature: L;
  /** What kind of service it suits. */
  bestFor: L;
  /** Style brief sent to the model with every screen (prompts are written in Korean). */
  guide: string;
  tokens: DesignTokens;
  mini: (v: MiniVars) => string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

type Font = [family: string, weights: number[]];
type Colors = [bg: string, surface: string, ink: string, inkMuted: string, primary: string, accent: string, line: string];

function tokens(display: Font, body: Font, c: Colors, radius: [number, number, number], motion: string, bg: string, o: { mono?: string; shadow?: string[]; space?: number } = {}): DesignTokens {
  return {
    color: { bg: c[0], surface: c[1], ink: c[2], inkMuted: c[3], primary: c[4], accent: c[5], line: c[6] },
    font: { display: { family: display[0], weights: display[1] }, body: { family: body[0], weights: body[1] }, ...(o.mono ? { mono: { family: o.mono, weights: [400, 500] } } : {}) },
    scale: [12, 14, 16, 20, 28, 40, 56],
    space: o.space ?? 8,
    radius: { sm: radius[0], md: radius[1], lg: radius[2] },
    shadow: o.shadow ?? ['0 1px 0 rgba(0,0,0,.06)'],
    motion: { signature: motion },
    background: { treatment: bg },
  };
}

// ---- mini preview building blocks (inline styles only; token CSS variables for every color) ----
const D = 'font-family:var(--font-display)';
const M = 'font-family:var(--font-mono)';
const wrap = (style: string, inner: string) => `<div style="min-height:440px;box-sizing:border-box;overflow:hidden;position:relative;word-break:keep-all;${style}">${inner}</div>`;
const bars = (widths: number[], color = 'var(--color-line)', h = 8) => widths.map((w) => `<div style="height:${h}px;width:${w}%;background:${color}"></div>`).join('');

export const PRESETS: StylePreset[] = [
  {
    id: 'broadsheet',
    name: { ko: '종이 신문', en: 'Broadsheet' },
    genre: { ko: '에디토리얼', en: 'Editorial' },
    theme: 'light',
    feature: { ko: '굵은 세리프 제목, 가는 괘선, 단 나눔', en: 'Heavy serif headlines, hairline rules, columns' },
    bestFor: { ko: '읽을거리가 많은 서비스: 뉴스, 블로그, 기록, 큐레이션', en: 'Reading-heavy products: news, blogs, journals, curation' },
    guide: `- 레이아웃: 신문 1면처럼 머리기사 하나를 크게 두고 나머지는 2~3단으로 나눈다. 카드 대신 가는 괘선과 단 구분선으로 영역을 가른다
- 타이포: 굵은 세리프 제목, 본문은 줄 길이를 짧게. 날짜·분류는 자간 넓힌 작은 라벨로
- 형태: 직각에 가깝게, 그림자 없음. 강조색은 머리기사 라벨이나 밑줄 한 곳에만
- 피할 것: 둥근 카드 그리드, 아이콘 나열, 가운데 정렬 히어로`,
    tokens: tokens(['Hahmlet', [700, 900]], ['IBM Plex Sans KR', [400, 600]],
      ['#F3EEE4', '#FBF8F2', '#1C1A16', '#5E584D', '#1C1A16', '#D9481C', '#D8D0C1'], [2, 4, 8],
      '제목이 위에서 아래로 인쇄되듯 차례로 나타남', '미세한 종이 노이즈 질감'),
    mini: (v) => wrap('padding:18px 22px', `
      <div style="text-align:center;border-top:4px double var(--color-ink);border-bottom:1px solid var(--color-ink);padding:9px 0;${D};font-weight:900;font-size:22px">${v.name}</div>
      <p style="font-size:11px;letter-spacing:.16em;font-weight:600;color:var(--color-accent);margin:18px 0 6px">VOL. 01 — TODAY</p>
      <p style="${D};font-weight:900;font-size:35px;line-height:1.1;margin:0 0 14px">${v.first}</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;border-top:1px solid var(--color-ink);padding-top:12px">
        <p style="font-size:13px;line-height:1.65;color:var(--color-ink-muted);margin:0">${v.summary}</p>
        <div style="border-left:1px solid var(--color-line);padding-left:16px;display:grid;gap:8px;align-content:start">${bars([100, 92, 96, 70, 100, 84, 58])}</div>
      </div>`),
  },
  {
    id: 'phosphor',
    name: { ko: '형광 계기판', en: 'Phosphor Gauge' },
    genre: { ko: '터미널 · 데이터', en: 'Terminal · Data' },
    theme: 'dark',
    feature: { ko: '모노 숫자, 선 그리드 배경, 촘촘한 정보', en: 'Mono numerals, line-grid background, dense info' },
    bestFor: { ko: '수치를 계속 보는 서비스: 대시보드, 모니터링, 운동·금융 기록', en: 'Numbers at a glance: dashboards, monitoring, fitness or finance logs' },
    guide: `- 레이아웃: 계기판. 화면을 표와 행 단위로 촘촘히 나누고, 맨 위 상태 줄에 핵심 값을 한 줄로 모은다
- 타이포: 숫자·코드·시간은 모노스페이스에 자릿수 정렬. 라벨은 작게, 자간을 넓혀서
- 형태: 1px 선과 2~4px 모서리. 면 대신 선으로 구분한다. 강조색은 "지금 살아 있는 값"에만
- 배경: 1px 선 그리드. 발광(glow)은 강조 값 하나에만 약하게
- 피할 것: 큰 사진, 둥근 카드, 넓은 장식 여백`,
    tokens: tokens(['IBM Plex Sans KR', [700]], ['IBM Plex Sans KR', [400, 500]],
      ['#0F1211', '#171C1A', '#E6EDE8', '#9AA59F', '#E6EDE8', '#C6F432', '#2A322E'], [2, 4, 6],
      '숫자가 0에서 실제 값으로 빠르게 올라감', '1px 선 그리드 패턴', { mono: 'IBM Plex Mono' }),
    mini: (v) => wrap('padding:16px 18px;background:linear-gradient(var(--color-line) 1px,transparent 1px) 0 0/100% 28px,linear-gradient(90deg,var(--color-line) 1px,transparent 1px) 0 0/28px 100%,var(--color-bg)', `
      <div style="display:flex;justify-content:space-between;${M};font-size:11px;letter-spacing:.08em;color:var(--color-ink-muted);background:var(--color-bg);padding:4px 6px;border:1px solid var(--color-line)">
        <span><span style="color:var(--color-accent)">●</span> LIVE · ${v.name}</span><span>SYS OK</span></div>
      <p style="font-weight:700;font-size:25px;line-height:1.2;margin:18px 0 14px;background:var(--color-bg);display:inline-block">${v.first}</p>
      <div style="background:var(--color-surface);border:1px solid var(--color-line)">
        ${[['01', '42.0', 62], ['02', '71.3', 84], ['03', '08.6', 30], ['04', '15.9', 46]].map(([k, n, w], i) => `<div style="display:grid;grid-template-columns:44px 1fr 52px;gap:10px;align-items:center;padding:9px 10px;border-top:${i ? 1 : 0}px solid var(--color-line);${M};font-size:12px">
          <span style="color:var(--color-ink-muted)">${k}</span><div style="height:4px;background:var(--color-line)"><div style="height:4px;width:${w}%;background:${i === 1 ? 'var(--color-accent)' : 'var(--color-ink-muted)'}"></div></div>
          <span style="text-align:right;color:${i === 1 ? 'var(--color-accent)' : 'var(--color-ink)'}">${n}</span></div>`).join('')}
      </div>`),
  },
  {
    id: 'brutal',
    name: { ko: '브루탈 포스터', en: 'Brutal Poster' },
    genre: { ko: '네오 브루탈리즘', en: 'Neo-brutalism' },
    theme: 'light',
    feature: { ko: '두꺼운 테두리, 직각, 그림자 대신 어긋난 면', en: 'Thick borders, right angles, offset slabs' },
    bestFor: { ko: '목소리가 큰 서비스: 커뮤니티, 이벤트, 크리에이터 도구', en: 'Loud products: communities, events, creator tools' },
    guide: `- 레이아웃: 포스터처럼 큰 블록을 쌓는다. 블록끼리 맞닿게 하고 여백 대신 굵은 테두리로 나눈다
- 형태: 3px 잉크색 테두리, 완전한 직각. 흐린 그림자 대신 4~6px 어긋난 단색 면(오프셋)
- 타이포: 아주 굵은 제목을 좌측 정렬로 폭에 꽉 채운다. 버튼과 라벨도 굵게
- 색: 흰색·검정·강조색 한 가지를 면 단위로 크게 쓴다
- 피할 것: 그라데이션, 둥근 모서리, 옅은 회색 글자`,
    tokens: tokens(['Black Han Sans', [400]], ['Gothic A1', [400, 700]],
      ['#FFFFFF', '#F4F4F4', '#111111', '#444444', '#111111', '#2F3BFF', '#111111'], [0, 0, 0],
      '블록이 옆에서 미끄러져 들어와 딱 멈춤', '굵은 대각선 줄무늬 띠 하나', { shadow: ['6px 6px 0 rgba(17,17,17,1)'] }),
    mini: (v) => wrap('padding:18px', `
      <div style="display:flex;border:3px solid var(--color-ink)">
        <span style="background:var(--color-accent);color:var(--color-bg);${D};font-size:17px;padding:8px 12px;border-right:3px solid var(--color-ink)">${v.name}</span>
        <span style="flex:1;background:repeating-linear-gradient(135deg,var(--color-ink) 0 6px,var(--color-bg) 6px 12px)"></span></div>
      <div style="border:3px solid var(--color-ink);border-top:0;padding:18px 16px 22px">
        <p style="${D};font-size:40px;line-height:1.02;margin:0">${v.first}</p></div>
      <div style="display:grid;grid-template-columns:1.3fr 1fr;border:3px solid var(--color-ink);border-top:0">
        <p style="font-size:13px;font-weight:700;line-height:1.5;margin:0;padding:14px;border-right:3px solid var(--color-ink)">${v.summary}</p>
        <div style="background:var(--color-surface);padding:14px;display:grid;place-items:center"><span style="display:block;background:var(--color-bg);border:3px solid var(--color-ink);box-shadow:5px 5px 0 var(--color-ink);padding:9px 16px;font-weight:700;font-size:15px">${v.cta} →</span></div>
      </div>`),
  },
  {
    id: 'neighborhood',
    name: { ko: '동네 손글씨', en: 'Neighborhood Hand' },
    genre: { ko: '핸드메이드 · 크래프트', en: 'Handmade · Craft' },
    theme: 'mid',
    feature: { ko: '따뜻한 종이 질감, 둥근 형태, 큰 사진', en: 'Warm paper texture, round shapes, big photos' },
    bestFor: { ko: '사람 냄새 나는 서비스: 동네 가게, 음식, 취미 모임', en: 'Human-scale products: local shops, food, hobby groups' },
    guide: `- 레이아웃: 사진(또는 사진 자리)이 주인공. 사진을 살짝 기울이거나 겹쳐 손으로 붙인 듯하게 둔다
- 형태: 크게 둥근 모서리, 불규칙하게 둥근 사진 틀, 손으로 그은 듯한 점선과 밑줄
- 타이포: 부드러운 바탕체 제목, 말하듯 쓴 짧은 문장
- 배경: 크래프트지 질감과 따뜻한 빛
- 피할 것: 차가운 회색, 날카로운 직각 표, 빽빽한 정보`,
    tokens: tokens(['Gowun Batang', [700]], ['Gowun Dodum', [400]],
      ['#EFE6D4', '#F8F1E3', '#3B2F23', '#6E5E4C', '#3B2F23', '#B5532A', '#D9CBB2'], [10, 18, 28],
      '사진이 살짝 기울어진 채 내려앉음', '크래프트지 질감 + 따뜻한 방사형 그라데이션'),
    mini: (v) => wrap('padding:22px;background:radial-gradient(circle at 12% 0,var(--color-surface),transparent 60%),var(--color-bg)', `
      <p style="${D};font-weight:700;font-size:17px;margin:0 0 14px">${v.name} <span style="display:inline-block;width:38px;border-bottom:2px dashed var(--color-accent);vertical-align:middle"></span></p>
      <div style="display:flex;gap:14px;align-items:flex-start">
        <div style="flex:none;width:150px;background:var(--color-surface);padding:8px 8px 26px;border-radius:6px;transform:rotate(-4deg);box-shadow:0 8px 0 var(--color-line)">
          <div style="height:120px;border-radius:46% 54% 50% 50%/55% 48% 52% 45%;background:linear-gradient(140deg,var(--color-accent),var(--color-line))"></div></div>
        <p style="${D};font-weight:700;font-size:29px;line-height:1.25;margin:6px 0 0">${v.first}</p></div>
      <p style="font-size:14px;line-height:1.7;color:var(--color-ink-muted);margin:22px 0 16px">${v.summary}</p>
      <span style="display:inline-block;padding:11px 22px;border-radius:999px;background:var(--color-accent);color:var(--color-surface);font-size:15px">${v.cta}</span>`),
  },
  {
    id: 'swiss',
    name: { ko: '스위스 그리드', en: 'Swiss Grid' },
    genre: { ko: '스위스 모더니즘', en: 'Swiss modernism' },
    theme: 'light',
    feature: { ko: '엄격한 12단 그리드, 굵은 숫자, 비대칭', en: 'Strict 12-col grid, bold numerals, asymmetry' },
    bestFor: { ko: '정보를 정돈해 보여주는 서비스: 포트폴리오, 문서, 예약·일정', en: 'Ordered information: portfolios, docs, booking and schedules' },
    guide: `- 레이아웃: 12단 그리드에 엄격히 맞춘 비대칭. 왼쪽 좁은 단에 번호·분류, 오른쪽 넓은 단에 내용
- 타이포: 한 가지 고딕으로 굵기 대비(900 대 400)만 쓴다. 좌측 정렬, 제목은 줄 간격을 좁게
- 형태: 직각. 그림자와 장식 테두리 없이 가는 선과 여백만으로 구분한다. 번호(01, 02)를 구조 표지로
- 색: 밝은 바탕과 검정에 빨강 한 점
- 피할 것: 가운데 정렬, 둥근 카드, 장식 아이콘`,
    tokens: tokens(['Gothic A1', [900]], ['Gothic A1', [400]],
      ['#F2F2EF', '#FFFFFF', '#141414', '#555555', '#141414', '#E3241B', '#CFCFCA'], [0, 0, 2],
      '그리드 선이 먼저 그려지고 내용이 채워짐', '희미한 12단 컬럼 가이드'),
    mini: (v) => wrap('padding:22px 20px;background:repeating-linear-gradient(90deg,transparent 0 29px,var(--color-line) 29px 30px),var(--color-bg)', `
      <div style="display:grid;grid-template-columns:60px 1fr;gap:0 0">
        <div><span style="display:block;width:26px;height:26px;background:var(--color-accent)"></span></div>
        <div style="background:var(--color-bg)"><p style="font-size:12px;font-weight:900;margin:0 0 44px;display:flex;justify-content:space-between"><span>${v.name}</span><span style="font-weight:400;color:var(--color-ink-muted)">01 / 04</span></p>
          <p style="${D};font-weight:900;font-size:33px;line-height:1.08;letter-spacing:-.02em;margin:0 0 20px">${v.first}</p></div>
        ${[['01', 82], ['02', 64], ['03', 74]].map(([n, w]) => `<span style="font-weight:900;font-size:13px;padding:11px 0;border-top:1px solid var(--color-ink)">${n}</span>
        <div style="padding:11px 0;border-top:1px solid var(--color-ink);background:var(--color-bg);display:grid;gap:6px">${bars([Number(w), Number(w) - 30], 'var(--color-ink-muted)', 5)}</div>`).join('')}
      </div>`),
  },
  {
    id: 'forest',
    name: { ko: '고요한 숲', en: 'Quiet Forest' },
    genre: { ko: '캄 미니멀', en: 'Calm minimal' },
    theme: 'mid',
    feature: { ko: '넓은 여백, 느린 페이드, 세이지 그라데이션', en: 'Wide margins, slow fades, sage gradient' },
    bestFor: { ko: '천천히 쓰는 서비스: 명상, 일기, 웰니스, 독서', en: 'Slow products: meditation, journaling, wellness, reading' },
    guide: `- 레이아웃: 한 화면에 한 가지 일만. 넓은 여백과 좁은 본문 폭, 가운데 한 줄기로 흐르게 둔다
- 타이포: 가는 명조 제목과 넉넉한 줄 간격. 글자 수를 줄인다
- 형태: 은은하게 둥근 모서리, 테두리 대신 톤 차이. 버튼은 채우지 않고 밑줄이나 가는 선으로
- 배경: 세이지 톤 두 겹 그라데이션, 느린 페이드
- 피할 것: 강한 대비의 색 면, 배지와 알림 점, 촘촘한 표`,
    tokens: tokens(['Nanum Myeongjo', [800]], ['IBM Plex Sans KR', [400]],
      ['#E4E8E1', '#EEF1EB', '#1F2A24', '#4F5C54', '#1F2A24', '#7A5C2E', '#C5CEC4'], [4, 8, 14],
      '느린 페이드 인 (600ms)', '세이지 색 두 겹 그라데이션', { space: 10 }),
    mini: (v) => wrap('padding:26px 44px;text-align:center;background:radial-gradient(ellipse at 50% 110%,var(--color-line),transparent 62%),linear-gradient(var(--color-surface),var(--color-bg))', `
      <p style="font-size:12px;letter-spacing:.3em;color:var(--color-ink-muted);margin:0 0 62px">${v.name}</p>
      <p style="${D};font-weight:800;font-size:28px;line-height:1.5;margin:0 0 20px">${v.first}</p>
      <span style="display:block;width:1px;height:38px;background:var(--color-ink-muted);margin:0 auto 20px"></span>
      <p style="font-size:13px;line-height:1.9;color:var(--color-ink-muted);margin:0 0 24px">${v.summary}</p>
      <span style="font-size:14px;color:var(--color-accent);border-bottom:1px solid var(--color-accent);padding-bottom:3px">${v.cta}</span>`),
  },
  {
    id: 'retro-pop',
    name: { ko: '레트로 팝', en: 'Retro Pop' },
    genre: { ko: '레트로 · 스티커', en: 'Retro · Sticker' },
    theme: 'color',
    feature: { ko: '굵은 윤곽선, 스티커 같은 요소, 기울임', en: 'Thick outlines, sticker elements, tilts' },
    bestFor: { ko: '발랄한 서비스: 퀴즈, 굿즈, 10~20대 대상 앱', en: 'Bouncy products: quizzes, merch, apps for teens and twenties' },
    guide: `- 레이아웃: 스티커를 붙인 듯 요소를 살짝 기울이고 겹친다. 큰 색 면 위에 알약 모양 라벨을 얹는다
- 형태: 2~3px 잉크색 윤곽선, 알약과 원. 흐리지 않은 단색 오프셋 그림자
- 타이포: 굵고 둥근 제목, 짧고 경쾌한 문구
- 배경: 물방울 도트 패턴
- 피할 것: 옅은 회색, 가는 선, 차분한 여백 위주 구성`,
    tokens: tokens(['Do Hyeon', [400]], ['Gothic A1', [500, 700]],
      ['#FFD84D', '#FFF3C4', '#1A1A1A', '#3D3A2E', '#1A1A1A', '#C8205A', '#1A1A1A'], [6, 14, 999],
      '스티커가 튕기듯 붙음', '물방울 도트 패턴', { shadow: ['4px 4px 0 rgba(26,26,26,1)'] }),
    mini: (v) => wrap('padding:20px;background:radial-gradient(var(--color-surface) 2.5px,transparent 3px) 0 0/22px 22px,var(--color-bg)', `
      <span style="display:inline-block;${D};font-size:17px;background:var(--color-surface);border:2.5px solid var(--color-ink);border-radius:999px;padding:5px 16px;transform:rotate(-3deg);box-shadow:3px 3px 0 var(--color-ink)">${v.name}</span>
      <p style="${D};font-size:40px;line-height:1.08;margin:20px 0 16px">${v.first}</p>
      <div style="background:var(--color-accent);color:var(--color-surface);border:2.5px solid var(--color-ink);border-radius:14px;padding:14px 16px;transform:rotate(1.5deg);box-shadow:5px 5px 0 var(--color-ink);font-size:14px;font-weight:700;line-height:1.5">${v.summary}</div>
      <span style="display:inline-block;margin-top:20px;background:var(--color-ink);color:var(--color-bg);border-radius:999px;padding:10px 22px;font-weight:700;font-size:15px">${v.cta}</span>
      <span style="position:absolute;right:26px;top:26px;width:44px;height:44px;border-radius:50%;background:var(--color-surface);border:2.5px solid var(--color-ink);transform:rotate(12deg);display:grid;place-items:center;font-weight:700;font-size:12px">NEW</span>`),
  },
  {
    id: 'lounge',
    name: { ko: '심야 라운지', en: 'Late Lounge' },
    genre: { ko: '다크 럭셔리', en: 'Dark luxury' },
    theme: 'dark',
    feature: { ko: '깊은 어둠 위 금빛 선, 세리프, 노이즈 질감', en: 'Gold hairlines on deep dark, serif, grain' },
    bestFor: { ko: '격식 있는 서비스: 바·레스토랑, 프리미엄 멤버십, 공연', en: 'Formal products: bars and dining, premium membership, shows' },
    guide: `- 레이아웃: 가운데 정렬의 좌우 대칭. 요소 수를 줄이고 하나씩 무대에 올리듯 배치한다
- 타이포: 세리프 제목과 자간 넓힌 작은 라벨
- 형태: 금빛 1px 선으로 테두리와 구분선을 긋는다. 채운 면은 거의 쓰지 않는다
- 배경: 깊은 어둠에 노이즈 질감, 아래쪽 은은한 금빛 광원
- 피할 것: 밝은 면, 여러 강조색, 굵은 테두리`,
    tokens: tokens(['Song Myung', [400]], ['Nanum Gothic', [400, 700]],
      ['#17131C', '#211B28', '#EDE6F2', '#A99DB5', '#EDE6F2', '#E8A54B', '#3A3142'], [2, 6, 12],
      '금빛 선이 천천히 그어짐', '노이즈 질감 + 아래쪽 은은한 금빛 광원'),
    mini: (v) => wrap('padding:16px;background:radial-gradient(ellipse at 50% 118%,var(--color-accent),transparent 46%),var(--color-bg)', `
      <div style="border:1px solid var(--color-accent);min-height:406px;box-sizing:border-box;padding:26px 22px;text-align:center">
        <p style="font-size:11px;letter-spacing:.38em;color:var(--color-accent);margin:0 0 40px">${v.name}</p>
        <p style="${D};font-size:31px;line-height:1.4;margin:0 0 18px">${v.first}</p>
        <span style="display:block;width:54px;height:1px;background:var(--color-accent);margin:0 auto 18px"></span>
        <p style="font-size:13px;line-height:1.8;color:var(--color-ink-muted);margin:0 0 24px">${v.summary}</p>
        <span style="display:inline-block;border:1px solid var(--color-accent);color:var(--color-accent);font-size:12px;letter-spacing:.22em;padding:10px 24px">${v.cta}</span></div>`),
  },
  {
    id: 'bento',
    name: { ko: '벤토 박스', en: 'Bento Box' },
    genre: { ko: '벤토 그리드', en: 'Bento grid' },
    theme: 'light',
    feature: { ko: '크기가 다른 둥근 타일을 한 판에 빈틈없이', en: 'Rounded tiles of mixed sizes packed into one board' },
    bestFor: { ko: '여러 기능을 한눈에 보여주는 서비스: 생산성 도구, 홈 대시보드, 소개 페이지', en: 'Many features at once: productivity tools, home dashboards, overview pages' },
    guide: `- 레이아웃: 도시락 칸. 크기가 다른 타일(큰 것 하나, 중간 둘, 작은 것 여럿)을 한 그리드에 빈틈없이 맞춘다. 타일 하나에 정보 하나
- 형태: 모든 타일이 같은 큰 반경과 같은 간격을 쓴다. 테두리와 그림자 없이 바탕과의 톤 차이로만 구분한다
- 타이포: 타일마다 짧은 라벨과 핵심 값 하나. 긴 문단은 넣지 않는다
- 색: 중립 바탕에 강조색 타일은 화면에 하나만
- 피할 것: 같은 크기 카드 3개 나란히, 타일 안에 또 카드, 타일마다 다른 반경`,
    tokens: tokens(['Nanum Gothic', [800]], ['Nanum Gothic', [400, 700]],
      ['#EDEBE6', '#FFFFFF', '#15171C', '#5A5F6B', '#15171C', '#0C7A5F', '#D9D6CF'], [10, 18, 26],
      '타일이 하나씩 제자리에서 커지며 채워짐', '단색 바탕. 타일 사이 간격이 곧 무늬', { shadow: [] }),
    mini: (v) => wrap('padding:14px', `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);grid-auto-rows:66px;gap:10px">
        <div style="grid-column:span 4;grid-row:span 2;background:var(--color-surface);border-radius:18px;padding:16px;display:flex;flex-direction:column;justify-content:space-between">
          <span style="font-size:12px;font-weight:700;color:var(--color-ink-muted)">${v.name}</span>
          <p style="${D};font-weight:800;font-size:27px;line-height:1.15;margin:0">${v.first}</p></div>
        <div style="grid-column:span 2;grid-row:span 2;background:var(--color-accent);color:var(--color-surface);border-radius:18px;padding:14px;display:flex;flex-direction:column;justify-content:space-between">
          <span style="width:26px;height:26px;border-radius:50%;border:2px solid var(--color-surface)"></span><span style="font-weight:700;font-size:15px">${v.cta} →</span></div>
        <div style="grid-column:span 2;background:var(--color-surface);border-radius:18px;padding:12px 14px;display:grid;gap:7px;align-content:center">${bars([80, 52], 'var(--color-line)', 7)}</div>
        <div style="background:var(--color-ink);border-radius:18px"></div>
        <div style="background:var(--color-line);border-radius:18px"></div>
        <div style="grid-column:span 4;background:var(--color-surface);border-radius:18px;padding:0 16px;display:flex;align-items:center;font-size:12px;color:var(--color-ink-muted);white-space:nowrap;overflow:hidden">${v.summary}</div>
      </div>`),
  },
  {
    id: 'clay',
    name: { ko: '말랑 클레이', en: 'Soft Clay' },
    genre: { ko: '클레이모피즘', en: 'Claymorphism' },
    theme: 'mid',
    feature: { ko: '부풀어 오른 파스텔 덩어리, 아주 둥근 버튼', en: 'Puffy pastel blobs, very round buttons' },
    bestFor: { ko: '다정한 서비스: 어린이·교육, 습관 만들기, 반려동물', en: 'Friendly products: kids and learning, habit building, pets' },
    guide: `- 레이아웃: 큼직하고 적은 요소. 엄지로 누르기 좋은 큰 버튼과 카드 두세 개만 둔다
- 형태: 아주 둥근 모서리와 부풀어 오른 입체감(아래쪽 단색 그림자 + 안쪽 위의 밝은 하이라이트). 원, 알약, 물방울
- 타이포: 둥근 글자체 제목, 짧고 다정한 말투
- 색: 토큰 색의 투명도를 조절한 파스텔 면 여러 톤. 강조색은 주 버튼에
- 피할 것: 가는 선, 직각, 촘촘한 표, 어두운 면`,
    tokens: tokens(['Jua', [400]], ['Gowun Dodum', [400]],
      ['#FDE7DC', '#FFF6F0', '#3A2A4A', '#6A587A', '#3A2A4A', '#3565D8', '#F1CDBE'], [16, 24, 36],
      '버튼이 말랑하게 눌렸다가 튀어 오름', '아주 연한 색 덩어리 두세 개가 겹친 바탕', { shadow: ['0 10px 0 rgba(58,42,74,.12)'] }),
    mini: (v) => wrap('padding:22px;background:radial-gradient(circle at 92% 6%,var(--color-line) 0 90px,transparent 91px),radial-gradient(circle at -4% 92%,var(--color-surface) 0 120px,transparent 121px),var(--color-bg)', `
      <p style="${D};font-size:18px;margin:0 0 16px">${v.name}</p>
      <div style="background:var(--color-surface);border-radius:32px;padding:22px 20px;box-shadow:0 12px 0 var(--color-line),inset 0 6px 0 rgba(255,255,255,.9)">
        <p style="${D};font-size:30px;line-height:1.2;margin:0 0 10px">${v.first}</p>
        <p style="font-size:14px;line-height:1.6;color:var(--color-ink-muted);margin:0">${v.summary}</p></div>
      <div style="display:flex;gap:12px;align-items:center;margin-top:30px">
        <span style="${D};font-size:18px;background:var(--color-accent);color:var(--color-surface);border-radius:999px;padding:14px 30px;box-shadow:0 8px 0 var(--color-ink),inset 0 4px 0 rgba(255,255,255,.3)">${v.cta}</span>
        <span style="width:52px;height:52px;border-radius:50%;background:var(--color-line);box-shadow:0 8px 0 var(--color-ink-muted),inset 0 5px 0 rgba(255,255,255,.5)"></span>
        <span style="width:52px;height:52px;border-radius:42% 58% 55% 45%;background:var(--color-surface);box-shadow:0 8px 0 var(--color-line)"></span></div>`),
  },
  {
    id: 'blueprint',
    name: { ko: '청사진', en: 'Blueprint' },
    genre: { ko: '테크니컬 드로잉', en: 'Technical drawing' },
    theme: 'color',
    feature: { ko: '푸른 바탕에 흰 선, 치수선, 고정폭 글자', en: 'White linework on blue, dimension lines, monospace' },
    bestFor: { ko: '만들고 재는 서비스: 개발자 도구, 인테리어·건축, 제조·견적', en: 'Build-and-measure products: developer tools, interiors, manufacturing quotes' },
    guide: `- 레이아웃: 설계 도면. 영역마다 도면 번호(A-01)와 제목 칸을 붙이고, 치수선과 보조선으로 요소 사이 관계를 표시한다
- 형태: 면을 채우지 않고 1px 실선·점선 윤곽만 쓴다. 모서리에 십자 표식
- 타이포: 전부 고정폭 글자. 라벨은 작게, 수치는 단위와 함께 같은 크기로
- 배경: 가는 모눈. 강조색(노랑)은 선택된 항목 하나에만
- 피할 것: 채워진 카드, 그림자, 사진, 둥근 모서리`,
    tokens: tokens(['Nanum Gothic Coding', [700]], ['Nanum Gothic Coding', [400, 700]],
      ['#1B4B9B', '#235AAE', '#F2F6FF', '#CBDAF5', '#F2F6FF', '#FFD23F', '#5E86CC'], [0, 0, 2],
      '치수선이 왼쪽에서 오른쪽으로 그어지고 수치가 찍힘', '가는 모눈 + 모서리 십자 표식', { mono: 'Nanum Gothic Coding', shadow: [] }),
    mini: (v) => wrap('padding:18px;background:linear-gradient(var(--color-surface) 1px,transparent 1px) 0 0/100% 20px,linear-gradient(90deg,var(--color-surface) 1px,transparent 1px) 0 0/20px 100%,var(--color-bg)', `
      <div style="display:flex;justify-content:space-between;font-size:11px;letter-spacing:.1em;color:var(--color-ink-muted)"><span>+ ${v.name}</span><span>DWG A-01 · 1:50 +</span></div>
      <div style="border:1px solid var(--color-ink);margin-top:14px;padding:18px 16px;position:relative">
        <p style="${D};font-weight:700;font-size:28px;line-height:1.25;margin:0">${v.first}</p>
        <span style="position:absolute;left:-1px;right:-1px;bottom:-17px;border-top:1px solid var(--color-line);height:6px;border-left:1px solid var(--color-line);border-right:1px solid var(--color-line)"></span></div>
      <p style="text-align:center;font-size:11px;color:var(--color-ink-muted);margin:20px 0 14px">← 364 px →</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="border:1px dashed var(--color-ink-muted);padding:12px;font-size:12px;line-height:1.6;color:var(--color-ink-muted)">${v.summary}</div>
        <div style="border:1px solid var(--color-accent);color:var(--color-accent);padding:12px;display:flex;flex-direction:column;justify-content:space-between;font-size:12px"><span>B-02 ✓</span><span style="font-weight:700;font-size:15px">${v.cta} →</span></div>
      </div>`),
  },
  {
    id: 'hanji',
    name: { ko: '먹과 한지', en: 'Ink & Hanji' },
    genre: { ko: '동양 수묵', en: 'East Asian ink' },
    theme: 'mid',
    feature: { ko: '세로쓰기 제목, 여백, 붓글씨와 쪽빛 낙관', en: 'Vertical titles, empty space, brush lettering, an indigo seal' },
    bestFor: { ko: '전통과 차분함이 어울리는 서비스: 차·공예, 숙소, 전시·문화', en: 'Tradition and stillness: tea and craft, stays, exhibitions' },
    guide: `- 레이아웃: 여백을 그림의 일부로 쓴다. 제목을 세로쓰기(writing-mode: vertical-rl)로 한쪽에 세우고 본문은 반대편에 낮게 둔다
- 타이포: 붓글씨풍 제목은 화면에 한 곳만, 나머지는 명조
- 형태: 직각과 가는 먹선. 낙관(도장) 같은 작은 사각형에만 강조색을 쓴다
- 배경: 한지 섬유 질감과 옅은 먹 번짐
- 피할 것: 둥근 버튼, 여러 색, 아이콘 나열, 꽉 찬 화면`,
    tokens: tokens(['Yeon Sung', [400]], ['Noto Serif KR', [400, 600]],
      ['#DCD5C3', '#E8E2D3', '#191816', '#4A463D', '#191816', '#1D3F7A', '#B9B19D'], [0, 2, 4],
      '먹선이 붓으로 긋듯 번지며 나타남', '한지 섬유 질감 + 한쪽 구석의 옅은 먹 번짐', { space: 10, shadow: [] }),
    mini: (v) => wrap('padding:24px;background:radial-gradient(ellipse at 0 100%,var(--color-line),transparent 55%),var(--color-bg)', `
      <div style="display:flex;justify-content:space-between;gap:20px;height:262px">
        <div style="display:flex;flex-direction:column;justify-content:flex-end;gap:14px;max-width:190px">
          <span style="width:64px;height:3px;background:var(--color-ink);border-radius:60% 40% 70% 30%"></span>
          <p style="font-size:13px;line-height:1.9;color:var(--color-ink-muted);margin:0">${v.summary}</p>
          <span style="font-size:14px;border-bottom:1px solid var(--color-ink);align-self:flex-start;padding-bottom:3px">${v.cta}</span></div>
        <div style="display:flex;gap:12px;align-items:flex-start">
          <p style="${D};font-size:27px;line-height:1.35;margin:0;writing-mode:vertical-rl;max-height:262px">${v.first}</p>
          <div style="display:flex;flex-direction:column;align-items:center;gap:10px"><p style="font-size:12px;letter-spacing:.3em;margin:0;writing-mode:vertical-rl;color:var(--color-ink-muted)">${v.name}</p>
            <span style="width:30px;height:30px;background:var(--color-accent);color:var(--color-surface);${D};font-size:17px;display:grid;place-items:center">印</span></div></div>
      </div>`),
  },
  {
    id: 'notebook',
    name: { ko: '모눈 공책', en: 'Graph Notebook' },
    genre: { ko: '손그림 · 스케치', en: 'Hand-drawn · Sketch' },
    theme: 'light',
    feature: { ko: '모눈종이, 형광펜 밑줄, 빨간 펜, 포스트잇', en: 'Graph paper, highlighter, red pen, sticky notes' },
    bestFor: { ko: '적고 정리하는 서비스: 메모·할 일, 공부, 가계부', en: 'Note-and-organise products: to-dos, study, household budgets' },
    guide: `- 레이아웃: 공책에 손으로 정리한 듯 구성한다. 체크리스트, 화살표, 여백 메모, 살짝 기울어진 포스트잇
- 형태: 손으로 그은 듯 조금 삐뚤한 테두리(불규칙한 border-radius)와 점선
- 타이포: 손글씨 제목과 또박또박한 본문. 중요한 말은 형광펜 밑줄(surface 색)로 표시한다
- 배경: 연한 모눈. 빨간 펜(강조색)은 교정 표시처럼 한두 곳에만
- 피할 것: 정밀한 그리드, 그림자, 완벽한 원, 굵은 색 면`,
    tokens: tokens(['Gaegu', [700]], ['Gowun Dodum', [400]],
      ['#FBFBF6', '#FFF1A1', '#262A33', '#575D6B', '#262A33', '#D5382B', '#C9D8EC'], [3, 6, 10],
      '형광펜이 밑줄을 긋듯 왼쪽에서 오른쪽으로 지나감', '연한 파란 모눈', { shadow: [] }),
    mini: (v) => wrap('padding:22px 22px 22px 40px;background:linear-gradient(var(--color-line) 1px,transparent 1px) 0 0/100% 22px,linear-gradient(90deg,var(--color-line) 1px,transparent 1px) 0 0/22px 100%,var(--color-bg)', `
      <span style="position:absolute;left:26px;top:0;bottom:0;border-left:1.5px solid var(--color-accent)"></span>
      <p style="${D};font-weight:700;font-size:19px;margin:0 0 12px">${v.name} <span style="color:var(--color-accent)">✓</span></p>
      <p style="${D};font-weight:700;font-size:37px;line-height:1.2;margin:0 0 16px"><span style="background:linear-gradient(transparent 58%,var(--color-surface) 58%)">${v.first}</span></p>
      <div style="display:grid;gap:11px;font-size:14px">
        ${[[1, 70], [0, 54], [0, 62]].map(([on, w]) => `<div style="display:flex;gap:10px;align-items:center"><span style="width:16px;height:16px;border:1.5px solid var(--color-ink);border-radius:3px 5px 2px 6px;${on ? 'background:var(--color-ink)' : ''}"></span><span style="height:7px;width:${w}%;background:var(--color-ink-muted);border-radius:4px;opacity:${on ? 0.4 : 0.75}"></span></div>`).join('')}</div>
      <div style="position:absolute;right:20px;bottom:26px;width:150px;background:var(--color-surface);padding:12px;transform:rotate(3deg);${D};font-size:15px;line-height:1.35;border-radius:2px 2px 14px 2px">${v.summary.slice(0, 34)}</div>`),
  },
  {
    id: 'arcade',
    name: { ko: '네온 오락실', en: 'Neon Arcade' },
    genre: { ko: '사이버펑크 · 레트로 퓨처', en: 'Cyberpunk · Retro-future' },
    theme: 'dark',
    feature: { ko: '짙은 보랏빛 밤, 발광하는 네온 선, 원근 격자', en: 'Deep violet night, glowing neon lines, a perspective grid' },
    bestFor: { ko: '몰입과 승부가 있는 서비스: 게임, 음악, 랭킹·챌린지', en: 'Immersive, competitive products: games, music, rankings and challenges' },
    guide: `- 레이아웃: 게임 시작 화면. 가운데에 제목과 시작 버튼 하나, 아래에는 점수판 같은 목록
- 형태: 네온관처럼 빛나는 1~2px 윤곽선(box-shadow/text-shadow에 강조색). 채운 면은 주 버튼 하나뿐
- 타이포: 각진 디스플레이 글자, 자간 넓힌 작은 라벨
- 배경: 아래쪽 원근 격자 바닥과 가는 주사선
- 피할 것: 밝은 면, 파스텔, 사진, 둥글둥글한 형태`,
    tokens: tokens(['Gugi', [400]], ['Orbit', [400]],
      ['#140B2E', '#1F1245', '#F4EEFF', '#B7A8DE', '#F4EEFF', '#FF3DA5', '#3C2A75'], [2, 4, 8],
      '전원이 켜지듯 네온이 두어 번 깜빡이며 들어옴', '아래쪽 원근 격자 바닥 + 가는 주사선', { shadow: ['0 0 18px rgba(255,61,165,.55)'] }),
    mini: (v) => wrap('padding:22px;text-align:center;background:repeating-linear-gradient(transparent 0 3px,var(--color-surface) 3px 4px),var(--color-bg)', `
      <div style="position:absolute;left:-60%;right:-60%;bottom:-40px;height:190px;transform:perspective(220px) rotateX(62deg);background:linear-gradient(var(--color-accent) 1.5px,transparent 1.5px) 0 0/100% 26px,linear-gradient(90deg,var(--color-accent) 1.5px,transparent 1.5px) 0 0/26px 100%;opacity:.55"></div>
      <p style="font-size:11px;letter-spacing:.4em;color:var(--color-ink-muted);margin:0 0 30px">${v.name} · 1P</p>
      <p style="${D};font-size:34px;line-height:1.25;margin:0 0 14px;text-shadow:0 0 14px var(--color-accent),0 0 2px var(--color-accent)">${v.first}</p>
      <p style="font-size:13px;line-height:1.7;color:var(--color-ink-muted);margin:0 0 22px">${v.summary}</p>
      <span style="position:relative;display:inline-block;background:var(--color-accent);color:var(--color-bg);${D};font-size:16px;padding:10px 26px;border-radius:4px;box-shadow:0 0 22px var(--color-accent)">▶ ${v.cta}</span>
      <div style="position:relative;margin:22px auto 0;width:210px;border:1px solid var(--color-accent);box-shadow:0 0 10px var(--color-accent);padding:8px 12px;display:flex;justify-content:space-between;font-size:12px;background:var(--color-bg)"><span>RANK 01</span><span style="color:var(--color-accent)">★ ★ ★</span></div>`),
  },
  {
    id: 'riso',
    name: { ko: '리소 인쇄', en: 'Riso Print' },
    genre: { ko: '리소그래프 · 프린트', en: 'Risograph · Print' },
    theme: 'light',
    feature: { ko: '두 가지 잉크의 겹침, 망점, 통통한 글자', en: 'Two inks overprinting, halftone dots, chunky letters' },
    bestFor: { ko: '취향이 뚜렷한 서비스: 독립 출판, 전시·페스티벌, 굿즈 상점', en: 'Strong-taste products: indie publishing, festivals, merch shops' },
    guide: `- 레이아웃: 인쇄 포스터. 큰 도형(원, 반원, 띠) 두세 개를 겹치고 그 위에 글자를 얹는다
- 형태: 테두리 없이 잉크 면만 쓴다. 두 잉크(ink, accent)가 겹치는 곳은 mix-blend-mode: multiply로 진하게
- 타이포: 통통한 제목. 글자도 검정이 아니라 잉크색(ink)으로 찍는다
- 배경: 망점(하프톤)과 종이 결. 인쇄가 살짝 어긋난 듯한 1~2px 오프셋
- 피할 것: 검정, 세 번째 색, 그림자, 매끈한 그라데이션`,
    tokens: tokens(['Bagel Fat One', [400]], ['Gothic A1', [400, 700]],
      ['#F3F0E8', '#E7E3D8', '#1B2F8F', '#4455A6', '#1B2F8F', '#D8341F', '#C9C4B6'], [0, 4, 999],
      '두 잉크 층이 살짝 어긋나 있다가 제자리에 겹쳐짐', '망점(하프톤) 질감 + 종이 결', { shadow: [] }),
    mini: (v) => wrap('padding:22px;background:radial-gradient(var(--color-line) 1.2px,transparent 1.5px) 0 0/9px 9px,var(--color-bg)', `
      <span style="position:absolute;right:-56px;top:-70px;width:220px;height:220px;border-radius:50%;background:var(--color-accent);mix-blend-mode:multiply"></span>
      <span style="position:absolute;right:84px;top:34px;width:130px;height:130px;border-radius:50%;background:var(--color-ink);opacity:.9;mix-blend-mode:multiply"></span>
      <span style="position:absolute;left:0;right:0;bottom:64px;height:26px;background:var(--color-accent);mix-blend-mode:multiply"></span>
      <p style="position:relative;font-weight:700;font-size:13px;letter-spacing:.06em;margin:0 0 150px">${v.name} — No.1</p>
      <p style="position:relative;${D};font-size:38px;line-height:1.12;margin:0 0 12px;text-shadow:2px 2px 0 var(--color-accent)">${v.first}</p>
      <p style="position:relative;font-size:13px;font-weight:700;line-height:1.6;margin:0;max-width:250px">${v.summary}</p>`),
  },
];

/** A preset as a pickable direction, with its mini preview filled with the project's own name and copy. */
export function presetAsDirection(p: StylePreset, lang: 'ko' | 'en', v: MiniVars): Direction {
  return {
    name: p.name[lang],
    mood: p.feature[lang],
    rationale: p.bestFor[lang],
    guide: p.guide,
    tokens: structuredClone(p.tokens),
    miniPreviewHtml: p.mini({ name: esc(v.name), first: esc(v.first), summary: esc(v.summary), cta: esc(v.cta) }),
  };
}
