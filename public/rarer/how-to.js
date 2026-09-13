import {tiers,tier} from './core.js?v=859643e99d5c';
import {treasureValue} from './rewards.js?v=859643e99d5c';
// Illustrative scores explain the rule; they are not today's answer ratings.
const gem='<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 2h8v2h2v6h-2v2h-2v2H6v-2H4v-2H2V4h2z"/><path fill="var(--paper)" opacity=".6" d="M5 4h5v2H7v4H5z"/></svg>';
const ladder='<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M5 2v24M19 2v24M5 6h14M5 13h14M5 20h14" fill="none" stroke="currentColor" stroke-width="3"/><path d="m9 5 3-3 3 3M12 2v11" fill="none" stroke="var(--paper)" stroke-width="2"/></svg>';
export function visualGuide({help=false,risk=true}={}){
 return `<div class="visual-guide${help?' guide-help':''}">
 <figure class="rarity-demo" aria-label="Example: answers worth 30, 50, then 80 points. Each answer is worth more; three common answers unlock a banking bonus.">
 <div class="demo-label"><span>Example finds</span><span>Worth more →</span></div>
 <ol class="demo-steps">${[['Germany',2,'common'],['France',4,'common'],['Spain',7,'common']].map(([name,score,t],i)=>`<li class="demo-step ${t}" style="--step:${i}"><div class="demo-answer"><strong>${treasureValue(score)}<em>pts</em></strong><span>${name}</span><small>${tier(score).label}</small></div><div class="demo-treasure">${gem.repeat(i+1)}<b>×${i+1}</b></div></li>`).join('')}</ol>
 <figcaption>Three common finds. <strong>+25% when you bank.</strong></figcaption>
 </figure><div class="tier-legend" aria-label="Six rarity tiers, from common to legendary">${tiers.map(t=>`<span class="${t.className}">${t.mark} ${t.label}</span>`).join('')}</div>
 <div class="guide-choices">${risk?`<div class="guide-risk"><div class="spill-picture" aria-hidden="true">${gem}<span>↘</span><b>−25%</b></div><strong>Go less rare?</strong><span>Lose 25% of this haul.</span><div class="three-misses" aria-label="Three mistakes empties your cart"><i>×</i><i>×</i><i>×</i><span>Empty cart</span></div></div>`:''}<div class="guide-bank"><div class="bank-picture" aria-hidden="true">${ladder}${gem}${gem}${gem}<span>✓</span></div><strong>Climb out anytime.</strong><span>Keep your remaining haul.</span><div class="bank-safe">⌂ Home treasure stays safe</div></div></div>
 ${help?'<p class="guide-footnote">Equal point values also count as a mistake. Unknown answers are free. No timer.</p><details class="scoring-details"><summary>How points work</summary><p>Add your finds’ points, then multiply by your chain length. The first two mistakes each lose 25% of your current points, rounded up. The third empties this dig’s cart.</p><p>Bank all six tiers for Full spectrum (+25%), or three increasing answers in one tier for Three of a kind (+25%). Each pays once per dig, after spills. Both together give ×1.5, rounded down. Three mistakes lose the bonuses too.</p><p>Three categories a day, shared by everyone. New digs at 00:00 UTC. Rarity uses Wikipedia pageviews.</p></details>':''}
 </div>`;
}
