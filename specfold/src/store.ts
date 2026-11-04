import { create } from 'zustand';
import { db } from './lib/db';
import { providerInfo } from './lib/llm/providers';
import type { ChangeEntry, DesignTokens, Project, ProjectSpec, ProviderSettings, Screen, Step } from './lib/types';
import { debounce, uid } from './lib/util';
import i18n from './i18n';

const SETTINGS_KEY = 'specfold.provider';

function loadSettings(): ProviderSettings {
  const raw = sessionStorage.getItem(SETTINGS_KEY) || localStorage.getItem(SETTINGS_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      /* ignore */
    }
  }
  const p = providerInfo('claude');
  return { provider: 'claude', apiKey: '', baseUrl: '', fastModel: p.fastModel, strongModel: p.strongModel, persist: 'session' };
}

export function saveSettings(s: ProviderSettings) {
  sessionStorage.removeItem(SETTINGS_KEY);
  localStorage.removeItem(SETTINGS_KEY);
  (s.persist === 'device' ? localStorage : sessionStorage).setItem(SETTINGS_KEY, JSON.stringify(s));
}

export type Route = { name: 'home' } | { name: 'project'; id: string; step: Step };

function parseHash(): Route {
  const m = location.hash.match(/^#\/p\/([^/]+)\/(\w+)/);
  if (m) return { name: 'project', id: m[1], step: m[2] as Step };
  return { name: 'home' };
}

type Undoable = Pick<Project, 'screens' | 'tokens' | 'spec' | 'changeLog'>;
const pickUndo = (p: Project): Undoable => structuredClone({ screens: p.screens, tokens: p.tokens, spec: p.spec, changeLog: p.changeLog });

interface State {
  route: Route;
  settings: ProviderSettings;
  settingsOpen: boolean;
  project: Project | null;
  past: Undoable[];
  future: Undoable[];
  toast: string | null;
  go: (r: Route) => void;
  setSettings: (s: ProviderSettings) => void;
  openSettings: (v: boolean) => void;
  openProject: (id: string, step?: Step) => Promise<void>;
  setProject: (p: Project | null) => void;
  /** Mutate the current project. undoable=true pushes an undo frame first. */
  update: (fn: (p: Project) => Project | void, opts?: { undoable?: boolean }) => void;
  undo: () => void;
  redo: () => void;
  notify: (msg: string) => void;
}

const persist = debounce((p: Project) => {
  if (p.readonly) return;
  db.projects.put({ ...p, updatedAt: Date.now() });
}, 400);

export const useStore = create<State>((set, get) => ({
  route: parseHash(),
  settings: loadSettings(),
  settingsOpen: false,
  project: null,
  past: [],
  future: [],
  toast: null,
  go: (r) => {
    location.hash = r.name === 'home' ? '#/' : `#/p/${r.id}/${r.step}`;
    set({ route: r });
  },
  setSettings: (s) => {
    saveSettings(s);
    set({ settings: s });
  },
  openSettings: (v) => set({ settingsOpen: v }),
  openProject: async (id, step) => {
    const cur = get().project;
    let p = cur?.id === id ? cur : null;
    if (!p) p = (await db.projects.get(id)) ?? null;
    if (!p && id === 'demo') {
      const { loadDemo } = await import('./data/demo');
      p = loadDemo(i18n.language as 'ko' | 'en');
    }
    if (!p) {
      get().go({ name: 'home' });
      return;
    }
    set({ project: p, past: cur?.id === id ? get().past : [], future: cur?.id === id ? get().future : [] });
    const s = step ?? p.step;
    if (location.hash !== `#/p/${id}/${s}`) get().go({ name: 'project', id, step: s });
  },
  setProject: (p) => {
    set({ project: p, past: [], future: [] });
    if (p) persist(p);
  },
  update: (fn, opts) => {
    const p = get().project;
    if (!p) return;
    const before = opts?.undoable ? pickUndo(p) : null;
    const draft = structuredClone(p);
    const next = fn(draft) ?? draft;
    next.updatedAt = Date.now();
    set((s) => ({
      project: next,
      past: before ? [...s.past.slice(-99), before] : s.past,
      future: before ? [] : s.future,
    }));
    persist(next);
  },
  undo: () => {
    const { past, project } = get();
    if (!past.length || !project) return;
    const prev = past[past.length - 1];
    const next = { ...project, ...structuredClone(prev) };
    set((s) => ({ project: next, past: s.past.slice(0, -1), future: [...s.future, pickUndo(project)] }));
    persist(next);
  },
  redo: () => {
    const { future, project } = get();
    if (!future.length || !project) return;
    const nxt = future[future.length - 1];
    const next = { ...project, ...structuredClone(nxt) };
    set((s) => ({ project: next, future: s.future.slice(0, -1), past: [...s.past, pickUndo(project)] }));
    persist(next);
  },
  notify: (msg) => {
    set({ toast: msg });
    setTimeout(() => get().toast === msg && set({ toast: null }), 3200);
  },
}));

window.addEventListener('hashchange', () => {
  const r = parseHash();
  const st = useStore.getState();
  useStore.setState({ route: r });
  if (r.name === 'project' && st.project?.id !== r.id) st.openProject(r.id, r.step);
});

export function newProject(partial: Partial<Project> = {}): Project {
  const now = Date.now();
  return {
    id: uid('p'),
    name: partial.name ?? 'Untitled',
    createdAt: now,
    updatedAt: now,
    step: 'input',
    contentLang: 'ko',
    specRaw: '',
    attachments: [],
    answers: {},
    spec: null,
    directions: [],
    tokens: null,
    direction: null,
    screens: [],
    changeLog: [],
    snapshots: [],
    ...partial,
  };
}

export function logChange(p: Project, e: Omit<ChangeEntry, 'id' | 'at'>) {
  p.changeLog.push({ id: uid('c'), at: Date.now(), ...e });
}

export function screensFromSpec(spec: ProjectSpec, existing: Screen[] = []): Screen[] {
  return spec.screens.map((s) => existing.find((e) => e.id === s.id) ?? { id: s.id, name: s.name, html: '', status: 'pending', updatedAt: Date.now() });
}

export type { DesignTokens };
