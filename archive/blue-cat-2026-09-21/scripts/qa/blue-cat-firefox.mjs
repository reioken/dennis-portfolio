import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const driver=spawn(process.env.GECKODRIVER||'.source-assets/firefox-qa/geckodriver.exe',['--port','4447'],{windowsHide:true});
driver.stdout.resume();driver.stderr.resume();let session;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function request(path,body,method=body?'POST':'GET'){
 const response=await fetch('http://127.0.0.1:4447'+path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const data=await response.json();if(data.value?.error)throw Error(JSON.stringify(data.value));return data.value;
}
const command=(p,b)=>request('/session/'+session+p,b);
const js=script=>command('/execute/sync',{script,args:[]});
try{
 for(let i=0;i<40;i++){try{await request('/status');break;}catch{await wait(100);}}
 const created=await request('/session',{capabilities:{alwaysMatch:{browserName:'firefox','moz:firefoxOptions':{binary:process.env.FIREFOX_BINARY||'C:/Program Files/Mozilla Firefox/firefox.exe',args:['-headless']}}}});
 session=created.sessionId;await command('/window/rect',{width:1440,height:1000});
 await command('/url',{url:'http://localhost:4321/'});
 let ready=false;
 for(let i=0;i<100;i++){ready=await js('return !!window.__hall?.readyDone && !!window.__hall?.blue');if(ready)break;await wait(500);}
 assert.ok(ready);await wait(7300);
 const first=await js('return window.__hall.blue.mixer.time');await wait(1500);
 const second=await js('return window.__hall.blue.mixer.time');assert.ok(second-first>.5);
 const point=await js('const r=document.querySelector(".hall__blue-pet").getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}');
 await command('/actions',{actions:[{type:'pointer',id:'mouse',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',duration:0,origin:'viewport',...point},{type:'pointerDown',button:0},{type:'pointerUp',button:0}]}]});
 await wait(650);
 const happy=await js('const b=window.__hall.blue;return {mood:b.mood,blink:b.blink,path:location.pathname,hiddenAncestor:!!b.button.closest("[aria-hidden=true]")}');
 assert.equal(happy.mood,'happy');assert.ok(happy.blink>.85);assert.equal(happy.path,'/');assert.equal(happy.hiddenAncestor,false);
 await fs.mkdir('.source-assets/blue/qa',{recursive:true});
 await fs.writeFile('.source-assets/blue/qa/firefox.png',Buffer.from(await command('/screenshot'),'base64'));
 const report={browser:created.capabilities.browserVersion,ready,animationAdvance:second-first,happy};
 await fs.writeFile('.source-assets/blue/qa/firefox.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{if(session)await request('/session/'+session,undefined,'DELETE').catch(()=>{});driver.kill();}
