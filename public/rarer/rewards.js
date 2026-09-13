import {tiers,tier} from './core.js?v=a55994f72823';
// The catalog rank stays internal. Every step earns a distinct, positive value.
export const treasureValue=rarity=>(rarity+1)*10;
export const treasureSum=chain=>chain.reduce((total,a)=>total+treasureValue(a[1]),0);
export const baseScore=chain=>treasureSum(chain)*chain.length;
export function challenges(chain){
 const counts=tiers.map(t=>chain.filter(a=>tier(a[1])===t).length);
 const best=Math.max(0,...counts),index=counts.indexOf(best);
 const spectrum=counts.filter(Boolean).length;
 return [
  {id:'spectrum',name:'Full spectrum',percent:25,earned:spectrum===6,progress:spectrum,target:6,counts},
  {id:'triple',name:'Three of a kind',percent:25,earned:best>=3,progress:Math.min(3,best),target:3,tier:best?tiers[index]:null}
 ];
}
export function settlement(chain,lost=0,bust=false){
 const subtotal=baseScore(chain),remaining=Math.max(0,subtotal-lost);
 const bonuses=bust?[]:challenges(chain).filter(b=>b.earned).map(({id,name,percent})=>({id,name,percent}));
 const multiplier=1+bonuses.reduce((n,b)=>n+b.percent,0)/100;
 const points=bust?0:Math.floor(remaining*multiplier);
 return {scoringVersion:2,treasure:treasureSum(chain),links:chain.length,subtotal,lost,remaining:bust?0:remaining,bonuses,multiplier,bonusPoints:bust?0:points-remaining,points};
}
