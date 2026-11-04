import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { newProject, useStore } from '../store';
import { SAMPLES } from '../data/samples';
import Preview from '../components/Preview';
import type { Project } from '../lib/types';
import { detectLang } from '../lib/util';

function Thumb({ p }: { p: Project }) {
  const first = p.screens.find((s) => s.status === 'done' && s.html);
  if (!first) return <div className="empty">{p.name.slice(0, 1)}</div>;
  return <Preview html={first.html} tokens={p.tokens} mode="static" title={p.name} />;
}

export default function Home() {
  const { t, i18n } = useTranslation();
  const { go, setProject, notify, settings, openSettings } = useStore();
  const projects = useLiveQuery(() => db.projects.orderBy('updatedAt').reverse().toArray(), []) ?? [];
  const fileRef = useRef<HTMLInputElement>(null);
  const lang = (i18n.language === 'en' ? 'en' : 'ko') as 'ko' | 'en';
  const [firstVisit] = useState(() => !localStorage.getItem('specfold.visited'));
  useEffect(() => localStorage.setItem('specfold.visited', '1'), []);

  const start = async (p: Project) => {
    await db.projects.put(p);
    setProject(p);
    go({ name: 'project', id: p.id, step: p.step });
  };
  const blank = () => {
    start(newProject({ name: t('home.untitled'), contentLang: lang }));
    if (!settings.apiKey && settings.provider !== 'local') setTimeout(() => openSettings(true), 300);
  };
  const fromSample = (i: number) => {
    const s = SAMPLES[i];
    const text = s.text[lang];
    start(newProject({ name: s.title[lang], specRaw: text, contentLang: detectLang(text) }));
  };
  const importJson = async (f: File) => {
    try {
      const p = JSON.parse(await f.text()) as Project;
      if (!p.id || !('specRaw' in p)) throw new Error('invalid');
      p.readonly = false;
      if (await db.projects.get(p.id)) p.id = newProject().id;
      await start(p);
      notify(t('home.imported'));
    } catch {
      notify(t('home.importFail'));
    }
  };
  const remove = async (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(t('home.confirmDelete', { name: p.name }))) await db.projects.delete(p.id);
  };

  return (
    <div className="page">
      <section className="hero unfold-seq">
        <div>
          <p className="eyebrow">{t('home.eyebrow')}</p>
          <h1 dangerouslySetInnerHTML={{ __html: t('home.title') }} />
          <p className="lede">{t('home.lede')}</p>
        </div>
        <div className="hero-side">
          <button className="demo-sticker" onClick={() => go({ name: 'project', id: 'demo', step: 'studio' })}>
            <small>{t('home.demoTag')}</small>
            <b>{t('home.demo')}<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h15M13 6l6 6-6 6" /></svg></b>
            <span>{t('home.demoSub')}</span>
          </button>
          <div className="row">
            <button className="btn ink" onClick={blank}>+ {t('home.new')}</button>
            <button className="btn" onClick={() => fileRef.current?.click()}>{t('home.import')}</button>
          </div>
          <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
          <div className="privacy">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M5 9V6a5 5 0 0110 0v3M4 9h12v9H4z" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
            <span>{t('home.privacy')}</span>
          </div>
        </div>
      </section>

      {firstVisit && (
        <div className="firstvisit unfold">
          <span>{t('home.firstVisit')}</span>
          <button className="btn sm pencil" onClick={() => go({ name: 'project', id: 'demo', step: 'studio' })}>{t('home.demo')}</button>
        </div>
      )}

      <div className="home-grid">
        <section>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 26 }}>{t('home.mine')}</h2>
            <span className="mono muted">{projects.length}</span>
          </div>
          {projects.length === 0 ? (
            <p className="muted" style={{ borderTop: '1px solid var(--line)', paddingTop: 16 }}>{t('home.empty')}</p>
          ) : (
            <div className="projects unfold-seq">
              {projects.map((p) => (
                <div key={p.id} className="pcard" role="button" tabIndex={0}
                  onClick={() => go({ name: 'project', id: p.id, step: p.step })}
                  onKeyDown={(e) => e.key === 'Enter' && go({ name: 'project', id: p.id, step: p.step })}>
                  <div className="thumb"><Thumb p={p} /></div>
                  <div className="meta">
                    <div>
                      <b>{p.name}</b>
                      <div className="mono muted">{t(`steps.${p.step}`)} · {new Date(p.updatedAt).toLocaleDateString(lang)}</div>
                    </div>
                    <button className="btn sm ghost" aria-label={t('common.delete')} onClick={(e) => remove(p, e)}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        <aside>
          <h2 style={{ fontSize: 22, marginBottom: 6 }}>{t('home.samples')}</h2>
          <p className="muted" style={{ fontSize: 13, margin: '0 0 12px' }}>{t('home.samplesLede')}</p>
          <div className="samples">
            {SAMPLES.map((s, i) => (
              <button key={s.id} className="sample" onClick={() => fromSample(i)}>
                <span className="num">{i + 1}</span>
                <span>
                  <h4>{s.title[lang]}</h4>
                  <p>{s.shows[lang]}</p>
                </span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
