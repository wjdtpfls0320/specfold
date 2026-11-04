// 완성 데모: 샘플 1(마감빵)을 끝까지 진행한 프로젝트. API 키 없이 동작 (기획서 §5-1b)
import type { Direction, Project, ProjectSpec, Screen } from '../lib/types';
import { SAMPLES } from './samples';
import { buildMarkdown } from '../lib/exportMd';

const T0 = Date.UTC(2026, 10, 2, 9, 0);

const MOTION = `<style>
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.rise>*{animation:rise .5s cubic-bezier(.2,.7,.1,1) both}
.rise>*:nth-child(2){animation-delay:.06s}.rise>*:nth-child(3){animation-delay:.12s}.rise>*:nth-child(4){animation-delay:.18s}.rise>*:nth-child(n+5){animation-delay:.24s}
@media (prefers-reduced-motion:reduce){.rise>*{animation:none}}
.paper{background-image:radial-gradient(circle at 20% 0%,color-mix(in srgb,var(--color-accent) 10%,transparent),transparent 45%),url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.8'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
</style>`;

const icon = {
  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z"/></svg>',
  heart: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/></svg>',
  heartFill: '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.6"><path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z"/></svg>',
  me: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/></svg>',
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M15 5l-7 7 7 7"/></svg>',
  clock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  pin: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  check: '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 12.5l5 5L20 6.5"/></svg>',
};

const tabbar = (active: 'home' | 'favorites' | 'mypage') => `
<nav data-dw-id="${active}-tabbar" class="fixed bottom-0 inset-x-0 h-[72px] border-t border-[var(--color-line)] bg-[var(--color-surface)] grid grid-cols-3 text-[12px]">
  ${[['home', '홈', icon.home], ['favorites', '찜', icon.heart], ['mypage', '마이', icon.me]]
    .map(([id, label, ic]) => `<a data-dw-id="${active}-tab-${id}" data-nav="${id}" class="flex flex-col items-center justify-center gap-1 ${id === active ? 'text-[var(--color-ink)] font-bold' : 'text-[var(--color-ink-muted)]'}">${ic}<span>${label}</span></a>`)
    .join('')}
</nav>`;

const SHOPS = [
  { id: 'milsalt', name: '밀과 소금', hood: '망원동', close: '21:00', left: '38분', dist: '320m', off: 50, x: 34, y: 42 },
  { id: 'todaybread', name: '오늘의 식빵', hood: '연남동', close: '20:30', left: '8분', dist: '650m', off: 50, x: 68, y: 26 },
  { id: 'bnb', name: '브레드 앤 버터', hood: '성산동', close: '21:30', left: '1시간 8분', dist: '1.1km', off: 40, x: 58, y: 70 },
];

