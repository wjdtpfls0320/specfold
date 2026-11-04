import { streamChat, type LLMMessage, type LLMPart } from './llm/providers';
import * as P from './prompts';
import type { ChangeEntry, CheckResult, DesignTokens, Direction, Lang, LintViolation, Project, ProjectSpec, ProviderSettings, SpecScreen } from './types';
import { cleanScreenHtml, extractJson, extractTag } from './util';
import { normalizeTokens } from './tokens';
import { getUsage } from './db';
import { summarizeScreen } from './preview';

export interface Ctx {
  settings: ProviderSettings;
  uiLang: Lang;
  signal?: AbortSignal;
  onToken?: (chunk: string, full: string) => void;
}

const vars = (p: Project, ctx: Ctx) => ({ contentLanguage: P.LANG_NAME[p.contentLang], uiLanguage: P.LANG_NAME[ctx.uiLang] });
const designSystem = (p: Project, ctx: Ctx, extra: string) => P.fill(P.PRINCIPLES + '\n\n' + extra, vars(p, ctx));

function attachmentsText(p: Project) {
  return p.attachments.filter((a) => a.kind === 'text').map((a) => `## ${a.name}\n${(a.text ?? '').slice(0, 20000)}`).join('\n\n') || '(없음)';
}
function images(p: Project): LLMPart[] {
  return p.attachments.filter((a) => a.kind === 'image' && a.dataUrl).slice(0, 4).map((a) => ({ type: 'image', dataUrl: a.dataUrl }));
}
function userMsg(text: string, imgs: LLMPart[] = []): LLMMessage {
  return { role: 'user', content: imgs.length ? [...imgs, { type: 'text', text }] : text };
}

/** Run a JSON-returning prompt, retrying once with "JSON만 다시 출력" on parse failure (design-prompts §9). */
async function askJson<T>(ctx: Ctx, model: string, system: string, msg: LLMMessage, maxTokens = 8000): Promise<T> {
  const first = await streamChat(ctx.settings, [msg], { system, model, json: true, maxTokens, signal: ctx.signal, onToken: ctx.onToken });
  try {
    return extractJson<T>(first);
  } catch {
    const again = await streamChat(
      ctx.settings,
      [msg, { role: 'assistant', content: first }, { role: 'user', content: 'JSON만 다시 출력해. 설명이나 코드펜스 없이.' }],
      { system, model, json: true, maxTokens, signal: ctx.signal },
    );
    return extractJson<T>(again);
  }
}

// P1
export async function aiCheck(p: Project, ctx: Ctx): Promise<CheckResult> {
  const sys = P.fill(P.P1_SYSTEM, vars(p, ctx));
  const r = await askJson<any>(ctx, ctx.settings.fastModel, sys, userMsg(P.fill(P.P1_USER, { specRaw: p.specRaw, attachmentsText: attachmentsText(p) }), images(p)), 3000);
  return { source: 'ai', items: Array.isArray(r.items) ? r.items : [], questions: Array.isArray(r.questions) ? r.questions.slice(0, 5) : [] };
}

// P2
export async function aiStructure(p: Project, ctx: Ctx): Promise<ProjectSpec> {
  const sys = P.fill(P.P2_SYSTEM, vars(p, ctx));
  const answers = Object.entries(p.answers).map(([k, v]) => `${k}: ${v}`).join('\n') || '(없음)';
  const r = await askJson<any>(ctx, ctx.settings.fastModel, sys, userMsg(P.fill(P.P2_USER, { specRaw: p.specRaw, attachmentsText: attachmentsText(p), answers }), images(p)), 6000);
  return normalizeSpec(r);
}

export function normalizeSpec(r: any): ProjectSpec {
  const arr = (x: any) => (Array.isArray(x) ? x.map(String) : []);
  const screens: SpecScreen[] = (Array.isArray(r.screens) ? r.screens : []).map((s: any, i: number) => ({
    id: String(s.id || `screen-${i + 1}`).toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    name: String(s.name || s.id || `Screen ${i + 1}`),
    purpose: String(s.purpose || ''),
    elements: arr(s.elements),
    priority: String(s.priority || ''),
    navTo: arr(s.navTo),
    inferred: !!s.inferred,
  }));
  return {
    summary: String(r.summary || ''),
    audience: String(r.audience || ''),
    context: String(r.context || ''),
    platform: ['mobile', 'desktop', 'both'].includes(r.platform) ? r.platform : 'mobile',
    moodKeywords: arr(r.moodKeywords),
    avoidKeywords: arr(r.avoidKeywords),
    screens,
    features: (Array.isArray(r.features) ? r.features : []).map((f: any, i: number) => ({
      id: String(f.id || `f${i + 1}`), name: String(f.name || ''), description: String(f.description || ''), screens: arr(f.screens),
    })),
    contentSamples: arr(r.contentSamples),
  };
}

