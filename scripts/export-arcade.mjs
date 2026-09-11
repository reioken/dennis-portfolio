#!/usr/bin/env node
// Export a Godot game as a browser build into public/game-builds/<id>.
//
//   node scripts/export-arcade.mjs echo-frequency [--debug] [--import] [--dry-run]
//                                                [--force-templates] [--backup-dir <dir>]
//
// 1. Checks the Godot binary and that the matching Web export template is installed.
// 2. Backs up the game's export_presets.cfg (bytes kept in memory plus a file copy).
// 3. Appends the Web preset from scripts/arcade/<id>.preset.cfg under the next free
//    [preset.N] index and points export_path at the output folder.
// 4. Runs `godot --headless --path <project> --export-release "Web" <out>/index.html`
//    with a 15-minute timeout (`--import` runs a resource import pass first).
// 5. Always restores export_presets.cfg byte-for-byte (verified by SHA-256) and removes
//    an export_credentials.cfg if Godot created one that was not there before.
// 6. Lists the produced files and flags anything over Cloudflare Pages' 25 MiB limit.
//
// The game repo is never committed to, staged, or branch-switched.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { instrumentGameHtml } from './arcade/ready-protocol.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MiB = 1024 * 1024;
const PAGES_FILE_LIMIT = 25 * MiB;
const EXPORT_TIMEOUT_MS = 15 * 60 * 1000;
const IMPORT_TIMEOUT_MS = 15 * 60 * 1000;

const DEFAULT_GODOT =
  'C:/Users/denni/Downloads/Godot_v4.7.1-stable_win64.exe/Godot_v4.7.1-stable_win64_console.exe';

const GAMES = {
  'echo-frequency': {
    project: 'C:/Users/denni/Projects/Echo-Frequency/EchoFreq/game',
    presetFile: 'scripts/arcade/echo-frequency.preset.cfg',
    out: 'public/game-builds/echo-frequency',
  },
};

function fail(msg) {
  console.error(`\n[export-arcade] ${msg}`);
  process.exit(1);
}

function parseArgs(argv) {
  const flags = { debug: false, import: false, dryRun: false, forceTemplates: false, backupDir: '' };
  let id = '';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--debug') flags.debug = true;
    else if (a === '--import') flags.import = true;
    else if (a === '--dry-run') flags.dryRun = true;
    else if (a === '--force-templates') flags.forceTemplates = true;
    else if (a === '--backup-dir') flags.backupDir = argv[++i] ?? '';
    else if (a.startsWith('--')) fail(`Unknown flag ${a}`);
    else if (!id) id = a;
    else fail(`Unexpected argument ${a}`);
  }
  if (!id) fail(`Usage: node scripts/export-arcade.mjs <game-id> [flags]\nKnown ids: ${Object.keys(GAMES).join(', ')}`);
  return { id, flags };
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const fmtMiB = (n) => `${(n / MiB).toFixed(2)} MiB`;
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Spawn a process, tee its output to the console, enforce a timeout. */
function run(exe, args, { timeoutMs, label }) {
  return new Promise((resolve) => {
    const shown = args.map((a) => (a.includes(' ') ? JSON.stringify(a) : a)).join(' ');
    console.log(`\n[export-arcade] ${label}\n  ${exe}\n  ${shown}\n`);
    const started = Date.now();
    const child = spawn(exe, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let timedOut = false;
    const onData = (chunk) => {
      const s = chunk.toString('utf8');
      out += s;
      process.stdout.write(s);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({ code: -1, out: `${out}\n${err.message}`, timedOut, ms: Date.now() - started });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, out, timedOut, ms: Date.now() - started });
    });
  });
}

async function godotVersion(godot) {
  const { code, out } = await run(godot, ['--version'], { timeoutMs: 30_000, label: 'Godot version' });
  const line = out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^\d+\.\d+\.\d+\./.test(l))
    .pop();
  if (code !== 0 || !line) fail(`Could not read Godot version (exit ${code}).`);
  // "4.7.1.stable.official.abcdef12" -> "4.7.1.stable" (the export_templates folder name)
  return { full: line, templateVersion: line.split('.').slice(0, 4).join('.') };
}

