import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store';
import { themeOf } from '../lib/tokens';
import { PRESETS, presetAsDirection } from '../lib/presets';
import { aiReference } from '../lib/ai';
import { useAI } from '../components/useAI';
import Preview from '../components/Preview';
import { lintTokens } from '../lib/lint';
import { readAttachment } from '../lib/files';
import type { DesignTokens, Direction } from '../lib/types';

type Source = 'preset' | 'reference';
interface Cand { key: string; source: Source; d: Direction; genre?: string }

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Generic mini preview (reference directions, mixed tokens): the service's own name & first screen in the tokens. */
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

function Card({ c, selected, onPick, mini, lang }: { c: Cand; selected: boolean; onPick: () => void; mini: string; lang: string }) {
  const { t } = useTranslation();
  const tk = c.d.tokens;
  // the mini preview is drawn 400px wide; scale it to fill whatever width the card gets
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.96);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => el.clientWidth && setScale(el.clientWidth / 400);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div className="dir" role="button" tabIndex={0} aria-pressed={selected} onClick={onPick} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick()}>
      <div className="mini" ref={box} style={{ height: Math.round(310 * scale) }}>
        <Preview html={c.d.miniPreviewHtml || mini} tokens={tk} mode="static" lang={lang} title={c.d.name}
          style={{ width: 400, height: 440, border: 0, transform: `scale(${scale})`, transformOrigin: '0 0', pointerEvents: 'none' }} />
      </div>
      <div className="body">
        <span className="eyebrow">{c.genre ?? `${t(`direction.src.${c.source}`)} · ${themeOf(tk)}`}</span>
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
  const [tab, setTab] = useState<Source>('preset');
  const [refText, setRefText] = useState('');
  const [refImgs, setRefImgs] = useState<string[]>([]);
  const [refDir, setRefDir] = useState<Direction | null>(null);
  // start on the preset the project already uses, if any
  const [sel, setSel] = useState<string | null>(() => {
    const cur = PRESETS.find((x) => x.name.ko === p.direction?.name || x.name.en === p.direction?.name);
    return cur ? `preset-${cur.id}` : null;
  });
  const [colorFrom, setColorFrom] = useState<string>('');
  const [fontFrom, setFontFrom] = useState<string>('');

  const serviceName = p.specRaw.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? p.name;
  const firstScreen = (p.spec?.screens[0]?.priority || p.spec?.summary || p.name).slice(0, 26);
  const summary = (p.spec?.summary ?? '').slice(0, 70);
  const mini = miniFor(serviceName, summary, firstScreen);
  const cands: Cand[] = useMemo(() => {
    const v = { name: serviceName, first: firstScreen, summary, cta: p.contentLang === 'ko' ? '시작하기' : 'Get started' };
    return [
      ...PRESETS.map((x) => ({ key: `preset-${x.id}`, source: 'preset' as const, genre: x.genre[lang], d: presetAsDirection(x, lang, v) })),
      ...(refDir ? [{ key: 'ref', source: 'reference' as const, d: refDir }] : []),
    ];
  }, [refDir, lang, serviceName, firstScreen, summary, p.contentLang]);
  const byKey = (k: string) => cands.find((c) => c.key === k);

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
        rationale: [base.d.mood, base.d.rationale, base.d.fontRationale, base.d.colorRationale].filter(Boolean).join(' · '),
        ...(base.d.guide ? { guide: base.d.guide } : {}),
      };
      d.step = 'studio';
    }, { undoable: true });
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
        {(['preset', 'reference'] as const).map((s) => (
          <button key={s} role="tab" aria-selected={tab === s} onClick={() => setTab(s)}>{t(`direction.tab.${s}`)}</button>
        ))}
      </div>

      {tab === 'preset' && <p className="muted" style={{ margin: '-8px 0 20px', fontSize: 14 }}>{t('direction.presetHint', { n: PRESETS.length })}</p>}
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
      <div className="dirs unfold-seq">
        {list.map((c) => <Card key={c.key} c={c} selected={sel === c.key} onPick={() => setSel(c.key)} mini={mini} lang={p.contentLang} />)}
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
