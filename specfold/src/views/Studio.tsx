import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { logChange, screensFromSpec, useStore } from '../store';
import { aiEdit, aiEditFull, aiFix, aiScreen, type Ctx, type EditResult } from '../lib/ai';
import { useAI } from '../components/useAI';
import Preview, { type SelectedEl } from '../components/Preview';
import { lintProject, lintScreen } from '../lib/lint';
import { applyEdit, getOuter, patchElement, setTextSegment, textSegments } from '../lib/edits';
import { FONT_PAIRS, setTokenPath } from '../lib/tokens';
import { QUICK_CHIPS } from '../lib/prompts';
import { uid } from '../lib/util';
import type { ChangeEntry, LintViolation, Project, SpecScreen } from '../lib/types';

type Device = 'mobile' | 'tablet' | 'desktop';
const WIDTH: Record<Device, number> = { mobile: 390, tablet: 768, desktop: 1280 };
type Scope = 'element' | 'screen' | 'global';
interface Msg { id: string; who: 'user' | 'ai'; text: string; err?: boolean; clarify?: { question: string; options: string[] }; req?: string }

/** Apply an EditResult (P5/P6) to a project draft. Returns ids of edits that failed to apply. */
function applyResult(d: Project, r: EditResult, fallbackScreen: string): string[] {
  const failed: string[] = [];
  for (const e of r.edits ?? []) {
    const sid = e.screenId || fallbackScreen;
    const s = d.screens.find((x) => x.id === sid);
    if (!s) { failed.push(sid); continue; }
    const out = applyEdit(s.html, e.targetId, e.replaceWith);
    if (out === null) failed.push(sid);
    else { s.html = out; s.updatedAt = Date.now(); }
  }
  if (r.tokenChanges && d.tokens) {
    for (const [path, val] of Object.entries(r.tokenChanges)) d.tokens = setTokenPath(d.tokens, path, val);
  }
  if (r.newScreens?.length && d.spec) {
    for (const ns of r.newScreens) if (!d.spec.screens.some((x) => x.id === ns.id)) d.spec.screens.push(ns);
    d.screens = screensFromSpec(d.spec, d.screens);
  }
  return failed;
}

