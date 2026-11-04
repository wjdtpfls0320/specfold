import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore, newProject } from './store';
import type { Step } from './lib/types';
import Home from './views/Home';
import SpecInput from './views/SpecInput';
import SpecReview from './views/SpecReview';
import DirectionView from './views/Direction';
import Studio from './views/Studio';
import ExportView from './views/Export';
import SettingsModal from './components/SettingsModal';
import { db } from './lib/db';

export const STEPS: Step[] = ['input', 'review', 'direction', 'studio', 'export'];

export function Logo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 3h12l6 6v12H3z" fill="#f8f6f1" stroke="#17171a" strokeWidth="1.6" />
      <path d="M15 3v6h6" fill="#2340d6" stroke="#17171a" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 13h9M7 16.5h6" stroke="#17171a" strokeWidth="1.6" />
    </svg>
  );
}

function TopBar() {
  const { t, i18n } = useTranslation();
  const { route, project, go, openSettings, settings } = useStore();
  const reachable = (s: Step) => {
    if (!project) return false;
    if (s === 'input') return true;
    if (s === 'review') return !!project.spec;
    if (s === 'direction') return !!project.spec;
    return !!project.tokens;
  };
  return (
    <header className="topbar">
      <button className="wordmark" onClick={() => go({ name: 'home' })} aria-label="Specfold home">
        <Logo /> Specfold
      </button>
      {route.name === 'project' && project && (
        <nav className="steps" aria-label={t('steps.aria')}>
          {STEPS.map((s, i) => (
            <button
              key={s}
              aria-current={route.step === s ? 'step' : undefined}
              disabled={!reachable(s)}
              onClick={() => go({ name: 'project', id: project.id, step: s })}
            >
              <span className="n">{String(i + 1).padStart(2, '0')}</span>
              <span className="label">{t(`steps.${s}`)}</span>
            </button>
          ))}
        </nav>
      )}
      <div className="spacer" />
      <button className="btn sm ghost" onClick={() => openSettings(true)}>
        <span className="mono">{settings.provider === 'local' || settings.apiKey ? '●' : '○'}</span> {t('settings.open')}
      </button>
      <div className="lang" role="group" aria-label="Language">
        {(['ko', 'en'] as const).map((l) => (
          <button key={l} aria-pressed={i18n.language === l} onClick={() => i18n.changeLanguage(l)}>
            {l === 'ko' ? '한국어' : 'EN'}
          </button>
        ))}
      </div>
    </header>
  );
}

function ReadonlyBand() {
  const { t } = useTranslation();
  const { project, setProject, go, notify } = useStore();
  if (!project?.readonly) return null;
  const copy = async () => {
    const copyP = newProject({ ...structuredClone(project), readonly: false, name: project.name + t('demo.copySuffix') });
    copyP.id = newProject().id;
    await db.projects.put(copyP);
    setProject(copyP);
    go({ name: 'project', id: copyP.id, step: 'studio' });
    notify(t('demo.copied'));
  };
  return (
    <div className="readonly-band">
      <span>{t('demo.readonly')}</span>
      <button className="btn sm" onClick={copy}>{t('demo.copy')}</button>
    </div>
  );
}

export default function App() {
  const { route, project, openProject, settingsOpen, toast } = useStore();

  useEffect(() => {
    if (route.name === 'project' && project?.id !== route.id) openProject(route.id, route.step);
    window.scrollTo(0, 0);
  }, [route]);

  useEffect(() => {
    if (route.name === 'project' && project && project.step !== route.step && !project.readonly) {
      useStore.getState().update((p) => {
        p.step = route.step;
      });
    }
  }, [route, project?.id]);

  let body: JSX.Element = <Home />;
  if (route.name === 'project') {
    if (!project || project.id !== route.id) body = <div className="page muted">…</div>;
    else {
      const V = { input: SpecInput, review: SpecReview, direction: DirectionView, studio: Studio, export: ExportView }[route.step] ?? SpecInput;
      body = <V key={route.step} />;
    }
  }

  return (
    <>
      <TopBar />
      <ReadonlyBand />
      <main>{body}</main>
      {settingsOpen && <SettingsModal />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
