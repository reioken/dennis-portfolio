import {tiers,tier} from './core.js?v=52b81d98bb60';
// Rarer finds are worth more. The catalog rarity (0–100) stays internal.
export const treasureValue=rarity=>(rarity+1)*10;
// A bigger leap from the previous answer pays up to double. The first find has no leap.
export const findValue=(rarity,previous=null)=>Math.round(treasureValue(rarity)*(1+(previous===null?0:Math.max(0,rarity-previous))/100));
// Climb Up (reverse) aims for more looked-up answers, so value is measured on commonness.
const worth=(a,reverse)=>reverse?100-a[1]:a[1];
export const findValues=(chain,reverse=false)=>chain.map((a,i)=>findValue(worth(a,reverse),i?worth(chain[i-1],reverse):null));
export const treasureSum=chain=>chain.reduce((total,a)=>total+treasureValue(a[1]),0);
export const baseScore=(chain,reverse=false)=>findValues(chain,reverse).reduce((total,v)=>total+v,0);
// Receipts banked before scoring version 3 used treasure times chain length, with bonuses up to 2.6.
export const legacyScore=chain=>treasureSum(chain)*chain.length;
export const legacyMaxMultiplier=2.6;
// Banking combos, collected at home. Each pays once per dig; percentages add.
export function challenges(chain,mistakes=0){
 const levels=chain.map(a=>tiers.indexOf(tier(a[1])));
 const counts=tiers.map((_,i)=>levels.filter(n=>n===i).length);
 const best=Math.max(0,...counts),index=counts.indexOf(best);
 let climb=chain.length?1:0;
 for(let i=1,run=1;i<levels.length;i++){run=levels[i]===levels[i-1]+1?run+1:1;climb=Math.max(climb,run);}
 const spotless=mistakes?0:Math.min(6,chain.length);
 return [
  {id:'rainbow',name:'Rainbow',percent:25,earned:counts.every(Boolean),progress:counts.filter(Boolean).length,target:6,hint:'One answer in every tier'},
  {id:'triple',name:'Triple',percent:25,earned:best>=3,progress:Math.min(3,best),target:3,tier:best?tiers[index]:null,hint:'Three answers in one tier'},
  {id:'staircase',name:'Staircase',percent:25,earned:climb>=4,progress:Math.min(4,climb),target:4,hint:'Four tiers up in a row'},
  {id:'legendary',name:'Legendary',percent:25,earned:counts[5]>0,progress:Math.min(1,counts[5]),target:1,hint:'Any legendary answer'},
  {id:'spotless',name:'Spotless',percent:25,earned:spotless>=6,progress:spotless,target:6,hint:'Six answers without a slip'}
 ];
}
export const maxMultiplier=1+challenges([]).reduce((n,b)=>n+b.percent,0)/100;
// A cave-in keeps what is left of the haul, but no combos.
// Climb Up (reverse) has no combos.
export function settlement(chain,lost=0,caveIn=false,mistakes=0,reverse=false){
 const subtotal=baseScore(chain,reverse),remaining=Math.max(0,subtotal-lost);
 const bonuses=caveIn||reverse?[]:challenges(chain,mistakes).filter(b=>b.earned).map(({id,name,percent})=>({id,name,percent}));
 const multiplier=Math.round((1+bonuses.reduce((n,b)=>n+b.percent,0)/100)*100)/100;
 const points=Math.floor(remaining*multiplier);
 return {scoringVersion:3,treasure:subtotal,links:chain.length,subtotal,lost,remaining,bonuses,multiplier,bonusPoints:points-remaining,points,caveIn};
}
