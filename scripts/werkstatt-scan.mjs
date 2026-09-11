#!/usr/bin/env node
/**
 * werkstatt-scan.mjs — deploy-time scanner for the "Werkstatt" shipping log.
 *
 * Reads the owner's sibling project repos on this machine and writes
 * src/data/werkstatt.json, which the site renders as a shipping log and a
 * build heatmap. Runs as `prebuild` / `predeploy`, so it must never fail:
 * missing paths are skipped (their previously written entry is kept), git
 * errors degrade to an mtime scan, and the process always exits 0.
 *
 * Privacy: only commit dates and (for public projects) commit subjects leave
 * the repo. No bodies, no author names or emails, no file paths. Subjects are
 * scrubbed for email addresses and token-looking strings before they are
 * written. Nothing in this script reads .env files or environment secrets.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = path.join(ROOT, 'src', 'data', 'werkstatt.json');

const HEATMAP_DAYS = 400; // keep the JSON small: per-day counts only this far back
const RECENT_SUBJECTS = 8; // per public project, feeds recentLog()
const GIT_TIMEOUT_MS = 20_000;
const WALK_BUDGET = 60_000; // max directory entries visited per non-git folder
const WALK_MAX_DEPTH = 12;

/**
 * Project config. `versionFrom` picks the strategy used to read a version
 * ('package' | 'expo' | 'tauri' | 'godot' | 'unity' | 'pyproject' | 'tag' | null);
 * every strategy falls back to the latest semver-looking git tag, else null.
 * `versionFile` optionally overrides the default file for that strategy
 * (relative to `path`). `public: false` keeps dates but drops subjects.
 */
const PROJECTS = [
  { slug: 'nexus',           path: 'C:/Users/denni/Documents/NEXUS',                       public: true,  versionFrom: 'package',   versionFile: 'app/package.json' },
  { slug: 'berry',           path: 'C:/Users/denni/Documents/Berry',                       public: true,  versionFrom: 'package' },
  { slug: 'riftcast',        path: 'C:/Users/denni/Documents/riftcast',                    public: true,  versionFrom: 'package',   versionFile: 'desktop/package.json' },
  { slug: 'riftback',        path: 'C:/Users/denni/Projects/Legaue Project/leagueproject', public: true,  versionFrom: 'package' },
  { slug: 'safeplate',       path: 'C:/Users/denni/Projects/Safeplate',                    public: true,  versionFrom: 'expo',      versionFile: 'apps/mobile/app.json' },
  { slug: 'carillon',        path: 'C:/Users/denni/Projects/Ashwake',                      public: true,  versionFrom: 'godot' },
  { slug: 'echo-frequency',  path: 'C:/Users/denni/Projects/Echo-Frequency/EchoFreq',      public: false, versionFrom: 'godot',     versionFile: 'game/project.godot' },
  { slug: 'cab-no-9',        path: 'C:/Users/denni/Projects/Cab No. 9/Cab No. 09',         public: false, versionFrom: 'godot',     versionFile: 'game/project.godot' },
  { slug: 'saute-survivors', path: 'C:/Users/denni/Projects/survivorlike',                 public: false, versionFrom: 'unity' },
  { slug: 'lowlight',        path: 'C:/Users/denni/Projects/Spotify',                      public: false, versionFrom: 'tauri' },
  { slug: 'angry',           path: 'C:/Users/denni/Projects/Angry',                        public: false, versionFrom: 'package' },
  { slug: 'briefly',         path: 'C:/Users/denni/Projects/briefly',                      public: false, versionFrom: 'package' },
  { slug: 'ceiling',         path: 'C:/Users/denni/Projects/CEILING',                      public: false, versionFrom: null },
  { slug: 'design-library',  path: 'C:/Users/denni/Projects/design-library',               public: false, versionFrom: 'package' },
  { slug: 'project-manager', path: 'C:/Users/denni/Projects/project-manager',              public: false, versionFrom: 'tauri' },
  { slug: 'image-gen',       path: 'C:/Users/denni/Documents/image-gen',                   public: false, versionFrom: 'pyproject' },
  { slug: 'portfolio',       path: ROOT,                                                   public: true,  versionFrom: 'package' },
];

