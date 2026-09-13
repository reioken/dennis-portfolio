import {categories,assess,score} from './core.js?v=34cffeeb0050';
import {edition,utcDay} from './edition.js?v=34cffeeb0050';
import {findFor} from './feedback.js?v=34cffeeb0050';
export const SAVE_KEY='rarer.daily.v2';
export const BACKUP_KEY='rarer.reset-backup.v1';
const clone=x=>JSON.parse(JSON.stringify(x));
const uid=()=>globalThis.crypto?.randomUUID?.()??Date.now().toString(36);
export const newRun=(day=edition.date)=>({id:day,day,ci:0,stage:'home',chain:[],results:[],failed:null,mistakes:0,lost:0,cargo:[]});
export const emptyProgress=(day=edition.date)=>({version:2,resetId:uid(),rounds:[],legendary:[],days:{},run:newRun(day)});
const validAnswer=a=>Array.isArray(a)&&typeof a[0]==='string'&&Number.isInteger(a[1])&&a[1]>=0&&a[1]<=100;
const validChain=a=>Array.isArray(a)&&a.length<=101&&a.every((x,i)=>validAnswer(x)&&(!i||x[1]>a[i-1][1]));
const unique=(xs,key)=>[...new Map(xs.map(x=>[key(x),x])).values()];
function validRun(r){
 if(!r||!/^\d{4}-\d{2}-\d{2}$/.test(r.day)||!Number.isInteger(r.ci)||r.ci<0||r.ci>2||!validChain(r.chain)||!['home','play','banked','bust','result'].includes(r.stage))return false;
 if(!Number.isInteger(r.mistakes)||r.mistakes<0||r.mistakes>3||!Number.isInteger(r.lost)||r.lost<0||r.lost>score(r.chain))return false;
 if(!Array.isArray(r.cargo)||!r.cargo.every(a=>validAnswer(a)&&r.chain.some(b=>b[0]===a[0]&&b[1]===a[1])))return false;
 const n=r.stage==='home'?0:r.stage==='play'?r.ci:r.stage==='result'?3:r.ci+1;
 return Array.isArray(r.results)&&r.results.length===n&&r.results.every(v=>v&&validChain(v.chain)&&Number.isInteger(v.points)&&v.points>=0&&v.points<=score(v.chain));
}
export function decodeProgress(raw,day=edition.date){
 const fresh=emptyProgress(day);
 try{
  const data=typeof raw==='string'?JSON.parse(raw):raw;
  if(data?.version!==2)return fresh;
  fresh.resetId=typeof data.resetId==='string'?data.resetId:fresh.resetId;
  fresh.rounds=unique((data.rounds||[]).filter(r=>r&&typeof r.id==='string'&&typeof r.categoryId==='string'&&validChain(r.chain)&&Array.isArray(r.cargo)&&r.cargo.every(validAnswer)&&Number.isInteger(r.points)&&r.points>=0&&r.points<=score(r.chain)),r=>r.id);
  fresh.legendary=unique((data.legendary||[]).filter(a=>a&&typeof a.name==='string'&&typeof a.categoryId==='string'&&Number.isInteger(a.rarity)&&a.rarity>=80&&a.rarity<=100),a=>a.categoryId+':'+a.name);
  fresh.days=Object.fromEntries(Object.entries(data.days||{}).filter(([k,r])=>k===r?.day&&validRun(r)));
  if(validRun(data.run))fresh.days[data.run.day]=data.run;
  // An unfinished past dig can finish without a timer. The next day is then offered.
  const unfinished=validRun(data.run)&&data.run.stage!=='home'&&data.run.stage!=='result'&&data.run.day<day;
  fresh.run=clone(unfinished?data.run:fresh.days[day]||newRun(day));
  return fresh;
 }catch{return fresh;}
}
export function loadProgress(storage,day=edition.date){try{return {state:decodeProgress(storage?.getItem(SAVE_KEY),day),ok:!!storage};}catch{return {state:emptyProgress(day),ok:false};}}
export function saveProgress(storage,state){
 try{
  if(!storage)throw Error('No storage');
  const raw=storage.getItem(SAVE_KEY),previous=raw?decodeProgress(raw,state.run.day):null;
  if(previous&&previous.resetId!==state.resetId)return {state:previous,ok:true,conflict:true};
  const merged={...state,rounds:unique([...(previous?.rounds||[]),...state.rounds],r=>r.id),legendary:unique([...(previous?.legendary||[]),...state.legendary],a=>a.categoryId+':'+a.name),days:{...previous?.days,...state.days,[state.run.day]:clone(state.run)}};
  storage.setItem(SAVE_KEY,JSON.stringify(merged));return {state:merged,ok:true};
 }catch{return {state,ok:false};}
}
export function recordDiscovery(state,ci,answer){return answer[1]<80?state:{...state,legendary:unique([...state.legendary,{categoryId:categories[ci].id,name:answer[0],rarity:answer[1]}],a=>a.categoryId+':'+a.name)};}
export function settleRound(state,runId,ci,chain,bust=false,risk={}){
 const id=runId+':'+ci;if(state.rounds.some(r=>r.id===id))return state;
 return {...state,rounds:[...state.rounds,{id,day:state.run.day,categoryId:categories[ci].id,chain:clone(chain),cargo:clone(risk.cargo||[]),points:Math.max(0,score(chain)-(risk.lost||0)),mistakes:risk.mistakes||0,bust}]};
}
export function homeProfile(state){
 const finds={rocks:0,ore:0,amethyst:0,diamond:0},layers=[];let total=0;
 for(const r of state.rounds){const haul={};for(const a of r.cargo){const type=findFor(a[1]).asset;finds[type]++;haul[type]=(haul[type]||0)+1;}if(r.points)layers.push({from:total,to:total+r.points,finds:haul});total+=r.points;}
 const days=[...new Set(state.rounds.map(r=>r.day))].filter(d=>state.rounds.filter(r=>r.day===d).length===3).sort();
 let streak=0,date=utcDay();if(!days.includes(date))date=new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10);
 while(days.includes(date)){streak++;date=new Date(Date.parse(date+'T00:00:00Z')-86400000).toISOString().slice(0,10);}
 return {total,finds,layers,rounds:state.rounds.length,legendary:state.legendary.length,streak};
}
export function resetProgress(storage){
 const backup={daily:storage?.getItem(SAVE_KEY),legacy:storage?.getItem('rarer.home.v1'),at:new Date().toISOString()};
 if(storage)storage.setItem(BACKUP_KEY,JSON.stringify(backup));
 const state=emptyProgress();if(storage){storage.setItem('rarer.home.v1',JSON.stringify({version:1,rounds:[],legendary:[],run:{id:'reset',ci:0,stage:'home',chain:[],results:[],failed:null}}));storage.setItem(SAVE_KEY,JSON.stringify(state));}return state;
}
