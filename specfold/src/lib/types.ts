export type Lang = 'ko' | 'en';
export type Platform = 'mobile' | 'desktop' | 'both';
export type ProviderId = 'claude' | 'openai' | 'gemini' | 'openrouter' | 'local';
export type Step = 'input' | 'review' | 'direction' | 'studio' | 'export';

export interface Attachment {
  id: string;
  name: string;
  kind: 'text' | 'image';
  text?: string; // extracted text
  dataUrl?: string; // images
}

export interface SpecScreen {
  id: string;
  name: string;
  purpose: string;
  elements: string[];
  priority: string;
  navTo: string[];
  inferred?: boolean;
}

export interface SpecFeature {
  id: string;
  name: string;
  description: string;
  screens: string[];
}

export interface ProjectSpec {
  summary: string;
  audience: string;
  context: string;
  platform: Platform;
  moodKeywords: string[];
  avoidKeywords: string[];
  screens: SpecScreen[];
  features: SpecFeature[];
  contentSamples: string[];
}

export interface FontSpec {
  family: string;
  weights: number[];
}

export interface ColorSet {
  bg: string;
  surface: string;
  ink: string;
  inkMuted: string;
  primary: string;
  accent: string;
  line: string;
}

export interface DesignTokens {
  color: ColorSet & { dark?: ColorSet };
  font: { display: FontSpec; body: FontSpec; mono?: FontSpec };
  scale: number[];
  space: number;
  radius: { sm: number; md: number; lg: number };
  shadow: string[];
  motion: { signature: string };
  background: { treatment: string };
}

export interface Direction {
  name: string;
  mood: string;
  rationale: string;
  tokens: DesignTokens;
  fontRationale?: string;
  colorRationale?: string;
  layoutIdea?: string;
  signatureMotion?: string;
  backgroundTreatment?: string;
  miniPreviewHtml?: string;
  contrastCheck?: Record<string, number | string>;
}

export type ScreenStatus = 'pending' | 'generating' | 'done' | 'error';

export interface Screen {
  id: string;
  name: string;
  html: string;
  status: ScreenStatus;
  notes?: string;
  updatedAt: number;
}

export type ImpactType =
  | 'none'
  | 'feature_add'
  | 'feature_change'
  | 'feature_remove'
  | 'screen_add'
  | 'screen_change'
  | 'flow_change'
  | 'content_change';

export interface ChangeEntry {
  id: string;
  at: number;
  request: string;
  scope: 'element' | 'screen' | 'global' | 'tokens';
  screenIds: string[];
  specImpact: { type: ImpactType; summary: string };
  note?: string;
  snapshotId?: string;
}

export interface Snapshot {
  id: string;
  name: string;
  at: number;
  screens: Screen[];
  tokens: DesignTokens | null;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  step: Step;
  readonly?: boolean;
  contentLang: Lang;
  specRaw: string;
  attachments: Attachment[];
  answers: Record<string, string>;
  check?: CheckResult;
  spec: ProjectSpec | null;
  directions: Direction[];
  tokens: DesignTokens | null;
  direction: { source: 'ai' | 'preset' | 'reference'; name: string; rationale: string } | null;
  screens: Screen[];
  changeLog: ChangeEntry[];
  snapshots: Snapshot[];
  exportedMd?: string;
  /** Device width last used in the studio preview; the HTML export opens at the same width. */
  device?: 'mobile' | 'tablet' | 'desktop';
}

export type CheckStatus = 'ok' | 'vague' | 'missing';

export interface CheckItem {
  id: string;
  status: CheckStatus;
  note?: string;
  suggestions?: string[];
}

export interface CheckResult {
  items: CheckItem[];
  questions: { id: string; target: string; question: string; options: string[] }[];
  source: 'local' | 'ai';
}

export interface UsageHistory {
  id: 'me';
  fontsUsed: string[];
  primaryHuesUsed: string[];
  themesUsed: string[];
}

export interface ProviderSettings {
  provider: ProviderId;
  apiKey: string;
  baseUrl: string;
  fastModel: string;
  strongModel: string;
  persist: 'session' | 'device';
}

export interface LintViolation {
  rule:
    | 'banned-font'
    | 'purple-gradient'
    | 'off-token-color'
    | 'contrast'
    | 'card-overuse'
    | 'template-layout'
    | 'oversized-type'
    | 'fake-content'
    | 'emoji-icon'
    | 'missing-ko-font';
  severity: 'fix' | 'warn';
  detail: string;
  screenId?: string;
}
