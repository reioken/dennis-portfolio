import {tiers} from './core.js?v=b9fe4fa5c055';
import {challenges,maxMultiplier} from './rewards.js?v=b9fe4fa5c055';
function slots(b){
 if(b.id==='spectrum')return `<div class="spectrum-slots" aria-label="${b.progress} of 6 tiers found">${tiers.map((t,i)=>`<span class="${t.className}${b.counts[i]?' filled':''}" title="${t.label}${b.counts[i]?' found':''}" aria-label="${t.label}${b.counts[i]?' found':''}">${t.mark}</span>`).join('')}</div>`;
 if(b.id==='triple')return `<div class="triple-slots ${b.tier?.className||'common'}" aria-label="${b.progress} of 3 answers in one tier">${[0,1,2].map(i=>`<span class="${i<b.progress?'filled':''}">◆</span>`).join('')}</div>`;
 return `<div class="bonus-pips" aria-label="${b.progress} of ${b.target}">${Array.from({length:b.target},(_,i)=>`<span class="${i<b.progress?'filled':''}"></span>`).join('')}</div>`;
}
export function bonusTrackers(chain,lost=0){
 const list=challenges(chain,lost);
 return `<aside class="bonus-trackers" aria-label="Banking bonus challenges"><div class="bonus-heading">Banking combos <span>Up to ×${maxMultiplier}</span></div><div class="bonus-grid">
 ${list.map(b=>`<div class="bonus-challenge${b.earned?' earned':''}"><div><strong>${b.name}</strong><b>${b.earned?'✓ ':''}+${b.percent}%</b></div>${slots(b)}<small>${b.id==='triple'?`${b.progress}/3 ${b.tier?.label.toLowerCase()||'in one tier'}`:b.id==='spectrum'?`${b.progress}/6 tiers`:`${b.progress}/${b.target}`} · ${b.hint}</small></div>`).join('')}
 </div></aside>`;
}
export function rewardReceipt(reward){
 if(!reward)return '';
 return `<div class="reward-receipt" aria-label="Haul calculation"><div><span>Treasure × chain</span><strong>${reward.treasure.toLocaleString('en-US')} × ${reward.links}</strong></div>${reward.lost?`<div><span>Spilled points</span><strong>−${reward.lost.toLocaleString('en-US')}</strong></div>`:''}<div><span>Haul saved</span><strong>${reward.remaining.toLocaleString('en-US')}</strong></div>${reward.bonuses.map(b=>`<div class="bonus-earned"><span>✓ ${b.name}</span><strong>+${b.percent}%</strong></div>`).join('')}<div class="reward-final"><span>${reward.bonuses.length?'Bonus ×'+reward.multiplier:'Final haul'}</span><strong>${reward.points.toLocaleString('en-US')} points</strong></div></div>`;
}
export function bonusSummary(results){
 const earned=results.flatMap(r=>r.reward?.bonuses||[]);
 if(!earned.length)return '';
 return `<div class="daily-bonuses"><strong>Combos brought home</strong>${challenges([]).map(({name})=>{const count=earned.filter(b=>b.name===name).length;return count?`<span>✓ ${name} <b>×${count}</b></span>`:''}).join('')}<small>Already included in your total.</small></div>`;
}
