import { pageKeyFromPath, type BlockInstance } from './block-catalog';
import { applyContentToDom, readDoc, readLayout } from './content-store';
import { safeHttpUrl, safeImageUrl } from './url-safe';

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function prop(block: BlockInstance, key: string, fallback = '') {
  return block.props?.[key] ?? fallback;
}

function renderCustomBlock(block: BlockInstance): HTMLElement {
  const wrap = document.createElement('section');
  wrap.className = 'section db-custom-block';
  wrap.dataset.blockId = block.id;
  wrap.dataset.blockType = block.type;
  wrap.dataset.blockCustom = '1';
  wrap.dataset.blockSource = 'custom';

  const p = (k: string, fb = '') => esc(prop(block, k, fb));

  if (block.type === 'divider') {
    wrap.className = 'db-custom-block';
    wrap.innerHTML = `<div class="wrap"><hr class="rule" /></div>`;
    return wrap;
  }

  if (block.type === 'quote') {
    wrap.innerHTML = `
      <div class="wrap max-w-3xl">
        <p class="display text-[clamp(1.4rem,3.5vw,2.2rem)] leading-snug">
          <span data-lang="de" data-edit="${block.id}.quote.de">„${p('quote.de')}“</span>
          <span data-lang="en" data-edit="${block.id}.quote.en">“${p('quote.en')}”</span>
        </p>
        <p class="mt-4 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--faint)]">
          <span data-lang="de" data-edit="${block.id}.quote.cite.de">${p('quote.cite.de')}</span>
          <span data-lang="en" data-edit="${block.id}.quote.cite.en">${p('quote.cite.en')}</span>
        </p>
      </div>`;
    return wrap;
  }

  if (block.type === 'text') {
    wrap.innerHTML = `
      <div class="wrap max-w-2xl">
        <p class="section-label">
          <span data-lang="de" data-edit="${block.id}.label.de">${p('label.de')}</span>
          <span data-lang="en" data-edit="${block.id}.label.en">${p('label.en')}</span>
        </p>
        <h2 class="display mb-3 text-[clamp(1.4rem,3vw,2rem)]">
          <span data-lang="de" data-edit="${block.id}.title.de">${p('title.de')}</span>
          <span data-lang="en" data-edit="${block.id}.title.en">${p('title.en')}</span>
        </h2>
        <p class="normal-case tracking-normal text-[var(--dim)]">
          <span data-lang="de" data-edit="${block.id}.body.de">${p('body.de')}</span>
          <span data-lang="en" data-edit="${block.id}.body.en">${p('body.en')}</span>
        </p>
      </div>`;
    return wrap;
  }

  if (block.type === 'image-banner') {
    const img = safeImageUrl(prop(block, 'image'));
    wrap.innerHTML = `
      <div class="wrap">
        <div class="overflow-hidden rounded-[28px] border border-[var(--stroke)]">
          ${
            img
              ? `<img data-edit-img="${block.id}.image" src="${esc(img)}" alt="" class="w-full max-h-[420px] object-cover" loading="lazy" decoding="async" />`
              : `<div class="flex h-48 items-center justify-center bg-[var(--panel)] text-[var(--faint)] text-sm">Bild im Editor setzen</div>`
          }
        </div>
        <p class="mt-3 text-[0.8rem] text-[var(--dim)]">
          <span data-lang="de" data-edit="${block.id}.caption.de">${p('caption.de')}</span>
          <span data-lang="en" data-edit="${block.id}.caption.en">${p('caption.en')}</span>
        </p>
      </div>`;
    return wrap;
  }

  if (block.type === 'stats') {
    wrap.innerHTML = `
      <div class="wrap grid gap-4 sm:grid-cols-3">
        ${(['a', 'b', 'c'] as const)
          .map(
            (k) => `
          <div class="rounded-[var(--radius)] border border-[var(--stroke)] bg-[var(--panel-soft)] p-5">
            <div class="display text-[1.8rem] gradient-text" data-edit="${block.id}.${k}.value">${p(`${k}.value`)}</div>
            <div class="mt-1 text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[var(--faint)]">
              <span data-lang="de" data-edit="${block.id}.${k}.label.de">${p(`${k}.label.de`)}</span>
              <span data-lang="en" data-edit="${block.id}.${k}.label.en">${p(`${k}.label.en`)}</span>
            </div>
          </div>`,
          )
          .join('')}
      </div>`;
    return wrap;
  }

  if (block.type === 'dual-cta') {
    wrap.innerHTML = `
      <div class="wrap">
        <div class="rounded-[28px] border border-[var(--stroke)] bg-[var(--panel)] px-6 py-10 md:px-10">
          <h2 class="display mb-5 text-[clamp(1.4rem,3vw,2rem)]">
            <span data-lang="de" data-edit="${block.id}.title.de">${p('title.de')}</span>
            <span data-lang="en" data-edit="${block.id}.title.en">${p('title.en')}</span>
          </h2>
          <div class="flex flex-wrap gap-3">
            <a class="btn btn--primary" href="${esc(safeHttpUrl(prop(block, 'a.href', '/work'), '/work'))}">
              <span data-lang="de" data-edit="${block.id}.a.label.de">${p('a.label.de')}</span>
              <span data-lang="en" data-edit="${block.id}.a.label.en">${p('a.label.en')}</span>
            </a>
            <a class="btn" href="${esc(safeHttpUrl(prop(block, 'b.href', '/contact'), '/contact'))}">
              <span data-lang="de" data-edit="${block.id}.b.label.de">${p('b.label.de')}</span>
              <span data-lang="en" data-edit="${block.id}.b.label.en">${p('b.label.en')}</span>
            </a>
          </div>
        </div>
      </div>`;
    return wrap;
  }

  wrap.innerHTML = `<div class="wrap text-[var(--dim)]">Unbekannter Block: ${esc(block.type)}</div>`;
  return wrap;
}

