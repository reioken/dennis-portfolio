// Best scores and the collection album for every mode outside the daily.
// Kept apart from the daily save (daily-progress.js) so daily points and streaks stay clean.
export const MODES_KEY='rarer.modes.v1';
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x)?x:{};
export const emptyModes=()=>({version:1,best:{},collection:{}});
export function loadModes(storage){
 try{
  const data=JSON.parse(storage?.getItem(MODES_KEY)||'null');
  if(data?.version!==1)return emptyModes();
  const best=Object.fromEntries(Object.entries(plain(data.best)).filter(([,v])=>Number.isFinite(v)));
  const collection=Object.fromEntries(Object.entries(plain(data.collection)).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,[...new Set(v.filter(n=>typeof n==='string'))]]));
  return {version:1,best,collection};
 }catch{return emptyModes();}
}
export function saveModes(storage,state){try{storage?.setItem(MODES_KEY,JSON.stringify(state));return !!storage;}catch{return false;}}
// Re-read before writing so two tabs never erase each other's finds or records.
export function updateModes(storage,change){const state=change(loadModes(storage));saveModes(storage,state);return state;}
export const recordFinds=(state,categoryId,names)=>({...state,collection:{...state.collection,[categoryId]:[...new Set([...(state.collection[categoryId]||[]),...names])]}});
// Higher is better for every stored record.
export function recordBest(state,key,score){
 const previous=Number.isFinite(state.best[key])?state.best[key]:null,isBest=previous===null||score>previous;
 return {state:isBest?{...state,best:{...state.best,[key]:score}}:state,isBest,previous};
}