// P3
export async function aiDirections(p: Project, ctx: Ctx): Promise<Direction[]> {
  const u = await getUsage();
  const sys = designSystem(p, ctx, P.fill(P.P3_SYSTEM, {
    ...vars(p, ctx),
    recentFonts: u.fontsUsed.join(', ') || '(없음)',
    recentHues: u.primaryHuesUsed.join(', ') || '(없음)',
    recentThemes: u.themesUsed.join(', ') || '(없음)',
    avoidKeywords: p.spec?.avoidKeywords.join(', ') || '(없음)',
  }));
  const r = await askJson<any>(ctx, ctx.settings.strongModel, sys, userMsg(P.fill(P.P3_USER, { specJson: JSON.stringify(p.spec) })), 16000);
  return (r.directions || []).slice(0, 3).map(normalizeDirection);
}

function normalizeDirection(d: any): Direction {
  return {
    name: String(d.name || 'Direction'),
    mood: String(d.mood || ''),
    rationale: String(d.rationale || ''),
    tokens: normalizeTokens(d.tokens),
    fontRationale: d.fontRationale,
    colorRationale: d.colorRationale,
    layoutIdea: d.layoutIdea,
    signatureMotion: d.signatureMotion,
    backgroundTreatment: d.backgroundTreatment,
    miniPreviewHtml: typeof d.miniPreviewHtml === 'string' ? cleanScreenHtml(d.miniPreviewHtml) : undefined,
    contrastCheck: d.contrastCheck,
  };
}

// P3b
export async function aiReference(p: Project, ctx: Ctx, refText: string, refImages: string[]): Promise<Direction> {
  const sys = designSystem(p, ctx, P.P3B_SYSTEM);
  const text = `<ProjectSpec>${JSON.stringify(p.spec)}</ProjectSpec>\n<참고자료>${refText || '(이미지 참고)'}</참고자료>`;
  const r = await askJson<any>(ctx, ctx.settings.strongModel, sys, userMsg(text, refImages.map((d) => ({ type: 'image', dataUrl: d }))), 8000);
  const d = normalizeDirection(r);
  if (r.adjustments) d.rationale += `\n${r.adjustments}`;
  return d;
}

/**
 * Stream a whole screen of HTML. Long screens can hit the output limit and stop mid-tag; ask the
 * model to continue from where it stopped (up to 3 times). If it is still unfinished, fail instead
 * of saving a half-built screen.
 */
