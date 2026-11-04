import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { diffLines } from 'diff';
import { useStore } from '../store';
import { aiExport } from '../lib/ai';
import { buildMarkdown } from '../lib/exportMd';
import { buildPrototypeHtml } from '../lib/exportHtml';
import { useAI } from '../components/useAI';
import { download, slug } from '../lib/util';

export default function ExportView() {
  const { t } = useTranslation();
  const { project, update, notify } = useStore();
  const p = project!;
  const ai = useAI();
  const [selected, setSelected] = useState<string[]>(() => p.changeLog.map((c) => c.id));
  const revised = p.exportedMd ?? '';

  const parts = useMemo(() => (revised ? diffLines(p.specRaw, revised) : []), [p.specRaw, revised]);

  const runAI = () =>
    ai.run('export', async (ctx) => {
      const md = await aiExport(useStore.getState().project!, ctx, selected);
      update((d) => { d.exportedMd = md; });
    }).catch(() => {});
  const runLocal = () => {
    if (p.readonly) return notify(t('demo.readonlyAction'));
    update((d) => { d.exportedMd = buildMarkdown(d, selected); });
  };
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const backup = () => {
    const { readonly, ...rest } = p;
    download(`${slug(p.name)}.specfold.json`, JSON.stringify(rest, null, 2), 'application/json');
  };
  const doneScreens = p.screens.filter((s) => s.status === 'done' && s.html).length;
  const impactful =p.changeLog.filter((c) => c.specImpact.type !== 'none');
  const visualOnly = p.changeLog.filter((c) => c.specImpact.type === 'none');

  return (
    <div className="page" style={{ maxWidth: 1400 }}>
      <div className="page-head unfold">
        <div>
          <p className="eyebrow">05 · {t('steps.export')}</p>
          <h1>{t('export.title')}</h1>
          <p>{t('export.lede')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button className="btn" onClick={backup}>{t('export.backup')}</button>
          <button className="btn" disabled={!doneScreens} title={t('export.htmlHint')}
            onClick={() => download(`${slug(p.name)}-prototype.html`, buildPrototypeHtml(p), 'text/html')}>
            {t('export.html', { n: doneScreens })}
          </button>
          <button className="btn ink" disabled={!revised} onClick={() => download(`${slug(p.name)}-spec-v2.md`, revised)}>{t('export.download')}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0,1fr)', gap: 24, alignItems: 'start' }}>
        <aside className="sheet block" style={{ position: 'sticky', top: 76 }}>
          <h3 style={{ fontSize: 20 }}>{t('export.changes')}</h3>
          <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>{t('export.changesLede')}</p>
          {p.changeLog.length === 0 && <p className="muted" style={{ fontSize: 13 }}>{t('studio.logEmpty')}</p>}
          {[[t('export.specChanges'), impactful], [t('export.visualChanges'), visualOnly]].map(([label, list]) =>
            (list as typeof impactful).length ? (
              <div key={label as string}>
                <p className="eyebrow" style={{ margin: '12px 0 4px' }}>{label as string}</p>
                <ul className="changes">
                  {(list as typeof impactful).map((c) => (
                    <li key={c.id}>
                      <label>
                        <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                        <span>
                          {c.specImpact.type !== 'none' && <span className={`impact ${c.specImpact.type}`}>{t(`impact.${c.specImpact.type}`)}</span>}{' '}
                          {c.specImpact.summary || c.request}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
          <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
            <button className="btn pencil" disabled={!!ai.busy || p.readonly} onClick={runAI}>{ai.busy ? t('export.writing') : t('export.runAI')}</button>
            <button className="btn" disabled={!!ai.busy || p.readonly} onClick={runLocal}>{t('export.runLocal')}</button>
            {ai.busy && <button className="link" onClick={ai.cancel}>{t('common.cancel')}</button>}
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>{t('export.localNote')}</p>
          </div>
        </aside>

        <div className="diffwrap unfold">
          <div>
            <div className="diffhead"><b>{t('export.original')}</b><span className="mono muted">{p.specRaw.split('\n').length} lines</span></div>
            <pre className="mdview">
              {revised
                ? parts.filter((x) => !x.added).map((x, i) => (x.removed ? <del key={i}>{x.value}</del> : <span key={i}>{x.value}</span>))
                : p.specRaw}
            </pre>
          </div>
          <div>
            <div className="diffhead"><b>{t('export.revised')}</b><span className="mono muted">{revised ? `+${parts.filter((x) => x.added).reduce((n, x) => n + (x.count ?? 0), 0)} lines` : ''}</span></div>
            <pre className="mdview">
              {ai.busy ? ai.stream || '…' : revised ? parts.filter((x) => !x.removed).map((x, i) => (x.added ? <ins key={i}>{x.value}</ins> : <span key={i}>{x.value}</span>)) : <span className="muted">{t('export.empty')}</span>}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
