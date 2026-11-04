import type { Project } from './types';
import { navLinks } from './preview';

const L = {
  ko: {
    title: '기획서 v2', sub: '원본 기획서 + 디자인 작업 반영본', overview: '서비스 개요', users: '사용자와 사용 상황', screens: '화면 구성',
    purpose: '목적', elements: '구성 요소', nav: '이동 경로', memo: '디자인 메모', features: '기능 명세', flow: '화면 흐름',
    system: '디자인 시스템', direction: '디자인 방향', color: '색 토큰', font: '폰트', scale: '글자 크기 단계', space: '간격', radius: '둥글기',
    motion: '움직임', bgt: '배경', history: '변경 이력', open: '남은 질문', none: '없음', token: '토큰', value: '값',
    q: ['목록이 비어 있을 때(검색 결과 없음 등) 무엇을 보여줄까요?', '네트워크 오류·로딩 중 상태는 어떻게 표시할까요?', '로그인 전과 후에 달라지는 화면이 있나요?'],
  },
  en: {
    title: 'Spec v2', sub: 'Original spec + design work applied', overview: 'Overview', users: 'Users and context', screens: 'Screens',
    purpose: 'Purpose', elements: 'Elements', nav: 'Navigates to', memo: 'Design memo', features: 'Features', flow: 'Screen flow',
    system: 'Design system', direction: 'Direction', color: 'Color tokens', font: 'Fonts', scale: 'Type scale', space: 'Spacing', radius: 'Radius',
    motion: 'Motion', bgt: 'Background', history: 'Change history', open: 'Open questions', none: 'none', token: 'Token', value: 'Value',
    q: ['What should an empty list (no results) show?', 'How are network errors and loading states shown?', 'Does anything change before vs. after sign-in?'],
  },
};

/** AI-free export: assembles §11 structure from spec + tokens + selected change log. */
export function buildMarkdown(p: Project, selected: string[]): string {
  const t = L[p.contentLang];
  const s = p.spec;
  const name = (p.specRaw.match(/^#\s+(.+)$/m)?.[1] || p.name).trim();
  const changes = p.changeLog.filter((c) => selected.includes(c.id));
  const addedScreens = new Set(changes.filter((c) => c.specImpact.type === 'screen_add' || c.specImpact.type === 'feature_add').flatMap((c) => c.screenIds));
  const out: string[] = [];
  out.push(`# ${name} ${t.title}`, `> ${t.sub} · ${new Date().toISOString().slice(0, 10)}`, '');
  out.push(`## 1. ${t.overview}`, s?.summary || '', '');
  out.push(`## 2. ${t.users}`, s?.audience || '', s?.context || '', '');
  out.push(`## 3. ${t.screens}`);
  (s?.screens ?? []).forEach((sc, i) => {
    const real = p.screens.find((x) => x.id === sc.id);
    const nav = real?.html ? navLinks(real.html) : sc.navTo;
    const mark = addedScreens.has(sc.id) || sc.inferred ? ' 🆕' : '';
    out.push(`### 3-${i + 1}. ${sc.name}${mark}`);
    out.push(`- ${t.purpose}: ${sc.purpose}`);
    out.push(`- ${t.elements}: ${sc.elements.join(', ')}`);
    out.push(`- ${t.nav}: ${nav.join(', ') || t.none}`);
    if (real?.notes) out.push(`- ${t.memo}: ${real.notes.replace(/\s*\n\s*/g, ' ').slice(0, 300)}`);
    out.push('');
  });
  out.push(`## 4. ${t.features}`);
  (s?.features ?? []).forEach((f) => {
    const isNew = changes.some((c) => c.specImpact.type === 'feature_add' && c.specImpact.summary.includes(f.name));
    out.push(`- **${f.name}**${isNew ? ' 🆕' : ''} — ${f.description}`);
  });
  changes
    .filter((c) => c.specImpact.type.startsWith('feature'))
    .forEach((c) => out.push(`- ${c.specImpact.type === 'feature_add' ? '🆕' : '✏️'} ${c.specImpact.summary}`));
  out.push('', `## 5. ${t.flow}`, '```mermaid', 'flowchart LR');
  p.screens.forEach((sc) => {
    out.push(`  ${sc.id.replace(/-/g, '_')}["${sc.name}"]`);
    const links = sc.html ? navLinks(sc.html) : (s?.screens.find((x) => x.id === sc.id)?.navTo ?? []);
    links.filter((l) => l !== sc.id).forEach((l) => out.push(`  ${sc.id.replace(/-/g, '_')} --> ${l.replace(/-/g, '_')}`));
  });
  out.push('```', '');
  if (p.tokens) {
    const tk = p.tokens;
    out.push(`## 6. ${t.system}`);
    if (p.direction) out.push(`**${t.direction}: ${p.direction.name}** — ${p.direction.rationale}`, '');
    out.push(`### ${t.color}`, `| ${t.token} | ${t.value} |`, '|---|---|');
    Object.entries(tk.color).forEach(([k, v]) => typeof v === 'string' && out.push(`| ${k} | \`${v}\` |`));
    out.push('', `- ${t.font}: ${tk.font.display.family} (display) / ${tk.font.body.family} (body)${tk.font.mono ? ` / ${tk.font.mono.family} (mono)` : ''}`);
    out.push(`- ${t.scale}: ${tk.scale.join(' / ')} px`, `- ${t.space}: ${tk.space}px`, `- ${t.radius}: ${tk.radius.sm} / ${tk.radius.md} / ${tk.radius.lg}px`);
    out.push(`- ${t.motion}: ${tk.motion.signature}`, `- ${t.bgt}: ${tk.background.treatment}`, '');
  }
  out.push(`## 7. ${t.history}`);
  if (!changes.length) out.push(`- ${t.none}`);
  changes.forEach((c) => out.push(`- ${new Date(c.at).toISOString().slice(0, 10)} · ${c.specImpact.type === 'none' ? '' : `**${c.specImpact.summary}** — `}"${c.request}"`));
  out.push('', `## 8. ${t.open}`, ...t.q.map((q) => `- ${q}`), '');
  return out.join('\n');
}
