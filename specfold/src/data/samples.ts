// 샘플 기획서 3개 × 언어별 (번역이 아니라 각 언어 사용자에게 자연스러운 내용, 기획서 §5-1b)
export interface Sample {
  id: string;
  title: { ko: string; en: string };
  shows: { ko: string; en: string };
  text: { ko: string; en: string };
}

export const SAMPLES: Sample[] = [
  {
    id: 'bakery',
    title: { ko: '동네 빵집 마감 할인 예약', en: 'Closing-time bakery deals' },
    shows: { ko: '모바일 앱 · 따뜻한 분위기, 지도·목록 화면', en: 'Mobile app · warm mood, map & list' },
    text: {
      ko: `# 마감빵
한 줄 소개: 동네 빵집이 문 닫기 전 남은 빵을 할인가로 미리 예약하고 가게에서 받아 가는 앱
사용자: 퇴근길 20~30대 직장인. 지하철에서 한 손으로 보고, 집 가는 길에 들러서 픽업
플랫폼: 모바일 앱

## 분위기
- 이런 느낌: 갓 구운 빵 냄새 나는, 동네 단골집 같은, 손글씨 칠판 메뉴판 느낌
- 이런 느낌은 싫음: 배달앱 같은 빨간 느낌, 쿠폰 전단지처럼 시끄러운 것, 너무 IT 회사 같은 것
- 참고: 동네 빵집 인스타그램 계정들 — 큰 빵 사진과 손글씨 가격표가 좋음

## 화면
### 1. 홈
- 들어갈 것: 내 주변 지도, 마감 임박 가게 목록, 거리·할인율 필터
- 가장 중요한 것: 마감까지 남은 시간이 한눈에 보이는 것
- 이동: 가게 카드 → 가게 상세

### 2. 가게 상세
- 들어갈 것: 가게 사진, 오늘 남은 빵 목록(원가·할인가·남은 개수), 픽업 가능 시간
- 가장 중요한 것: 할인가와 남은 개수
- 이동: 빵 담기 → 예약 확인

### 3. 예약 확인
- 들어갈 것: 담은 빵, 합계, 픽업 시간 선택, 결제 수단
- 이동: 예약하기 → 예약 완료

### 4. 마이페이지
- 들어갈 것: 예약 내역, 지금까지 아낀 금액, 단골 가게

## 기능
- 위치 기반 마감 임박 가게 찾기
- 빵 예약과 결제, 픽업 시간 선택
- 픽업 30분 전 알림

## 실제 콘텐츠 예시
- 가게: 밀과 소금(망원동, 21:00 마감), 오늘의 식빵(연남동, 20:30 마감), 브레드 앤 버터(성산동, 21:30 마감)
- 빵: 우유 식빵 4,800원 → 2,400원 (3개 남음), 소금빵 3,200원 → 1,600원 (7개 남음), 무화과 캄파뉴 7,500원 → 3,800원 (1개 남음)
- 리뷰: "퇴근길에 들르기 딱 좋아요. 소금빵이 아직 따뜻했어요"

## 상태 화면
- 주변에 마감 할인 가게가 없을 때, 위치 권한이 없을 때`,
      en: `# Last Loaf
One-liner: An app for reserving a neighborhood bakery's leftover bread at a discount before it closes, then picking it up in store
Users: Commuters in their 20s–30s, browsing one-handed on the train home, stopping by on the way
Platform: mobile app

## Mood
- Feels like: flour-dusted, corner-shop familiar, chalkboard-menu handwriting
- Does NOT feel like: a food-delivery app (no aggressive red), a coupon flyer, a tech startup
- References: small bakeries on Instagram — big close-up bread photos and handwritten price tags

## Screens
### 1. Home
- Contains: map of nearby bakeries, list of shops closing soon, distance & discount filters
- Most important: how much time is left before each shop closes
- Goes to: shop card → Shop detail

### 2. Shop detail
- Contains: shop photo, today's leftover bread (original price, deal price, how many left), pickup window
- Most important: deal price and quantity left
- Goes to: add bread → Checkout

### 3. Checkout
- Contains: bag, total, pickup time picker, payment method
- Goes to: reserve → Confirmation

### 4. My page
- Contains: past reservations, money saved so far, favorite shops

## Features
- Find bakeries closing soon near me
- Reserve and pay, choose a pickup time
- Reminder 30 minutes before pickup

## Real content examples
- Shops: Flour & Salt (Mission, closes 9:00pm), Morning Crumb (Noe Valley, closes 8:30pm), Butter Hours (Bernal, closes 9:30pm)
- Bread: Country sourdough $9.00 → $4.50 (3 left), Salted butter roll $3.75 → $1.80 (7 left), Fig & walnut loaf $11.00 → $5.50 (1 left)
- Review: "Perfect on the way home — the rolls were still warm."

## States
- No discounted bakeries nearby, location permission denied`,
    },
  },
  {
    id: 'workout',
    title: { ko: '개인 운동 기록 대시보드', en: 'Personal training log dashboard' },
    shows: { ko: '데스크톱 웹 · 어두운 테마, 정보가 촘촘한 화면', en: 'Desktop web · dark theme, dense data' },
    text: {
      ko: `# 세트로그
한 줄 소개: 웨이트 트레이닝 기록을 세트 단위로 쌓고, 중량·볼륨 변화를 한눈에 보는 개인 대시보드
사용자: 주 3~5회 헬스장에 다니는 중급자. 운동 후 집에서 노트북으로 기록을 정리하고 다음 루틴을 계획
플랫폼: 데스크톱 웹

## 분위기
- 이런 느낌: 계기판 같은, 숫자가 주인공인, 밤에 봐도 눈이 편한
- 이런 느낌은 싫음: 다이어트 앱 같은 파스텔, 동기부여 문구 가득한 것, 형광 초록 남발
- 참고: 증권 거래 화면 — 촘촘하지만 정돈된 숫자 배열

## 화면
### 1. 대시보드
- 들어갈 것: 이번 주 총 볼륨, 운동 부위별 분포, 3대 운동 1RM 추이 그래프, 최근 운동 5개
- 가장 중요한 것: 1RM 추이 (늘고 있는지)
- 이동: 최근 운동 → 운동 상세, 기록하기 → 운동 기록

### 2. 운동 기록
- 들어갈 것: 종목 검색, 세트 표(중량·횟수·RPE), 휴식 타이머, 지난번 같은 종목 기록
- 가장 중요한 것: 지난번 기록과 비교
- 이동: 저장 → 대시보드

### 3. 운동 상세
- 들어갈 것: 날짜별 세트 기록, 종목별 볼륨, 메모

### 4. 루틴 계획
- 들어갈 것: 요일별 루틴, 종목 드래그로 배치

## 기능
- 세트 단위 기록, 1RM 자동 계산(Epley 공식)
- 부위별 주간 볼륨 집계
- 지난 기록 불러오기

## 실제 콘텐츠 예시
- 스쿼트 100kg × 5 × 3세트 (RPE 8), 벤치프레스 72.5kg × 6, 데드리프트 140kg × 3
- 이번 주 볼륨 18,420kg (지난주 대비 +6%)
- 메모: "왼쪽 무릎 살짝 불편 — 다음 주 스쿼트 깊이 체크"

## 우선순위
- 숫자 비교가 가장 중요. 장식보다 데이터 밀도`,
      en: `# Setlog
One-liner: A personal dashboard that logs strength training set by set and shows how weight and volume change over time
Users: Intermediate lifters training 3–5×/week who review their log on a laptop at home and plan the next session
Platform: desktop web

## Mood
- Feels like: an instrument panel, numbers as the hero, easy on the eyes at night
- Does NOT feel like: pastel diet apps, motivational-quote overload, neon green everywhere
- References: trading terminals — dense but orderly columns of numbers

## Screens
### 1. Dashboard
- Contains: weekly total volume, split by muscle group, 1RM trend for the big three, last 5 sessions
- Most important: 1RM trend (am I getting stronger?)
- Goes to: a session → Session detail, Log workout → Logger

### 2. Logger
- Contains: exercise search, set table (weight · reps · RPE), rest timer, last time's numbers for the same lift
- Most important: comparison with last time
- Goes to: save → Dashboard

### 3. Session detail
- Contains: sets by date, volume per exercise, notes

### 4. Program planner
- Contains: routine per weekday, drag exercises into days

## Features
- Per-set logging, automatic 1RM (Epley)
- Weekly volume by muscle group
- Pull previous numbers

## Real content examples
- Squat 225 lb × 5 × 3 (RPE 8), Bench 160 lb × 6, Deadlift 315 lb × 3
- Weekly volume 40,600 lb (+6% vs last week)
- Note: "Left knee a bit cranky — check squat depth next week"

## Priority
- Comparing numbers matters most. Data density over decoration`,
    },
  },
  {
    id: 'press',
    title: { ko: '독립 출판사 소개 사이트', en: 'Independent press website' },
    shows: { ko: '반응형 웹 · 에디토리얼 레이아웃, 큰 타이포', en: 'Responsive web · editorial layout, big type' },
    text: {
      ko: `# 느린서재
한 줄 소개: 1년에 네 권만 내는 작은 독립 출판사의 책과 작가를 소개하는 사이트
사용자: 30~40대 책 좋아하는 사람. 서점에서 책을 보고 출판사가 궁금해서 들어옴. 주말에 여유롭게 둘러봄
플랫폼: 반응형 웹 (모바일·데스크톱 둘 다)

## 분위기
- 이런 느낌: 문예지 같은, 활자가 큼직한, 종이 냄새 나는 여백
- 이런 느낌은 싫음: 온라인 서점 같은 상품 나열, 할인 배너, 둥근 카드 그리드
- 참고: 오래된 문예지 표지 — 큰 제목 활자와 넓은 여백

## 화면
### 1. 홈
- 들어갈 것: 이번 계절 신간 한 권을 크게, 출판사 소개 한 문단, 지난 책 목록
- 가장 중요한 것: 신간 제목과 첫 문장
- 이동: 책 → 책 상세, 작가 이름 → 작가 소개

### 2. 책 상세
- 들어갈 것: 표지, 제목·작가·쪽수·가격, 책 속 한 문장, 편집자의 말, 구매처 링크
- 이동: 작가 → 작가 소개

### 3. 작가 소개
- 들어갈 것: 작가 사진, 약력, 이 출판사에서 낸 책

### 4. 소식
- 들어갈 것: 북토크·낭독회 일정 목록

## 실제 콘텐츠 예시
- 신간: 『겨울 정원의 문법』 김서하 지음, 212쪽, 16,000원
- 첫 문장: "정원은 겨울에야 비로소 자기 뼈대를 보여 준다."
- 소식: 11월 23일(토) 오후 3시 성수동 책방에서 낭독회

## 상태 화면
- 품절된 책 표시`,
      en: `# Slow Shelf Press
One-liner: A site for a tiny independent press that publishes just four books a year — showing the books and the writers behind them
Users: Readers in their 30s–40s who saw one of our books in a shop and got curious; they browse slowly on weekends
Platform: responsive web (mobile and desktop)

## Mood
- Feels like: a literary quarterly, generous type, the quiet margins of a printed page
- Does NOT feel like: an online bookstore product grid, sale banners, rounded card layouts
- References: old literary-magazine covers — huge title type and wide margins

## Screens
### 1. Home
- Contains: this season's new book, very large; one paragraph about the press; backlist
- Most important: the new book's title and first line
- Goes to: a book → Book page, an author name → Author page

### 2. Book page
- Contains: cover, title · author · pages · price, a line from the book, editor's note, where to buy
- Goes to: author → Author page

### 3. Author page
- Contains: portrait, bio, books published with us

### 4. News
- Contains: list of readings and book talks

## Real content examples
- New book: *A Grammar of Winter Gardens* by Hana Seo, 212 pages, $22
- First line: "A garden shows you its bones only in winter."
- News: Reading at Green Apple Books, Sat Nov 23, 3pm

## States
- Out-of-print / sold-out books`,
    },
  },
];
