import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store';
import { PRESETS, hueBucket, presetAsDirection, themeOf } from '../lib/tokens';
import { aiDirections, aiReference } from '../lib/ai';
import { useAI } from '../components/useAI';
import Preview from '../components/Preview';
import { recordUsage } from '../lib/db';
import { lintTokens } from '../lib/lint';
import { readAttachment } from '../lib/files';
import type { DesignTokens, Direction } from '../lib/types';

type Source = 'ai' | 'preset' | 'reference';
interface Cand { key: string; source: Source; d: Direction }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Fallback mini preview for presets/reference: the service's own name & first screen in the tokens. */
function miniFor(name: string, summary: string, first: string) {
  return `<div style="padding:22px;min-height:440px;background:var(--color-bg)">
  <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--color-line);padding-bottom:10px">
    <span style="font-family:var(--font-display);font-size:18px;font-weight:700">${esc(name)}</span>
    <span style="width:22px;height:2px;background:var(--color-ink);box-shadow:0 6px 0 var(--color-ink)"></span></div>
  <p style="font-family:var(--font-display);font-size:38px;line-height:1.05;font-weight:800;margin:26px 0 10px;color:var(--color-ink)">${esc(first)}</p>
  <p style="font-size:14px;color:var(--color-ink-muted);margin:0 0 18px">${esc(summary.slice(0, 70))}</p>
  <span style="display:inline-block;padding:10px 16px;background:var(--color-accent);color:var(--color-bg);border-radius:var(--radius-md);font-weight:700;font-size:14px">→</span>
  <div style="margin-top:22px;display:grid;gap:8px">${[0, 1, 2].map(() => '<div style="height:44px;background:var(--color-surface);border:1px solid var(--color-line);border-radius:var(--radius-sm)"></div>').join('')}</div></div>`;
}

