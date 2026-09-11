/**
 * Portfolio screenshot capture. Local only — does not deploy or mutate content.
 * Usage: node portfolio-handoff/capture-screenshots.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.HANDOFF_BASE_URL || "http://localhost:3000";
const DESKTOP = join(__dirname, "screenshots", "desktop");
const MOBILE = join(__dirname, "screenshots", "mobile");

mkdirSync(DESKTOP, { recursive: true });
mkdirSync(MOBILE, { recursive: true });

const desktopViews = [
  { file: "01-home-desktop.png", path: "/", fullPage: false },
  { file: "01-home-desktop-full.png", path: "/", fullPage: true },
  { file: "02-champions-desktop.png", path: "/champions", fullPage: false },
  { file: "02-champions-desktop-full.png", path: "/champions", fullPage: true },
  { file: "03-champion-ahri-desktop.png", path: "/champions/ahri", fullPage: false },
  { file: "03-champion-ahri-desktop-full.png", path: "/champions/ahri", fullPage: true },
  { file: "04-champion-sion-desktop.png", path: "/champions/sion", fullPage: false },
  { file: "05-items-desktop.png", path: "/items", fullPage: false },
  { file: "06-item-deathfire-grasp-desktop.png", path: "/items/deathfire-grasp", fullPage: false },
  { file: "07-runes-desktop.png", path: "/runes", fullPage: false },
  { file: "08-masteries-desktop.png", path: "/masteries", fullPage: false },
  { file: "09-summoner-spells-desktop.png", path: "/summoner-spells", fullPage: false },
  { file: "10-jungle-desktop.png", path: "/jungle", fullPage: false },
  { file: "10-jungle-desktop-full.png", path: "/jungle", fullPage: true },
  { file: "11-builder-desktop.png", path: "/builder", fullPage: false },
  { file: "12-tier-list-desktop.png", path: "/tier-list", fullPage: false },
  { file: "12-tier-list-desktop-full.png", path: "/tier-list", fullPage: true },
  { file: "13-mayhem-tier-desktop.png", path: "/tier-list/aram", fullPage: false },
  { file: "14-augments-desktop.png", path: "/tier-list/aram/augments", fullPage: false },
  { file: "15-classic-explained-desktop.png", path: "/start", fullPage: false },
  { file: "15-classic-explained-desktop-full.png", path: "/start", fullPage: true },
  { file: "16-changes-desktop.png", path: "/changes", fullPage: false },
  { file: "17-about-desktop.png", path: "/about", fullPage: false },
  { file: "18-contribute-desktop.png", path: "/contribute", fullPage: false },
];

const mobileViews = [
  { file: "01-home-mobile.png", path: "/" },
  { file: "02-champions-mobile.png", path: "/champions" },
  { file: "03-champion-ahri-mobile.png", path: "/champions/ahri" },
  { file: "04-jungle-mobile.png", path: "/jungle" },
  { file: "05-builder-mobile.png", path: "/builder" },
  { file: "06-tier-list-mobile.png", path: "/tier-list" },
  { file: "07-classic-explained-mobile.png", path: "/start" },
];

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(600);
  /* Collapse any open tooltips / hover leftovers */
  await page.mouse.move(0, 0);
  await page.waitForTimeout(200);
}

async function shot(page, dir, { file, path, fullPage = false }) {
  const url = `${BASE}${path}`;
  console.log(`${fullPage ? "full" : "view"} ${file} ← ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(page);
  await page.screenshot({
    path: join(dir, file),
    fullPage,
    animations: "disabled",
  });
}

async function captureSearch(page, dir) {
  console.log("view 19-search-palette-desktop.png");
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await settle(page);
  await page.keyboard.press("Control+KeyK");
  await page.waitForTimeout(400);
  /* Type a short query so results show */
  await page.keyboard.type("ahri", { delay: 40 });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: join(dir, "19-search-palette-desktop.png"),
    fullPage: false,
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
}

const browser = await chromium.launch({ headless: true });

const desktop = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: "dark",
});
const dPage = await desktop.newPage();
for (const view of desktopViews) {
  await shot(dPage, DESKTOP, view);
}
await captureSearch(dPage, DESKTOP);
await desktop.close();

const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  colorScheme: "dark",
});
const mPage = await mobile.newPage();
for (const view of mobileViews) {
  await shot(mPage, MOBILE, view);
}
await mobile.close();

await browser.close();
console.log("done");
