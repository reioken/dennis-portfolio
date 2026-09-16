// Spelunkle Depths: "Choose a depth, then name something that belongs there."
// Pure rules and save helpers, testable in Node. The page lives in depth-view.js.
import {assess} from './core.js?v=cea0b2abe3a6';

// Layers cover slices of each category's ranking, by the 0–100 rarity score
// (0 = most looked-up). Surface is the top 10%, Legendary the rarest 15%.
export const LAYERS=[
 {id:'surface',name:'Surface',max:10,points:10,share:'⬜'},
 {id:'shallow',name:'Shallow',max:30,points:20,share:'🟨'},
 {id:'deep',name:'Deep',max:60,points:40,share:'🟧'},
 {id:'abyss',name:'Abyss',max:85,points:80,share:'🟥'},
 {id:'legendary',name:'Legendary',max:100,points:150,share:'💎'}
];
export const MAX_MISSES=3;
export const DEPTH_KEY='rarer.depth.v1';
export const DEPTH_URL='dennisbf.design/rarer/?mode=depth';

export const layerIndex=rarity=>LAYERS.findIndex(layer=>rarity<=layer.max);

// Which ranks each layer covers in this category, so players can reason about it.
export function layerRanges(category){
 return LAYERS.map((layer,i)=>{
  const ranks=category.entries.filter(entry=>layerIndex(entry.rarity)===i).map(entry=>entry.rank);
  return {...layer,count:ranks.length,from:ranks.length?Math.min(...ranks):null,to:ranks.length?Math.max(...ranks):null};
 });
}

export const newDig=()=>({finds:[],guesses:[],misses:0,banked:false,caved:false});
export const cartPoints=dig=>dig.finds.reduce((total,find)=>total+LAYERS[find.layer].points,0);
// A cave-in spills half the cart, rounded down in the player's favour of simplicity.
export const digPoints=dig=>dig.caved?Math.floor(cartPoints(dig)/2):cartPoints(dig);
export const digDone=dig=>!!dig&&(dig.banked||dig.caved||dig.finds.length===LAYERS.length);
export const bankDig=dig=>({...dig,banked:true});

// One swing: the player picked `layer` and typed `text`.
// Unknown, ambiguous and repeated answers cost nothing; each layer pays once.
export function attempt(category,dig,layer,text){
 const result=assess(category,[],text);
 if(result.kind==='ambiguous'||result.kind==='unknown')return {kind:result.kind,dig};
 const entry=category.entries.find(item=>item.name===result.answer[0]);
 if(dig.guesses.some(guess=>guess.name===entry.name))return {kind:'repeat',entry,dig};
 if(dig.finds.some(find=>find.layer===layer))return {kind:'claimed',entry,dig};
 const actual=layerIndex(entry.rarity),hit=actual===layer;
 const guess={name:entry.name,rank:entry.rank,layer:actual,target:layer,hit};
 if(hit)return {kind:'found',entry,actual,dig:{...dig,finds:[...dig.finds,{name:entry.name,rank:entry.rank,layer}],guesses:[...dig.guesses,guess]}};
 const misses=dig.misses+1;
 return {kind:'miss',entry,actual,dig:{...dig,misses,guesses:[...dig.guesses,guess],caved:misses>=MAX_MISSES}};
}

export function depthShare(number,categories,digs){
 const total=digs.reduce((sum,dig)=>sum+(dig?digPoints(dig):0),0);
 const rows=categories.map((category,i)=>{
  const dig=digs[i]||newDig();
  const gems=LAYERS.map((layer,k)=>dig.finds.some(find=>find.layer===k)?layer.share:'').join('');
  return category.label+' '+(gems||(dig.misses?'':'·'))+'✖'.repeat(dig.misses)+(dig.caved?' 🕳️':'')+' · '+digPoints(dig).toLocaleString('en-US');
 });
 return ['Spelunkle Depths #'+number+' · '+total.toLocaleString('en-US')+' pts',...rows,DEPTH_URL].join('\n');
}

const validDig=dig=>({
 finds:Array.isArray(dig?.finds)?dig.finds.filter(find=>typeof find?.name==='string'&&Number.isInteger(find.layer)&&find.layer>=0&&find.layer<LAYERS.length):[],
 guesses:Array.isArray(dig?.guesses)?dig.guesses.filter(guess=>typeof guess?.name==='string'):[],
 misses:Number.isInteger(dig?.misses)?Math.max(0,Math.min(MAX_MISSES,dig.misses)):0,
 banked:!!dig?.banked,caved:!!dig?.caved
});
export function loadDepth(storage,day){
 try{
  const saved=JSON.parse(storage?.getItem(DEPTH_KEY)||'null')?.days?.[day];
  if(saved&&Number.isInteger(saved.ci)&&Array.isArray(saved.digs))
   return {day,ci:Math.max(0,Math.min(3,saved.ci)),digs:saved.digs.slice(0,3).map(validDig),recorded:!!saved.recorded};
 }catch{}
 return {day,ci:0,digs:[],recorded:false};
}
export function saveDepth(storage,state){
 try{
  let data;try{data=JSON.parse(storage?.getItem(DEPTH_KEY)||'null');}catch{}
  if(data?.version!==1||typeof data.days!=='object')data={version:1,days:{}};
  data.days={...data.days,[state.day]:{ci:state.ci,digs:state.digs,recorded:state.recorded}};
  storage.setItem(DEPTH_KEY,JSON.stringify(data));return true;
 }catch{return false;}
}
