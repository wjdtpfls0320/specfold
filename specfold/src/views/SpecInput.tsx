import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { screensFromSpec, useStore } from '../store';
import { CHECK_IDS, ESSENTIAL, TEMPLATE, VAGUE_WORDS, findVague, localCheck } from '../lib/checklist';
import { ACCEPT, readAttachment } from '../lib/files';
import { aiCheck, aiStructure } from '../lib/ai';
import { useAI } from '../components/useAI';
import { detectLang } from '../lib/util';
import type { CheckItem } from '../lib/types';

const MARK = { ok: '✓', vague: '△', missing: '✗' } as const;

export default function SpecInput() {
  const { t, i18n } = useTranslation();
  const { project, update, go, notify } = useStore();
  const p = project!;
  const ai = useAI();
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const uiLang = (i18n.language === 'en' ? 'en' : 'ko') as 'ko' | 'en';

  const local = useMemo(() => localCheck(p.specRaw), [p.specRaw]);
  // AI judgement wins where present; local check fills the rest and stays live while typing.
  const items: CheckItem[] = CHECK_IDS.map((id) => p.check?.items.find((i) => i.id === id) ?? local.items.find((i) => i.id === id)!);
  const vague = useMemo(() => [...findVague(p.specRaw, 'ko'), ...findVague(p.specRaw, 'en')], [p.specRaw]);

  const setText = (v: string) =>
    update((d) => {
      d.specRaw = v;
      d.contentLang = detectLang(v || (uiLang === 'ko' ? '가' : 'a'));
      const title = v.match(/^#\s+(.+)$/m)?.[1]?.trim();
      if (title && !d.readonly) d.name = title.slice(0, 40);
    });

  const addFiles = async (files: FileList | File[]) => {
    for (const f of Array.from(files)) {
      try {
        const a = await readAttachment(f);
        update((d) => {
          d.attachments.push(a);
          if (a.kind === 'text' && !d.specRaw.trim() && a.text) d.specRaw = a.text;
        });
      } catch (e) {
        notify(t('input.fileFail', { name: f.name }));
      }
    }
  };

  const askAI = () =>
    ai.run('check', async (ctx) => {
      const r = await aiCheck(useStore.getState().project!, ctx);
      update((d) => {
        d.check = r;
      });
    }).catch(() => {});

  const next = () =>
    ai.run('structure', async (ctx) => {
      const spec = await aiStructure(useStore.getState().project!, ctx);
      update((d) => {
        d.spec = spec;
        d.screens = screensFromSpec(spec, d.screens);
        d.step = 'review';
      });
      go({ name: 'project', id: p.id, step: 'review' });
    }).catch(() => {});

  const missingEssential = items.filter((i) => ESSENTIAL.has(i.id) && i.status === 'missing').length;

  return (
    <div className="page">
      <div className="page-head unfold">
        <div>
          <p className="eyebrow">01 · {t('steps.input')}</p>
          <h1>{t('input.title')}</h1>
          <p>{t('input.lede')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {p.spec && <button className="btn" onClick={() => go({ name: 'project', id: p.id, step: 'review' })}>{t('input.toReview')}</button>}
          <button className="btn ink" disabled={!p.specRaw.trim() || !!ai.busy || p.readonly} onClick={next}>
            {ai.busy === 'structure' ? t('input.structuring') : t('input.next')} →
          </button>
        </div>
      </div>

      <div className="split">
        <div>
          <div className="editor">
            <div className="editor-bar">
              <button className="btn sm" disabled={p.readonly} onClick={() => setText(p.specRaw.trim() ? p.specRaw + '\n\n' + TEMPLATE[uiLang] : TEMPLATE[uiLang])}>{t('input.template')}</button>
              <button className="btn sm ghost" disabled={p.readonly} onClick={() => fileRef.current?.click()}>{t('input.upload')}</button>
              <div style={{ flex: 1 }} />
              <span className="mono muted">{t('input.contentLang')}: {p.contentLang.toUpperCase()}</span>
              <select className="input" style={{ width: 'auto', height: 28, fontSize: 12 }} value={p.contentLang} disabled={p.readonly}
                onChange={(e) => update((d) => { d.contentLang = e.target.value as 'ko' | 'en'; })}>
                <option value="ko">한국어</option>
                <option value="en">English</option>
              </select>
            </div>
            <CodeMirror
              value={p.specRaw}
              onChange={setText}
              readOnly={p.readonly}
              extensions={[markdown(), EditorView.lineWrapping]}
              placeholder={t('input.placeholder')}
              basicSetup={{ foldGutter: false, highlightActiveLine: false }}
            />
          </div>
          <div
            className={`drop ${over ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); if (!p.readonly) addFiles(e.dataTransfer.files); }}
            onClick={() => !p.readonly && fileRef.current?.click()}
          >
            {t('input.drop')}
          </div>
          <input ref={fileRef} type="file" multiple hidden accept={ACCEPT} onChange={(e) => e.target.files && addFiles(e.target.files)} />
          {p.attachments.length > 0 && (
            <div className="attach">
              {p.attachments.map((a) => (
                <span key={a.id}>
                  <span className="mono">{a.kind === 'image' ? 'IMG' : 'TXT'}</span> {a.name}
                  {!p.readonly && <button className="link" onClick={() => update((d) => { d.attachments = d.attachments.filter((x) => x.id !== a.id); })}>×</button>}
                </span>
              ))}
            </div>
          )}
        </div>

        <aside className="side">
          <section className="sheet tips">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h3>{t('input.checklist')}</h3>
              <span className="mono muted">{p.check?.source === 'ai' ? 'AI' : t('input.live')}</span>
            </div>
            <ul className="checklist">
              {items.map((it) => (
                <li key={it.id}>
                  <span className={`mark ${it.status}`} aria-label={t(`check.status.${it.status}`)}>{MARK[it.status]}</span>
                  <span>
                    {t(`check.${it.id}`)}
                    {ESSENTIAL.has(it.id) ? '' : <span className="muted"> · {t('input.optional')}</span>}
                    {it.note && <div className="muted" style={{ fontSize: 12 }}>{it.note}</div>}
                    {it.suggestions && it.suggestions.length > 0 && (
                      <div className="tags" style={{ marginTop: 4 }}>{it.suggestions.map((s) => <span key={s} className="tag">{s}</span>)}</div>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <button className="btn pencil" style={{ width: '100%', marginTop: 12 }} disabled={!p.specRaw.trim() || !!ai.busy || p.readonly} onClick={askAI}>
              {ai.busy === 'check' ? t('input.asking') : t('input.askAI')}
            </button>
            {missingEssential > 0 && <p className="muted" style={{ fontSize: 12, margin: '8px 0 0' }}>{t('input.missingN', { n: missingEssential })}</p>}

            {(p.check?.questions ?? []).map((q) => (
              <div className="question" key={q.id}>
                <p>{q.question}</p>
                <div className="opts">
                  {q.options.map((o) => (
                    <button key={o} className={`chip ${p.answers[q.id] === o ? 'on' : ''}`}
                      onClick={() => update((d) => { d.answers[q.id] = `${q.question} → ${o}`; })}>{o}</button>
                  ))}
                </div>
                <input className="input" style={{ marginTop: 6, height: 32 }} placeholder={t('input.ownAnswer')}
                  onBlur={(e) => e.target.value && update((d) => { d.answers[q.id] = `${q.question} → ${e.target.value}`; })} />
                {p.answers[q.id] && <div className="mono" style={{ color: 'var(--pencil)', marginTop: 4 }}>✓ {p.answers[q.id].split('→').pop()}</div>}
              </div>
            ))}
          </section>

          {vague.length > 0 && (
            <section className="note warn">
              <b>{t('input.vagueTitle')}</b>
              {vague.map((w) => (
                <div key={w} style={{ marginTop: 6 }}>
                  “{w}” → {(VAGUE_WORDS.ko[w] ?? VAGUE_WORDS.en[w]).join(' / ')}
                </div>
              ))}
            </section>
          )}

          <section className="sheet tips">
            <h3>{t('tips.title')}</h3>
            <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>{t('tips.lede')}</p>
            <ol>
              {Array.from({ length: 8 }, (_, i) => (
                <li key={i}><b>{t(`tips.must.${i}.name`)}</b><span className="muted">{t(`tips.must.${i}.why`)} — {t(`tips.must.${i}.ex`)}</span></li>
              ))}
            </ol>
            <p className="eyebrow" style={{ margin: '16px 0 8px' }}>{t('tips.better')}</p>
            <ol start={9}>
              {Array.from({ length: 5 }, (_, i) => (
                <li key={i}><b>{t(`tips.nice.${i}.name`)}</b><span className="muted">{t(`tips.nice.${i}.why`)}</span></li>
              ))}
            </ol>
            <p className="note" style={{ marginTop: 14 }}>{t('tips.cliche')}</p>
          </section>
        </aside>
      </div>
      {ai.busy && (
        <div className="toast" role="status">
          {t(`input.busy.${ai.busy}`)} <button className="link" style={{ color: '#fff', marginLeft: 8 }} onClick={ai.cancel}>{t('common.cancel')}</button>
        </div>
      )}
    </div>
  );
}
