import {tiers,tier} from './core.js?v=b9fe4fa5c055';
// The catalog rank stays internal. Every step earns a distinct, positive value.
export const treasureValue=rarity=>(rarity+1)*10;
export const treasureSum=chain=>chain.reduce((total,a)=>total+treasureValue(a[1]),0);
export const baseScore=chain=>treasureSum(chain)*chain.length;
// Banking combos. Each pays once per dig; percentages add, rather than compound.
export function challenges(chain,lost=0){
 const levels=chain.map(a=>tiers.indexOf(tier(a[1])));
 const counts=tiers.map((_,i)=>levels.filter(n=>n===i).length);
 const best=Math.max(0,...counts),index=counts.indexOf(best);
 const spectrum=counts.filter(Boolean).length;
 let climb=chain.length?1:0;
 for(let i=1,run=1;i<levels.length;i++){run=levels[i]===levels[i-1]+1?run+1:1;climb=Math.max(climb,run);}
 const photo=chain.some((a,i)=>i>0&&a[1]-chain[i-1][1]===1);
 const clean=lost?0:Math.min(6,chain.length);
 return [
  {id:'spectrum',name:'Full spectrum',percent:25,earned:spectrum===6,progress:spectrum,target:6,counts,hint:'One of each tier'},
  {id:'triple',name:'Three of a kind',percent:25,earned:best>=3,progress:Math.min(3,best),target:3,tier:best?tiers[index]:null,hint:'Three in one tier'},
  {id:'staircase',name:'Staircase',percent:25,earned:climb>=4,progress:Math.min(4,climb),target:4,hint:'Four tiers up in a row'},
  {id:'long-haul',name:'Long haul',percent:25,earned:chain.length>=8,progress:Math.min(8,chain.length),target:8,hint:'Eight answers'},
  {id:'legendary',name:'Legendary find',percent:25,earned:counts[5]>0,progress:Math.min(1,counts[5]),target:1,hint:'Any legendary answer'},
  {id:'photo-finish',name:'Photo finish',percent:10,earned:photo,progress:photo?1:0,target:1,hint:'Exactly 10 points rarer'},
  {id:'clean',name:'Clean dig',percent:25,earned:clean>=6,progress:clean,target:6,hint:'Six answers, no mistakes'}
 ];
}
export const maxMultiplier=1+challenges([]).reduce((n,b)=>n+b.percent,0)/100;
export function settlement(chain,lost=0,bust=false){
 const subtotal=baseScore(chain),remaining=Math.max(0,subtotal-lost);
 const bonuses=bust?[]:challenges(chain,lost).filter(b=>b.earned).map(({id,name,percent})=>({id,name,percent}));
 const multiplier=Math.round((1+bonuses.reduce((n,b)=>n+b.percent,0)/100)*100)/100;
 const points=bust?0:Math.floor(remaining*multiplier);
 return {scoringVersion:2,treasure:treasureSum(chain),links:chain.length,subtotal,lost,remaining:bust?0:remaining,bonuses,multiplier,bonusPoints:bust?0:points-remaining,points};
}
