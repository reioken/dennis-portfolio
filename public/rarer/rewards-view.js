import {challenges} from './rewards.js?v=8b851d4060c4';
const icons={rainbow:'🌈',triple:'💎',staircase:'🪜',legendary:'👑',spotless:'✨'};
export const comboIcon=id=>icons[id]||'✦';
const fmt=n=>n.toLocaleString('en-US');
const multiplierText=m=>'×'+String(Math.round(m*100)/100);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// Timings for the home reveal, kept pure so tests can check order and length.
export function revealPlan(reward,{reduced=false}={}){
 const bonuses=reward?.bonuses||[];
 if(reduced)return [{at:0,kind:'final'},{at:600,kind:'done'}];
 const steps=[{at:0,kind:'haul',value:reward.remaining}];
 bonuses.forEach((b,i)=>steps.push({at:500+i*380,kind:'combo',id:b.id,multiplier:1+bonuses.slice(0,i+1).reduce((n,x)=>n+x.percent,0)/100}));
 const end=bonuses.length?500+bonuses.length*380+300:500;
 steps.push({at:end,kind:'total',value:reward.points},{at:end+(bonuses.length?600:700),kind:'done'});
 return steps;
}
export function clearReveal(host){host?.querySelectorAll('.combo-sign,.combo-toast').forEach(node=>node.remove());}
export function showToast(host,text,reduced=false){
 if(!host)return;const toast=document.createElement('div');toast.className='combo-toast';toast.textContent=text;host.append(toast);
 setTimeout(()=>toast.remove(),reduced?1200:1700);
}
function countUp(el,from,to,ms){
 if(ms<=0){el.textContent=fmt(to);return Promise.resolve();}
 return new Promise(resolve=>{const start=performance.now();const step=now=>{const p=Math.min(1,(now-start)/ms);el.textContent=fmt(Math.round(from+(to-from)*(1-(1-p)**3)));if(p<1)requestAnimationFrame(step);else resolve();};requestAnimationFrame(step);});
}
const stamp=(b,lost=false)=>`<span class="combo-stamp${lost?' lost':''}">${comboIcon(b.id)} ${b.name}${lost?'':` <b>+${b.percent}%</b>`}</span>`;
// A wooden sign at home: haul, then each combo stamps in, then the total rolls up.
// A tap speeds it up; a second tap jumps to the end.
export async function playReveal(host,reward,{reduced=false,caveIn=false,lostCombos=[],speed=1}={}){
 if(!host||!reward)return;clearReveal(host);
 const sign=document.createElement('div');sign.className='combo-sign';sign.setAttribute('role','status');
 sign.innerHTML=`<p class="sign-label">${caveIn?'Saved from the cave-in':'Haul brought home'}</p><strong class="sign-number">0</strong><div class="sign-stamps"></div><p class="sign-mult"></p>`;
 host.append(sign);
 const number=sign.querySelector('.sign-number'),stamps=sign.querySelector('.sign-stamps'),mult=sign.querySelector('.sign-mult');
 const summary=()=>sign.setAttribute('aria-label',(reward.bonuses.length?reward.bonuses.map(b=>b.name+' +'+b.percent+'%').join(', ')+'. '+multiplierText(reward.multiplier)+'. ':'')+reward.points+' points.');
 if(caveIn){
  number.textContent=fmt(reward.points);stamps.innerHTML=lostCombos.map(b=>stamp(b,true)).join('');
  mult.textContent=lostCombos.length?'Combos lost in the cave-in':'No combos this dig';mult.classList.add('note');
  sign.setAttribute('aria-label',reward.points+' points saved from the cave-in.'+(lostCombos.length?' Lost: '+lostCombos.map(b=>b.name).join(', ')+'.':''));
  await sleep(reduced?600:1500/speed);return;
 }
 let fast=1,skip=false;const tap=()=>{if(fast>1)skip=true;fast=4;};host.addEventListener('pointerdown',tap);
 let clock=0;
 for(const step of revealPlan(reward,{reduced})){
  const wait=(step.at-clock)/speed/fast;clock=step.at;
  if(!skip&&wait>0)await sleep(wait);
  const time=ms=>skip?0:ms/speed/fast;
  if(step.kind==='haul')countUp(number,0,step.value,time(400));
  if(step.kind==='combo'){stamps.insertAdjacentHTML('beforeend',stamp(reward.bonuses.find(b=>b.id===step.id)));mult.textContent=multiplierText(step.multiplier);}
  if(step.kind==='total'){if(reward.bonuses.length)sign.classList.add('pulse');else {mult.textContent='No combos this dig';mult.classList.add('note');}await countUp(number,reward.remaining,step.value,time(500));}
  if(step.kind==='final'){number.textContent=fmt(reward.points);stamps.innerHTML=reward.bonuses.map(b=>stamp(b)).join('');mult.textContent=reward.bonuses.length?multiplierText(reward.multiplier):'No combos this dig';mult.classList.toggle('note',!reward.bonuses.length);}
 }
 host.removeEventListener('pointerdown',tap);summary();
}
export function rewardReceipt(reward){
 if(!reward)return '';
 return `<div class="reward-receipt" aria-label="Haul calculation"><div><span>Treasure from ${reward.links} ${reward.links===1?'find':'finds'}</span><strong>${fmt(reward.subtotal)}</strong></div>${reward.lost?`<div><span>Spilled points</span><strong>−${fmt(reward.lost)}</strong></div>`:''}${reward.bonuses.map(b=>`<div class="bonus-earned"><span>${comboIcon(b.id)} ${b.name}</span><strong>+${b.percent}%</strong></div>`).join('')}<div class="reward-final"><span>${reward.bonuses.length?'Combos '+multiplierText(reward.multiplier):'Final haul'}</span><strong>${fmt(reward.points)} points</strong></div></div>`;
}
export function bonusSummary(results){
 const earned=results.flatMap(r=>r.reward?.bonuses||[]);
 if(!earned.length)return '';
 return `<div class="daily-bonuses"><strong>Combos brought home</strong>${challenges([]).map(({id,name})=>{const count=earned.filter(b=>b.id===id).length;return count?`<span>${comboIcon(id)} ${name} <b>×${count}</b></span>`:''}).join('')}<small>Already included in your total.</small></div>`;
}