const home = `${MOTION}
<main data-dw-id="home-root" class="paper min-h-screen pb-24 bg-[var(--color-bg)] text-[var(--color-ink)]">
  <header data-dw-id="home-header" class="px-5 pt-6 pb-3 flex items-end justify-between">
    <div>
      <p data-dw-id="home-location" class="text-[13px] text-[var(--color-ink-muted)] flex items-center gap-1">${icon.pin} 망원동 · 지금 20:22</p>
      <h1 data-dw-id="home-title" class="font-display text-[34px] leading-[1.05] font-bold mt-1">오늘 남은 빵,<br>닫기 전에 데려가요</h1>
    </div>
  </header>
  <section data-dw-id="home-map" class="relative mx-5 h-[196px] border border-[var(--color-ink)] rounded-[var(--radius-lg)] overflow-hidden bg-[var(--color-surface)]">
    <svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" stroke="var(--color-line)" stroke-width=".8">
      <path d="M0 55 C30 50 45 62 100 48"/><path d="M0 20 L100 34"/><path d="M22 0 L30 100"/><path d="M70 0 C62 40 80 60 74 100"/><path d="M0 85 L100 78"/>
    </svg>
    ${SHOPS.map((s, i) => `<a data-dw-id="home-map-pin-${s.id}" data-nav="store" class="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center" style="left:${s.x}%;top:${s.y}%">
      <span class="px-2 py-[3px] text-[12px] font-bold rounded-[var(--radius-sm)] ${i === 1 ? 'bg-[var(--color-accent)] text-[var(--color-surface)]' : 'bg-[var(--color-ink)] text-[var(--color-surface)]'}">${s.left}</span>
      <span class="w-[2px] h-2 bg-[var(--color-ink)]"></span></a>`).join('')}
    <span data-dw-id="home-map-me" class="absolute left-[46%] top-[52%] w-3 h-3 rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-ink)]"></span>
  </section>
  <div data-dw-id="home-filters" class="px-5 mt-4 flex gap-2 text-[13px] overflow-x-auto">
    <button data-dw-id="home-filter-soon" class="px-3 h-8 rounded-full bg-[var(--color-ink)] text-[var(--color-surface)] font-bold whitespace-nowrap">마감 임박순</button>
    <button data-dw-id="home-filter-near" class="px-3 h-8 rounded-full border border-[var(--color-ink)] whitespace-nowrap">500m 안</button>
    <button data-dw-id="home-filter-off" class="px-3 h-8 rounded-full border border-[var(--color-ink)] whitespace-nowrap">50% 이상</button>
  </div>
  <ol data-dw-id="home-list" class="rise mt-4 px-5">
    ${[SHOPS[1], SHOPS[0], SHOPS[2]].map((s, i) => `<li data-dw-id="home-shop-${s.id}" class="border-t border-[var(--color-line)] py-4">
      <a data-nav="store" data-dw-id="home-shop-${s.id}-link" class="grid grid-cols-[88px_1fr] gap-4 items-start">
        <div class="text-right">
          <p data-dw-id="home-shop-${s.id}-left" class="font-display font-bold leading-none ${i === 0 ? 'text-[30px] text-[var(--color-accent)]' : 'text-[24px]'}">${s.left}</p>
          <p class="text-[11px] text-[var(--color-ink-muted)] mt-1">${s.close} 마감</p>
        </div>
        <div>
          <p data-dw-id="home-shop-${s.id}-name" class="text-[17px] font-bold">${s.name} <span class="text-[13px] font-normal text-[var(--color-ink-muted)]">${s.hood}</span></p>
          <p class="text-[13px] text-[var(--color-ink-muted)] mt-1">${s.dist} · 남은 빵 ${[11, 6, 9][i]}개 · 최대 ${s.off}%</p>
        </div>
      </a></li>`).join('')}
  </ol>
  ${tabbar('home')}
</main>`;

const BREADS = [
  { id: 'milk', name: '우유 식빵', was: '4,800', now: '2,400', left: 3 },
  { id: 'salt', name: '소금빵', was: '3,200', now: '1,600', left: 7 },
  { id: 'fig', name: '무화과 캄파뉴', was: '7,500', now: '3,800', left: 1 },
];

