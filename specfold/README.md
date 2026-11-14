# Specfold · 스펙폴드

기획서를 펼치면 화면이 되고, 접으면 다시 기획서가 돼요.
간단한 기획서 → 스타일 프리셋 20개 중 디자인 방향 선택 → 클릭 가능한 여러 화면 시안 → 수정 → 변경을 반영한 기획서(.md).

**서버가 없어요.** API 키와 기획서는 브라우저(IndexedDB/세션 저장소)에만 저장되고, AI 요청은 브라우저에서 공급자(Claude · OpenAI · Gemini · OpenRouter · 로컬 OpenAI 호환)로 바로 가요.

## 실행

```bash
npm install
npm run dev     # http://localhost:5178
npm run build   # dist/ 정적 파일 → Cloudflare Pages / Vercel
```

API 키 없이도 홈의 **완성 데모 둘러보기**로 전체 흐름(기획서 → 방향 선택 → 화면 6개 → 변경 로그 → 내보낸 기획서)을 볼 수 있어요.

## 구조

| 경로 | 내용 |
|---|---|
| `src/lib/prompts.ts` | 프롬프트 팩 P1~P7 (`../design-prompts.md`와 동일) |
| `src/lib/llm/providers.ts` | 5개 공급자 스트리밍 어댑터, 모델 등급 |
| `src/lib/ai.ts` | 단계별 AI 호출, JSON 재시도 |
| `src/lib/presets.ts` | 스타일 프리셋 20개 (토큰 + 스타일 지침 + 미리보기) |
| `src/lib/lint.ts` | 품질 검사 10개 규칙 |
| `src/lib/preview.ts` | 샌드박스 미리보기 문서 + 브리지 스크립트 (선택/프로토타입 모드) |
| `src/lib/edits.ts` | `data-dw-id` 기준 찾아 바꾸기, 조정 패널 직접 수정 |
| `src/lib/exportMd.ts` | AI 없이 기획서 v2 구조 조립 |
| `src/data/` | 샘플 기획서 3개(한·영), 완성 데모 |
| `src/i18n/` | `ko.json`, `en.json` |

## 보안 메모

- 생성된 HTML은 `sandbox="allow-scripts"` iframe(동일 출처 권한 없음)에서만 실행되고, CSP로 Tailwind CDN · Google Fonts · picsum만 허용해요.
- 키 저장 기본값은 "이번 세션만"이에요.
- Claude는 브라우저 호출에 `anthropic-dangerous-direct-browser-access` 헤더를 써요. Ollama는 `OLLAMA_ORIGINS=*`가 필요해요.

MIT License
