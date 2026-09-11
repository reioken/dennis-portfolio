import { chromium } from "playwright";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "screenshots", "desktop");
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: "dark",
});
const page = await ctx.newPage();

await page.goto("http://localhost:3000/champions/ahri", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForTimeout(800);
await page.evaluate(() => {
  const el = document.getElementById("build") || document.querySelector("#build");
  if (el) el.scrollIntoView({ block: "start" });
});
await page.waitForTimeout(700);
await page.screenshot({
  path: join(dir, "03b-champion-ahri-build-desktop.png"),
  animations: "disabled",
});

await browser.close();
console.log("extras done");