const store = `${MOTION}
<main data-dw-id="store-root" class="paper min-h-screen pb-28 bg-[var(--color-bg)] text-[var(--color-ink)]">
  <div data-dw-id="store-hero" class="relative h-[250px] overflow-hidden">
    <img data-dw-id="store-photo" src="https://picsum.photos/seed/sourdough-loaf/780/500" alt="" class="w-full h-full object-cover">
    <a data-dw-id="store-back" data-nav="home" class="absolute top-4 left-4 w-10 h-10 grid place-items-center rounded-full bg-[var(--color-surface)]">${icon.back}</a>
    <button data-dw-id="store-fav" data-nav="favorites" class="absolute top-4 right-4 w-10 h-10 grid place-items-center rounded-full bg-[var(--color-surface)] text-[var(--color-accent)]">${icon.heartFill}</button>
  </div>
  <section data-dw-id="store-head" class="px-5 -mt-10 relative">
    <div class="bg-[var(--color-surface)] border border-[var(--color-ink)] rounded-[var(--radius-lg)] p-5">
      <p data-dw-id="store-hood" class="text-[13px] text-[var(--color-ink-muted)]">망원동 · 320m</p>
      <h1 data-dw-id="store-name" class="font-display text-[30px] font-bold leading-tight">밀과 소금</h1>
      <p data-dw-id="store-pickup" class="mt-3 flex items-center gap-2 text-[14px]">${icon.clock}<span>픽업 <b>20:30 – 21:00</b></span><span class="ml-auto font-display text-[22px] font-bold text-[var(--color-accent)]">38분 남음</span></p>
    </div>
  </section>
  <h2 data-dw-id="store-list-title" class="px-5 mt-7 mb-2 text-[13px] tracking-[.12em] text-[var(--color-ink-muted)]">오늘 남은 빵</h2>
  <ul data-dw-id="store-breads" class="rise px-5">
    ${BREADS.map((b) => `<li data-dw-id="store-bread-${b.id}" class="flex items-center gap-3 py-4 border-t border-[var(--color-line)]">
      <div class="flex-1">
        <p data-dw-id="store-bread-${b.id}-name" class="text-[17px] font-bold">${b.name}</p>
        <p class="text-[13px] text-[var(--color-ink-muted)]"><s>${b.was}원</s> · ${b.left === 1 ? '<b class="text-[var(--color-accent)]">마지막 1개</b>' : `${b.left}개 남음`}</p>
      </div>
      <p data-dw-id="store-bread-${b.id}-price" class="font-display text-[22px] font-bold">${b.now}<span class="text-[14px]">원</span></p>
      <button data-dw-id="store-bread-${b.id}-add" class="w-9 h-9 rounded-full border border-[var(--color-ink)] text-[20px] leading-none">+</button>
    </li>`).join('')}
  </ul>
  <blockquote data-dw-id="store-review" class="mx-5 mt-6 pl-4 border-l-2 border-[var(--color-accent)] font-display text-[17px] leading-relaxed">“퇴근길에 들르기 딱 좋아요. 소금빵이 아직 따뜻했어요”</blockquote>
  <div data-dw-id="store-cta-bar" class="fixed bottom-0 inset-x-0 p-4 bg-[var(--color-surface)] border-t border-[var(--color-line)]">
    <a data-dw-id="store-cta" data-nav="checkout" class="flex items-center justify-between h-14 px-5 rounded-[var(--radius-md)] bg-[var(--color-ink)] text-[var(--color-surface)] font-bold"><span>2개 담음 · 4,000원</span><span>예약하기 →</span></a>
  </div>
</main>`;

