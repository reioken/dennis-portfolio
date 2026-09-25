// Riftback at 390 px (preview server, 4322). Once the glass panel over the hall; since d58c490 (2026-09-17) a native
// project page without the hall, which is what this asserts before the screenshot.
import {chromium} from 'playwright';
import {base,outDir,expectNativeCase} from './_env.mjs';
const BASE=base('http://localhost:4322');
const out=outDir('polish-2026-09-11');
const b=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
try{const c=await b.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),p=await c.newPage();await p.goto(BASE+'/work/riftback/',{waitUntil:'networkidle'});console.log(JSON.stringify(await expectNativeCase(p)));await p.waitForTimeout(500);await p.screenshot({path:out+'/glass-after-390.png'});}finally{await b.close()}
