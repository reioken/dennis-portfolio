import {categories,assess,score} from './core.js';
import {findFor} from './feedback.js';
export const SAVE_KEY='rarer.home.v1';
const clone=value=>JSON.parse(JSON.stringify(value));
export const newRun=id=>({id,ci:0,stage:'home',chain:[],results:[],failed:null});
export const emptyProgress=id=>({version:1,rounds:[],legendary:[],run:newRun(id)});
function validChain(ci,chain){
 if(!categories[ci]||!Array.isArray(chain)||chain.length>30)return false;
 const prior=[];
 for(const a of chain){if(!Array.isArray(a)||typeof a[0]!=='string')return false;const r=assess(categories[ci],prior,a[0]);if(r.kind!=='accepted'||r.answer[1]!==a[1])return false;prior.push(r.answer);}
 return true;
}
const validId=id=>typeof id==='string'&&id.length>0&&id.length<=100;
const unique=(list,key)=>[...new Map(list.map(item=>[key(item),item])).values()];
function cleanLegendary(entries){
 return unique((Array.isArray(entries)?entries:[]).filter(a=>a&&Number.isInteger(a.ci)&&validChain(a.ci,[[a.name,a.rarity]])&&a.rarity>=80).map(a=>({ci:a.ci,name:a.name,rarity:a.rarity})),a=>a.ci+':'+a.name);
}
export function decodeProgress(raw,id='new'){
 const fresh=emptyProgress(id);
 try{
  const data=typeof raw==='string'?JSON.parse(raw):raw;if(!data||data.version!==1)return fresh;
  fresh.rounds=unique((Array.isArray(data.rounds)?data.rounds:[]).filter(r=>r&&validId(r.id)&&Number.isInteger(r.ci)&&validChain(r.ci,r.chain)).map(r=>({id:r.id,ci:r.ci,chain:r.chain,bust:!!r.bust})),r=>r.id);
  fresh.legendary=cleanLegendary(data.legendary);
  const r=data.run;
  if(r&&validId(r.id)&&Number.isInteger(r.ci)&&validChain(r.ci,r.chain)&&['home','play','banked','bust','result'].includes(r.stage)){
   const expected=r.stage==='home'?0:r.stage==='play'?r.ci:r.stage==='result'?3:r.ci+1;
   const validResults=Array.isArray(r.results)&&r.results.length===expected&&r.results.every((v,i)=>v&&validChain(i,v.chain));
   const results=validResults?r.results.map((v,i)=>({name:categories[i].label,chain:v.chain,bust:!!v.bust})):[];
   let failed=null;
   if(Array.isArray(r.failed)&&typeof r.failed[0]==='string'){
    const attempt=assess(categories[r.ci],r.chain,r.failed[0]);if(attempt.kind==='bust')failed=attempt.answer;
   }
   if(validResults&&(r.stage!=='bust'||failed))fresh.run={id:r.id,ci:r.ci,stage:r.stage,chain:r.chain,results,failed};
  }
  return clone(fresh);
 }catch{return fresh;}
}
export function loadProgress(storage,id){
 try{return {state:decodeProgress(storage?.getItem(SAVE_KEY),id),ok:!!storage};}catch{return {state:emptyProgress(id),ok:false};}
}
export function saveProgress(storage,state){
 try{
  if(!storage)throw new Error('No local storage');
  const previous=decodeProgress(storage.getItem(SAVE_KEY));
  const merged={...state,rounds:unique([...previous.rounds,...state.rounds],r=>r.id),legendary:cleanLegendary([...previous.legendary,...state.legendary])};
  storage.setItem(SAVE_KEY,JSON.stringify(merged));return {state:merged,ok:true};
 }catch{return {state,ok:false};}
}
export function recordDiscovery(state,ci,answer){
 if(answer[1]<80)return state;
 return {...state,legendary:cleanLegendary([...state.legendary,{ci,name:answer[0],rarity:answer[1]}])};
}
export function settleRound(state,runId,ci,chain,bust=false){
 const id=runId+':'+ci;if(state.rounds.some(r=>r.id===id))return state;
 if(!validChain(ci,chain))throw new Error('Cannot save an invalid chain');
 return {...state,rounds:[...state.rounds,{id,ci,chain:clone(chain),bust}]};
}
export function homeProfile(state){
 const finds={rocks:0,ore:0,amethyst:0,diamond:0},layers=[];let total=0;
 for(const r of state.rounds){
  const haul={},value=score(r.chain);
  for(const a of r.chain){const type=findFor(a[1]).asset;finds[type]++;haul[type]=(haul[type]||0)+1;}
  if(value)layers.push({from:total,to:total+value,finds:haul});total+=value;
 }
 return {total,finds,layers,rounds:state.rounds.length,legendary:state.legendary.length};
}
export {pileHeight} from './burrow.js';
