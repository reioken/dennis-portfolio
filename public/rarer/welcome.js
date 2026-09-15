import {tier,assess} from './core.js?v=b9fe4fa5c055';
import {treasureValue,baseScore,settlement} from './rewards.js?v=b9fe4fa5c055';
const art='./assets/one-more-swing/';
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function mountWelcome(){
 const dialog=document.createElement('dialog');dialog.id='welcome';dialog.setAttribute('aria-labelledby','welcome-title');
 dialog.innerHTML=`<button class="welcome-close" aria-label="Close welcome">×</button><p class="welcome-kicker">Three digs. A fresh start every day.</p><h2 id="welcome-title" tabindex="-1" autofocus>Start common.<br>Go a little rarer.</h2><p class="welcome-lead">Leave room for a long chain.</p><section class="welcome-demo" aria-label="Practice dig, separate from your game"><div class="welcome-demo-label"><span>Practice · A country</span><button class="welcome-replay">↻ Reset</button></div><ol class="welcome-chain"></ol><div class="welcome-world" aria-hidden="true"><div class="welcome-mole"></div><div class="welcome-cart"><div class="welcome-gems"></div><img src="${art}v12/cart-small.png" alt=""></div><div class="welcome-spills"></div><span class="welcome-pop"></span></div><div class="welcome-haul"><strong class="welcome-points"></strong><span class="welcome-misses"></span></div><p class="welcome-feedback" id="welcome-feedback" role="status">Name a very common country to start.</p><form class="welcome-answer-form"><label class="sr" for="welcome-answer">Your country answer</label><input id="welcome-answer" aria-describedby="welcome-feedback" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="go" placeholder="A very common country…" disabled><button type="submit" aria-label="Submit practice answer" disabled>→</button></form><div class="welcome-risk"><span>Not rarer <b>−25%</b></span><span>× × × <b>Empty cart</b></span></div><button class="welcome-bank">↑ Climb out & save</button></section><button class="primary welcome-done">Got it. Let’s dig</button><p class="welcome-note">Practice only. No timer. Unknown answers are free.</p>`;
 document.body.append(dialog);
 // Practice is separate from the daily run and never writes progress.
 let chain=[],mistakes=0,lost=0,saved=false,category=null;
 const el=s=>dialog.querySelector(s);
 const points=()=>Math.max(0,baseScore(chain)-lost);
 function draw(){
  const links=chain.length;
  el('.welcome-chain').innerHTML=links?chain.slice(-2).map(([name,value])=>`<li class="${tier(value).className}"><strong>${treasureValue(value)}<em>pts</em></strong><span>${escape(name)}</span><small>${tier(value).label}</small></li>`).join('')+'<li class="welcome-next"><strong>?</strong><span>Go a little rarer</span></li>':'<li class="welcome-next common"><strong>?</strong><span>Your first answer</span><small>Start common</small></li><li class="welcome-next"><strong>?</strong><span>A little rarer</span></li><li class="welcome-next"><strong>?</strong><span>Rarer again</span></li>';
  const amount=!links||mistakes===3?0:Math.max(1,Math.round(Math.min(links,4)*3*(1-mistakes*.25)));
  el('.welcome-gems').innerHTML=Array.from({length:amount},(_,i)=>`<img style="--gem:${i}" src="${art}v11/${links>2?'amethyst':'ore'}.png" alt="">`).join('');
  el('.welcome-points').textContent=saved?settlement(chain,lost).points+' points safe ✓':points()+' points'+(links?' · ×'+links:'');
  el('.welcome-misses').textContent=mistakes?mistakes+'/3 mistakes':links?'Your practice haul':'Empty cart. Your first pick.';
  el('#welcome-answer').placeholder=links?'A rarer country…':'A very common country…';
  el('#welcome-answer').disabled=el('[type="submit"]').disabled=!category||saved||mistakes===3;
  el('.welcome-bank').disabled=!links||saved||mistakes===3;
 }
 function effect(kind,text,spill=0){const world=el('.welcome-world');world.className='welcome-world';void world.offsetWidth;world.classList.add(kind);el('.welcome-pop').textContent=text;el('.welcome-spills').innerHTML=Array.from({length:spill},(_,i)=>`<img style="--spill:${i}" src="${art}v11/ore.png" alt="">`).join('');}
 el('.welcome-answer-form').onsubmit=event=>{
  event.preventDefault();
  const input=el('#welcome-answer');
  if(!category||saved||mistakes===3||!input.value.trim())return;
  const result=assess(category,chain,input.value);
  if(result.kind==='unknown'||result.kind==='ambiguous'){
   el('.welcome-feedback').textContent=result.kind==='ambiguous'?'Which country? Try its full name. No penalty.':'Country not recognized. Try another — no penalty.';
   return;
  }
  input.value='';
  if(result.kind==='bust'){
   const before=el('.welcome-gems').childElementCount;
   const amount=mistakes===2?points():Math.ceil(points()*.25);
   lost+=amount;mistakes++;draw();effect('spilled','−'+amount,Math.max(1,before-el('.welcome-gems').childElementCount));
   el('.welcome-feedback').textContent=mistakes===3?'Third mistake. The cart is empty. Reset to try again.':result.answer[0]+' isn’t rarer. Some treasure spills.';
   return;
  }
  chain.push(result.answer);draw();effect('found','×'+chain.length+'!');
  const last=chain.at(-1),nextExists=category.entries.some(a=>a.rarity>last[1]);
  el('.welcome-feedback').textContent=!nextExists?'You’ve reached the top. Climb out to save.':chain.length===1?(last[1]<20?'Good start! Now name a country a little rarer than '+last[0]+'.':'That’s already '+tier(last[1]).label.toLowerCase()+'. A common first pick leaves more room.'):'Rarer! Keep going a little rarer, or climb out.';
 };
 el('.welcome-bank').onclick=()=>{if(!chain.length||saved||mistakes===3)return;saved=true;draw();effect('banked','Saved ✓');el('.welcome-feedback').textContent='Practice haul saved.'+(settlement(chain,lost).bonuses.length?' Bonus ×'+settlement(chain,lost).multiplier+' included!':' Now try a daily dig.');};
 function reset(){chain=[];mistakes=0;lost=0;saved=false;el('#welcome-answer').value='';draw();el('.welcome-world').className='welcome-world';el('.welcome-pop').textContent='';el('.welcome-spills').replaceChildren();el('.welcome-feedback').textContent='Name a very common country to start.';}
 el('.welcome-replay').onclick=reset;
 el('.welcome-close').onclick=el('.welcome-done').onclick=()=>dialog.close();
 function open(){reset();if(!dialog.open)dialog.showModal();}
 open();window.addEventListener('pageshow',event=>{if(event.persisted)open();});
 fetch('./data/catalog.json').then(response=>{if(!response.ok)throw Error('Catalog unavailable');return response.json();}).then(catalog=>{
  category=catalog.categories.find(c=>c.id==='countries');if(!category?.entries?.length)throw Error('Countries unavailable');draw();
 }).catch(()=>{category=null;draw();el('.welcome-feedback').textContent='Practice couldn’t load. Reload to try again.';});
}