/* ------------------------------------------------------------------ dates */

const DAY_MS = 86_400_000;

/** Local calendar date as YYYY-MM-DD (matches git --date=short granularity). */
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const NOW = new Date();
const CUTOFF_400 = isoDate(new Date(NOW.getTime() - HEATMAP_DAYS * DAY_MS));
const CUTOFF_90 = isoDate(new Date(NOW.getTime() - 90 * DAY_MS));
const CUTOFF_30 = isoDate(new Date(NOW.getTime() - 30 * DAY_MS));

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

/* ---------------------------------------------------------------- helpers */

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  } catch {
    return null;
  }
}

function readJson(file) {
  const text = readText(file);
  if (text == null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Run git without a shell (paths with spaces are safe). Returns stdout or null. */
function git(dir, args) {
  try {
    return execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      timeout: GIT_TIMEOUT_MS,
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0' },
    })
      .replace(/\r\n/g, '\n')
      .trim();
  } catch {
    return null;
  }
}

const normalizePath = (p) => path.resolve(p).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

/** True only when `dir` itself is the top level of a work tree (not merely inside one). */
function isGitRoot(dir) {
  const top = git(dir, ['rev-parse', '--show-toplevel']);
  return top != null && normalizePath(top) === normalizePath(dir);
}

/** Strip anything that could identify a person or look like a credential. */
function scrubSubject(subject) {
  return String(subject)
    .replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]')
    .replace(/\b(?:sk|ghp|gho|ghu|ghs|xox[baprs]|AKIA|AIza)[-_A-Za-z0-9]{8,}\b/g, '[redacted]')
    .replace(/\b[0-9a-f]{32,}\b/gi, '[hash]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);
}

/* --------------------------------------------------------------- versions */

const DEFAULT_VERSION_FILE = {
  package: 'package.json',
  expo: 'app.json',
  tauri: 'src-tauri/tauri.conf.json',
  godot: 'project.godot',
  unity: 'ProjectSettings/ProjectSettings.asset',
  pyproject: 'pyproject.toml',
};

const VERSION_READERS = {
  package: (file) => readJson(file)?.version,
  expo: (file) => readJson(file)?.expo?.version,
  // Tauri 2 keeps `version` at the top level, Tauri 1 under `package`.
  tauri: (file) => {
    const conf = readJson(file);
    return conf?.version ?? conf?.package?.version;
  },
  godot: (file) => readText(file)?.match(/^config\/version\s*=\s*"([^"]*)"/m)?.[1],
  unity: (file) => readText(file)?.match(/^\s*bundleVersion:\s*(\S+)/m)?.[1],
  pyproject: (file) => readText(file)?.match(/^version\s*=\s*["']([^"']+)["']/m)?.[1],
};

/** Accept only strings that start like a version number; strip a leading "v". */
function cleanVersion(raw) {
  if (raw == null) return null;
  const m = String(raw)
    .trim()
    .match(/^v?(\d+(?:\.\d+)*(?:[-+.][0-9A-Za-z.+-]*)?)$/);
  return m ? m[1] : null;
}

function latestTag(dir) {
  const out = git(dir, ['tag', '--list', '--sort=-creatordate']);
  if (!out) return null;
  for (const tag of out.split('\n')) {
    const v = cleanVersion(tag);
    if (v) return v;
  }
  return null;
}

function resolveVersion(project, dir, hasGit) {
  const strategy = project.versionFrom;
  if (strategy && strategy !== 'tag') {
    const reader = VERSION_READERS[strategy];
    const rel = project.versionFile ?? DEFAULT_VERSION_FILE[strategy];
    if (reader && rel) {
      const v = cleanVersion(reader(path.join(dir, rel)));
      if (v) return v;
    }
  }
  return hasGit ? latestTag(dir) : null;
}