function Card({ c, selected, onPick, mini, lang, scale = 0.98 }: { c: Cand; selected: boolean; onPick: () => void; mini: string; lang: string; scale?: number }) {
  const { t } = useTranslation();
  const tk = c.d.tokens;
  return (
    <div className="dir" role="button" tabIndex={0} aria-pressed={selected} onClick={onPick} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick()}>
      <div className="mini">
        <Preview html={c.d.miniPreviewHtml || mini} tokens={tk} mode="static" lang={lang} title={c.d.name}
          style={{ width: 400, height: 440, border: 0, transform: `scale(${scale})`, transformOrigin: '0 0', pointerEvents: 'none' }} />
      </div>
      <div className="body">
        <span className="eyebrow">{t(`direction.src.${c.source}`)} · {themeOf(tk)}</span>
        <h3>{c.d.name}</h3>
        <span className="muted" style={{ fontSize: 13 }}>{c.d.mood}</span>
        <div className="swatches" aria-label="colors">
          {[tk.color.bg, tk.color.surface, tk.color.ink, tk.color.inkMuted, tk.color.line].map((x, i) => <span key={i} style={{ background: x }} title={x} />)}
          <span className="acc" style={{ background: tk.color.accent }} title={tk.color.accent} />
        </div>
        <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${encodeURIComponent(tk.font.display.family).replace(/%20/g, '+')}:wght@${tk.font.display.weights[0] ?? 700}&display=swap`} />
        <div className="fontsample" style={{ fontFamily: `'${tk.font.display.family}'`, fontWeight: tk.font.display.weights[0] ?? 700 }}>가Ag 123</div>
        <span className="mono muted">{tk.font.display.family} / {tk.font.body.family}</span>
      </div>
      <div className="body why" style={{ borderTop: '1px solid var(--line)' }}>
        {c.d.rationale && <span>{c.d.rationale}</span>}
        {c.d.fontRationale && <span><b>{t('direction.font')}</b> {c.d.fontRationale}</span>}
        {c.d.colorRationale && <span><b>{t('direction.color')}</b> {c.d.colorRationale}</span>}
        {c.d.layoutIdea && <span><b>{t('direction.layout')}</b> {c.d.layoutIdea}</span>}
      </div>
      <div />
    </div>
  );
}

export default function DirectionView() {
  const { t, i18n } = useTranslation();
  const { project, update, go, notify } = useStore();
  const p = project!;
  const lang = (i18n.language === 'en' ? 'en' : 'ko') as 'ko' | 'en';
  const ai = useAI();
  const [tab, setTab] = useState<Source>(p.directions.length ? 'ai' : 'ai');
  const [refText, setRefText] = useState('');
  const [refImgs, setRefImgs] = useState<string[]>([]);
  const [refDir, setRefDir] = useState<Direction | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [colorFrom, setColorFrom] = useState<string>('');
  const [fontFrom, setFontFrom] = useState<string>('');

  const cands: Cand[] = useMemo(() => [
    ...p.directions.map((d, i) => ({ key: `ai-${i}`, source: 'ai' as const, d })),
    ...PRESETS.map((_, i) => ({ key: `preset-${i}`, source: 'preset' as const, d: presetAsDirection(i, lang) })),
    ...(refDir ? [{ key: 'ref', source: 'reference' as const, d: refDir }] : []),
  ], [p.directions, refDir, lang]);
  const byKey = (k: string) => cands.find((c) => c.key === k);
  const firstScreen = p.spec?.screens[0]?.priority || p.spec?.summary || p.name;
  const mini = miniFor(p.specRaw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? p.name, p.spec?.summary ?? '', firstScreen.slice(0, 26));

  const generate = () =>
    ai.run('directions', async (ctx) => {
      const ds = await aiDirections(useStore.getState().project!, ctx);
      update((d) => { d.directions = ds; });
      setSel('ai-0');
    }).catch(() => {});

  const analyze = () =>
    ai.run('reference', async (ctx) => {
      const d = await aiReference(useStore.getState().project!, ctx, refText, refImgs);
      setRefDir(d);
      setSel('ref');
    }).catch(() => {});

  const finalTokens = (): DesignTokens | null => {
    const base = sel ? byKey(sel) : null;
    if (!base) return null;
    const tk = structuredClone(base.d.tokens);
    const c = colorFrom ? byKey(colorFrom) : null;
    const f = fontFrom ? byKey(fontFrom) : null;
    if (c) tk.color = structuredClone(c.d.tokens.color);
    if (f) tk.font = structuredClone(f.d.tokens.font);
    return tk;
  };

  const confirm = async () => {
    const base = byKey(sel!)!;
    const tk = finalTokens()!;
    const issues = lintTokens(tk, p.contentLang);
    if (issues.length) notify(t('direction.tokenIssues', { n: issues.length, detail: issues[0].detail }));
    const mixed = (colorFrom && colorFrom !== sel) || (fontFrom && fontFrom !== sel);
    update((d) => {
      d.tokens = tk;
      d.direction = {
        source: base.source,
        name: mixed ? `${base.d.name} + ${t('direction.mixed')}` : base.d.name,
        rationale: [base.d.rationale, base.d.fontRationale, base.d.colorRationale].filter(Boolean).join(' '),
      };
      d.step = 'studio';
    }, { undoable: true });
    await recordUsage([tk.font.display.family, tk.font.body.family], hueBucket(tk.color.accent), themeOf(tk));
    go({ name: 'project', id: p.id, step: 'studio' });
  };

  const list = cands.filter((c) => c.source === tab);

  return (
    <div className="page">
      <div className="page-head unfold">
        <div>
          <p className="eyebrow">03 · {t('steps.direction')}</p>
          <h1>{t('direction.title')}</h1>
          <p>{t('direction.lede')}</p>
        </div>
        {p.tokens && <button className="btn" onClick={() => go({ name: 'project', id: p.id, step: 'studio' })}>{t('direction.keep')}</button>}
      </div>

      <div className="tabs" role="tablist">
        {(['ai', 'preset', 'reference'] as const).map((s) => (
          <button key={s} role="tab" aria-selected={tab === s} onClick={() => setTab(s)}>{t(`direction.tab.${s}`)}</button>
        ))}
      </div>

      {tab === 'ai' && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
          <button className="btn pencil" disabled={!!ai.busy || p.readonly} onClick={generate}>
            {ai.busy === 'directions' ? t('direction.generating') : p.directions.length ? t('direction.regenerate') : t('direction.generate')}
          </button>
          <span className="muted" style={{ fontSize: 13 }}>{t('direction.aiHint')}</span>
          {ai.busy && <button className="link" onClick={ai.cancel}>{t('common.cancel')}</button>}
        </div>
      )}
      {tab === 'reference' && (
        <div className="sheet block" style={{ marginBottom: 20, display: 'grid', gap: 12 }}>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>{t('direction.refHint')}</p>
          <textarea className="input" rows={3} placeholder={t('direction.refPh')} value={refText} onChange={(e) => setRefText(e.target.value)} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <label className="btn sm">
              {t('direction.refUpload')}
              <input type="file" accept="image/*" multiple hidden onChange={async (e) => {
                const fs = Array.from(e.target.files ?? []);
                const as = await Promise.all(fs.map(readAttachment));
                setRefImgs((x) => [...x, ...as.map((a) => a.dataUrl!).filter(Boolean)].slice(0, 4));
              }} />
            </label>
            {refImgs.map((d, i) => <img key={i} src={d} alt="" style={{ height: 40, border: '1px solid var(--ink)' }} />)}
            <div style={{ flex: 1 }} />
            <button className="btn pencil" disabled={(!refText.trim() && !refImgs.length) || !!ai.busy || p.readonly} onClick={analyze}>
              {ai.busy === 'reference' ? t('direction.analyzing') : t('direction.analyze')}
            </button>
          </div>
        </div>
      )}

      {ai.busy && ai.stream && <pre className="mdview" style={{ maxHeight: 120, marginBottom: 16, border: '1px solid var(--line)' }}>{ai.stream.slice(-600)}</pre>}

      {list.length === 0 && !ai.busy && <p className="muted">{t(`direction.empty.${tab}`)}</p>}
      <div className={tab === 'preset' ? 'presets unfold-seq' : 'dirs unfold-seq'}>
        {list.map((c) => <Card key={c.key} c={c} selected={sel === c.key} onPick={() => setSel(c.key)} mini={mini} lang={p.contentLang} scale={tab === 'preset' ? 0.72 : 0.98} />)}
      </div>

      {sel && (
        <div className="sheet mix unfold">
          <div style={{ flex: '1 1 100%' }}>
            <h3 style={{ fontSize: 20 }}>{t('direction.mixTitle')}</h3>
            <p className="muted" style={{ fontSize: 13, margin: '4px 0 0' }}>{t('direction.mixLede')}</p>
          </div>
          <label className="field">
            <span>{t('direction.colorFrom')}</span>
            <select className="input" value={colorFrom} onChange={(e) => setColorFrom(e.target.value)}>
              <option value="">— {byKey(sel)?.d.name}</option>
              {cands.map((c) => <option key={c.key} value={c.key}>{c.d.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>{t('direction.fontFrom')}</span>
            <select className="input" value={fontFrom} onChange={(e) => setFontFrom(e.target.value)}>
              <option value="">— {byKey(sel)?.d.name}</option>
              {cands.map((c) => <option key={c.key} value={c.key}>{c.d.name}</option>)}
            </select>
          </label>
          {(colorFrom || fontFrom) && (
            <div style={{ width: 260, height: 160, border: '1px solid var(--ink)', overflow: 'hidden' }}>
              <Preview html={mini} tokens={finalTokens()} mode="static" lang={p.contentLang} style={{ width: 400, height: 440, border: 0, transform: 'scale(.65)', transformOrigin: '0 0' }} />
            </div>
          )}
        </div>
      )}

      <div className="bottom-bar">
        <span className="muted" style={{ fontSize: 13, marginRight: 'auto' }}>{sel ? t('direction.picked', { name: byKey(sel)?.d.name }) : t('direction.pickOne')}</span>
        <button className="btn ink" disabled={!sel || p.readonly} onClick={confirm}>{t('direction.confirm')} →</button>
      </div>
    </div>
  );
}
