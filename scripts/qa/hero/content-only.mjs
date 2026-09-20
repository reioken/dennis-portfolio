// Verify projects removed from the hall still have complete, responsive project pages.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { outDir } from './_out.mjs';
const [out, base = 'http://127.0.0.1:4322'] = process.argv.slice(2);
const dir = outDir(out, 'content-only.mjs OUT BASE');
const slugs = ['mina', 'briefly', 'riftcast', 'carillon'];
const browser = await chromium.launch({headless:true});
const report = {errors:[], pages:[]};
try {
  for (const width of [390,1440]) {
    const page = await browser.newPage({viewport:{width,height:900}});
    page.on('pageerror', e => report.errors.push(String(e)));
    page.on('console', m => {if(m.type()==='error') report.errors.push(m.text());});
    const models=[];
    page.on('request', r => {if(r.url().includes('.glb')) models.push(r.url());});
    await page.goto(base+'/work/?filter=all', {waitUntil:'networkidle'});
    await page.locator('a[href$="/work/briefly/"]').first().waitFor();
    for (const slug of slugs) assert.ok(await page.locator(`a[href$="/work/${slug}/"]`).count(), `${slug} still listed in Projects`);
    for (const slug of slugs) {
      await page.goto(`${base}/work/${slug}/`, {waitUntil:'networkidle'});
      await page.locator('.case-page').waitFor({state:'visible'});
      assert.equal(await page.locator('.hall').count(),0);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${slug} overflow at ${width}`);
      assert.ok(await page.locator('.case-page img').count()>1,`${slug} retains screenshots`);
      assert.ok(await page.locator('.case-page__title').innerText());
      if(slug==='mina') assert.ok(await page.locator('.mina-reading').count(), 'Readable German Mina study retained');
      await page.screenshot({path:`${dir}/${slug}-${width}.png`});
      report.pages.push({slug,width});
    }
    assert.deepEqual(models,[], 'Content-only project pages never request hall models');
    await page.close();
  }
  assert.deepEqual(report.errors,[]);
} finally {
  await browser.close();
  await writeFile(`${dir}/content-only.json`,JSON.stringify(report,null,2));
}
console.log(JSON.stringify(report));
