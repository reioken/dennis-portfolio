import {tier} from './core.js?v=52b81d98bb60';
import {baseScore as score} from './rewards.js?v=52b81d98bb60';
import {comboIcon} from './rewards-view.js?v=52b81d98bb60';
import {dailyNumber} from './edition.js?v=52b81d98bb60';
export const pointsLeft=(chain,lost=0,reverse=false)=>Math.max(0,score(chain,reverse)-lost);
// The first slip is a free warning. The second caves in: half the haul spills and the dig ends.
export function takePenalty(chain,lost,mistakes,cargo,reverse=false){
 const count=mistakes+1;
 if(count<2)return {mistakes:count,amount:0,lost,cargo,spill:0,ended:false,warning:true};
 const amount=Math.ceil(pointsLeft(chain,lost,reverse)/2),spill=Math.ceil(cargo.length/2);
 return {mistakes:count,amount,lost:lost+amount,cargo:cargo.slice(0,cargo.length-spill),spill,ended:true,warning:false};
}
// Where a shared result points back to. Always the last line.
export const SHARE_URL='dennisbf.design/rarer';
// The plain summary leads, so a reader who sees no emoji still gets the day,
// the score and how far you got. `emoji:false` is the text-only version offered
// on the results screen; `rarest` is the optional "Beat #212 of 240" line.
export function dailyShare(results,date,{emoji=true,rarest=''}={}){
 const total=results.reduce((n,r)=>n+r.points,0);
 const head='Spelunkle #'+dailyNumber(date)+' · '+total.toLocaleString('en-US')+' pts · '+results.length+'/3 digs';
 const rows=results.map(r=>{
  const points=r.points.toLocaleString('en-US'),combos=r.reward?.bonuses||[];
  return emoji
   ?r.name+' '+r.chain.map(a=>tier(a[1]).square).join('')+(r.bust?' 🕳️':'')+' · '+points+(combos.length?' · '+combos.map(b=>comboIcon(b.id)).join(''):'')
   :r.name+' · '+points+' pts'+(r.bust?' · cave-in':'')+(combos.length?' · '+combos.map(b=>b.name).join(', '):'');
 });
 return [head,...(rarest?['Rarest: '+rarest]:[]),...rows,SHARE_URL].join('\n');
}