/* ------------------------------------------------------------------- git */

function scanGit(dir, isPublic) {
  // Last commits: date<TAB>subject, newest first. Subjects only, never bodies.
  const recentRaw = git(dir, ['log', `-${RECENT_SUBJECTS}`, '--format=%ad%x09%s', '--date=short']);
  const recent = [];
  for (const line of (recentRaw ?? '').split('\n')) {
    const tab = line.indexOf('\t');
    if (tab < 0) continue;
    const date = line.slice(0, tab).trim();
    if (!isDate(date)) continue;
    recent.push({ date, subject: scrubSubject(line.slice(tab + 1)) });
  }

  // Per-day commit counts for the heatmap window.
  const datesRaw = git(dir, ['log', `--since=${HEATMAP_DAYS}.days`, '--format=%ad', '--date=short']);
  const commits = {};
  for (const line of (datesRaw ?? '').split('\n')) {
    const date = line.trim();
    if (!isDate(date) || date < CUTOFF_400) continue;
    commits[date] = (commits[date] ?? 0) + 1;
  }

  const head = recent[0] ?? null;
  return {
    lastCommit: head ? { date: head.date, subject: isPublic ? head.subject : null } : null,
    recent: isPublic ? recent : [],
    commits: sortKeys(commits),
  };
}

/* ---------------------------------------------------------------- mtimes */

const SKIP_DIRS = new Set([
  'node_modules', 'Library', 'Temp', 'Logs', 'Builds', '.git', '.godot', '.import',
  '.cache', '.next', '.wrangler', '__pycache__', 'target', 'dist', 'out', 'coverage',
]);
const skipDir = (name) => SKIP_DIRS.has(name) || /^\.?venv/i.test(name);

/** Newest file mtime under `root` as YYYY-MM-DD, bounded so huge trees stay fast. */
function newestMtime(root) {
  let newest = 0;
  let budget = WALK_BUDGET;
  const stack = [[root, 0]];
  while (stack.length && budget > 0) {
    const [dir, depth] = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (--budget <= 0) break;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!skipDir(entry.name) && depth < WALK_MAX_DEPTH) stack.push([full, depth + 1]);
      } else if (entry.isFile()) {
        try {
          const ms = fs.statSync(full).mtimeMs;
          if (ms > newest) newest = ms;
        } catch {
          // unreadable entry: ignore
        }
      }
    }
  }
  if (!newest) return null;
  return isoDate(new Date(Math.min(newest, NOW.getTime())));
}

/* ------------------------------------------------------------- assembly */