const checkout = `${MOTION}
<main data-dw-id="checkout-root" class="paper min-h-screen pb-28 bg-[var(--color-bg)] text-[var(--color-ink)]">
  <header data-dw-id="checkout-header" class="flex items-center gap-2 px-4 h-14 border-b border-[var(--color-line)]">
    <a data-dw-id="checkout-back" data-nav="store" class="w-10 h-10 grid place-items-center">${icon.back}</a>
    <h1 data-dw-id="checkout-title" class="font-display text-[20px] font-bold">예약 확인</h1>
  </header>
  <section data-dw-id="checkout-bag" class="rise px-5 pt-5">
    <p class="text-[13px] text-[var(--color-ink-muted)]">밀과 소금 · 망원동</p>
    <div class="flex justify-between py-3 border-b border-[var(--color-line)]"><span>소금빵 × 1</span><span>1,600원</span></div>
    <div class="flex justify-between py-3 border-b border-[var(--color-line)]"><span>우유 식빵 × 1</span><span>2,400원</span></div>
    <div data-dw-id="checkout-total" class="flex justify-between items-baseline pt-4"><span class="font-bold">합계</span><span class="font-display text-[30px] font-bold">4,000원</span></div>
    <p data-dw-id="checkout-saved" class="text-right text-[13px] text-[var(--color-accent)] font-bold">정가보다 4,000원 아꼈어요</p>
  </section>
  <section data-dw-id="checkout-time" class="px-5 mt-7">
    <h2 class="text-[13px] tracking-[.12em] text-[var(--color-ink-muted)] mb-3">픽업 시간</h2>
    <div class="grid grid-cols-3 gap-2 text-[14px]">
      <button data-dw-id="checkout-time-1" class="h-12 border border-[var(--color-line)] rounded-[var(--radius-sm)]">20:30</button>
      <button data-dw-id="checkout-time-2" class="h-12 border-2 border-[var(--color-ink)] rounded-[var(--radius-sm)] font-bold">20:45</button>
      <button data-dw-id="checkout-time-3" class="h-12 border border-[var(--color-line)] rounded-[var(--radius-sm)]">21:00</button>
    </div>
  </section>
  <section data-dw-id="checkout-pay" class="px-5 mt-7">
    <h2 class="text-[13px] tracking-[.12em] text-[var(--color-ink-muted)] mb-3">결제 수단</h2>
    <label class="flex items-center gap-3 py-3 border-t border-[var(--color-line)]"><span class="w-4 h-4 rounded-full border-4 border-[var(--color-ink)]"></span>등록된 카드 (국민 ····1024)</label>
    <label class="flex items-center gap-3 py-3 border-t border-b border-[var(--color-line)]"><span class="w-4 h-4 rounded-full border border-[var(--color-ink)]"></span>가게에서 현장 결제</label>
  </section>
  <div class="fixed bottom-0 inset-x-0 p-4 bg-[var(--color-surface)] border-t border-[var(--color-line)]">
    <a data-dw-id="checkout-cta" data-nav="done" class="flex items-center justify-center h-14 rounded-[var(--radius-md)] bg-[var(--color-accent)] text-[var(--color-surface)] font-bold">4,000원 예약하기</a>
  </div>
</main>`;

const done = `${MOTION}
<main data-dw-id="done-root" class="paper min-h-screen bg-[var(--color-bg)] text-[var(--color-ink)] px-6 pt-20">
  <div class="rise">
    <span data-dw-id="done-icon" class="w-16 h-16 grid place-items-center rounded-full border-2 border-[var(--color-ink)]">${icon.check}</span>
    <h1 data-dw-id="done-title" class="font-display text-[38px] font-bold leading-[1.05] mt-6">20:45에<br>밀과 소금에서 만나요</h1>
    <p data-dw-id="done-desc" class="mt-4 text-[15px] text-[var(--color-ink-muted)]">픽업 30분 전에 알림을 보내드릴게요. 가게에 예약 번호를 말해 주세요.</p>
    <p data-dw-id="done-code" class="mt-8 font-display text-[56px] font-bold tracking-[.08em] text-[var(--color-accent)]">A-17</p>
    <div class="mt-10 grid gap-3">
      <a data-dw-id="done-mypage" data-nav="mypage" class="h-14 flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-ink)] text-[var(--color-surface)] font-bold">예약 내역 보기</a>
      <a data-dw-id="done-home" data-nav="home" class="h-14 flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-ink)]">다른 가게 더 보기</a>
    </div>
  </div>
</main>`;

