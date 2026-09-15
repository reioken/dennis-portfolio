import {tier} from './core.js?v=804e5dbc4495';
import {baseScore as score} from './rewards.js?v=804e5dbc4495';
import {comboIcon} from './rewards-view.js?v=804e5dbc4495';
import {dailyNumber} from './edition.js?v=804e5dbc4495';
export const pointsLeft=(chain,lost=0,reverse=false)=>Math.max(0,score(chain,reverse)-lost);
// The first slip is a free warning. The second caves in: half the haul spills and the dig ends.
export function takePenalty(chain,lost,mistakes,cargo,reverse=false){
 const count=mistakes+1;
 if(count<2)return {mistakes:count,amount:0,lost,cargo,spill:0,ended:false,warning:true};
 const amount=Math.ceil(pointsLeft(chain,lost,reverse)/2),spill=Math.ceil(cargo.length/2);
 return {mistakes:count,amount,lost:lost+amount,cargo:cargo.slice(0,cargo.length-spill),spill,ended:true,warning:false};
}
export function dailyShare(results,date){
 return 'Spelunkle #'+dailyNumber(date)+' · '+date+'\n'+results.map(r=>r.name+' '+r.chain.map(a=>tier(a[1]).square).join('')+(r.bust?' 🕳️':'')+' · '+r.points.toLocaleString('en-US')+(r.reward?.bonuses?.length?' · '+r.reward.bonuses.map(b=>comboIcon(b.id)).join(''):'')).join('\n')+'\nTotal '+results.reduce((n,r)=>n+r.points,0).toLocaleString('en-US');
}
