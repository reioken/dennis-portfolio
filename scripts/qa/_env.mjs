// Shared by the older browser regressions in scripts/qa: where the site runs and where output goes.
//
//   QA_BASE_URL=http://localhost:4351 QA_OUT=C:/tmp/qa node scripts/qa/<test>.mjs
//
// QA_BASE_URL overrides each test's default server (4321 = astro dev, 4322 = astro preview; the test's own default
// says which one it was written for). QA_OUT overrides the output folder; the default lives under os.tmpdir(),
// never inside the project: any file written there while a test runs makes Vite reload the dev server.
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Base URL without a trailing slash, e.g. `${base('http://localhost:4322')}/about/`. */
export const base = fallback => (process.env.QA_BASE_URL || fallback).replace(/\/+$/, '');

/** Output folder for one test (created). */
export function outDir(name) {
  const dir = process.env.QA_OUT || path.join(os.tmpdir(), 'dennis-portfolio-qa', name);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** True when the base URL is the deployed site (Cloudflare-only behaviour such as public/_redirects applies). */
export const isLive = url => /^https:\/\/(www\.)?dennisbf\.de\b|\.pages\.dev\b/.test(url);

/**
 * Below 900 px a project page is a native reading page (d58c490, 2026-09-17; Hall.tsx nativeCase): the hall is
 * neither booted nor shown on a direct load, the captures lead the page as a swipeable carousel and a tap opens the
 * lightbox. Returns the measured state; throws when the page is not native.
 * direct: the page was loaded directly, so the hall must not have booted. After a soft navigation from the hall the
 * booted stage stays (stopped, behind the full-height panel), so pass { direct: false } there.
 */
export async function expectNativeCase(page, { direct = true } = {}) {
  await page.locator('.captures--native .captures__slide').first().waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForFunction(() => !document.documentElement.classList.contains('gl-pending'), null, { timeout: 15000 });
  const state = await page.evaluate(() => {
    const shown = sel => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
    const hero = document.querySelector('.captures__hero'), panel = document.querySelector('.hall-panel--case');
    const pr = panel?.getBoundingClientRect();
    return {
      width: innerWidth,
      height: innerHeight,
      booted: !!document.querySelector('.hall.is-3d, .hall__stage'),
      heroScrollSnap: hero ? getComputedStyle(hero).scrollSnapType : null,
      slides: document.querySelectorAll('.captures__slide').length,
      closeupButton: shown('.captures__large'),
      strip: shown('.captures__strip'),
      panel: pr ? { top: pr.top, bottom: pr.bottom, left: pr.left, right: pr.right } : null,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  const fail = msg => { throw new Error(`native project page at ${state.width} px: ${msg} ${JSON.stringify(state)}`); };
  if (direct && state.booted) fail('the hall stage was booted on a direct load');
  if (!state.heroScrollSnap?.includes('x')) fail('captures are not a scroll-snap carousel');
  if (state.closeupButton || state.strip) fail('desktop close-up button or thumb strip is showing');
  if (!state.panel || state.panel.left > 1 || state.panel.right < state.width - 1 || state.panel.bottom < state.height - 1 || state.panel.top > 80) fail('panel does not cover the page below the nav');
  if (state.overflow > 0) fail('horizontal overflow');
  return state;
}

/** Taps/clicks a native carousel slide and waits for the lightbox; returns the stage/image fit check. */
export async function openNativeLightbox(page, index = 0) {
  await page.locator('.captures--native .captures__slide').nth(index).click();
  await page.locator('.gallery-view').waitFor({ state: 'visible' });
  await page.waitForTimeout(250);
  return page.evaluate(() => {
    const s = document.querySelector('.gallery-view__stage').getBoundingClientRect(), i = document.querySelector('.gallery-view__image').getBoundingClientRect();
    return { stage: { x: s.x, y: s.y, w: s.width, h: s.height }, image: { x: i.x, y: i.y, w: i.width, h: i.height },
      ok: i.height <= s.height + 1 && i.width <= s.width + 1 && Math.abs(s.x + s.width / 2 - i.x - i.width / 2) < 2 && Math.abs(s.y + s.height / 2 - i.y - i.height / 2) < 2 };
  });
}
