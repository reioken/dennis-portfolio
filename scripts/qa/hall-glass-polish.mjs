import {chromium} from 'playwright';
const b=await chromium.launch({headless:true,args:['--use-angle=d3d11']});
try{const c=await b.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),p=await c.newPage();await p.goto('http://localhost:4322/work/riftback/',{waitUntil:'networkidle'});await p.waitForFunction(()=>document.querySelector('.hall.is-3d'));await p.waitForTimeout(500);await p.screenshot({path:'.source-assets/polish-2026-09-11/glass-after-390.png'});}finally{await b.close()}
