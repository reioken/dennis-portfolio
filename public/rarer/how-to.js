// Illustrative scores explain the rule; they are not today's answer ratings.
const gem='<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 2h8v2h2v6h-2v2h-2v2H6v-2H4v-2H2V4h2z"/><path fill="var(--paper)" opacity=".6" d="M5 4h5v2H7v4H5z"/></svg>';
const ladder='<svg viewBox="0 0 24 28" aria-hidden="true"><path d="M5 2v24M19 2v24M5 6h14M5 13h14M5 20h14" fill="none" stroke="currentColor" stroke-width="3"/><path d="m9 5 3-3 3 3M12 2v11" fill="none" stroke="var(--paper)" stroke-width="2"/></svg>';
export function visualGuide({help=false,risk=true}={}){
 return `<div class="visual-guide${help?' guide-help':''}">
 <figure class="rarity-demo" aria-label="Example: Germany at 12, Portugal at 31, Bhutan at 64. Each answer is rarer and increases the chain multiplier.">
 <div class="demo-label"><span>Example chain</span><span>Rarer →</span></div>
 <ol class="demo-steps">${[['Germany',12,'common'],['Portugal',31,'uncommon'],['Bhutan',64,'rare']].map(([name,score,t],i)=>`<li class="demo-step ${t}" style="--step:${i}"><div class="demo-answer"><strong>${score}</strong><span>${name}</span></div><div class="demo-treasure">${gem.repeat(i+1)}<b>×${i+1}</b></div></li>`).join('')}</ol>
 <figcaption>Small rarity jumps. <strong>Bigger gem piles.</strong></figcaption>
 </figure>
 <div class="guide-choices">${risk?`<div class="guide-risk"><div class="spill-picture" aria-hidden="true">${gem}<span>↘</span><b>−25%</b></div><strong>Go less rare?</strong><span>Lose 25% of this haul.</span><div class="three-misses" aria-label="Three mistakes empties your cart"><i>×</i><i>×</i><i>×</i><span>Empty cart</span></div></div>`:''}<div class="guide-bank"><div class="bank-picture" aria-hidden="true">${ladder}${gem}${gem}${gem}<span>✓</span></div><strong>Climb out anytime.</strong><span>Keep your remaining haul.</span><div class="bank-safe">⌂ Home treasure stays safe</div></div></div>
 ${help?'<p class="guide-footnote">Equal rarity also counts as a mistake. Unknown answers are free. No timer.</p><details class="scoring-details"><summary>How points work</summary><p>Add your answer scores, then multiply by your chain length. The first two mistakes each lose 25% of your current points, rounded up. The third empties this dig’s cart.</p><p>Three categories a day, shared by everyone. New digs at 00:00 UTC. Rarity uses Wikipedia pageviews.</p></details>':''}
 </div>`;
}