function sortKeys(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

function countSince(commits, cutoff) {
  let n = 0;
  for (const [date, count] of Object.entries(commits ?? {})) if (date >= cutoff) n += count;
  return n;
}

function scanProject(project) {
  const dir = path.resolve(project.path);
  const hasGit = isGitRoot(dir);
  const version = resolveVersion(project, dir, hasGit);
  const base = {
    slug: project.slug,
    public: project.public === true,
    git: hasGit,
    version,
    lastCommit: null,
    recent: [],
    lastTouched: null,
    lastActivity: null,
    commits: null,
    commitsLast90Days: 0,
    source: 'scan',
  };
  if (hasGit) {
    const g = scanGit(dir, base.public);
    base.lastCommit = g.lastCommit;
    base.recent = g.recent;
    base.commits = g.commits;
    base.commitsLast90Days = countSince(g.commits, CUTOFF_90);
    base.lastActivity = g.lastCommit?.date ?? null;
  } else {
    base.lastTouched = newestMtime(dir);
    base.lastActivity = base.lastTouched;
  }
  return base;
}

/** Re-shape an entry from the previous JSON so it matches the current schema. */
function reviveCached(project, prev) {
  const commits = prev.commits && typeof prev.commits === 'object'
    ? sortKeys(Object.fromEntries(Object.entries(prev.commits).filter(([d]) => isDate(d) && d >= CUTOFF_400)))
    : null;
  const isPublic = project.public === true;
  const lastCommit = prev.lastCommit && isDate(prev.lastCommit.date)
    ? { date: prev.lastCommit.date, subject: isPublic ? prev.lastCommit.subject ?? null : null }
    : null;
  const recent = isPublic && Array.isArray(prev.recent)
    ? prev.recent
        .filter((r) => r && isDate(r.date) && typeof r.subject === 'string')
        .map((r) => ({ date: r.date, subject: scrubSubject(r.subject) }))
    : [];
  const lastTouched = isDate(prev.lastTouched) ? prev.lastTouched : null;
  return {
    slug: project.slug,
    public: isPublic,
    git: prev.git === true,
    version: typeof prev.version === 'string' ? prev.version : null,
    lastCommit,
    recent,
    lastTouched,
    lastActivity: lastCommit?.date ?? lastTouched ?? (isDate(prev.lastActivity) ? prev.lastActivity : null),
    commits,
    commitsLast90Days: countSince(commits, CUTOFF_90),
    source: 'cache',
  };
}

function main() {
  const previous = readJson(OUT_FILE);
  const prevBySlug = new Map((previous?.products ?? []).map((p) => [p?.slug, p]));

  const products = [];
  let present = 0;
  const skipped = [];

  for (const project of PROJECTS) {
    let exists = false;
    try {
      exists = fs.statSync(project.path).isDirectory();
    } catch {
      exists = false;
    }
    if (exists) {
      present += 1;
      products.push(scanProject(project));
    } else if (prevBySlug.has(project.slug)) {
      products.push(reviveCached(project, prevBySlug.get(project.slug)));
      skipped.push(`${project.slug} (kept cached entry)`);
    } else {
      skipped.push(`${project.slug} (no data)`);
    }
  }

  if (present === 0 && previous) {
    console.log(`werkstatt: none of ${PROJECTS.length} project paths exist here; keeping ${path.relative(ROOT, OUT_FILE)} as is.`);
    return;
  }

  products.sort((a, b) => {
    const da = a.lastActivity ?? '';
    const db = b.lastActivity ?? '';
    if (da !== db) return da < db ? 1 : -1;
    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  });

  const heatmap = {};
  for (const p of products) {
    for (const [date, count] of Object.entries(p.commits ?? {})) heatmap[date] = (heatmap[date] ?? 0) + count;
  }

  const data = {
    generatedAt: NOW.toISOString(),
    machine: present * 2 >= PROJECTS.length,
    products,
    heatmap: sortKeys(heatmap),
    totals: {
      products: products.length,
      commitsLast90Days: products.reduce((n, p) => n + p.commitsLast90Days, 0),
      activeProjectsLast30Days: products.filter((p) => p.lastActivity && p.lastActivity >= CUTOFF_30).length,
    },
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  const json = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(OUT_FILE, json, 'utf8');

  const col = (s, w) => String(s ?? '').padEnd(w);
  console.log(`werkstatt: ${present}/${PROJECTS.length} paths present, machine=${data.machine}, ${(json.length / 1024).toFixed(1)} KB -> ${path.relative(ROOT, OUT_FILE)}`);
  console.log(`  ${col('slug', 16)} ${col('src', 6)} ${col('version', 10)} ${col('last', 11)} 90d`);
  for (const p of products) {
    const src = p.source === 'cache' ? 'cache' : p.git ? 'git' : 'dir';
    console.log(`  ${col(p.slug, 16)} ${col(src, 6)} ${col(p.version ?? '-', 10)} ${col(p.lastActivity ?? '-', 11)} ${p.commitsLast90Days}`);
  }
  if (skipped.length) console.log(`  skipped: ${skipped.join(', ')}`);
  console.log(`  totals: ${JSON.stringify(data.totals)}`);
}

try {
  main();
} catch (err) {
  // Never break a build because the shipping log could not be refreshed.
  console.warn(`werkstatt: scan failed, leaving existing data untouched (${err?.message ?? err})`);
}
process.exitCode = 0;

