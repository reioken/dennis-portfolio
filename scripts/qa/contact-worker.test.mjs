import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {webcrypto} from 'node:crypto';
const source=fs.readFileSync(new URL('../../workers/contact/src/index.js',import.meta.url),'utf8').replace("import { EmailMessage } from 'cloudflare:email';",'').replace('export default {','globalThis.worker = {');
function setup(overrides={}) {
 const sent=[];const context=vm.createContext({Request,Response,TextEncoder,crypto:webcrypto,btoa,console:{log(){},error(){}},EmailMessage:class {constructor(from,to,raw){Object.assign(this,{from,to,raw});}}});
 vm.runInContext(source,context);
 const env={CONTACT:{send:async m=>sent.push(m)},CONTACT_TO:'inbox@example.test',CONTACT_FROM:'contact@example.test',...overrides};
 const request=(body,form=false)=>new Request('https://www.dennisbf.design/api/contact',{method:'POST',headers:{'content-type':form?'application/x-www-form-urlencoded':'application/json'},body:form?new URLSearchParams(body).toString():JSON.stringify(body)});
 return {sent,send:(body,form=false)=>context.worker.fetch(request(body,form),env)};
}
const valid={name:'Local test',email:'qa@example.test',message:'A mocked message.'};
test('contact rejects null, arrays and primitive JSON without sending mail',async()=>{
 const {send,sent}=setup();for(const body of [null,[],false,'text',1]){const r=await send(body);assert.equal(r.status,400);assert.equal((await r.json()).error,'invalid_payload');}assert.equal(sent.length,0);
});
test('plain form response preserves validation, rate-limit and unavailable statuses',async()=>{
 assert.equal((await setup().send({},true)).status,400);
 assert.equal((await setup({CONTACT_SENDER_LIMITER:{limit:async()=>({success:false})}}).send(valid,true)).status,429);
 const unavailable=await setup({CONTACT:null}).send(valid,true);assert.equal(unavailable.status,503);assert.match(unavailable.headers.get('content-type'),/text\/html/);
 const failed=await setup({CONTACT:{send:async()=>{throw Error('mock');}}}).send(valid,true);assert.equal(failed.status,502);
});
test('valid JSON and plain form deliver once through mocked mail binding',async()=>{
 for(const form of [false,true]){const {send,sent}=setup();const r=await send(valid,form);assert.equal(r.status,200);assert.equal(sent.length,1);assert.match(sent[0].raw,/Reply-To: Local test <qa@example.test>/);assert.match(sent[0].raw,/multipart\/alternative/);}
});
