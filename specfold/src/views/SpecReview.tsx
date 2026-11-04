import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { screensFromSpec, useStore } from '../store';
import type { ProjectSpec, SpecScreen } from '../lib/types';
import { uid } from '../lib/util';

function TagEditor({ values, onChange, neg, readOnly }: { values: string[]; onChange: (v: string[]) => void; neg?: boolean; readOnly?: boolean }) {
  const [v, setV] = useState('');
  return (
    <div className="tags">
      {values.map((x, i) => (
        <span key={i} className={`tag ${neg ? 'neg' : ''}`}>
          {x}
          {!readOnly && <button aria-label="remove" onClick={() => onChange(values.filter((_, j) => j !== i))}>×</button>}
        </span>
      ))}
      {!readOnly && (
        <input className="input" style={{ width: 120, height: 26, fontSize: 12 }} value={v} placeholder="+"
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && v.trim() && !e.nativeEvent.isComposing) {
              onChange([...values, v.trim()]);
              setV('');
            }
          }} />
      )}
    </div>
  );
}

/** Simple arrow map: BFS levels from the first screen, one column per level. */
export function Sitemap({ screens }: { screens: SpecScreen[] }) {
  if (!screens.length) return null;
  const level = new Map<string, number>();
  const q = [screens[0].id];
  level.set(screens[0].id, 0);
  while (q.length) {
    const id = q.shift()!;
    const s = screens.find((x) => x.id === id);
    s?.navTo.forEach((n) => {
      if (!level.has(n) && screens.some((x) => x.id === n)) {
        level.set(n, level.get(id)! + 1);
        q.push(n);
      }
    });
  }
  let maxL = Math.max(0, ...level.values());
  screens.forEach((s) => !level.has(s.id) && level.set(s.id, ++maxL));
  const cols: string[][] = [];
  screens.forEach((s) => (cols[level.get(s.id)!] ??= []).push(s.id));
  const W = 150, H = 44, GX = 70, GY = 22, P = 20;
  const pos = new Map<string, { x: number; y: number }>();
  cols.forEach((c, ci) => c?.forEach((id, ri) => pos.set(id, { x: P + ci * (W + GX), y: P + ri * (H + GY) })));
  const width = P * 2 + cols.length * (W + GX) - GX;
  const height = P * 2 + Math.max(...cols.map((c) => c?.length ?? 0)) * (H + GY) - GY;
  return (
    <div className="sitemap">
      <svg width={width} height={height} role="img" aria-label="sitemap">
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" fill="#2340d6" />
          </marker>
        </defs>
        {screens.flatMap((s) =>
          s.navTo.filter((n) => pos.has(n) && n !== s.id).map((n) => {
            const a = pos.get(s.id)!, b = pos.get(n)!;
            const back = b.x <= a.x;
            const x1 = back ? a.x + W / 2 : a.x + W, y1 = back ? a.y + H : a.y + H / 2;
            const x2 = back ? b.x + W / 2 : b.x, y2 = back ? b.y + H : b.y + H / 2;
            const d = back ? `M${x1} ${y1} C ${x1} ${y1 + 40}, ${x2} ${y2 + 40}, ${x2} ${y2 + 2}` : `M${x1} ${y1} C ${x1 + GX / 2} ${y1}, ${x2 - GX / 2} ${y2}, ${x2 - 2} ${y2}`;
            return <path key={s.id + n} d={d} fill="none" stroke="#2340d6" strokeWidth="1.5" strokeDasharray={back ? '4 3' : undefined} markerEnd="url(#arr)" />;
          }),
        )}
        {screens.map((s) => {
          const { x, y } = pos.get(s.id)!;
          return (
            <g key={s.id}>
              <rect x={x} y={y} width={W} height={H} fill="#f8f6f1" stroke="#17171a" />
              <text x={x + 10} y={y + 19} fontSize="13" fontWeight="700" fill="#17171a" fontFamily="IBM Plex Sans KR">{s.name.slice(0, 14)}</text>
              <text x={x + 10} y={y + 34} fontSize="10" fill="#55514a" fontFamily="IBM Plex Mono">{s.id.slice(0, 20)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function SpecReview() {
  const { t } = useTranslation();
  const { project, update, go } = useStore();
  const p = project!;
  const spec = p.spec!;
  const ro = !!p.readonly;
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);

  const set = (fn: (s: ProjectSpec) => void) =>
    update((d) => {
      fn(d.spec!);
      d.screens = screensFromSpec(d.spec!, d.screens);
    }, { undoable: true });

  const move = (from: number, to: number) =>
    set((s) => {
      const [x] = s.screens.splice(from, 1);
      s.screens.splice(to, 0, x);
    });

  if (!spec) return null;

  return (
    <div className="page">
      <div className="page-head unfold">
        <div>
          <p className="eyebrow">02 · {t('steps.review')}</p>
          <h1>{t('review.title')}</h1>
          <p>{t('review.lede')}</p>
        </div>
        <button className="btn ink" onClick={() => go({ name: 'project', id: p.id, step: 'direction' })}>{t('review.next')} →</button>
      </div>

      <div className="spec-grid unfold-seq">
        <section className="sheet block wide">
          <h3>{t('review.service')}</h3>
          {(['summary', 'audience', 'context'] as const).map((k) => (
            <label className="kv" key={k}>
              <span>{t(`review.${k}`)}</span>
              <textarea className="input" rows={k === 'summary' ? 2 : 2} value={spec[k]} readOnly={ro} onChange={(e) => set((s) => { s[k] = e.target.value; })} />
            </label>
          ))}
          <div className="kv">
            <span>{t('review.platform')}</span>
            <div className="seg" style={{ justifySelf: 'start' }}>
              {(['mobile', 'desktop', 'both'] as const).map((pl) => (
                <button key={pl} aria-pressed={spec.platform === pl} disabled={ro} onClick={() => set((s) => { s.platform = pl; })}>{t(`review.pf.${pl}`)}</button>
              ))}
            </div>
          </div>
        </section>
        <section className="sheet block narrow">
          <h3>{t('review.mood')}</h3>
          <div className="kv"><span>{t('review.moodKw')}</span><TagEditor readOnly={ro} values={spec.moodKeywords} onChange={(v) => set((s) => { s.moodKeywords = v; })} /></div>
          <div className="kv"><span>{t('review.avoidKw')}</span><TagEditor readOnly={ro} neg values={spec.avoidKeywords} onChange={(v) => set((s) => { s.avoidKeywords = v; })} /></div>
          <div className="kv"><span>{t('review.content')}</span><TagEditor readOnly={ro} values={spec.contentSamples} onChange={(v) => set((s) => { s.contentSamples = v; })} /></div>
        </section>

        <section className="sheet block full">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3>{t('review.screens')} <span className="mono muted">{spec.screens.length}</span></h3>
            {!ro && (
              <button className="btn sm" onClick={() => set((s) => {
                const id = `screen-${uid().slice(0, 4)}`;
                s.screens.push({ id, name: t('review.newScreen'), purpose: '', elements: [], priority: '', navTo: [] });
              })}>+ {t('review.addScreen')}</button>
            )}
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>{t('review.dragHint')}</p>
          {spec.screens.map((sc, i) => (
            <div key={sc.id} className={`screen-row ${overIdx === i ? 'drag-over' : ''}`}
              draggable={!ro}
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
              onDragLeave={() => setOverIdx(null)}
              onDrop={() => { if (dragIdx !== null && dragIdx !== i) move(dragIdx, i); setDragIdx(null); setOverIdx(null); }}>
              <span className="grip" aria-hidden="true">⋮⋮</span>
              <span className="idx">{String(i + 1).padStart(2, '0')}</span>
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="input" style={{ fontWeight: 700, maxWidth: 260 }} value={sc.name} readOnly={ro} onChange={(e) => set((s) => { s.screens[i].name = e.target.value; })} />
                  <span className="mono muted">#{sc.id}</span>
                  {sc.inferred && <span className="tag" title={t('review.inferredHint')}>{t('review.inferred')}</span>}
                </div>
                <input className="input" placeholder={t('review.purpose')} value={sc.purpose} readOnly={ro} onChange={(e) => set((s) => { s.screens[i].purpose = e.target.value; })} />
                <input className="input" placeholder={t('review.priority')} value={sc.priority} readOnly={ro} onChange={(e) => set((s) => { s.screens[i].priority = e.target.value; })} />
                <TagEditor readOnly={ro} values={sc.elements} onChange={(v) => set((s) => { s.screens[i].elements = v; })} />
                <div className="tags">
                  <span className="mono muted">{t('review.navTo')} →</span>
                  {spec.screens.filter((o) => o.id !== sc.id).map((o) => (
                    <button key={o.id} disabled={ro} className={`chip ${sc.navTo.includes(o.id) ? 'on' : ''}`} style={{ height: 24, fontSize: 12 }}
                      onClick={() => set((s) => {
                        const n = s.screens[i].navTo;
                        s.screens[i].navTo = n.includes(o.id) ? n.filter((x) => x !== o.id) : [...n, o.id];
                      })}>{o.name}</button>
                  ))}
                </div>
              </div>
              {!ro && (
                <div style={{ display: 'grid', gap: 4 }}>
                  <button className="btn sm ghost" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label="up">↑</button>
                  <button className="btn sm ghost" disabled={i === spec.screens.length - 1} onClick={() => move(i, i + 1)} aria-label="down">↓</button>
                  <button className="btn sm ghost" onClick={() => set((s) => {
                    s.screens.splice(i, 1);
                    s.screens.forEach((x) => (x.navTo = x.navTo.filter((n) => n !== sc.id)));
                  })} aria-label={t('common.delete')}>×</button>
                </div>
              )}
            </div>
          ))}
        </section>

        <section className="sheet block wide">
          <h3>{t('review.sitemap')}</h3>
          <Sitemap screens={spec.screens} />
        </section>
        <section className="sheet block narrow">
          <h3>{t('review.features')}</h3>
          {spec.features.map((f, i) => (
            <div key={f.id} className="kv" style={{ gridTemplateColumns: '1fr auto' }}>
              <div>
                <b>{f.name}</b>
                <div className="muted" style={{ fontSize: 13 }}>{f.description}</div>
              </div>
              {!ro && <button className="btn sm ghost" onClick={() => set((s) => { s.features.splice(i, 1); })}>×</button>}
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