export default function Studio() {
  const { t, i18n } = useTranslation();
  const { project, update, undo, redo, past, future, go, notify } = useStore();
  const p = project!;
  const ro = !!p.readonly;
  const ai = useAI();
  const [cur, setCur] = useState(p.screens[0]?.id ?? '');
  const [device, setDeviceState] = useState<Device>(p.device ?? (p.spec?.platform === 'desktop' ? 'desktop' : 'mobile'));
  const setDevice = (d: Device) => {
    setDeviceState(d);
    if (!p.readonly) update((x) => { x.device = d; });
  };
  const [mode, setMode] = useState<'prototype' | 'select'>('prototype');
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState<'chat' | 'adjust' | 'log'>('chat');
  const [sel, setSel] = useState<SelectedEl | null>(null);
  const [scope, setScope] = useState<Scope>('screen');
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [genQueue, setGenQueue] = useState<string | null>(null);
  const [showLint, setShowLint] = useState(false);
  const [showSnaps, setShowSnaps] = useState(false);
  const [compare, setCompare] = useState<string | null>(null);
  const [snapName, setSnapName] = useState('');
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(800);
  const uiLang = (i18n.language === 'en' ? 'en' : 'ko') as 'ko' | 'en';

  const screen = p.screens.find((s) => s.id === cur) ?? p.screens[0];
  const specScreen = p.spec?.screens.find((s) => s.id === screen?.id);
  const curRef = useRef('');
  curRef.current = screen?.id ?? '';
  const lint = useMemo(() => lintProject(p.screens, p.tokens, p.contentLang, p.spec?.platform), [p.screens, p.tokens, p.contentLang, p.spec?.platform]);

  useEffect(() => { if (!screen && p.screens[0]) setCur(p.screens[0].id); }, [p.screens.length]);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStageW(el.clientWidth - 56));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || (e.target as HTMLElement)?.closest('input,textarea,.cm-editor')) return;
      if (e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.key.toLowerCase() === 'z' && e.shiftKey) || e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const say = (m: Omit<Msg, 'id'>) => setMsgs((x) => [...x, { id: uid(), ...m }]);

  // ---------- generation (P4) + auto lint fix (P6, once) ----------
  const genOne = async (ctx: Ctx, sc: SpecScreen) => {
    update((d) => { const s = d.screens.find((x) => x.id === sc.id); if (s) s.status = 'generating'; });
    try {
      const { html, notes } = await aiScreen(useStore.getState().project!, sc, ctx);
      update((d) => {
        const s = d.screens.find((x) => x.id === sc.id);
        if (s) Object.assign(s, { html, notes, status: 'done', updatedAt: Date.now() });
      }, { undoable: true });
      const fresh = useStore.getState().project!;
      const v = lintScreen(fresh.screens.find((x) => x.id === sc.id)!, fresh.tokens!, fresh.contentLang, fresh.spec?.platform).filter((x) => x.severity === 'fix');
      if (v.length) {
        const r = await aiFix(fresh, { ...ctx, onToken: undefined }, sc.id, v);
        let failed: string[] = [];
        update((d) => { failed = applyResult(d, r, sc.id); });
        const rules = v.map((x) => t(`lint.${x.rule}`)).join(', ');
        say({ who: 'ai', text: t(failed.length ? 'studio.autoFixFailed' : 'studio.autoFixed', { name: sc.name, rules }), err: failed.length > 0 });
      }
    } catch (e) {
      update((d) => { const s = d.screens.find((x) => x.id === sc.id); if (s) s.status = s.html ? 'done' : 'error'; });
      throw e;
    }
  };

  const generate = (ids: string[]) =>
    ai.run('generate', async (ctx) => {
      for (const id of ids) {
        const sc = useStore.getState().project!.spec!.screens.find((s) => s.id === id);
        if (!sc) continue;
        setGenQueue(id);
        setCur(id);
        await genOne(ctx, sc);
      }
      setGenQueue(null);
    }).catch(() => setGenQueue(null));

  // ---------- chat edits (P5) ----------
  const send = (request: string, label?: string) => {
    if (!request.trim() || !screen) return;
    const effScope: Scope = scope === 'element' && !sel ? 'screen' : scope;
    say({ who: 'user', text: (label ?? request) + (effScope === 'element' && sel ? `\n[${sel.id}]` : '') });
    setInput('');
    ai.run('edit', async (ctx) => {
      const before = useStore.getState().project!;
      const r = await aiEdit(before, ctx, {
        request, scope: effScope, screenId: screen.id, selectedId: sel?.id,
        selectedOuter: sel ? getOuter(screen.html, sel.id) || sel.outer : undefined,
      });
      if (r.clarify && r.clarify.question) {
        say({ who: 'ai', text: r.clarify.question, clarify: r.clarify, req: request });
        return;
      }
      let failed: string[] = [];
      update((d) => {
        failed = applyResult(d, r, screen.id);
        const touched = [...new Set([...(r.edits ?? []).map((e) => e.screenId || screen.id), ...(r.newScreens ?? []).map((s) => s.id)])];
        logChange(d, {
          request, scope: r.tokenChanges && !r.edits?.length ? 'tokens' : effScope,
          screenIds: touched.length ? touched : [screen.id],
          specImpact: r.specImpact ?? { type: 'none', summary: '' }, note: r.note,
        });
      }, { undoable: true });
      if (failed.length) {
        // fallback: whole-screen regeneration of the affected screen
        say({ who: 'ai', text: t('studio.fallback') });
        const html = await aiEditFull(useStore.getState().project!, ctx, request, failed[0]);
        update((d) => { const s = d.screens.find((x) => x.id === failed[0]); if (s) { s.html = html; s.updatedAt = Date.now(); } });
      }
      say({ who: 'ai', text: r.note || t('studio.applied') });
      // generate newly-defined screens
      const pending = (r.newScreens ?? []).map((s) => s.id);
      if (pending.length) {
        say({ who: 'ai', text: t('studio.newScreens', { names: r.newScreens!.map((s) => s.name).join(', ') }) });
        for (const id of pending) {
          const sc = useStore.getState().project!.spec!.screens.find((s) => s.id === id);
          if (sc) { setGenQueue(id); await genOne(ctx, sc); }
        }
        setGenQueue(null);
      }
    }).catch((e) => say({ who: 'ai', text: String(e?.message ?? e), err: true }));
  };

  const autoFix = () =>
    ai.run('fix', async (ctx) => {
      const byScreen = new Map<string, LintViolation[]>();
      lint.filter((v) => v.severity === 'fix').forEach((v) => {
        const k = v.screenId ?? cur;
        byScreen.set(k, [...(byScreen.get(k) ?? []), v]);
      });
      for (const [sid, vs] of byScreen) {
        const r = await aiFix(useStore.getState().project!, ctx, sid, vs);
        update((d) => {
          applyResult(d, r, sid);
          logChange(d, { request: `${t('studio.lintFix')}: ${vs.map((v) => v.rule).join(', ')}`, scope: 'screen', screenIds: [sid], specImpact: { type: 'none', summary: '' }, note: r.note });
        }, { undoable: true });
      }
      notify(t('studio.fixedAll'));
    }).catch(() => {});

  // ---------- direct adjust (no AI) ----------
  const setTok = (path: string, val: unknown, label: string) =>
    update((d) => {
      d.tokens = setTokenPath(d.tokens!, path, val);
      const last = d.changeLog[d.changeLog.length - 1];
      // collapse consecutive slider moves into one log entry
      if (last && last.scope === 'tokens' && last.request === label && Date.now() - last.at < 4000) last.at = Date.now();
      else logChange(d, { request: label, scope: 'tokens', screenIds: [], specImpact: { type: 'none', summary: '' } });
    }, { undoable: true });

  const patchSel = (patch: Parameters<typeof patchElement>[2], label: string, impact: ChangeEntry['specImpact']['type'] = 'none') => {
    if (!sel || !screen) return;
    update((d) => {
      const s = d.screens.find((x) => x.id === screen.id)!;
      const out = patchElement(s.html, sel.id, patch);
      if (out !== null) { s.html = out; s.updatedAt = Date.now(); }
      const last = d.changeLog[d.changeLog.length - 1];
      if (last && last.request === label && Date.now() - last.at < 4000) last.at = Date.now();
      else logChange(d, { request: label, scope: 'element', screenIds: [screen.id], specImpact: { type: impact, summary: impact === 'none' ? '' : label } });
    }, { undoable: true });
  };

  const onNav = useCallback((to: string) => {
    const exists = useStore.getState().project?.screens.some((s) => s.id === to);
    if (exists) setCur(to);
    else notify(t('studio.navMissing', { id: to }));
  }, []);
  const onNavAttempt = useCallback((to: string) => {
    const screens = useStore.getState().project?.screens ?? [];
    const hit = screens.find((s) => s.id === to) ?? screens.find((s) => to && (s.id.includes(to) || to.includes(s.id)));
    if (hit) setCur(hit.id);
    else notify(t('studio.navBlocked'));
  }, []);
  const onEscape = useCallback(() => notify(t('studio.escaped')), []);
  const onTextEdit = useCallback((id: string, outer: string, text: string): boolean => {
    const st = useStore.getState();
    if (st.project?.readonly) { notify(t('demo.readonlyAction')); return false; }
    const sid = curRef.current;
    const cur = st.project?.screens.find((x) => x.id === sid);
    const out = cur ? applyEdit(cur.html, id, outer) : null;
    if (out === null || out === cur!.html) return false;
    st.update((d) => {
      const s = d.screens.find((x) => x.id === sid)!;
      s.html = out;
      s.updatedAt = Date.now();
      logChange(d, { request: `${t('studio.adj.text')}: "${text}"`, scope: 'element', screenIds: [sid], specImpact: { type: 'content_change', summary: text } });
    }, { undoable: true });
    return true;
  }, []);
  const onSelect = useCallback((el: SelectedEl) => { setSel(el); setScope('element'); setTab((x) => (x === 'log' ? 'chat' : x)); }, []);

  const saveSnapshot = () =>
    update((d) => {
      d.snapshots.push({ id: uid('s'), name: snapName || new Date().toLocaleString(uiLang), at: Date.now(), screens: structuredClone(d.screens), tokens: structuredClone(d.tokens) });
      setSnapName('');
    });
  const restore = (id: string) =>
    update((d) => {
      const s = d.snapshots.find((x) => x.id === id)!;
      d.screens = structuredClone(s.screens);
      d.tokens = structuredClone(s.tokens);
      logChange(d, { request: `${t('studio.restored')}: ${s.name}`, scope: 'global', screenIds: [], specImpact: { type: 'none', summary: '' }, snapshotId: s.id });
    }, { undoable: true });

  if (!p.tokens || !p.spec) {
    return <div className="page"><p>{t('studio.needDirection')}</p><button className="btn ink" onClick={() => go({ name: 'project', id: p.id, step: 'direction' })}>{t('steps.direction')}</button></div>;
  }

  const w = WIDTH[device];
  const scale = Math.min(1, stageW / w);
  const pendingIds = p.screens.filter((s) => s.status !== 'done').map((s) => s.id);
  const compareSnap = compare ? p.snapshots.find((s) => s.id === compare) : null;
  const tk = p.tokens;
  const fixable = lint.filter((v) => v.severity === 'fix').length;
  const selTexts = sel && screen ? textSegments(screen.html, sel.id) : [];
  const setSegment = (i: number, value: string) => {
    if (!sel || !screen) return;
    update((d) => {
      const s = d.screens.find((x) => x.id === screen.id)!;
      const out = setTextSegment(s.html, sel.id, i, value);
      if (out === null) return;
      s.html = out;
      s.updatedAt = Date.now();
      logChange(d, { request: `${t('studio.adj.text')}: "${value.slice(0, 40)}"`, scope: 'element', screenIds: [screen.id], specImpact: { type: 'content_change', summary: value.slice(0, 60) } });
    }, { undoable: true });
  };

  return (
    <div className="studio">
      {/* ---------- left: screens ---------- */}
      <aside className="studio-left">
        <h4 className="eyebrow">{t('studio.screens')}</h4>
        <ul className="slist">
          {p.screens.map((s, i) => (
            <li key={s.id}>
              <button aria-current={s.id === screen?.id} onClick={() => setCur(s.id)}>
                <span className="mono muted">{String(i + 1).padStart(2, '0')}</span>
                <span>{s.name}</span>
                <span className={`status ${s.status}`} title={t(`studio.status.${s.status}`)} />
              </button>
            </li>
          ))}
        </ul>
        <div style={{ padding: 12, display: 'grid', gap: 8, borderTop: '1px solid var(--line)' }}>
          {pendingIds.length > 0 && (
            <button className="btn pencil sm" disabled={!!ai.busy || ro} onClick={() => generate(pendingIds)}>{t('studio.generateAll', { n: pendingIds.length })}</button>
          )}
          <button className="btn sm" disabled={ro || !!ai.busy} onClick={() => {
            const name = prompt(t('studio.addScreenPrompt'));
            if (!name) return;
            const id = (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'screen') + '-' + uid().slice(0, 3);
            update((d) => {
              d.spec!.screens.push({ id, name, purpose: name, elements: [], priority: '', navTo: [] });
              d.screens = screensFromSpec(d.spec!, d.screens);
              logChange(d, { request: `+ ${name}`, scope: 'global', screenIds: [id], specImpact: { type: 'screen_add', summary: name } });
            }, { undoable: true });
            setCur(id);
          }}>+ {t('studio.addScreen')}</button>
        </div>
      </aside>

      {/* ---------- center: preview ---------- */}
      <section className="studio-center">
        <div className="toolbar">
          <div className="seg" role="group" aria-label="device">
            {(['mobile', 'tablet', 'desktop'] as const).map((d) => <button key={d} aria-pressed={device === d} onClick={() => setDevice(d)}>{t(`studio.device.${d}`)}</button>)}
          </div>
          <div className="seg" role="group" aria-label="mode">
            <button aria-pressed={mode === 'prototype'} onClick={() => setMode('prototype')}>{t('studio.mode.prototype')}</button>
            <button aria-pressed={mode === 'select'} onClick={() => setMode('select')}>{t('studio.mode.select')}</button>
          </div>
          {mode === 'select' && !ro && <span className="mono muted" style={{ fontSize: 11 }}>{t('studio.dblHint')}</span>}
          {tk.color.dark && (
            <div className="seg"><button aria-pressed={!dark} onClick={() => setDark(false)}>{t('studio.light')}</button><button aria-pressed={dark} onClick={() => setDark(true)}>{t('studio.dark')}</button></div>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn sm ghost" disabled={!past.length || ro} onClick={undo} title="Ctrl+Z">↶ {t('studio.undo')}</button>
          <button className="btn sm ghost" disabled={!future.length || ro} onClick={redo} title="Ctrl+Shift+Z">↷</button>
          <div style={{ position: 'relative' }}>
            <button className="btn sm" onClick={() => { setShowSnaps(!showSnaps); setShowLint(false); }}>{t('studio.snapshots')} <span className="mono">{p.snapshots.length}</span></button>
            {showSnaps && (
              <div className="menu sheet">
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" style={{ height: 30 }} placeholder={t('studio.snapName')} value={snapName} onChange={(e) => setSnapName(e.target.value)} disabled={ro} />
                  <button className="btn sm ink" onClick={saveSnapshot} disabled={ro}>{t('common.save')}</button>
                </div>
                {p.snapshots.length === 0 && <span className="muted" style={{ fontSize: 13 }}>{t('studio.noSnaps')}</span>}
                {[...p.snapshots].reverse().map((s) => (
                  <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 6, alignItems: 'center', fontSize: 13 }}>
                    <span><b>{s.name}</b><br /><span className="mono muted">{new Date(s.at).toLocaleString(uiLang)}</span></span>
                    <button className={`btn sm ${compare === s.id ? 'ink' : 'ghost'}`} onClick={() => setCompare(compare === s.id ? null : s.id)}>{t('studio.compare')}</button>
                    <button className="btn sm" disabled={ro} onClick={() => restore(s.id)}>{t('studio.restore')}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button className={`lintbadge ${lint.length ? 'bad' : 'good'}`} onClick={() => { setShowLint(!showLint); setShowSnaps(false); }}>
              {lint.length ? `△ ${t('studio.lint')} ${lint.length}` : `✓ ${t('studio.lint')}`}
            </button>
            {showLint && (
              <div className="menu sheet" style={{ width: 360 }}>
                <b>{t('studio.lintTitle')}</b>
                {lint.length === 0 && <span className="muted" style={{ fontSize: 13 }}>{t('studio.lintClean')}</span>}
                {lint.map((v, i) => (
                  <div key={i} style={{ fontSize: 12, borderTop: '1px solid var(--line)', paddingTop: 6 }}>
                    <span className="mono" style={{ color: v.severity === 'fix' ? 'var(--warn)' : 'var(--ink-2)' }}>{v.severity === 'fix' ? t('studio.fix') : t('studio.warn')}</span>{' '}
                    <b>{t(`lint.${v.rule}`)}</b> {v.screenId && <button className="link" onClick={() => setCur(v.screenId!)}>#{v.screenId}</button>}
                    <div className="muted mono" style={{ wordBreak: 'break-all' }}>{v.detail}</div>
                  </div>
                ))}
                {fixable > 0 && <button className="btn pencil sm" disabled={!!ai.busy || ro} onClick={autoFix}>{t('studio.autoFix', { n: fixable })}</button>}
              </div>
            )}
          </div>
          <button className="btn sm ink" onClick={() => go({ name: 'project', id: p.id, step: 'export' })}>{t('steps.export')} →</button>
        </div>

        <div className="stage" ref={stageRef}>
          {!screen ? null : screen.status !== 'done' && !(ai.busy && genQueue === screen.id && ai.stream) ? (
            <div className="stage-empty">
              <h2 style={{ fontSize: 30 }}>{screen.name}</h2>
              <p className="muted" style={{ maxWidth: 380 }}>{specScreen?.purpose}</p>
              {screen.status === 'generating' ? <span className="mono">{t('studio.status.generating')}…</span> : (
                <button className="btn pencil" disabled={!!ai.busy || ro} onClick={() => generate([screen.id])}>{t('studio.generateThis')}</button>
              )}
              {ro && <span className="muted">{t('demo.readonlyAction')}</span>}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              {compareSnap && (() => {
                const old = compareSnap.screens.find((s) => s.id === screen.id);
                const cs = Math.min(1, (stageW / 2 - 12) / w);
                return (
                  <div>
                    <p className="eyebrow">{compareSnap.name}</p>
                    <div className="device" style={{ width: w * cs, height: 760 * cs }}>
                      <Preview html={old?.html ?? ''} tokens={compareSnap.tokens} mode="static" dark={dark} lang={p.contentLang}
                        style={{ width: w, height: 760, transform: `scale(${cs})`, transformOrigin: '0 0' }} />
                    </div>
                  </div>
                );
              })()}
              <div>
                {compareSnap && <p className="eyebrow">{t('studio.current')}</p>}
                {(() => {
                  const s = compareSnap ? Math.min(1, (stageW / 2 - 12) / w) : scale;
                  const h = device === 'mobile' ? 844 : device === 'tablet' ? 1024 : 800;
                  const live = ai.busy && genQueue === screen.id && ai.stream;
                  const liveHtml = live ? (ai.stream.match(/<screen>([\s\S]*)/)?.[1] ?? '').replace(/<\/screen>[\s\S]*/, '') : '';
                  return (
                    <div className="device" style={{ width: w * s, height: h * s }}>
                      <Preview html={live ? liveHtml : screen.html} tokens={tk} mode={live ? 'static' : mode} dark={dark} lang={p.contentLang}
                        onNav={onNav} onSelect={onSelect} onNavAttempt={onNavAttempt} onTextEdit={onTextEdit} onEscape={onEscape} title={screen.name}
                        style={{ width: w, height: h, transform: `scale(${s})`, transformOrigin: '0 0' }} />
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
          {ai.busy && ai.stream && genQueue && <div className="stream-overlay">{ai.stream.slice(-500)}</div>}
        </div>
      </section>

      {/* ---------- right: chat / adjust / log ---------- */}
      <aside className="studio-right">
        <div className="tabs" role="tablist">
          {(['chat', 'adjust', 'log'] as const).map((x) => (
            <button key={x} role="tab" aria-selected={tab === x} onClick={() => setTab(x)}>
              {t(`studio.tab.${x}`)}{x === 'log' && <span className="mono muted"> {p.changeLog.length}</span>}
            </button>
          ))}
        </div>

        {tab === 'chat' && (
          <div className="pane">
            <div className="msgs">
              {msgs.length === 0 && <p className="muted" style={{ fontSize: 13 }}>{t('studio.chatHint')}</p>}
              {msgs.map((m) => (
                <div key={m.id} className={`msg ${m.who} ${m.err ? 'err' : ''}`}>
                  {m.text}
                  {m.clarify && (
                    <div className="tags" style={{ marginTop: 8 }}>
                      {m.clarify.options.map((o) => <button key={o} className="chip" onClick={() => send(`${m.req}\n(${m.clarify!.question} → ${o})`, o)}>{o}</button>)}
                    </div>
                  )}
                </div>
              ))}
              {ai.busy === 'edit' && <div className="msg ai mono">{t('studio.thinking')}… <button className="link" onClick={ai.cancel}>{t('common.cancel')}</button></div>}
            </div>
            <div className="composer">
              {sel && (
                <span className="selchip">
                  {t('studio.selected')}: <code>{sel.id}</code> <span className="muted">{sel.text.slice(0, 24)}</span>
                  <button className="link" onClick={() => { setSel(null); setScope('screen'); }}>×</button>
                </span>
              )}
              <div className="seg" role="group" aria-label="scope">
                {(['element', 'screen', 'global'] as const).map((s) => (
                  <button key={s} aria-pressed={scope === s} disabled={s === 'element' && !sel} onClick={() => setScope(s)}>{t(`studio.scope.${s}`)}</button>
                ))}
              </div>
              <div className="tags">
                {QUICK_CHIPS.map((c) => <button key={c.id} className="chip" disabled={!!ai.busy || ro || screen?.status !== 'done'} onClick={() => send(c.request, c[uiLang])}>{c[uiLang]}</button>)}
              </div>
              <textarea className="input" rows={3} value={input} placeholder={t('studio.chatPh')} disabled={ro}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(input); } }} />
              <button className="btn ink" disabled={!input.trim() || !!ai.busy || ro || screen?.status !== 'done'} onClick={() => send(input)}>{t('studio.send')}</button>
            </div>
          </div>
        )}

        {tab === 'adjust' && (
          <div className="pane">
            <p className="eyebrow">{t('studio.adj.global')}</p>
            {(['bg', 'surface', 'ink', 'inkMuted', 'primary', 'accent', 'line'] as const).map((k) => (
              <label className="adj-row" key={k}>
                <span>{t(`studio.adj.c.${k}`)}</span>
                <input type="color" value={tk.color[k]} disabled={ro} onChange={(e) => setTok(`color.${k}`, e.target.value, `${t('studio.adj.color')}: ${k}`)} />
              </label>
            ))}
            <label className="adj-row">
              <span>{t('studio.adj.fonts')}</span>
              <select className="input" disabled={ro} value={`${tk.font.display.family}|${tk.font.body.family}`}
                onChange={(e) => {
                  const [dsp, body] = e.target.value.split('|');
                  update((d) => {
                    d.tokens = setTokenPath(setTokenPath(d.tokens!, 'font.display', { family: dsp, weights: [700, 900] }), 'font.body', { family: body, weights: [400, 600] });
                    logChange(d, { request: `${t('studio.adj.fonts')}: ${dsp} / ${body}`, scope: 'tokens', screenIds: [], specImpact: { type: 'none', summary: '' } });
                  }, { undoable: true });
                }}>
                {![...FONT_PAIRS].some((f) => f.display === tk.font.display.family && f.body === tk.font.body.family) && (
                  <option value={`${tk.font.display.family}|${tk.font.body.family}`}>{tk.font.display.family} / {tk.font.body.family}</option>
                )}
                {FONT_PAIRS.map((f) => <option key={f.display + f.body} value={`${f.display}|${f.body}`}>{f.display} / {f.body}</option>)}
              </select>
            </label>
            <label className="adj-row">
              <span>{t('studio.adj.baseSize')} <span className="mono">{tk.scale[2]}px</span></span>
              <input type="range" min={13} max={20} value={tk.scale[2] ?? 16} disabled={ro}
                onChange={(e) => {
                  const base = Number(e.target.value), ratio = base / (tk.scale[2] || 16);
                  setTok('scale', tk.scale.map((x) => Math.round(x * ratio)), t('studio.adj.baseSize'));
                }} />
            </label>
            <label className="adj-row">
              <span>{t('studio.adj.radius')} <span className="mono">{tk.radius.md}px</span></span>
              <input type="range" min={0} max={28} value={tk.radius.md} disabled={ro}
                onChange={(e) => { const r = Number(e.target.value); setTok('radius', { sm: Math.round(r / 2), md: r, lg: r * 2 }, t('studio.adj.radius')); }} />
            </label>
            <label className="adj-row">
              <span>{t('studio.adj.space')} <span className="mono">{tk.space}px</span></span>
              <input type="range" min={4} max={14} value={tk.space} disabled={ro} onChange={(e) => setTok('space', Number(e.target.value), t('studio.adj.space'))} />
            </label>
            <p className="muted" style={{ fontSize: 12, margin: 0 }}>{t('studio.adj.note')}</p>

            <hr className="rule ink" />
            <p className="eyebrow">{t('studio.adj.element')}</p>
            {!sel ? <p className="muted" style={{ fontSize: 13 }}>{t('studio.adj.pickFirst')}</p> : (
              <>
                <span className="selchip"><code>{sel.id}</code></span>
                <div className="field">
                  <span>{t('studio.adj.text')} {selTexts.length > 1 && <span className="mono muted">· {selTexts.length}</span>}</span>
                  {selTexts.length === 0 && <span className="muted" style={{ fontSize: 12 }}>{t('studio.adj.noText')}</span>}
                  {selTexts.map((seg, i) => (
                    <textarea key={`${sel.id}|${i}|${seg}`} className="input" rows={seg.length > 40 ? 3 : 1} defaultValue={seg} disabled={ro}
                      style={{ minHeight: 36 }}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }}
                      onBlur={(e) => e.target.value.trim() !== seg && setSegment(i, e.target.value.trim())} />
                  ))}
                  <span className="muted" style={{ fontSize: 12 }}>{t('studio.adj.textHint')}</span>
                </div>
                {(['padding', 'margin'] as const).map((k) => (
                  <label className="adj-row" key={k}>
                    <span>{t(`studio.adj.${k}`)}</span>
                    <input type="range" min={0} max={64} step={4} defaultValue={parseInt(sel.styles[k]) || 0} disabled={ro}
                      onChange={(e) => patchSel({ [k]: `${e.target.value}px` }, `${t(`studio.adj.${k}`)} · ${sel.id}`)} />
                  </label>
                ))}
                <label className="adj-row">
                  <span>{t('studio.adj.fontSize')}</span>
                  <select className="input" disabled={ro} defaultValue="" onChange={(e) => e.target.value && patchSel({ fontSize: `${e.target.value}px` }, `${t('studio.adj.fontSize')} · ${sel.id}`)}>
                    <option value="">{sel.styles.fontSize}</option>
                    {tk.scale.map((s) => <option key={s} value={s}>{s}px</option>)}
                  </select>
                </label>
                <label className="adj-row">
                  <span>{t('studio.adj.weight')}</span>
                  <select className="input" disabled={ro} defaultValue="" onChange={(e) => e.target.value && patchSel({ fontWeight: e.target.value }, `${t('studio.adj.weight')} · ${sel.id}`)}>
                    <option value="">{sel.styles.fontWeight}</option>
                    {[300, 400, 500, 700, 800, 900].map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                </label>
                <div className="adj-row">
                  <span>{t('studio.adj.textColor')}</span>
                  <div className="tokpick">
                    {(['ink', 'inkMuted', 'primary', 'accent', 'bg', 'surface'] as const).map((k) => (
                      <button key={k} title={k} disabled={ro} style={{ background: tk.color[k] }}
                        onClick={() => patchSel({ color: `var(--color-${k === 'inkMuted' ? 'ink-muted' : k})` }, `${t('studio.adj.textColor')}: ${k} · ${sel.id}`)} />
                    ))}
                  </div>
                </div>
                <div className="adj-row">
                  <span>{t('studio.adj.bgColor')}</span>
                  <div className="tokpick">
                    {(['bg', 'surface', 'primary', 'accent', 'ink', 'line'] as const).map((k) => (
                      <button key={k} title={k} disabled={ro} style={{ background: tk.color[k] }}
                        onClick={() => patchSel({ background: `var(--color-${k})` }, `${t('studio.adj.bgColor')}: ${k} · ${sel.id}`)} />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'log' && (
          <div className="pane">
            {p.changeLog.length === 0 && <p className="muted" style={{ fontSize: 13 }}>{t('studio.logEmpty')}</p>}
            <ul className="log">
              {[...p.changeLog].reverse().map((c) => (
                <li key={c.id}>
                  <span className={`impact ${c.specImpact.type}`}>{t(`impact.${c.specImpact.type}`)}{c.specImpact.summary && c.specImpact.type !== 'none' ? `: ${c.specImpact.summary}` : ''}</span>
                  <span>{c.request}</span>
                  {c.note && <span className="muted" style={{ fontSize: 12 }}>{c.note}</span>}
                  <span className="mono muted">{new Date(c.at).toLocaleString(uiLang)} · {t(`studio.scope.${c.scope === 'tokens' ? 'global' : c.scope}`)}{c.screenIds.length ? ` · ${c.screenIds.join(', ')}` : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}
