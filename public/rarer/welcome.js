import {tier} from './core.js?v=859643e99d5c';
import {treasureValue,baseScore,settlement} from './rewards.js?v=859643e99d5c';
const art='./assets/one-more-swing/';
const answers=[['Germany',2],['France',4],['Spain',7],['Portugal',25],['Greece',45],['Bhutan',65],['Tuvalu',85],['Niue',98]];
export function mountWelcome(){
 const dialog=document.createElement('dialog');dialog.id='welcome';dialog.setAttribute('aria-labelledby','welcome-title');
 dialog.innerHTML=`<button class="welcome-close" aria-label="Close welcome">×</button><p class="welcome-kicker">Three digs. A fresh start every day.</p><h2 id="welcome-title" tabindex="-1" autofocus>Rarer answers.<br>Bigger hauls.</h2><p class="welcome-lead">Rarer finds earn more. Beat your last point value.</p><section class="welcome-demo" aria-label="Practice example, separate from your game"><div class="welcome-demo-label"><span>Try it · Example finds</span><button class="welcome-replay">↻ Reset</button></div><ol class="welcome-chain"></ol><div class="welcome-world" aria-hidden="true"><div class="welcome-rail"></div><div class="welcome-mole"></div><div class="welcome-cart"><div class="welcome-gems"></div><img src="${art}v5/cart.png" alt=""></div><div class="welcome-spills"></div><span class="welcome-pop"></span></div><div class="welcome-haul"><strong class="welcome-points"></strong><span class="welcome-misses"></span></div><p class="welcome-feedback" role="status">Pick the more valuable answer.</p><div class="welcome-answers"><button data-demo="rarer"></button><button data-demo="lower"><span>United States<small class="common">Common</small></span><strong>20<em>pts</em></strong></button></div><div class="welcome-risk"><span>Lower / equal <b>−25%</b></span><span>× × × <b>Empty cart</b></span></div><button class="welcome-bank">↑ Climb out & save</button></section><button class="primary welcome-done">Got it. Let’s dig</button><p class="welcome-note">No timer. Unknown answers are free.</p>`;
 document.body.append(dialog);
 let links=1,mistakes=0,lost=0,saved=false;
 const el=s=>dialog.querySelector(s);
 const chain=()=>answers.slice(0,links);
 const points=()=>Math.max(0,baseScore(chain())-lost);
 function draw(){
  el('.welcome-chain').innerHTML=chain().slice(-3).map(([name,value])=>`<li class="${tier(value).className}"><strong>${treasureValue(value)}<em>pts</em></strong><span>${name}</span><small>${tier(value).label}</small></li>`).join('')+(links<answers.length?'<li class="welcome-next"><strong>?</strong><span>Go rarer</span></li>':'');
  const amount=mistakes===3?0:Math.max(1,Math.round(Math.min(links,4)*3*(1-mistakes*.25)));
  el('.welcome-gems').innerHTML=Array.from({length:amount},(_,i)=>`<img style="--gem:${i}" src="${art}v2/${links>2?'amethyst':'ore'}.png" alt="">`).join('');
  el('.welcome-points').textContent=saved?settlement(chain(),lost).points+' points safe ✓':points()+' points · ×'+links;
  el('.welcome-misses').textContent=mistakes?mistakes+'/3 mistakes':'Your practice haul';
  const next=answers[links];el('[data-demo="rarer"]').innerHTML=next?`<span>${next[0]}<small class="${tier(next[1]).className}">${tier(next[1]).label}</small></span><strong>${treasureValue(next[1])}<em>pts</em></strong>`:'Top reached ✓';
  el('[data-demo="rarer"]').disabled=!next||saved||mistakes===3;
  el('[data-demo="lower"]').disabled=saved||mistakes===3;
  el('.welcome-bank').disabled=saved||mistakes===3;
 }
 function effect(kind,text,spill=0){const world=el('.welcome-world');world.className='welcome-world';void world.offsetWidth;world.classList.add(kind);el('.welcome-pop').textContent=text;el('.welcome-spills').innerHTML=Array.from({length:spill},(_,i)=>`<img style="--spill:${i}" src="${art}v2/ore.png" alt="">`).join('');}
 el('[data-demo="rarer"]').onclick=()=>{if(saved||mistakes===3||links===answers.length)return;links++;draw();effect('found','×'+links+'!');el('.welcome-feedback').textContent=links===3?'Three of a kind! +25% when you bank.':links===8?'Full spectrum too! Bank with ×1.5.':'Worth more! Your chain multiplier grows.';};
 el('[data-demo="lower"]').onclick=()=>{if(saved||mistakes===3)return;const before=el('.welcome-gems').childElementCount;const amount=mistakes===2?points():Math.ceil(points()*.25);lost+=amount;mistakes++;draw();effect('spilled','−'+amount,Math.max(1,before-el('.welcome-gems').childElementCount));el('.welcome-feedback').textContent=mistakes===3?'Third mistake. The cart is empty.':'20 points is lower. Some treasure spills.';};
 el('.welcome-bank').onclick=()=>{if(saved||mistakes===3)return;saved=true;draw();effect('banked','Saved ✓');el('.welcome-feedback').textContent='Home safe.'+(settlement(chain(),lost).bonuses.length?' Bonus ×'+settlement(chain(),lost).multiplier+' included!':' That haul is yours.');};
 function reset(){links=1;mistakes=0;lost=0;saved=false;draw();el('.welcome-world').className='welcome-world';el('.welcome-pop').textContent='';el('.welcome-spills').replaceChildren();el('.welcome-feedback').textContent='Pick the more valuable answer.';}
 el('.welcome-replay').onclick=reset;
 el('.welcome-close').onclick=el('.welcome-done').onclick=()=>dialog.close();
 function open(){reset();if(!dialog.open)dialog.showModal();}
 open();window.addEventListener('pageshow',event=>{if(event.persisted)open();});
}
