/**
 * Uebernimmt das Studio aus fd-pipeline nach public/studio/.
 *
 * Quelle der Wahrheit ist fd-pipeline/studio-web. Dort laeuft das Studio
 * unter "/", im Portfolio unter "/studio/" — deshalb werden beim Kopieren
 * die absoluten Pfade umgeschrieben.
 *
 * Bewusst NICHT synchronisiert: functions/. Die Portfolio-Variante setzt
 * zusaetzlich CSP- und X-Frame-Options-Header, damit overlay.html in einem
 * iframe laufen darf, und liegt unter functions/studio/ statt functions/.
 * Diese Dateien werden getrennt gepflegt.
 *
 * Aufruf:
 *   node scripts/sync-studio.mjs            # kopieren
 *   node scripts/sync-studio.mjs --check    # nur pruefen, nichts schreiben
 */

import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORTFOLIO = join(HERE, "..");
const SOURCE = join(PORTFOLIO, "..", "..", "Documents", "Floordirekt", "fd-pipeline", "studio-web");
const TARGET = join(PORTFOLIO, "public", "studio");

const CHECK_ONLY = process.argv.includes("--check");

/** Dateien, die 1:1 mit Pfad-Rewrite uebernommen werden. */
const TEXT_FILES = [
  "app.js",
  "placement.js",
  "index.html",
  "styles.css",
  "overlay.html",
  "login.html",
  "login.js",
];

/** Verzeichnisse, die unveraendert kopiert werden. */
const ASSET_DIRS = ["assets", "vendor"];

/**
 * Wurzelpfade der Quelle, die im Portfolio unter /studio/ liegen.
 * Reihenfolge egal, die Ersetzung ist praefixgebunden.
 */
const ROOT_PREFIXES = [
  "api",
  "assets",
  "vendor",
  "login",
  "overlay",
  "styles.css",
  "login.js",
  "favicon.ico",
];

function rewritePaths(content) {
  let out = content;
  for (const prefix of ROOT_PREFIXES) {
    // Nur in Quotes stehende absolute Pfade anfassen, damit z. B.
    // Kommentare oder URL-Fragmente unberuehrt bleiben.
    const re = new RegExp(`(["'\`])/${prefix.replace(".", "\\.")}`, "g");
    out = out.replace(re, `$1/studio/${prefix}`);
  }
  // Sicherheitsnetz gegen doppelte Praefixe bei mehrfachem Lauf.
  out = out.replace(/\/studio\/studio\//g, "/studio/");
  return out;
}

function main() {
  if (!existsSync(SOURCE)) {
    console.error(`Quelle nicht gefunden: ${SOURCE}`);
    console.error("Liegt fd-pipeline woanders? Pfad in diesem Skript anpassen.");
    process.exit(1);
  }

  let changed = 0;
  let identical = 0;

  for (const name of TEXT_FILES) {
    const from = join(SOURCE, name);
    if (!existsSync(from)) {
      console.warn(`  fehlt in der Quelle, uebersprungen: ${name}`);
      continue;
    }
    const rewritten = rewritePaths(readFileSync(from, "utf8"));
    const to = join(TARGET, name);
    const current = existsSync(to) ? readFileSync(to, "utf8") : null;

    if (current === rewritten) {
      identical++;
      continue;
    }
    changed++;
    console.log(`  ${CHECK_ONLY ? "wuerde aendern" : "aktualisiert"}: ${name}`);
    if (!CHECK_ONLY) {
      mkdirSync(dirname(to), { recursive: true });
      writeFileSync(to, rewritten, "utf8");
    }
  }

  // login/ und overlay/ existieren zusaetzlich als Ordner mit index.html,
  // damit /studio/login/ und /studio/overlay/ ohne Dateiendung funktionieren.
  for (const [file, dir] of [["login.html", "login"], ["overlay.html", "overlay"]]) {
    const from = join(SOURCE, file);
    if (!existsSync(from)) continue;
    const rewritten = rewritePaths(readFileSync(from, "utf8"));
    const to = join(TARGET, dir, "index.html");
    const current = existsSync(to) ? readFileSync(to, "utf8") : null;
    if (current === rewritten) {
      identical++;
      continue;
    }
    changed++;
    console.log(`  ${CHECK_ONLY ? "wuerde aendern" : "aktualisiert"}: ${dir}/index.html`);
    if (!CHECK_ONLY) {
      mkdirSync(dirname(to), { recursive: true });
      writeFileSync(to, rewritten, "utf8");
    }
  }

  for (const dir of ASSET_DIRS) {
    const from = join(SOURCE, dir);
    if (!existsSync(from)) continue;
    const to = join(TARGET, dir);
    const missing = listFiles(from).filter((f) => !existsSync(join(to, f)));
    if (missing.length) {
      changed += missing.length;
      for (const f of missing) console.log(`  ${CHECK_ONLY ? "wuerde kopieren" : "kopiert"}: ${dir}/${f}`);
    }
    if (!CHECK_ONLY) cpSync(from, to, { recursive: true });
  }

  console.log(`\n${changed} Aenderung(en), ${identical} unveraendert.`);
  console.log("functions/studio/ wurde NICHT angefasst — wird getrennt gepflegt.");

  if (CHECK_ONLY && changed > 0) process.exit(1);
}

function listFiles(root, prefix = "") {
  const out = [];
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    if (statSync(full).isDirectory()) out.push(...listFiles(full, join(prefix, entry)));
    else out.push(join(prefix, entry));
  }
  return out;
}

main();
