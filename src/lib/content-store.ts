import { GATE } from './gate-config';
import type { BlockInstance } from './block-catalog';
import { COLLAGE_DEFAULTS, COLLAGE_MEDIA, COLLAGE_SLOT_KEYS } from './media-catalog';
import { safeCssImageUrl, safeImageUrl } from './url-safe';

export type ContentMap = Record<string, string>;

export type SiteDoc = {
  v: 2;
  fields: ContentMap;
  /** pageKey -> ordered blocks */
  layout: Record<string, BlockInstance[]>;
};

const EMPTY_DOC: SiteDoc = { v: 2, fields: {}, layout: {} };

/** Only current product screens may stay as collage overrides (drops deleted/legacy paths). */
const ALLOWED_COLLAGE = new Set<string>([
  ...Object.values(COLLAGE_DEFAULTS),
  ...COLLAGE_MEDIA.map((m) => m.src),
]);

function isDoc(x: unknown): x is SiteDoc {
  return !!x && typeof x === 'object' && (x as SiteDoc).v === 2 && typeof (x as SiteDoc).fields === 'object';
}

/** Connect/QR launcher screens — weak in the hero marquee */
const COLLAGE_BLOCKLIST =
  /\/media\/riftcast\/shots\/screen-launcher(?:-remote)?(?:@2x)?\.(?:webp|png|jpe?g)$/i;

function scrubLegacyMedia(fields: ContentMap): ContentMap {
  const next = { ...fields };
  for (const key of COLLAGE_SLOT_KEYS) {
    const val = next[key];
    if (val && !ALLOWED_COLLAGE.has(val)) delete next[key];
    if (val && COLLAGE_BLOCKLIST.test(val)) delete next[key];
  }
  for (const [k, v] of Object.entries(next)) {
    if (typeof v !== 'string') continue;
    // Drop legacy product screenshot paths (pre-/shots/ layout + renamed assets).
    if (
      /\/media\/(?:nexus|berry|riftcast|floordirekt)\/(?!shots\/)(?:screen-|hero\.|cover|nexus_|brand|studio-lockup|logo-mark)/.test(
        v,
      )
    ) {
      delete next[k];
    }
  }
  return next;
}

/** Migrate v1 flat map → v2 doc */
function normalize(raw: unknown): SiteDoc {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_DOC, fields: {}, layout: {} };
  if (isDoc(raw)) {
    return {
      v: 2,
      fields: scrubLegacyMedia({ ...(raw.fields || {}) }),
      layout: { ...(raw.layout || {}) },
    };
  }
  // legacy flat ContentMap
  return { v: 2, fields: scrubLegacyMedia({ ...(raw as ContentMap) }), layout: {} };
}

export function readDoc(): SiteDoc {
  if (typeof window === 'undefined') return { ...EMPTY_DOC };
  try {
    const raw = localStorage.getItem(GATE.contentKey);
    if (!raw) return { ...EMPTY_DOC };
    return normalize(JSON.parse(raw));
  } catch {
    return { ...EMPTY_DOC };
  }
}

export function writeDoc(doc: SiteDoc) {
  const next: SiteDoc = {
    v: 2,
    fields: { ...doc.fields },
    layout: { ...doc.layout },
  };
  localStorage.setItem(GATE.contentKey, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('db-content-updated'));
}

/** @deprecated prefer readDoc().fields — kept for gate copy helpers */
export function readContent(): ContentMap {
  return readDoc().fields;
}

export function writeContent(map: ContentMap) {
  const doc = readDoc();
  doc.fields = map;
  writeDoc(doc);
}

export function mergeContent(patch: ContentMap) {
  const doc = readDoc();
  doc.fields = { ...doc.fields, ...patch };
  for (const k of Object.keys(doc.fields)) {
    if (doc.fields[k] == null || String(doc.fields[k]).trim() === '') delete doc.fields[k];
  }
  writeDoc(doc);
  return doc.fields;
}

export function readLayout(pageKey: string): BlockInstance[] | null {
  const layout = readDoc().layout[pageKey];
  return layout ? [...layout] : null;
}

export function writeLayout(pageKey: string, blocks: BlockInstance[]) {
  const doc = readDoc();
  doc.layout = { ...doc.layout, [pageKey]: blocks };
  writeDoc(doc);
}

export function isAuthed(): boolean {
  if (typeof window === 'undefined') return false;
  if (!GATE.lockSite && !GATE.editor) return true;
  try {
    return localStorage.getItem(GATE.authKey) === '1';
  } catch {
    return false;
  }
}

export function setAuthed(on: boolean) {
  if (on) localStorage.setItem(GATE.authKey, '1');
  else localStorage.removeItem(GATE.authKey);
  window.dispatchEvent(new CustomEvent('db-auth-updated'));
}

export function applyContentToDom(map: ContentMap = readContent()) {
  if (typeof document === 'undefined') return;

  document.querySelectorAll<HTMLElement>('[data-edit]').forEach((el) => {
    const key = el.getAttribute('data-edit');
    if (!key || map[key] == null) return;
    el.textContent = map[key];
  });

  document.querySelectorAll<HTMLImageElement>('img[data-edit-img]').forEach((el) => {
    const key = el.getAttribute('data-edit-img');
    if (!key || map[key] == null) return;
    const src = safeImageUrl(map[key]);
    if (src) el.src = src;
  });

  document.querySelectorAll<HTMLElement>('[data-edit-style-bg]').forEach((el) => {
    const key = el.getAttribute('data-edit-style-bg');
    if (!key || map[key] == null) return;
    const src = safeCssImageUrl(map[key]);
    if (src) el.style.backgroundImage = `url("${src}")`;
  });
}