async function listFiles(dir) {
  const rows = [];
  async function walk(d) {
    for (const e of await fs.readdir(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else rows.push({ rel: path.relative(dir, p).replace(/\\/g, '/'), size: (await fs.stat(p)).size });
    }
  }
  if (existsSync(dir)) await walk(dir);
  return rows.sort((a, b) => b.size - a.size);
}

function extractDiagnostics(out) {
  const hits = out
    .split(/\r?\n/)
    .filter((l) => /\b(ERROR|WARNING|SCRIPT ERROR)\b|error:|No export template/i.test(l))
    .map((l) => l.trim());
  return [...new Set(hits)];
}

async function main() {
  const { id, flags } = parseArgs(process.argv.slice(2));
  const game = GAMES[id];
  if (!game) fail(`Unknown game id "${id}". Known: ${Object.keys(GAMES).join(', ')}`);

  const godot = process.env.GODOT_EXE || DEFAULT_GODOT;
  if (!existsSync(godot)) fail(`Godot binary not found: ${godot} (set GODOT_EXE to override)`);

  const project = path.resolve(game.project);
  const presetsPath = path.join(project, 'export_presets.cfg');
  const credsPath = path.join(project, 'export_credentials.cfg');
  const outDir = path.resolve(ROOT, game.out);
  const outFile = path.join(outDir, 'index.html');
  const presetTemplatePath = path.resolve(ROOT, game.presetFile);

  if (!existsSync(path.join(project, 'project.godot'))) fail(`No project.godot in ${project}`);
  if (!existsSync(presetsPath)) fail(`No export_presets.cfg in ${project}`);
  if (!existsSync(presetTemplatePath)) fail(`Preset file missing: ${presetTemplatePath}`);

  const presetTemplate = (await fs.readFile(presetTemplatePath, 'utf8'))
    .split(/\r?\n/)
    .filter((l) => !l.trimStart().startsWith(';'))
    .join('\n')
    .trim();
  const presetName = /^name="([^"]*)"/m.exec(presetTemplate)?.[1];
  if (!presetName) fail('Preset file has no name="..." entry.');
  const wantThreads = /^variant\/thread_support=true/m.test(presetTemplate);
  const wantExtensions = /^variant\/extensions_support=true/m.test(presetTemplate);

  // ---- 1. engine + templates -------------------------------------------------
  const version = await godotVersion(godot);
  const templateDir = path.join(process.env.APPDATA || '', 'Godot', 'export_templates', version.templateVersion);
  // Godot's rule: "web" + ("_dlink" if extensions) + ("_nothreads" if !threads) + "_release|_debug" + ".zip"
  const templateName = `web${wantExtensions ? '_dlink' : ''}${wantThreads ? '' : '_nothreads'}_${flags.debug ? 'debug' : 'release'}.zip`;
  const templatePath = path.join(templateDir, templateName);
  const installed = existsSync(templateDir)
    ? (await fs.readdir(templateDir)).filter((f) => f.startsWith('web'))
    : [];
  console.log(`[export-arcade] Godot ${version.full}`);
  console.log(`[export-arcade] template dir: ${templateDir}`);
  console.log(`[export-arcade] web templates installed: ${installed.length ? installed.join(', ') : '(none)'}`);
  console.log(`[export-arcade] preset "${presetName}" needs: ${templateName} (threads=${wantThreads}, extensions=${wantExtensions})`);
  if (!existsSync(templatePath)) {
    const tpz = `Godot_v${version.templateVersion.replace('.stable', '-stable')}_export_templates.tpz`;
    const msg =
      `Missing Web export template: ${templatePath}\n` +
      `  Install the ${version.templateVersion} export templates (Editor > Manage Export Templates, ` +
      `or unpack ${tpz} into ${templateDir}).`;
    if (!flags.forceTemplates && !flags.dryRun) fail(msg);
    console.warn(`\n[export-arcade] WARNING: ${msg}\n[export-arcade] continuing because of --${flags.dryRun ? 'dry-run' : 'force-templates'}`);
  }

  // ---- 2. backup ---------------------------------------------------------------
  const original = await fs.readFile(presetsPath);
  const originalHash = sha256(original);
  const originalStat = await fs.stat(presetsPath);
  const credsExisted = existsSync(credsPath);
  const backupDir = path.resolve(flags.backupDir || path.join(os.tmpdir(), 'arcade-export'));
  await fs.mkdir(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `export_presets.${id}.${stamp}.cfg.bak`);
  await fs.writeFile(backupPath, original);
  console.log(`[export-arcade] backup: ${backupPath}`);
  console.log(`[export-arcade] sha256(original) = ${originalHash}`);

  // ---- 3. compose merged export_presets.cfg ------------------------------------
  const text = original.toString('utf8');
  if (new RegExp(`^name="${escapeRe(presetName)}"\\s*$`, 'm').test(text)) {
    fail(`export_presets.cfg already contains a preset named "${presetName}"; refusing to append a duplicate.`);
  }
  const indices = [...text.matchAll(/^\[preset\.(\d+)\]\s*$/gm)].map((m) => Number(m[1]));
  const next = indices.length ? Math.max(...indices) + 1 : 0;
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const section = presetTemplate
    .replace(/^\[preset\.\d+\]/m, `[preset.${next}]`)
    .replace(/^\[preset\.\d+\.options\]/m, `[preset.${next}.options]`)
    .replace('__EXPORT_PATH__', outFile.replace(/\\/g, '/'))
    .replace(/\n/g, eol);
  const merged = text.replace(/\s*$/, '') + eol + eol + section + eol;
  console.log(`[export-arcade] appending preset as [preset.${next}] (existing: ${indices.join(', ') || 'none'})`);

  // ---- 4. export (restore in finally) --------------------------------------------
  let result = null;
  let importResult = null;
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  try {
    await fs.writeFile(presetsPath, merged);
    if (flags.dryRun) {
      console.log('\n[export-arcade] --dry-run: preset appended, Godot not invoked. Appended section:\n');
      console.log(section.replace(/\r\n/g, '\n'));
      const now = await fs.readFile(presetsPath, 'utf8');
      const ids = [...now.matchAll(/^\[preset\.(\d+)\]\s*$/gm)].map((m) => m[1]);
      console.log(`[export-arcade] merged file now has presets: ${ids.join(', ')}`);
    } else {
      if (flags.import) {
        importResult = await run(godot, ['--headless', '--path', project, '--import'], {
          timeoutMs: IMPORT_TIMEOUT_MS,
          label: 'Godot resource import',
        });
        if (importResult.timedOut) fail('Import timed out.');
      }
      result = await run(
        godot,
        ['--headless', '--path', project, flags.debug ? '--export-debug' : '--export-release', presetName, outFile],
        { timeoutMs: EXPORT_TIMEOUT_MS, label: `Godot export (${flags.debug ? 'debug' : 'release'})` },
      );
      await fs.writeFile(path.join(backupDir, `godot-export.${id}.${stamp}.log`), (importResult?.out ?? '') + result.out);
    }
  } finally {
    await fs.writeFile(presetsPath, original);
    await fs.utimes(presetsPath, originalStat.atime, originalStat.mtime); // keep the original timestamps too
    const restoredHash = sha256(await fs.readFile(presetsPath));
    if (restoredHash === originalHash) {
      console.log(`\n[export-arcade] export_presets.cfg restored, sha256 identical (${restoredHash})`);
    } else {
      console.error(`\n[export-arcade] RESTORE MISMATCH: expected ${originalHash}, got ${restoredHash}. Backup: ${backupPath}`);
      process.exitCode = 1;
    }
    if (!credsExisted && existsSync(credsPath)) {
      await fs.rm(credsPath, { force: true });
      console.log('[export-arcade] removed export_credentials.cfg that Godot created during export');
    }
  }

  if (flags.dryRun) return;

  // ---- 5. report -------------------------------------------------------------------
  const diagnostics = extractDiagnostics(result.out);
  const files = await listFiles(outDir);
  const total = files.reduce((n, f) => n + f.size, 0);
  console.log(`\n[export-arcade] Godot exit code ${result.code}${result.timedOut ? ' (TIMED OUT)' : ''} after ${(result.ms / 1000).toFixed(1)}s`);
  if (diagnostics.length) {
    console.log('\n[export-arcade] Godot diagnostics:');
    for (const d of diagnostics) console.log(`  ${d}`);
  }
  console.log(`\n[export-arcade] files in ${path.relative(ROOT, outDir).replace(/\\/g, '/')}/ (${files.length}, ${fmtMiB(total)} total):`);
  let oversized = 0;
  for (const f of files) {
    const flag = f.size > PAGES_FILE_LIMIT ? '  <-- OVER 25 MiB (Cloudflare Pages limit)' : '';
    if (flag) oversized++;
    console.log(`  ${fmtMiB(f.size).padStart(11)}  ${f.rel}${flag}`);
  }
  if (oversized) {
    console.log(`\n[export-arcade] ${oversized} file(s) exceed 25 MiB; Cloudflare Pages will reject the deploy. Host those on R2 (custom domain or a Worker with an R2 binding) and point the loader at them.`);
  }
  if (result.code !== 0 || result.timedOut || !existsSync(outFile)) {
    fail(`Export failed (exit ${result.code}${result.timedOut ? ', timed out' : ''})${existsSync(outFile) ? '' : '; no index.html produced'}`);
  }
  const readyHtml = instrumentGameHtml(await fs.readFile(outFile, 'utf8'), id);
  await fs.writeFile(outFile, readyHtml);
  await fs.writeFile(path.join(outDir, 'portfolio-ready.json'), JSON.stringify({ id, protocol: 1 }) + '\n');
  console.log(`\n[export-arcade] done: ${outFile}`);
}

main().catch((err) => fail(err?.stack || String(err)));
