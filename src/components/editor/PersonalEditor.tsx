import { useEffect, useMemo, useRef, useState } from 'react';
import { BLOCK_CATALOG, pageKeyFromPath, uid, type BlockInstance } from '../../lib/block-catalog';
import { CONTENT_FIELDS } from '../../lib/content-registry';
import {
  mergeContent,
  readDoc,
  readLayout,
  setAuthed,
  writeDoc,
  type ContentMap,
  type SiteDoc,
} from '../../lib/content-store';
import { scanNativeBlocks } from '../../lib/layout-runtime';
import {
  COLLAGE_DEFAULTS,
  COLLAGE_GROUPS,
  COLLAGE_MEDIA,
  COLLAGE_SLOT_KEYS,
  collageSlotLabel,
  type CollageSlotKey,
} from '../../lib/media-catalog';
import { site } from '../../lib/site';
import { copy } from '../../lib/i18n';
import { safeImageUrl } from '../../lib/url-safe';

type Panel = 'none' | 'structure' | 'tools' | 'collage';

type InlineTarget = {
  key: string;
  kind: 'text' | 'textarea' | 'image';
  label: string;
  top: number;
  left: number;
  width: number;
};

function defaultsFromSite(): ContentMap {
  return {
    'site.name': site.name,
    'site.shortName': site.shortName,
    'site.role': site.role,
    'site.email': site.email,
    'site.phone': site.phone,
    'site.location': site.location,
    'site.description': site.description,
    'home.headline.de': copy.de.home.headline,
    'home.support.de': copy.de.home.support,
    'home.ctaWork.de': copy.de.home.ctaWork,
    'home.ctaContact.de': copy.de.home.ctaContact,
    'home.featuredLabel.de': copy.de.home.featuredLabel,
    'home.featuredTitle.de': copy.de.home.featuredTitle,
    'home.featuredBody.de': copy.de.home.featuredBody,
    'home.archiveLabel.de': copy.de.home.archiveLabel,
    'home.archiveTitle.de': copy.de.home.archiveTitle,
    'home.nextLabel.de': copy.de.home.nextLabel,
    'home.nextTitle.de': copy.de.home.nextTitle,
    'home.nextBody.de': copy.de.home.nextBody,
    'home.nextCta.de': copy.de.home.nextCta,
    'home.headline.en': copy.en.home.headline,
    'home.support.en': copy.en.home.support,
    'home.ctaWork.en': copy.en.home.ctaWork,
    'home.ctaContact.en': copy.en.home.ctaContact,
    'home.featuredLabel.en': copy.en.home.featuredLabel,
    'home.featuredTitle.en': copy.en.home.featuredTitle,
    'home.featuredBody.en': copy.en.home.featuredBody,
    'home.archiveLabel.en': copy.en.home.archiveLabel,
    'home.archiveTitle.en': copy.en.home.archiveTitle,
    'home.nextLabel.en': copy.en.home.nextLabel,
    'home.nextTitle.en': copy.en.home.nextTitle,
    'home.nextBody.en': copy.en.home.nextBody,
    'home.nextCta.en': copy.en.home.nextCta,
    'about.role.de': copy.de.about.role,
    'about.lead.de': copy.de.about.lead,
    'about.body.de': copy.de.about.body,
    'about.skillsIntro.de': copy.de.about.skillsIntro,
    'about.role.en': copy.en.about.role,
    'about.lead.en': copy.en.about.lead,
    'about.body.en': copy.en.about.body,
    'about.skillsIntro.en': copy.en.about.skillsIntro,
    'contact.title.de': copy.de.contact.title,
    'contact.body.de': copy.de.contact.body,
    'contact.title.en': copy.en.contact.title,
    'contact.body.en': copy.en.contact.body,
    'footer.tagline.de': copy.de.footer.tagline,
    'footer.tagline.en': copy.en.footer.tagline,
    'gate.title': 'Under Construction',
    'gate.subtitle': 'Das Portfolio wird gerade feingeschliffen. Mit Passwort kommst du rein.',
    'gate.hint': 'Passwort eingeben',
    ...COLLAGE_DEFAULTS,
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function currentPageKey() {
  return pageKeyFromPath(window.location.pathname);
}

function fieldMeta(key: string, isImage: boolean) {
  const known = CONTENT_FIELDS.find((f) => f.key === key);
  if (known) return known;
  return {
    key,
    label: key.split('.').slice(-2).join(' · '),
    kind: (isImage ? 'image' : key.includes('body') || key.includes('support') || key.includes('lead')
      ? 'textarea'
      : 'text') as 'text' | 'textarea' | 'image',
    group: 'Seite',
  };
}

function clampPopover(rect: DOMRect): Pick<InlineTarget, 'top' | 'left' | 'width'> {
  const pad = 12;
  const width = Math.min(Math.max(rect.width, 280), Math.min(440, window.innerWidth - pad * 2));
  let left = rect.left;
  let top = rect.bottom + 8;
  if (left + width > window.innerWidth - pad) left = window.innerWidth - width - pad;
  if (left < pad) left = pad;
  const estimatedH = 210;
  if (top + estimatedH > window.innerHeight - pad) {
    top = Math.max(pad, rect.top - estimatedH - 8);
  }
  return { top, left, width };
}

export default function PersonalEditor() {
  const [editMode, setEditMode] = useState(false);
  const [panel, setPanel] = useState<Panel>('none');
  const [inline, setInline] = useState<InlineTarget | null>(null);
  const [inlineValue, setInlineValue] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [blocks, setBlocks] = useState<BlockInstance[]>([]);
  const [pageKey, setPageKey] = useState('home');
  const [addOpen, setAddOpen] = useState(false);
  const [collageSlot, setCollageSlot] = useState<CollageSlotKey>(COLLAGE_SLOT_KEYS[0]);
  const [collageGroup, setCollageGroup] = useState<(typeof COLLAGE_GROUPS)[number]>('Alle');
  const [collageTick, setCollageTick] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const defaults = useMemo(() => defaultsFromSite(), []);

  const collageValues = useMemo(() => {
    const fields = readDoc().fields;
    const map = {} as Record<CollageSlotKey, string>;
    for (const key of COLLAGE_SLOT_KEYS) {
      map[key] = fields[key] || defaults[key] || COLLAGE_DEFAULTS[key];
    }
    return map;
    // collageTick forces re-read after saves
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaults, collageTick, panel]);

  const collageLibrary = useMemo(() => {
    if (collageGroup === 'Alle') return COLLAGE_MEDIA;
    return COLLAGE_MEDIA.filter((m) => m.group === collageGroup);
  }, [collageGroup]);

  const suggestions = useMemo(() => {
    const presentTypes = new Set(blocks.filter((b) => !b.hidden).map((b) => b.type));
    return BLOCK_CATALOG.filter((def) => {
      if (!def.pages.includes(pageKey) && def.source === 'native') return false;
      if (def.source === 'native' && presentTypes.has(def.type)) return false;
      return def.pages.includes(pageKey) || def.source === 'custom';
    });
  }, [blocks, pageKey]);

  const loadStructure = () => {
    const pk = currentPageKey();
    setPageKey(pk);
    const main = document.getElementById('main');
    const natives = main ? scanNativeBlocks(main) : [];
    const saved = readLayout(pk);
    if (saved && saved.length) {
      const have = new Set(saved.map((b) => b.id));
      const merged = [...saved];
      for (const n of natives) {
        if (!have.has(n.id) && !saved.some((s) => s.type === n.type && s.source === 'native')) {
          merged.push(n);
        }
      }
      setBlocks(merged);
    } else {
      setBlocks(natives);
    }
  };

  useEffect(() => {
    document.documentElement.dataset.editMode = editMode ? '1' : '';
    if (!editMode) {
      setInline(null);
      setPanel('none');
    }
    return () => {
      delete document.documentElement.dataset.editMode;
    };
  }, [editMode]);

  useEffect(() => {
    if (!editMode) return;

    const openTarget = (el: HTMLElement) => {
      const imgKey = el.getAttribute('data-edit-img');
      const textKey = el.getAttribute('data-edit');
      const key = imgKey || textKey;
      if (!key) return;

      const meta = fieldMeta(key, !!imgKey);
      const rect = el.getBoundingClientRect();
      const pos = clampPopover(rect);
      const stored = readDoc().fields[key];
      const live = imgKey
        ? (el as HTMLImageElement).currentSrc || (el as HTMLImageElement).src || ''
        : (el.textContent || '').trim();
      const value = stored ?? defaults[key] ?? live;

      setInline({ key, kind: meta.kind, label: meta.label, ...pos });
      setInlineValue(value);
      setPanel('none');

      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
        if (inputRef.current && 'select' in inputRef.current) {
          try {
            inputRef.current.select();
          } catch {
            /* ignore */
          }
        }
      });
    };

    const onClick = (e: MouseEvent) => {
      const node = e.target as HTMLElement | null;
      if (!node) return;
      if (node.closest('.editor-shell')) return;

      const hit = node.closest<HTMLElement>('[data-edit], [data-edit-img]');
      if (!hit) {
        if (!node.closest('.editor-inline')) setInline(null);
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      openTarget(hit);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setInline(null);
        if (panel !== 'none') setPanel('none');
      }
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [editMode, defaults, panel]);

  useEffect(() => {
    if (panel === 'structure') loadStructure();
  }, [panel]);

  const applyLive = (key: string, value: string, kind: InlineTarget['kind']) => {
    if (kind === 'image') {
      const src = safeImageUrl(value);
      if (!src) return;
      document.querySelectorAll<HTMLImageElement>(`img[data-edit-img="${key}"]`).forEach((el) => {
        el.src = src;
      });
      return;
    }
    document.querySelectorAll<HTMLElement>(`[data-edit="${key}"]`).forEach((el) => {
      el.textContent = value;
    });
  };

  const setCollageImage = (key: CollageSlotKey, src: string) => {
    const next = safeImageUrl(src);
    if (!next) return;
    applyLive(key, next, 'image');
    if (next === COLLAGE_DEFAULTS[key]) {
      const doc = readDoc();
      if (doc.fields[key] != null) {
        delete doc.fields[key];
        writeDoc(doc);
      }
    } else {
      mergeContent({ [key]: next });
    }
    setCollageTick((n) => n + 1);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  };

  const resetCollageSlot = (key: CollageSlotKey) => {
    setCollageImage(key, COLLAGE_DEFAULTS[key]);
  };

  const resetAllCollage = () => {
    const doc = readDoc();
    let changed = false;
    for (const key of COLLAGE_SLOT_KEYS) {
      applyLive(key, COLLAGE_DEFAULTS[key], 'image');
      if (doc.fields[key] != null) {
        delete doc.fields[key];
        changed = true;
      }
    }
    if (changed) writeDoc(doc);
    setCollageTick((n) => n + 1);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  };

  const commitInline = () => {
    if (!inline) return;
    const base = defaults[inline.key];
    const next = inlineValue;
    applyLive(inline.key, next, inline.kind);

    if (base != null && next === base) {
      const doc = readDoc();
      if (doc.fields[inline.key] != null) {
        delete doc.fields[inline.key];
        writeDoc(doc);
      }
    } else {
      mergeContent({ [inline.key]: next });
    }

    // fold custom block props
    const dot = inline.key.indexOf('.');
    if (dot > 0) {
      const bid = inline.key.slice(0, dot);
      const prop = inline.key.slice(dot + 1);
      const doc = readDoc();
      const pk = currentPageKey();
      const layout = [...(doc.layout[pk] || [])];
      const idx = layout.findIndex((b) => b.id === bid && b.source === 'custom');
      if (idx >= 0) {
        layout[idx] = { ...layout[idx], props: { ...layout[idx].props, [prop]: next } };
        doc.layout = { ...doc.layout, [pk]: layout };
        writeDoc(doc);
      }
    }

    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
    setInline(null);
  };

  const persistBlocks = (next: BlockInstance[]) => {
    setBlocks(next);
    const doc = readDoc();
    doc.layout = { ...doc.layout, [pageKey]: next };
    writeDoc(doc);
  };

  const moveBlock = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[j]] = [next[j], next[index]];
    persistBlocks(next);
  };

  const removeBlock = (index: number) => {
    const b = blocks[index];
    if (!b) return;
    if (b.source === 'native') {
      persistBlocks(blocks.map((x, i) => (i === index ? { ...x, hidden: true } : x)));
    } else {
      persistBlocks(blocks.filter((_, i) => i !== index));
    }
  };

  const restoreBlock = (index: number) => {
    persistBlocks(blocks.map((x, i) => (i === index ? { ...x, hidden: false } : x)));
  };

  const addFromCatalog = (type: string) => {
    const def = BLOCK_CATALOG.find((d) => d.type === type);
    if (!def) return;

    if (def.source === 'native') {
      const main = document.getElementById('main');
      const natives = main ? scanNativeBlocks(main) : [];
      const native = natives.find((n) => n.type === type);
      if (!native) return;
      const existingIdx = blocks.findIndex((b) => b.id === native.id || (b.type === type && b.source === 'native'));
      if (existingIdx >= 0) {
        const next = [...blocks];
        next[existingIdx] = { ...next[existingIdx], hidden: false };
        const [item] = next.splice(existingIdx, 1);
        next.push(item);
        persistBlocks(next);
      } else {
        persistBlocks([...blocks, { ...native, hidden: false }]);
      }
    } else {
      const id = uid(def.type);
      persistBlocks([
        ...blocks,
        {
          id,
          type: def.type,
          source: 'custom',
          label: def.label,
          props: { ...(def.defaults || {}) },
        },
      ]);
    }
    setAddOpen(false);
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(readDoc(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dennisbf-content.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importJson = async (file: File) => {
    const text = await file.text();
    const parsed = JSON.parse(text) as SiteDoc | ContentMap;
    if (parsed && typeof parsed === 'object' && 'v' in parsed && (parsed as SiteDoc).v === 2) {
      writeDoc(parsed as SiteDoc);
    } else {
      writeDoc({ v: 2, fields: parsed as ContentMap, layout: readDoc().layout });
    }
    loadStructure();
  };

  const logout = () => {
    setAuthed(false);
    setEditMode(false);
    setPanel('none');
  };

  const resetLayout = () => {
    const main = document.getElementById('main');
    const natives = main ? scanNativeBlocks(main) : [];
    persistBlocks(natives);
  };

  return (
    <div className="editor-shell">
      <div className="editor-dock">
        <button
          type="button"
          className={`editor-dock__btn editor-dock__btn--main ${editMode ? 'is-active' : ''}`}
          onClick={() => setEditMode((v) => !v)}
          title={editMode ? 'Edit-Modus beenden' : 'Edit-Modus'}
        >
          {editMode ? 'Fertig' : 'Edit'}
        </button>
        {editMode ? (
          <>
            <button
              type="button"
              className={`editor-dock__btn ${panel === 'structure' ? 'is-active' : ''}`}
              onClick={() => setPanel((p) => (p === 'structure' ? 'none' : 'structure'))}
              title="Struktur"
            >
              Blöcke
            </button>
            <button
              type="button"
              className={`editor-dock__btn ${panel === 'collage' ? 'is-active' : ''}`}
              onClick={() => setPanel((p) => (p === 'collage' ? 'none' : 'collage'))}
              title="Hero-Collage Bilder"
            >
              Collage
            </button>
            <button
              type="button"
              className={`editor-dock__btn ${panel === 'tools' ? 'is-active' : ''}`}
              onClick={() => setPanel((p) => (p === 'tools' ? 'none' : 'tools'))}
              title="Werkzeuge"
            >
              Mehr
            </button>
          </>
        ) : null}
      </div>

      {editMode ? (
        <div className="editor-hint" role="status">
          Element anklicken → Text direkt bearbeiten
          {savedFlash ? <span className="editor-hint__ok"> · gespeichert</span> : null}
        </div>
      ) : null}

      {inline ? (
        <div
          className="editor-inline"
          style={{ top: inline.top, left: inline.left, width: inline.width }}
          role="dialog"
          aria-label={`Bearbeiten: ${inline.label}`}
        >
          <div className="editor-inline__head">
            <span>{inline.label}</span>
            <button type="button" className="editor-ico" onClick={() => setInline(null)} aria-label="Schließen">
              ✕
            </button>
          </div>
          {inline.kind === 'image' ? (
            <div className="editor-inline__body">
              {inlineValue ? <img src={inlineValue} alt="" className="editor-inline__preview" /> : null}
              <input
                ref={(el) => {
                  inputRef.current = el;
                }}
                type="url"
                className="editor-control"
                placeholder="https://… oder Datei wählen"
                value={inlineValue.startsWith('data:') ? '' : inlineValue}
                onChange={(e) => {
                  setInlineValue(e.target.value);
                  applyLive(inline.key, e.target.value, 'image');
                }}
              />
              <input
                type="file"
                accept="image/*"
                className="editor-control editor-control--file"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = await fileToDataUrl(file);
                  setInlineValue(url);
                  applyLive(inline.key, url, 'image');
                }}
              />
            </div>
          ) : inline.kind === 'textarea' ? (
            <textarea
              ref={(el) => {
                inputRef.current = el;
              }}
              className="editor-control editor-control--area"
              rows={4}
              value={inlineValue}
              onChange={(e) => {
                setInlineValue(e.target.value);
                applyLive(inline.key, e.target.value, 'textarea');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  commitInline();
                }
              }}
            />
          ) : (
            <input
              ref={(el) => {
                inputRef.current = el;
              }}
              type="text"
              className="editor-control"
              value={inlineValue}
              onChange={(e) => {
                setInlineValue(e.target.value);
                applyLive(inline.key, e.target.value, 'text');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitInline();
                }
              }}
            />
          )}
          <div className="editor-inline__actions">
            <button type="button" className="editor-btn" onClick={() => setInline(null)}>
              Abbrechen
            </button>
            <button type="button" className="editor-btn editor-btn--primary" onClick={commitInline}>
              Übernehmen
            </button>
          </div>
        </div>
      ) : null}

      {panel === 'structure' ? (
        <aside className="editor-drawer" role="dialog" aria-label="Blöcke">
          <div className="editor-drawer__head">
            <div>
              <p className="editor-drawer__eyebrow">Struktur</p>
              <p className="editor-drawer__title">{pageKey}</p>
            </div>
            <button type="button" className="editor-ico" onClick={() => setPanel('none')} aria-label="Schließen">
              ✕
            </button>
          </div>
          <div className="editor-drawer__body">
            <p className="editor-drawer__intro">Reihenfolge ändern oder Blöcke ausblenden.</p>
            <ul className="editor-block-list">
              {blocks.map((b, i) => (
                <li key={b.id} className={`editor-block-item ${b.hidden ? 'is-hidden' : ''}`}>
                  <div className="editor-block-item__meta">
                    <strong>{b.label}</strong>
                    <span>
                      {b.source === 'native' ? 'Seite' : 'Neu'}
                      {b.hidden ? ' · aus' : ''}
                    </span>
                  </div>
                  <div className="editor-block-item__actions">
                    <button type="button" className="editor-ico" disabled={i === 0} onClick={() => moveBlock(i, -1)} title="Hoch">
                      ↑
                    </button>
                    <button
                      type="button"
                      className="editor-ico"
                      disabled={i === blocks.length - 1}
                      onClick={() => moveBlock(i, 1)}
                      title="Runter"
                    >
                      ↓
                    </button>
                    {b.hidden ? (
                      <button type="button" className="editor-ico" onClick={() => restoreBlock(i)} title="Einblenden">
                        +
                      </button>
                    ) : (
                      <button type="button" className="editor-ico" onClick={() => removeBlock(i)} title="Ausblenden">
                        −
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <button type="button" className="editor-btn editor-btn--primary editor-btn--block" onClick={() => setAddOpen((v) => !v)}>
              {addOpen ? 'Schließen' : 'Element hinzufügen'}
            </button>
            {addOpen ? (
              <div className="editor-suggest">
                {suggestions.map((s) => (
                  <button key={s.type} type="button" className="editor-suggest__item" onClick={() => addFromCatalog(s.type)}>
                    <strong>{s.label}</strong>
                    <span>{s.description}</span>
                  </button>
                ))}
                {suggestions.length === 0 ? <p className="editor-drawer__intro">Keine weiteren Vorschläge.</p> : null}
              </div>
            ) : null}

            <button type="button" className="editor-btn editor-btn--block" onClick={resetLayout}>
              Struktur zurücksetzen
            </button>
          </div>
        </aside>
      ) : null}

      {panel === 'collage' ? (
        <aside className="editor-drawer editor-drawer--media" role="dialog" aria-label="Hero Collage">
          <div className="editor-drawer__head">
            <div>
              <p className="editor-drawer__eyebrow">Hintergrund</p>
              <p className="editor-drawer__title">Hero Collage</p>
            </div>
            <button type="button" className="editor-ico" onClick={() => setPanel('none')} aria-label="Schließen">
              ✕
            </button>
          </div>
          <div className="editor-drawer__body editor-collage">
            <p className="editor-drawer__intro">
              Slot wählen, dann ein Vorschaubild antippen — erscheint sofort in der Animation hinten.
            </p>

            <div className="editor-collage__slots" role="tablist" aria-label="Collage-Slots">
              {COLLAGE_SLOT_KEYS.map((key, i) => {
                const active = collageSlot === key;
                const src = collageValues[key];
                return (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={`editor-collage__slot ${active ? 'is-active' : ''}`}
                    onClick={() => setCollageSlot(key)}
                    title={collageSlotLabel(i)}
                  >
                    <img src={src} alt="" loading="lazy" decoding="async" />
                    <span>{collageSlotLabel(i)}</span>
                  </button>
                );
              })}
            </div>

            <div className="editor-collage__slot-actions">
              <button type="button" className="editor-btn" onClick={() => resetCollageSlot(collageSlot)}>
                Slot zurücksetzen
              </button>
              <button type="button" className="editor-btn" onClick={resetAllCollage}>
                Alle zurücksetzen
              </button>
            </div>

            <div className="editor-collage__filters" role="toolbar" aria-label="Projektfilter">
              {COLLAGE_GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`editor-collage__chip ${collageGroup === g ? 'is-active' : ''}`}
                  onClick={() => setCollageGroup(g)}
                >
                  {g}
                </button>
              ))}
            </div>

            <div className="editor-collage__grid">
              {collageLibrary.map((item) => {
                const selected = Object.values(collageValues).includes(item.src);
                const inActive = collageValues[collageSlot] === item.src;
                return (
                  <button
                    key={item.src}
                    type="button"
                    className={`editor-collage__thumb ${inActive ? 'is-active' : ''} ${selected ? 'is-used' : ''}`}
                    onClick={() => setCollageImage(collageSlot, item.src)}
                    title={`${item.group} · ${item.label}`}
                  >
                    <img src={item.src} alt="" loading="lazy" decoding="async" />
                    <span>
                      <strong>{item.label}</strong>
                      <em>{item.group}</em>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      ) : null}

      {panel === 'tools' ? (
        <aside className="editor-drawer editor-drawer--compact" role="dialog" aria-label="Werkzeuge">
          <div className="editor-drawer__head">
            <div>
              <p className="editor-drawer__eyebrow">Werkzeuge</p>
              <p className="editor-drawer__title">Export & Account</p>
            </div>
            <button type="button" className="editor-ico" onClick={() => setPanel('none')} aria-label="Schließen">
              ✕
            </button>
          </div>
          <div className="editor-drawer__body editor-tools">
            <button type="button" className="editor-btn editor-btn--block" onClick={exportJson}>
              JSON exportieren
            </button>
            <label className="editor-btn editor-btn--block editor-btn--file">
              JSON importieren
              <input
                type="file"
                accept="application/json,.json"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) await importJson(file);
                }}
              />
            </label>
            <button type="button" className="editor-btn editor-btn--block editor-btn--danger" onClick={logout}>
              Ausloggen
            </button>
            <p className="editor-drawer__note">
              Editor aus: <code>gate-config.ts</code> → <code>editor: false</code>
            </p>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