const mypage = `${MOTION}
<main data-dw-id="mypage-root" class="paper min-h-screen pb-24 bg-[var(--color-bg)] text-[var(--color-ink)]">
  <header data-dw-id="mypage-header" class="px-5 pt-8">
    <p class="text-[13px] text-[var(--color-ink-muted)]">이번 달 아낀 금액</p>
    <p data-dw-id="mypage-saved" class="font-display text-[56px] font-bold leading-none mt-1">23,600<span class="text-[22px]">원</span></p>
    <p data-dw-id="mypage-saved-sub" class="text-[13px] mt-2">빵 <b>14개</b>를 버려지지 않게 했어요</p>
  </header>
  <section data-dw-id="mypage-upcoming" class="mx-5 mt-7 p-4 border-2 border-[var(--color-accent)] rounded-[var(--radius-lg)]">
    <p class="text-[12px] font-bold text-[var(--color-accent)]">픽업 예정</p>
    <p class="font-bold text-[17px] mt-1">밀과 소금 · 20:45</p>
    <p class="text-[13px] text-[var(--color-ink-muted)]">소금빵, 우유 식빵 · 예약번호 A-17</p>
  </section>
  <h2 class="px-5 mt-8 mb-2 text-[13px] tracking-[.12em] text-[var(--color-ink-muted)]">지난 예약</h2>
  <ul data-dw-id="mypage-history" class="rise px-5 text-[14px]">
    <li class="flex justify-between py-3 border-t border-[var(--color-line)]"><span>오늘의 식빵 · 우유 식빵 2</span><span class="text-[var(--color-ink-muted)]">10.29</span></li>
    <li class="flex justify-between py-3 border-t border-[var(--color-line)]"><span>브레드 앤 버터 · 무화과 캄파뉴</span><span class="text-[var(--color-ink-muted)]">10.24</span></li>
    <li class="flex justify-between py-3 border-t border-b border-[var(--color-line)]"><span>밀과 소금 · 소금빵 4</span><span class="text-[var(--color-ink-muted)]">10.21</span></li>
  </ul>
  <a data-dw-id="mypage-favs" data-nav="favorites" class="mx-5 mt-6 flex justify-between items-center h-12 px-4 border border-[var(--color-ink)] rounded-[var(--radius-md)]"><span>단골 가게 3곳</span><span>→</span></a>
  ${tabbar('mypage')}
</main>`;

const favorites = `${MOTION}
<main data-dw-id="favorites-root" class="paper min-h-screen pb-24 bg-[var(--color-bg)] text-[var(--color-ink)]">
  <header data-dw-id="favorites-header" class="px-5 pt-8 pb-4">
    <h1 data-dw-id="favorites-title" class="font-display text-[34px] font-bold">찜한 가게</h1>
    <p data-dw-id="favorites-desc" class="text-[13px] text-[var(--color-ink-muted)] mt-1">마감 할인이 시작되면 알려드려요</p>
  </header>
  <ul data-dw-id="favorites-list" class="rise px-5">
    ${SHOPS.map((s, i) => `<li data-dw-id="favorites-${s.id}" class="grid grid-cols-[64px_1fr_auto] gap-4 items-center py-4 border-t border-[var(--color-line)]">
      <img src="https://picsum.photos/seed/bakery-${s.id}/128/128" alt="" class="w-16 h-16 object-cover rounded-[var(--radius-md)]">
      <a data-nav="store" data-dw-id="favorites-${s.id}-link"><p class="font-bold text-[16px]">${s.name}</p><p class="text-[13px] text-[var(--color-ink-muted)]">${s.hood} · ${s.close} 마감</p></a>
      <span data-dw-id="favorites-${s.id}-state" class="text-[12px] font-bold ${i === 1 ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink-muted)]'}">${i === 1 ? '지금 할인 중' : '할인 전'}</span>
    </li>`).join('')}
  </ul>
  ${tabbar('favorites')}
</main>`;

const SCREEN_HTML: Record<string, string> = { home, store, checkout, done, mypage, favorites };

