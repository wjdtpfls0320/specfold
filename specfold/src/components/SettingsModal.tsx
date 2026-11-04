import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store';
import { PROVIDERS, modelGrade, providerInfo, testConnection } from '../lib/llm/providers';
import type { ProviderId, ProviderSettings } from '../lib/types';

export default function SettingsModal() {
  const { t } = useTranslation();
  const { settings, setSettings, openSettings, notify } = useStore();
  const [s, setS] = useState<ProviderSettings>(settings);
  const [testing, setTesting] = useState<'idle' | 'busy' | 'ok' | 'fail'>('idle');
  const [err, setErr] = useState('');
  const [adv, setAdv] = useState(false);
  const info = providerInfo(s.provider);

  const pick = (id: ProviderId) => {
    const p = providerInfo(id);
    setS({ ...s, provider: id, baseUrl: '', fastModel: p.fastModel, strongModel: p.strongModel, apiKey: id === s.provider ? s.apiKey : '' });
    setTesting('idle');
  };
  const test = async () => {
    setTesting('busy');
    setErr('');
    try {
      await testConnection(s);
      setTesting('ok');
    } catch (e) {
      setTesting('fail');
      setErr(e instanceof Error ? e.message : String(e));
    }
  };
  const save = () => {
    setSettings(s);
    openSettings(false);
    notify(t('settings.saved'));
  };
  const grade = (m: string) => {
    const g = modelGrade(s.provider, m);
    return <span className={`grade ${g}`}>{t(`settings.grade.${g}`)}</span>;
  };

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && openSettings(false)}>
      <div className="modal sheet unfold" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <p className="eyebrow">{t('settings.eyebrow')}</p>
        <h2 id="settings-title">{t('settings.title')}</h2>
        <p className="muted" style={{ marginTop: 6 }}>{t('settings.lede')}</p>

        <div style={{ display: 'grid', gap: 16, marginTop: 20 }}>
          <div className="prov" role="group">
            {PROVIDERS.map((p) => (
              <button key={p.id} aria-pressed={s.provider === p.id} onClick={() => pick(p.id)}>
                {p.id === 'local' ? t('settings.local') : p.label}
              </button>
            ))}
          </div>

          {info.needsKey && (
            <label className="field">
              <span>{t('settings.key')}</span>
              <input className="input" type="password" autoComplete="off" spellCheck={false} value={s.apiKey}
                placeholder={t('settings.keyPh')} onChange={(e) => setS({ ...s, apiKey: e.target.value.trim() })} />
            </label>
          )}
          {s.provider === 'local' && (
            <>
              <label className="field">
                <span>{t('settings.baseUrl')}</span>
                <input className="input" value={s.baseUrl} placeholder={info.defaultBase} onChange={(e) => setS({ ...s, baseUrl: e.target.value })} />
              </label>
              <div className="note warn">{t('settings.ollama')} <code className="mono">OLLAMA_ORIGINS=*</code></div>
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <label className="field">
              <span>{t('settings.fast')} {grade(s.fastModel)}</span>
              <input className="input" value={s.fastModel} onChange={(e) => setS({ ...s, fastModel: e.target.value })} />
            </label>
            <label className="field">
              <span>{t('settings.strong')} {grade(s.strongModel)}</span>
              <input className="input" value={s.strongModel} onChange={(e) => setS({ ...s, strongModel: e.target.value })} />
            </label>
          </div>
          <button className="link" style={{ justifySelf: 'start', fontSize: 13 }} onClick={() => setAdv(!adv)}>{t('settings.advanced')}</button>
          {adv && (
            <div className="note">
              {t('settings.advancedNote')}
              {s.provider !== 'local' && (
                <label className="field" style={{ marginTop: 10 }}>
                  <span>{t('settings.baseUrl')}</span>
                  <input className="input" value={s.baseUrl} placeholder={info.defaultBase} onChange={(e) => setS({ ...s, baseUrl: e.target.value })} />
                </label>
              )}
            </div>
          )}
          {modelGrade(s.provider, s.strongModel) === 'weak' && <div className="note warn">{t('settings.weakWarn')}</div>}

          <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'grid', gap: 6 }}>
            <legend className="field" style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{t('settings.persist')}</legend>
            <div className="seg">
              <button aria-pressed={s.persist === 'session'} onClick={() => setS({ ...s, persist: 'session' })}>{t('settings.session')}</button>
              <button aria-pressed={s.persist === 'device'} onClick={() => setS({ ...s, persist: 'device' })}>{t('settings.device')}</button>
            </div>
            {s.persist === 'device' && <div className="note warn">{t('settings.deviceWarn')}</div>}
          </fieldset>

          <div className="note">{t('settings.privacy')}</div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn" disabled={testing === 'busy' || (info.needsKey && !s.apiKey)} onClick={test}>
              {testing === 'busy' ? t('settings.testing') : t('settings.test')}
            </button>
            {testing === 'ok' && <span className="mono" style={{ color: 'var(--pencil)' }}>✓ {t('settings.testOk')}</span>}
            {testing === 'fail' && <span className="mono" style={{ color: 'var(--warn)' }}>✗ {t('settings.testFail')}</span>}
            <div style={{ flex: 1 }} />
            <button className="btn ghost" onClick={() => openSettings(false)}>{t('common.cancel')}</button>
            <button className="btn ink" onClick={save}>{t('common.save')}</button>
          </div>
          {err && <div className="note warn mono" style={{ wordBreak: 'break-word' }}>{err}</div>}
        </div>
      </div>
    </div>
  );
}