async function streamScreen(ctx: Ctx, system: string, msg: LLMMessage): Promise<string> {
  let full = '';
  for (let round = 0; round < 4; round++) {
    let truncated = false;
    const messages: LLMMessage[] = round === 0 ? [msg] : [
      msg,
      { role: 'assistant', content: full.trimEnd() },
      { role: 'user', content: '출력이 길이 제한으로 중간에 끊겼어. 끊긴 바로 다음 글자부터 이어서 출력해. 이미 쓴 부분은 반복하지 말고, 인사말·설명·코드펜스 없이 이어지는 내용만 출력해.' },
    ];
    const prev = full;
    const part = await streamChat(ctx.settings, messages, {
      system, model: ctx.settings.strongModel, maxTokens: 16000, signal: ctx.signal,
      onToken: (chunk) => ctx.onToken?.(chunk, prev + chunk),
      onTruncated: () => { truncated = true; },
    });
    full = round === 0 ? part : full.trimEnd() + part.replace(/^```(?:html)?\s*/i, '');
    const unfinished = truncated || (/<screen>/.test(full) && !/<\/screen>/.test(full));
    if (!unfinished) return full;
  }
  throw new Error(ctx.uiLang === 'en'
    ? 'The screen was too long and got cut off before it finished. Try again, or ask for a simpler screen.'
    : '화면이 너무 길어서 끝까지 만들지 못하고 끊겼어요. 다시 만들거나 조금 더 단순하게 요청해 주세요.');
}

// P4
export async function aiScreen(p: Project, screen: SpecScreen, ctx: Ctx, extra = ''): Promise<{ html: string; notes: string }> {
  const others = p.screens.filter((s) => s.status === 'done' && s.id !== screen.id && s.html);
  const existing = others.length ? others.slice(0, 3).map((s) => `### ${s.id}\n${summarizeScreen(s.html, 900)}`).join('\n') : '(아직 없음 — 이 화면이 기준이 된다)';
  const navTargets = p.spec!.screens.map((s) => `${s.id}(${s.name})`).join(', ');
  const sys = designSystem(p, ctx, P.fill(P.P4_SYSTEM, {
    ...vars(p, ctx),
    navTargets,
    platform: p.spec!.platform,
    signatureMotion: p.tokens!.motion.signature,
    existingScreensSummary: existing,
  }));
  const msg = P.fill(P.P4_USER, {
    specJson: JSON.stringify(p.spec),
    tokensJson: JSON.stringify(p.tokens),
    screenJson: JSON.stringify(screen),
    extra: extra ? `\n<추가요청>${extra}</추가요청>` : '',
  });
  const out = await streamScreen(ctx, sys, userMsg(msg));
  const html = cleanScreenHtml(extractTag(out, 'screen') ?? out);
  return { html, notes: extractTag(out, 'design-notes') ?? '' };
}

export interface EditResult {
  edits?: { screenId: string; targetId: string; replaceWith: string }[];
  tokenChanges?: Record<string, unknown>;
  newScreens?: SpecScreen[];
  specImpact?: ChangeEntry['specImpact'];
  note?: string;
  clarify?: { question: string; options: string[] } | null;
}

// P5
export async function aiEdit(
  p: Project,
  ctx: Ctx,
  a: { request: string; scope: 'element' | 'screen' | 'global'; screenId: string; selectedId?: string; selectedOuter?: string },
): Promise<EditResult> {
  const screen = p.screens.find((s) => s.id === a.screenId);
  const sys = designSystem(p, ctx, P.fill(P.P5_SYSTEM, { ...vars(p, ctx), selectedId: a.selectedId ?? '-' }));
  const otherScreens = p.screens.filter((s) => s.id !== a.screenId).map((s) => (a.scope === 'global' ? `### ${s.id}\n${summarizeScreen(s.html, 800)}` : `${s.id}(${s.name})`)).join('\n');
  const msg = P.fill(P.P5_USER, {
    userRequest: a.request,
    scope: a.scope,
    selectedOuterHtml: a.selectedOuter ?? '(없음)',
    screenId: a.screenId,
    screenHtml: screen?.html ?? '',
    otherScreens,
    tokensJson: JSON.stringify(p.tokens),
    specJson: JSON.stringify(p.spec),
  });
  const r = await askJson<EditResult>(ctx, ctx.settings.strongModel, sys, userMsg(msg), 16000);
  if (r.newScreens) r.newScreens = normalizeSpec({ screens: r.newScreens }).screens;
  return r;
}

export async function aiEditFull(p: Project, ctx: Ctx, request: string, screenId: string): Promise<string> {
  const screen = p.screens.find((s) => s.id === screenId)!;
  const sys = designSystem(p, ctx, P.P5_FULL_SYSTEM);
  const out = await streamScreen(ctx, sys, userMsg(`<요청>${request}</요청>\n<DesignTokens>${JSON.stringify(p.tokens)}</DesignTokens>\n<현재화면>${screen.html}</현재화면>`));
  return cleanScreenHtml(extractTag(out, 'screen') ?? out);
}

// P6
export async function aiFix(p: Project, ctx: Ctx, screenId: string, violations: LintViolation[]): Promise<EditResult> {
  const screen = p.screens.find((s) => s.id === screenId)!;
  const sys = designSystem(p, ctx, P.P6_SYSTEM);
  const msg = P.fill(P.P6_USER, {
    violations: JSON.stringify(violations.map((v) => ({ rule: v.rule, detail: v.detail }))),
    tokensJson: JSON.stringify(p.tokens),
    screenId,
    screenHtml: screen.html,
  });
  return askJson<EditResult>(ctx, ctx.settings.strongModel, sys, userMsg(msg), 16000);
}

// P7
export async function aiExport(p: Project, ctx: Ctx, selected: string[]): Promise<string> {
  const sys = P.fill(P.P7_SYSTEM, { ...vars(p, ctx), selectedChangeIds: selected.join(', ') || '(없음)' });
  const msg = P.fill(P.P7_USER, {
    specRaw: p.specRaw,
    specJson: JSON.stringify(p.spec),
    changeLogJson: JSON.stringify(p.changeLog.filter((c) => selected.includes(c.id))),
    screensSummary: p.screens.map((s) => `### ${s.id} (${s.name})\n${summarizeScreen(s.html, 1500)}`).join('\n\n'),
    tokensJson: JSON.stringify(p.tokens),
    directionJson: JSON.stringify(p.direction),
    today: new Date().toISOString().slice(0, 10),
  });
  const out = await streamChat(ctx.settings, [userMsg(msg)], { system: sys, model: ctx.settings.strongModel, maxTokens: 16000, signal: ctx.signal, onToken: ctx.onToken });
  return out.replace(/^```(?:markdown|md)?\s*\n/, '').replace(/\n```\s*$/, '').trim();
}

export function hasKey(s: ProviderSettings) {
  return s.provider === 'local' || !!s.apiKey;
}

export type { DesignTokens };