const spec: ProjectSpec = {
  summary: '동네 빵집이 문 닫기 전 남은 빵을 할인가로 미리 예약하고 가게에서 받아 가는 앱',
  audience: '퇴근길 20~30대 직장인',
  context: '지하철에서 한 손으로 보고, 집 가는 길에 들러서 픽업',
  platform: 'mobile',
  moodKeywords: ['갓 구운 빵 냄새', '동네 단골집', '손글씨 칠판 메뉴판'],
  avoidKeywords: ['배달앱 같은 빨강', '쿠폰 전단지', 'IT 회사 느낌'],
  screens: [
    { id: 'home', name: '홈', purpose: '내 주변 마감 임박 가게 찾기', elements: ['지도', '마감 임박 목록', '거리·할인율 필터'], priority: '마감까지 남은 시간', navTo: ['store', 'favorites', 'mypage'] },
    { id: 'store', name: '가게 상세', purpose: '남은 빵 확인하고 담기', elements: ['가게 사진', '남은 빵 목록', '픽업 가능 시간', '찜 버튼'], priority: '할인가와 남은 개수', navTo: ['home', 'checkout', 'favorites'] },
    { id: 'checkout', name: '예약 확인', purpose: '담은 빵 확인, 픽업 시간·결제 선택', elements: ['담은 빵', '합계', '픽업 시간', '결제 수단'], priority: '합계와 픽업 시간', navTo: ['store', 'done'] },
    { id: 'done', name: '예약 완료', purpose: '예약 번호와 픽업 안내', elements: ['예약 번호', '픽업 시간', '알림 안내'], priority: '픽업 시간과 예약 번호', navTo: ['mypage', 'home'], inferred: true },
    { id: 'mypage', name: '마이페이지', purpose: '예약 내역과 아낀 금액', elements: ['아낀 금액', '픽업 예정', '지난 예약', '단골 가게'], priority: '이번 달 아낀 금액', navTo: ['favorites', 'home'] },
    { id: 'favorites', name: '찜한 가게', purpose: '단골 가게 모아 보고 할인 시작 알림 받기', elements: ['찜한 가게 목록', '할인 상태'], priority: '지금 할인 중인 가게', navTo: ['store', 'home', 'mypage'] },
  ],
  features: [
    { id: 'nearby', name: '마감 임박 가게 찾기', description: '위치 기반으로 곧 문 닫는 가게를 남은 시간순으로', screens: ['home'] },
    { id: 'reserve', name: '예약·결제', description: '빵 담기, 픽업 시간 선택, 결제', screens: ['store', 'checkout', 'done'] },
    { id: 'remind', name: '픽업 알림', description: '픽업 30분 전 알림', screens: ['done'] },
    { id: 'favorite', name: '찜하기', description: '가게를 찜하고 마감 할인이 시작되면 알림', screens: ['store', 'favorites'] },
  ],
  contentSamples: ['밀과 소금(망원동, 21:00 마감)', '소금빵 3,200원 → 1,600원 (7개 남음)', '"퇴근길에 들르기 딱 좋아요"'],
};

