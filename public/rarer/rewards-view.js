import {tiers} from './core.js?v=2e123f57933a';
import {challenges} from './rewards.js?v=2e123f57933a';
export function bonusTrackers(chain){
 const [spectrum,triple]=challenges(chain);
 return `<aside class="bonus-trackers" aria-label="Banking bonus challenges"><div class="bonus-heading">Banking bonuses <span>Up to ×1.5</span></div><div class="bonus-grid">
 <div class="bonus-challenge${spectrum.earned?' earned':''}"><div><strong>Full spectrum</strong><b>${spectrum.earned?'✓ ':''}+25%</b></div><div class="spectrum-slots" aria-label="${spectrum.progress} of 6 tiers found">${tiers.map((t,i)=>`<span class="${t.className}${spectrum.counts[i]?' filled':''}" title="${t.label}${spectrum.counts[i]?' found':''}" aria-label="${t.label}${spectrum.counts[i]?' found':''}">${t.mark}</span>`).join('')}</div><small>${spectrum.progress}/6 tiers · One of each</small></div>
 <div class="bonus-challenge${triple.earned?' earned':''}"><div><strong>Three of a kind</strong><b>${triple.earned?'✓ ':''}+25%</b></div><div class="triple-slots ${triple.tier?.className||'common'}" aria-label="${triple.progress} of 3 answers in one tier">${[0,1,2].map(i=>`<span class="${i<triple.progress?'filled':''}">◆</span>`).join('')}</div><small>${triple.progress}/3 ${triple.tier?.label.toLowerCase()||'in one tier'} · Still go higher</small></div>
 </div></aside>`;
}
export function rewardReceipt(reward){
 if(!reward)return '';
 return `<div class="reward-receipt" aria-label="Haul calculation"><div><span>Treasure × chain</span><strong>${reward.treasure.toLocaleString('en-US')} × ${reward.links}</strong></div>${reward.lost?`<div><span>Spilled points</span><strong>−${reward.lost.toLocaleString('en-US')}</strong></div>`:''}<div><span>Haul saved</span><strong>${reward.remaining.toLocaleString('en-US')}</strong></div>${reward.bonuses.map(b=>`<div class="bonus-earned"><span>✓ ${b.name}</span><strong>+${b.percent}%</strong></div>`).join('')}<div class="reward-final"><span>${reward.bonuses.length?'Bonus ×'+reward.multiplier:'Final haul'}</span><strong>${reward.points.toLocaleString('en-US')} points</strong></div></div>`;
}
export function bonusSummary(results){
 const earned=results.flatMap(r=>r.reward?.bonuses||[]);
 if(!earned.length)return '';
 return `<div class="daily-bonuses"><strong>Bonuses brought home</strong>${['Full spectrum','Three of a kind'].map(name=>{const count=earned.filter(b=>b.name===name).length;return count?`<span>✓ ${name} <b>×${count}</b></span>`:''}).join('')}<small>Already included in your total.</small></div>`;
}
