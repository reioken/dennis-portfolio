import {chromium} from 'playwright';
import fs from 'node:fs/promises';import assert from 'node:assert/strict';
import {base,outDir} from './_env.mjs';
const BASE=base('http://localhost:4322');
const out=outDir('polish-2026-09-11');const browser=await chromium.launch({headless:true,args:['--use-angle=d3d11']});const results=[];
try{for(const width of [390,1366]){
 const page=await browser.newPage({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600,reducedMotion:'reduce'});
 let response='ok',requests=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/contact',async route=>{requests++;await new Promise(r=>setTimeout(r,500));if(response==='ok')await route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});else if(response==='rate')await route.fulfill({status:429,contentType:'application/json',body:'{"error":"rate_limited"}'});else await route.fulfill({status:500,contentType:'application/json',body:'{"error":"send_failed"}'});});
 await page.goto(BASE+'/contact/',{waitUntil:'networkidle'});await page.waitForFunction(()=>!document.documentElement.classList.contains('gl-pending'));
  const form=page.locator('.contact-form'),send=form.locator('button[type=submit]');
 await send.click();await page.waitForTimeout(100);assert.equal(await form.locator('[aria-invalid=true]').count(),3);assert.equal(await page.locator('input[name=name]').evaluate(e=>e===document.activeElement),true);
 await form.locator('[name=name]').fill('Local QA');assert.equal(await form.locator('[aria-invalid=true]').count(),2);
 await form.locator('[name=email]').fill('invalid');await form.locator('[name=message]').fill('Local mocked UI validation.');await send.click();assert.equal(await form.locator('[aria-invalid=true]').count(),1);assert.equal(requests,0);
 await form.locator('[name=email]').fill('qa@example.test');await send.click();assert.equal(await form.locator('[name=name]').isDisabled(),true);await page.waitForSelector('.contact-form__note--ok');assert.equal(requests,1);assert.equal(await form.locator('[name=name]').inputValue(),'');
 for(const kind of ['rate','failure']){response=kind;await form.locator('[name=name]').fill('Local QA');await form.locator('[name=email]').fill('qa@example.test');await form.locator('[name=message]').fill('Mock request only.');await send.click();await page.waitForSelector('.contact-form__note--err');assert.equal(await form.locator('[name=message]').inputValue(),'Mock request only.');assert.equal(await send.isEnabled(),true);}
 await page.screenshot({path:`${out}/contact-${width}-validation.png`});
 await page.goto(BASE+'/en/contact/',{waitUntil:'networkidle'});await page.waitForTimeout(800);assert.equal(await page.locator('html').getAttribute('lang'),'en');await page.getByRole('button',{name:'Send message',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.locator('[aria-invalid=true]').count(),3);
 results.push({width,validation:true,mockSuccess:true,mockRateLimit:true,mockFailure:true,draftPreserved:true,english:true,requests,errors});console.log(JSON.stringify(results.at(-1)));await page.close();
}}finally{await fs.writeFile(`${out}/contact-interactions.json`,JSON.stringify(results,null,2));await browser.close();}
