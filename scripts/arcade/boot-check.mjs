#!/usr/bin/env node
// Boot check for a Godot web export using puppeteer-core and a local Chrome/Edge.
//
//   node scripts/arcade/boot-check.mjs <url> [--timeout 60000] [--shot path.png] [--browser exe]
//
// Waits until Godot's default HTML shell hides its #status overlay (engine started, first
// frame imminent) or shows a failure notice. Prints a JSON summary with time to first frame,
// console errors and failed requests; optionally saves a screenshot. Exit 0 = booted.

import fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
if (!url) {
  console.error('Usage: node scripts/arcade/boot-check.mjs <url> [--timeout ms] [--shot file.png] [--browser exe]');
  process.exit(2);
}
const timeout = Number(opt('--timeout', '60000'));
const shot = opt('--shot', '');
const candidates = [
  opt('--browser', ''),
  process.env.ARCADE_BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);
const executablePath = candidates.find((p) => fs.existsSync(p));
if (!executablePath) {
  console.error('No Chrome/Edge found; pass --browser <exe> or set ARCADE_BROWSER.');
  process.exit(2);
}

const summary = {
  url,
  browser: executablePath,
  ok: false,
  ttff_ms: null,
  notice: '',
  consoleErrors: [],
  failedRequests: [],
  console: [],
};
const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: [
    '--window-size=1280,720',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required',
    '--no-first-run',
  ],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('console', (m) => {
    summary.console.push(`[${m.type()}] ${m.text()}`);
    if (m.type() === 'error') summary.consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => summary.consoleErrors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => summary.failedRequests.push(`${r.url()} ${r.failure()?.errorText ?? ''}`));
  page.on('response', (r) => {
    if (r.status() >= 400) summary.failedRequests.push(`${r.url()} HTTP ${r.status()}`);
  });

  const t0 = Date.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
  await page.waitForFunction(
    () => {
      const status = document.getElementById('status');
      const notice = document.getElementById('status-notice');
      if (notice && notice.textContent.trim()) return true;
      return !!status && getComputedStyle(status).visibility === 'hidden';
    },
    { timeout, polling: 100 },
  );
  summary.ttff_ms = Date.now() - t0;
  summary.notice = await page.evaluate(() => document.getElementById('status-notice')?.textContent.trim() ?? '');
  summary.ok = summary.notice === '';
  await new Promise((r) => setTimeout(r, 2000)); // let a few frames render before the shot
  if (shot) {
    await page.screenshot({ path: shot });
    summary.screenshot = shot;
  }
} catch (err) {
  summary.error = err.message;
} finally {
  await browser.close();
}
summary.console = summary.console.slice(-40);
console.log(JSON.stringify(summary, null, 2));
process.exit(summary.ok ? 0 : 1);
