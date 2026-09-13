import {tier} from './core.js?v=1479d059929f';
import {baseScore as score} from './rewards.js?v=1479d059929f';
export const pointsLeft=(chain,lost=0)=>Math.max(0,score(chain)-lost);
export function takePenalty(chain,lost,mistakes,cargo){
 const count=mistakes+1,points=pointsLeft(chain,lost),amount=count>=3?points:Math.ceil(points*.25);
 const spill=count>=3?cargo.length:Math.min(cargo.length,Math.ceil(cargo.length*.25));
 return {mistakes:count,amount,lost:lost+amount,cargo:cargo.slice(0,cargo.length-spill),spill,ended:count>=3};
}
export function dailyShare(results,date){
 return 'Rarer · '+date+'\n'+results.map(r=>r.name+' '+r.chain.map(a=>tier(a[1]).square).join('')+(r.bust?' ×':'')+' · '+r.points+' · ×'+r.chain.length+(r.reward?.bonuses?.length?' · bonus ×'+r.reward.multiplier:'')+(r.mistakes?' · '+r.mistakes+'/3 mistakes':'')).join('\n')+'\nTotal '+results.reduce((n,r)=>n+r.points,0).toLocaleString('en-US');
}