const directions: Direction[] = [
  {
    name: '밀가루 칠판',
    mood: '크래프트지 위에 손글씨 가격표를 붙인 동네 빵집 진열대',
    rationale: '퇴근길에 빠르게 훑어봐야 하니 남은 시간 숫자를 가장 크게 두고, 나머지는 종이 질감과 둥근 바탕체로 따뜻하게 감쌌어요. 배달앱의 빨강 대신 빵 껍질 같은 구운 주황을 강조색으로 썼어요.',
    fontRationale: '고운바탕은 손으로 쓴 메뉴판처럼 획 끝이 부드러워서 "동네 단골집" 느낌을 줘요.',
    colorRationale: '밀가루색 바탕 + 탄 크러스트 주황 한 가지. 마감 임박 표시에만 써서 눈이 바로 가요.',
    layoutIdea: '왼쪽에 남은 시간을 큰 숫자로, 오른쪽에 가게 정보를 두는 2단 목록. 카드 대신 가는 구분선.',
    signatureMotion: '목록이 아래에서 차례로 떠오름',
    backgroundTreatment: '크래프트지 노이즈 + 왼쪽 위 따뜻한 빛',
    tokens: {
      color: { bg: '#F1E9DA', surface: '#FBF6EC', ink: '#2B2118', inkMuted: '#6B5B4A', primary: '#2B2118', accent: '#B8431A', line: '#DDCDB4' },
      font: { display: { family: 'Gowun Batang', weights: [700] }, body: { family: 'Gowun Dodum', weights: [400] } },
      scale: [12, 13, 15, 17, 22, 30, 38, 56], space: 8, radius: { sm: 6, md: 14, lg: 22 }, shadow: [],
      motion: { signature: '목록이 아래에서 차례로 떠오름 (60ms 간격)' }, background: { treatment: '크래프트지 노이즈 + 왼쪽 위 따뜻한 방사형 빛' },
    },
  },
  {
    name: '새벽 오븐 계기판',
    mood: '불 꺼진 빵집 주방의 오븐 타이머처럼 숫자만 빛나는 화면',
    rationale: '밤에 지하철에서 보는 앱이라 어두운 화면이 눈이 편해요. 남은 시간을 오븐 타이머처럼 모노 숫자로 보여줘서 "곧 끝난다"는 긴장감을 줘요.',
    fontRationale: 'IBM Plex Mono 숫자는 폭이 일정해 시간이 바뀌어도 흔들리지 않아요.',
    colorRationale: '거의 검은 갈색 + 오븐 불빛 같은 호박색 강조.',
    layoutIdea: '상단 절반을 큰 카운트다운이 차지하고, 아래는 촘촘한 표 형태 목록.',
    tokens: {
      color: { bg: '#1A1512', surface: '#241D18', ink: '#F2E8DC', inkMuted: '#B3A595', primary: '#F2E8DC', accent: '#F2B33D', line: '#3A3029' },
      font: { display: { family: 'IBM Plex Sans KR', weights: [700] }, body: { family: 'IBM Plex Sans KR', weights: [400] }, mono: { family: 'IBM Plex Mono', weights: [500] } },
      scale: [12, 13, 15, 17, 22, 32, 48, 64], space: 8, radius: { sm: 2, md: 4, lg: 6 }, shadow: [],
      motion: { signature: '카운트다운 숫자가 1초마다 넘어감' }, background: { treatment: '아래쪽에서 올라오는 은은한 오븐 불빛 그라데이션' },
    },
  },
  {
    name: '동네 전단 스위스',
    mood: '잘 정리된 동네 게시판 전단처럼 굵은 고딕과 엄격한 줄맞춤',
    rationale: '정보를 빠르게 비교하기 좋게 굵은 고딕과 그리드로 정돈했어요. 강조색은 녹색으로 "할인 중"을 신호등처럼 표시해요.',
    fontRationale: 'Gothic A1 900은 전단 제목처럼 멀리서도 읽혀요.',
    colorRationale: '종이 흰색 + 먹색 + 짙은 녹색 하나.',
    layoutIdea: '12단 그리드 위에 가게별 큰 번호, 할인율을 거대한 숫자로.',
    tokens: {
      color: { bg: '#F4F1EA', surface: '#FFFFFF', ink: '#111111', inkMuted: '#555049', primary: '#111111', accent: '#1E5B3A', line: '#CFCAC0' },
      font: { display: { family: 'Gothic A1', weights: [900] }, body: { family: 'Gothic A1', weights: [400, 700] } },
      scale: [12, 14, 16, 20, 28, 44, 72], space: 8, radius: { sm: 0, md: 0, lg: 2 }, shadow: [],
      motion: { signature: '그리드 선이 먼저 그려지고 내용이 채워짐' }, background: { treatment: '희미한 12단 컬럼 가이드' },
    },
  },
];

