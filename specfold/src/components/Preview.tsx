import { useEffect, useMemo, useRef } from 'react';
import { buildPreviewDoc } from '../lib/preview';
import { tokensToCss } from '../lib/tokens';
import type { DesignTokens } from '../lib/types';

export interface SelectedEl {
  id: string;
  tag: string;
  text: string;
  outer: string;
  styles: Record<string, string>;
}

interface Props {
  html: string;
  tokens: DesignTokens | null;
  mode?: 'prototype' | 'select' | 'static';
  dark?: boolean;
  lang?: string;
  title?: string;
  onNav?: (to: string) => void;
  onSelect?: (el: SelectedEl) => void;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Sandboxed preview (allow-scripts only — no same-origin, so generated code cannot
 * reach the app's storage or API keys). The document is rebuilt only when html changes;
 * token edits and mode switches are pushed live via postMessage.
 */
export default function Preview({ html, tokens, mode = 'prototype', dark, lang, title, onNav, onSelect, style, className }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const doc = useMemo(() => buildPreviewDoc(html, tokensRef.current, { mode: mode === 'static' ? 'static' : modeRef.current, dark, lang }), [html, dark, lang, tokens?.font.display.family, tokens?.font.body.family, mode === 'static']);

  useEffect(() => {
    const w = ref.current?.contentWindow;
    if (w && tokens) w.postMessage({ __dw: true, type: 'tokens', css: tokensToCss(tokens, { dark }) }, '*');
  }, [tokens, dark]);

  useEffect(() => {
    ref.current?.contentWindow?.postMessage({ __dw: true, type: 'mode', mode }, '*');
  }, [mode]);

  useEffect(() => {
    if (mode === 'static') return;
    const onMsg = (e: MessageEvent) => {
      if (e.source !== ref.current?.contentWindow) return;
      const d = e.data;
      if (!d?.__dw) return;
      if (d.type === 'nav') onNav?.(d.to);
      if (d.type === 'select') onSelect?.(d.el);
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onNav, onSelect, mode]);

  const onLoad = () => {
    const w = ref.current?.contentWindow;
    if (!w) return;
    w.postMessage({ __dw: true, type: 'mode', mode: modeRef.current }, '*');
    if (tokensRef.current) w.postMessage({ __dw: true, type: 'tokens', css: tokensToCss(tokensRef.current, { dark }) }, '*');
  };

  return (
    <iframe
      ref={ref}
      title={title ?? 'preview'}
      sandbox="allow-scripts"
      srcDoc={doc}
      onLoad={onLoad}
      style={style}
      className={className}
    />
  );
}