export function scanNativeBlocks(main: HTMLElement): BlockInstance[] {
  return [...main.querySelectorAll<HTMLElement>('[data-block-id][data-block-source="native"]')].map((el) => ({
    id: el.dataset.blockId!,
    type: el.dataset.blockType || el.dataset.blockId!,
    source: 'native' as const,
    label: el.dataset.blockLabel || el.dataset.blockType || el.dataset.blockId!,
    hidden: false,
  }));
}

let applying = false;

export function applyLayoutToDom() {
  if (typeof document === 'undefined' || applying) return;
  const main = document.getElementById('main');
  if (!main) return;

  applying = true;
  try {
    const pageKey = pageKeyFromPath(window.location.pathname);
    let layout = readLayout(pageKey);
    const nativeNow = scanNativeBlocks(main);

    if (!layout || layout.length === 0) {
      // no saved layout — just ensure natives visible
      nativeNow.forEach((b) => {
        const el = main.querySelector<HTMLElement>(`[data-block-id="${b.id}"][data-block-source="native"]`);
        if (el) el.style.display = '';
      });
      main.querySelectorAll('[data-block-custom="1"]').forEach((el) => el.remove());
      applyContentToDom(readDoc().fields);
      return;
    }

    const nativeMap = new Map<string, HTMLElement>();
    main.querySelectorAll<HTMLElement>('[data-block-id][data-block-source="native"]').forEach((el) => {
      nativeMap.set(el.dataset.blockId!, el);
    });

    // drop old injected customs
    main.querySelectorAll('[data-block-custom="1"]').forEach((el) => el.remove());

    // hide all natives first
    nativeMap.forEach((el) => {
      el.style.display = 'none';
    });

    const ordered: HTMLElement[] = [];
    for (const block of layout) {
      if (block.hidden) continue;
      if (block.source === 'native') {
        const el = nativeMap.get(block.id);
        if (el) {
          el.style.display = '';
          ordered.push(el);
        }
      } else {
        ordered.push(renderCustomBlock(block));
      }
    }

    // append in order
    for (const el of ordered) main.appendChild(el);

    // sync field overrides onto customs + natives
    const fields = { ...readDoc().fields };
    // flatten custom props into fields for data-edit keys `${id}.prop`
    for (const block of layout) {
      if (block.source !== 'custom' || !block.props) continue;
      for (const [k, v] of Object.entries(block.props)) {
        fields[`${block.id}.${k}`] = v;
      }
    }
    applyContentToDom(fields);
  } finally {
    applying = false;
  }
}

export function applyAll() {
  applyLayoutToDom();
}
