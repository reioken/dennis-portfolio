// Native Firefox regression: inspect compositor transforms, not main-thread
// computed styles or screenshots that can flush a stalled animation into life.
// Requires geckodriver on PATH (or GECKODRIVER) and Firefox (or FIREFOX_BINARY).
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';

const out = '.source-assets/firefox-qa';
await fs.mkdir(out, {recursive: true});
const driver = spawn(process.env.GECKODRIVER || 'geckodriver', ['--port', '4445', '--allow-system-access'], {windowsHide: true});
let log = '', session;
driver.stdout.on('data', d => {log += d;});
driver.stderr.on('data', d => {log += d;});
driver.on('error', e => {log += e.message;});
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(path, body, method = body ? 'POST' : 'GET') {
  const response = await fetch('http://127.0.0.1:4445' + path, {
    method, headers: {'Content-Type': 'application/json'},
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (result.value?.error) throw Error(JSON.stringify(result.value));
  return result.value;
}
const command = (path, body) => request(`/session/${session}${path}`, body);
const context = name => command('/moz/context', {context: name});
const execute = script => command('/execute/sync', {script, args: []});

// This function runs privileged only inside the disposable WebDriver profile.
// No test flags, browser preferences, or injected scripts ship with the site.
function probe() {
  try {
    const cube = content.document.querySelector('.hall-startup__cube');
    const faces = [...cube.children];
    const properties = faces.map(face => face.getAnimations().flatMap(a => a.effect.getProperties()));
    const parentAnimations = cube.getAnimations().length;
    const phase = content.document.querySelector('.hall__stage')?.dataset.startupPhase;
    const visible = content.getComputedStyle(cube).visibility === 'visible';
    const samples = [], start = Date.now();
    // Intentionally do not yield the content main thread for two full turns.
    while (Date.now() - start < 9600) {
      samples.push({t: Date.now() - start, matrices: faces.map(face => content.windowUtils.getOMTAStyle(face, 'transform'))});
      const until = Date.now() + 40;
      while (Date.now() < until) {}
    }
    sendAsyncMessage('CubeQAResult', {properties, parentAnimations, phase, visible, samples});
  } catch (error) {
    sendAsyncMessage('CubeQAResult', {error: String(error)});
  }
}

function verify(result, label) {
  assert.ok(!result.error, result.error);
  assert.ok(result.visible, label + ': loader was not visible');
  assert.equal(result.parentAnimations, 0, label + ': animated preserve-3d parent can stall in Firefox');
  assert.equal(result.properties.length, 6);
  for (const properties of result.properties) {
    assert.ok(properties.some(p => p.property === 'transform' && p.runningOnCompositor), label + ': a panel is not compositor animated');
  }
  const holds = [];
  for (let face = 0; face < 6; face++) {
    let previous, held = 0, maxHold = 0, changes = 0;
    for (const sample of result.samples) {
      const matrix = sample.matrices[face];
      assert.ok(matrix.startsWith('matrix3d('), label + ': missing compositor transform');
      // Ignore translation: expansion alone must never satisfy the spin check.
      const rotation = matrix.slice(9, -1).split(',').slice(0, 12).join(',');
      if (rotation !== previous) {
        maxHold = Math.max(maxHold, sample.t - held);
        held = sample.t; previous = rotation; changes++;
      }
    }
    maxHold = Math.max(maxHold, result.samples.at(-1).t - held);
    assert.ok(changes > 180, `${label}: face ${face} only changed rotation ${changes} times`);
    assert.ok(maxHold < 200, `${label}: face ${face} held rotation for ${maxHold}ms`);
    holds.push(maxHold);
  }
  return {label, phase: result.phase, samples: result.samples.length, maxRotationHoldMs: Math.max(...holds), acceleratedFaces: 6};
}

try {
  for (let i = 0; i < 30; i++) {
    try {await request('/status'); break;} catch {await wait(100);}
  }
  const created = await request('/session', {capabilities: {alwaysMatch: {
    browserName: 'firefox', pageLoadStrategy: 'eager',
    'moz:firefoxOptions': {
      ...(process.env.FIREFOX_BINARY ? {binary: process.env.FIREFOX_BINARY} : {}),
      args: ['-headless'], prefs: {'layers.offmainthreadcomposition.testing.enabled': true},
    },
  }}});
  session = created.sessionId;
  await command('/window/rect', {width: 600, height: 700});
  const css = await fs.readFile(process.env.QA_LOADER_CSS || 'src/components/hall/hall-loading.css', 'utf8');
  const guard = await fs.readFile('src/components/hall/HallGuard.astro', 'utf8');
  const markup = guard.slice(guard.indexOf('<div class="hall-startup"'), guard.indexOf('<script is:inline'));
  await command('/url', {url: 'data:text/html;charset=utf-8,' + encodeURIComponent(`<html class="gl-pending"><style>body{background:#08090e}${css}</style>${markup}</html>`)});
  await wait(250);
  await context('chrome');
  const code = `(${probe.toString()})()`;
  const isolated = await command('/execute/async', {script: `
    const done = arguments[0], mm = window.gBrowser.selectedBrowser.messageManager;
    mm.addMessageListener('CubeQAResult', function listener(msg) {
      mm.removeMessageListener('CubeQAResult', listener); done(msg.data);
    });
    mm.loadFrameScript(${JSON.stringify('data:application/javascript,' + encodeURIComponent(code))}, false);
  `, args: []});
  await fs.writeFile(out + '/isolated-compositor.json', JSON.stringify(isolated, null, 2));
  const results = [verify(isolated, 'isolated-main-thread-block')];

  console.log(JSON.stringify(results[0]));
  await context('content');
  await command('/url', {url: process.env.QA_BASE_URL || 'http://localhost:4321/'});
  await wait(100);
  await context('chrome');
  const startup = await command('/execute/async', {script: `
    const done = arguments[0], mm = window.gBrowser.selectedBrowser.messageManager;
    mm.addMessageListener('CubeQAResult', function listener(msg) {
      mm.removeMessageListener('CubeQAResult', listener); done(msg.data);
    });
    mm.loadFrameScript(${JSON.stringify('data:application/javascript,' + encodeURIComponent(code))}, false);
  `, args: []});
  await fs.writeFile(out + '/startup-compositor.json', JSON.stringify(startup, null, 2));
  results.push(verify(startup, 'real-room-main-thread-block'));
  await context('content');
  let ready = false;
  for (let i = 0; i < 120; i++) {
    ready = await execute(`return document.querySelector('.hall__stage')?.dataset.startupPhase === 'ready' && getComputedStyle(document.querySelector('.hall-startup')).visibility === 'hidden'`);
    if (ready) break;
    await wait(250);
  }
  assert.ok(ready, 'Room did not finish loading and dismiss the emblem');
  await fs.writeFile(out + '/room-ready.png', Buffer.from(await command('/screenshot'), 'base64'));
  await context('chrome');
  await execute(`Services.prefs.setIntPref('ui.prefersReducedMotion', 1)`);
  await context('content');
  await wait(100);
  assert.equal(await execute(`return document.querySelector('.hall-startup').getAnimations({subtree:true}).length`), 0);
  const report = {browser: created.capabilities.browserVersion, results, roomReady: ready, reducedMotion: 'passed'};
  await fs.writeFile(out + '/results.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (session) await request(`/session/${session}`, undefined, 'DELETE').catch(() => {});
  driver.kill();
  await fs.writeFile(out + '/gecko.log', log);
}
