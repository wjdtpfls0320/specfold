import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store';
import { hasKey, type Ctx } from '../lib/ai';
import type { Lang } from '../lib/types';

/** Shared wrapper for AI calls: key guard, busy state, abort, error toast. */
export function useAI() {
  const { t, i18n } = useTranslation();
  const [busy, setBusy] = useState<string | null>(null);
  const [stream, setStream] = useState('');
  const abort = useRef<AbortController | null>(null);

  async function run<T>(label: string, fn: (ctx: Ctx) => Promise<T>): Promise<T | undefined> {
    const st = useStore.getState();
    if (st.project?.readonly) {
      st.notify(t('demo.readonlyAction'));
      return;
    }
    if (!hasKey(st.settings)) {
      st.notify(t('settings.needKey'));
      st.openSettings(true);
      return;
    }
    abort.current = new AbortController();
    setBusy(label);
    setStream('');
    try {
      return await fn({
        settings: st.settings,
        uiLang: (i18n.language === 'en' ? 'en' : 'ko') as Lang,
        signal: abort.current.signal,
        onToken: (_c, full) => setStream(full),
      });
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') st.notify(t('common.cancelled'));
      else st.notify(t('common.aiError', { msg: (e as Error)?.message ?? String(e) }));
      throw e;
    } finally {
      setBusy(null);
      abort.current = null;
    }
  }
  const cancel = () => abort.current?.abort();
  return { run, busy, stream, cancel };
}
