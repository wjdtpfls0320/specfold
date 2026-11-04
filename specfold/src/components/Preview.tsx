import { useEffect, useMemo, useRef, useState } from 'react';
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
  /** The screen tried to leave its own document (real link / location.href); value is a screen-id guess. */
  onNavAttempt?: (to: string) => void;
  /** Text edited in place (select mode, double-click): new outerHTML of the owning data-dw-id element. */
  onTextEdit?: (id: string, outer: string, text: string) => boolean;
  /** The frame left its document anyway and was restored. */
  onEscape?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Sandboxed preview (allow-scripts only — no same-origin, so generated code cannot
 * reach the app's storage or API keys). The document is rebuilt only when html changes;
 * token edits and mode switches are pushed live via postMessage.
 */
export default function Preview({ html, tokens, mode = 'prototype', dark, lang, title, onNav, onSelect, onNavAttempt, onTextEdit, onEscape, style, className }: Props) {
  const ref = useRef<HTMLIFrameElement>(null);
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // An in-place text edit already changed the DOM inside the frame. When the html prop comes back
  // with that edit, keep the current document instead of reloading the frame (no white flash).
  const latestHtml = useRef(html);
  latestHtml.current = html;
  const inFrameEditAt = useRef(0);
  const [docVersion, setDocVersion] = useState(0);
  const firstHtml = useRef(true);
  useEffect(() => {
    if (firstHtml.current) { firstHtml.current = false; return; }
    if (Date.now() - inFrameEditAt.current < 2000) { inFrameEditAt.current = 0; return; }
    setDocVersion((v) => v + 1);
  }, [html]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const doc = useMemo(() => buildPreviewDoc(latestHtml.current, tokensRef.current, { mode: mode === 'static' ? 'static' : modeRef.current, dark, lang }), [docVersion, dark, lang, tokens?.font.display.family, tokens?.font.body.family, mode === 'static']);

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
      if (d.type === 'nav-attempt') onNavAttempt?.(String(d.to || ''));
      if (d.type === 'text-edit' && d.id && d.outer && onTextEdit) {
        inFrameEditAt.current = Date.now();
        if (!onTextEdit(String(d.id), String(d.outer), String(d.text || ''))) {
          inFrameEditAt.current = 0;
          setDocVersion((v) => v + 1); // not saved: reload to drop the unsaved in-frame change
        }
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, [onNav, onSelect, onNavAttempt, onTextEdit, mode]);

  // Fallback for browsers without the Navigation API: a second load of the same srcdoc means the
  // frame navigated away (it would stay blank). Remount it, at most 3 times per document.
  const loads = useRef(0);
  const escapes = useRef(0);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    loads.current = 0;
    escapes.current = 0;
  }, [doc]);

  const onLoad = () => {
    loads.current += 1;
    if (loads.current > 1) {
      loads.current = 0;
      if (escapes.current < 3) {
        escapes.current += 1;
        setNonce((n) => n + 1);
        onEscape?.();
      }
      return;
    }
    const w = ref.current?.contentWindow;
    if (!w) return;
    w.postMessage({ __dw: true, type: 'mode', mode: modeRef.current }, '*');
    if (tokensRef.current) w.postMessage({ __dw: true, type: 'tokens', css: tokensToCss(tokensRef.current, { dark }) }, '*');
  };

  return (
    <iframe
      key={nonce}
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
