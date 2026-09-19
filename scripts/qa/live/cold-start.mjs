import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const BASE = process.argv[2];
const b = await chromium.launch({ headless: true, args: ['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist'] });
for (let run=0; run<2; run++) {
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(BASE+'/',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>performance.getEntriesByName('hall:render-warm-end').length>0,null,{timeout:60000});
await page.waitForTimeout(6000);
const r = await page.evaluate(()=>{
  const marks=Object.fromEntries(performance.getEntriesByType('mark').map(m=>[m.name,Math.round(m.startTime)]));
  const res=performance.getEntriesByType('resource');
  const grp=(re)=>{const x=res.filter(e=>re.test(e.name));return {n:x.length,kb:Math.round(x.reduce((s,e)=>s+(e.transferSize||e.encodedBodySize||0),0)/1024),firstStart:Math.round(Math.min(...x.map(e=>e.startTime))),lastEnd:Math.round(Math.max(...x.map(e=>e.responseEnd)))}};
  const long=performance.getEntriesByType('longtask')||[];
  return {marks, readyMs:document.querySelector('[data-ready-ms]')?.dataset.readyMs, js:grp(/\.js(\?|$)/), models:grp(/\/models\//), tex:grp(/\/textures\//), media:grp(/\/media\//),
   biggest:res.map(e=>[Math.round((e.transferSize||e.encodedBodySize)/1024),e.name.split('/').slice(-2).join('/')]).sort((a,b)=>b[0]-a[0]).slice(0,12)};
});
console.log('RUN',run,JSON.stringify(r,null,1));
await page.close();
}
await b.close();