export function loadDemo(lang: 'ko' | 'en'): Project {
  const names: Record<string, string> = { home: '홈', store: '가게 상세', checkout: '예약 확인', done: '예약 완료', mypage: '마이페이지', favorites: '찜한 가게' };
  const notes: Record<string, string> = {
    home: '- 남은 시간을 왼쪽 큰 숫자로: 기획서의 "가장 중요한 것"이라 가장 먼저 읽히게\n- 카드 대신 가는 구분선: 종이 메뉴판 느낌, 카드 남용 방지\n- 가장 임박한 가게만 강조색: 강조색은 한 곳에만',
    store: '- 할인가를 바탕체 큰 숫자로, 원가는 취소선으로 작게\n- "마지막 1개"만 강조색으로 표시해 긴급함 전달',
    checkout: '- 아낀 금액을 합계 바로 아래 강조색으로: 이 앱을 쓰는 이유를 다시 확인',
    done: '- 예약 번호를 56px로: 가게 앞에서 화면을 보여주는 상황 고려',
    mypage: '- 아낀 금액을 가장 큰 숫자로: 재방문 동기',
    favorites: '- 디자인 작업 중 추가된 화면. 할인 상태를 오른쪽 끝에 짧게',
  };
  const screens: Screen[] = Object.keys(SCREEN_HTML).map((id, i) => ({ id, name: names[id], html: SCREEN_HTML[id], status: 'done', notes: notes[id], updatedAt: T0 + i * 60000 }));
  const p: Project = {
    id: 'demo',
    name: lang === 'ko' ? '마감빵 (데모)' : 'Last Loaf (demo — Korean content)',
    createdAt: T0,
    updatedAt: T0 + 3600000,
    step: 'studio',
    readonly: true,
    contentLang: 'ko',
    specRaw: SAMPLES[0].text.ko,
    attachments: [],
    answers: {},
    spec,
    directions,
    tokens: structuredClone(directions[0].tokens),
    direction: { source: 'ai', name: directions[0].name, rationale: directions[0].rationale + ' ' + directions[0].fontRationale },
    screens,
    changeLog: [
      { id: 'c1', at: T0 + 600000, request: '홈 목록에서 마감까지 남은 시간을 더 크게, 가장 급한 가게만 강조색으로', scope: 'element', screenIds: ['home'], specImpact: { type: 'none', summary: '' }, note: '가장 임박한 가게의 남은 시간만 30px 강조색으로 키우고, 나머지는 24px 먹색으로 두었어요.' },
      { id: 'c2', at: T0 + 1200000, request: '찜하기 기능 추가해줘. 가게 상세에 하트 버튼, 찜한 가게 모아 보는 화면도', scope: 'global', screenIds: ['store', 'favorites'], specImpact: { type: 'feature_add', summary: '찜하기 기능 추가: 가게 상세 하트 버튼, 찜한 가게 화면 신설, 할인 시작 알림' }, note: '가게 상세 오른쪽 위에 하트 버튼을 넣고, 탭바에 "찜"을 추가했어요.' },
      { id: 'c3', at: T0 + 1500000, request: '탭바에 찜 탭 추가', scope: 'global', screenIds: ['home', 'mypage', 'favorites'], specImpact: { type: 'flow_change', summary: '하단 탭바: 홈 / 찜 / 마이' } },
      { id: 'c4', at: T0 + 1800000, request: '가게 이름 옆에 동네 이름 같이 보여줘', scope: 'screen', screenIds: ['home'], specImpact: { type: 'content_change', summary: '가게 목록에 동네 이름 표시' } },
      { id: 'c5', at: T0 + 2100000, request: '강조색: accent', scope: 'tokens', screenIds: [], specImpact: { type: 'none', summary: '' }, note: '#C2491D → #B8431A (대비 4.5:1 이상 확보)' },
      { id: 'c6', at: T0 + 2400000, request: '마이페이지에 이번 달 아낀 금액을 가장 크게', scope: 'screen', screenIds: ['mypage'], specImpact: { type: 'screen_change', summary: '마이페이지 최상단에 이번 달 아낀 금액' } },
    ],
    snapshots: [],
  };
  p.snapshots.push({ id: 'snap1', name: '찜하기 추가 전', at: T0 + 1100000, screens: structuredClone(screens.filter((s) => s.id !== 'favorites')), tokens: structuredClone(p.tokens) });
  p.exportedMd = buildMarkdown(p, p.changeLog.map((c) => c.id));
  return p;
}
