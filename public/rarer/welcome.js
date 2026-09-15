import {tier,assess,rankOf} from './core.js?v=8b851d4060c4';
import {baseScore,settlement,findValues} from './rewards.js?v=8b851d4060c4';
const art='./assets/one-more-swing/';
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function mountWelcome(){
 const dialog=document.createElement('dialog');dialog.id='welcome';dialog.setAttribute('aria-labelledby','welcome-title');
 dialog.innerHTML=`<button class="welcome-close" aria-label="Close welcome">×</button><p class="welcome-kicker">Three digs. A fresh start every day.</p><h2 id="welcome-title" tabindex="-1" autofocus>Start common.<br>Go a little rarer.</h2><p class="welcome-lead">Rarer = fewer people look it up. Every answer shows its rank.</p><section class="welcome-demo" aria-label="Practice dig, separate from your game"><div class="welcome-demo-label"><span>Practice · A country</span><button class="welcome-replay">↻ Reset</button></div><ol class="welcome-chain"></ol><div class="welcome-world" aria-hidden="true"><div class="welcome-mole"></div><div class="welcome-cart"><div class="welcome-gems"></div><img src="${art}v12/cart-small.png" alt=""></div><div class="welcome-spills"></div><span class="welcome-pop"></span></div><div class="welcome-haul"><strong class="welcome-points"></strong><span class="welcome-misses"></span></div><p class="welcome-feedback" id="welcome-feedback" role="status">Name a very common country to start.</p><form class="welcome-answer-form"><label class="sr" for="welcome-answer">Your country answer</label><input id="welcome-answer" aria-describedby="welcome-feedback" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="go" placeholder="A very common country…" disabled><button type="submit" aria-label="Submit practice answer" disabled>→</button></form><div class="welcome-risk"><span>1st slip <b>Warning</b></span><span>2nd slip <b>Cave-in −50%</b></span></div><button class="welcome-bank">↑ Climb out & collect</button></section><button class="primary welcome-done">Got it. Let’s dig</button><p class="welcome-note">Practice only. No timer. Unknown answers are free.</p>`;
 document.body.append(dialog);
 // Practice is separate from the daily run and never writes progress.
 let chain=[],mistakes=0,lost=0,saved=false,category=null;
 const el=s=>dialog.querySelector(s);
 const points=()=>Math.max(0,baseScore(chain)-lost);
 const caved=()=>mistakes>=2;
 const rank=name=>rankOf(category,name);
 function draw(){
  const links=chain.length,values=findValues(chain);
  el('.welcome-chain').innerHTML=links?chain.slice(-2).map(([name,value],i)=>`<li class="${tier(value).className}"><strong>#${rank(name)}</strong><span>${escape(name)}</span><small>${values[links-Math.min(2,links)+i]} pts</small></li>`).join('')+`<li class="welcome-next"><strong>?</strong><span>Beat #${rank(chain.at(-1)[0])}</span></li>`:'<li class="welcome-next common"><strong>?</strong><span>Your first answer</span><small>Start common</small></li><li class="welcome-next"><strong>?</strong><span>A little rarer</span></li><li class="welcome-next"><strong>?</strong><span>Rarer again</span></li>';
  const amount=!links?0:Math.max(1,Math.round(Math.min(links,4)*3*(caved()?.5:1)));
  el('.welcome-gems').innerHTML=Array.from({length:amount},(_,i)=>`<img style="--gem:${i}" src="${art}v11/${links>2?'amethyst':'ore'}.png" alt="">`).join('');
  el('.welcome-points').textContent=saved?settlement(chain,lost,caved(),mistakes).points+' points safe ✓':points()+' points';
  el('.welcome-misses').textContent=caved()?'Cave-in':mistakes?'Warning used':links?'Your practice haul':'Empty cart. Your first pick.';
  el('#welcome-answer').placeholder=links?'A rarer country…':'A very common country…';
  el('#welcome-answer').disabled=el('[type="submit"]').disabled=!category||saved||caved();
  el('.welcome-bank').disabled=!links||saved||caved();
 }
 function effect(kind,text,spill=0){const world=el('.welcome-world');world.className='welcome-world';void world.offsetWidth;world.classList.add(kind);el('.welcome-pop').textContent=text;el('.welcome-spills').innerHTML=Array.from({length:spill},(_,i)=>`<img style="--spill:${i}" src="${art}v11/ore.png" alt="">`).join('');}
 el('.welcome-answer-form').onsubmit=event=>{
  event.preventDefault();
  const input=el('#welcome-answer');
  if(!category||saved||caved()||!input.value.trim())return;
  const result=assess(category,chain,input.value),say=text=>{el('.welcome-feedback').textContent=text;};
  if(result.kind==='unknown'||result.kind==='ambiguous'){say(result.kind==='ambiguous'?'Which country? Try its full name. No penalty.':'Country not recognized. Try another. No penalty.');return;}
  if(result.kind==='repeat'){say(result.answer[0]+' is already in your cart. No penalty.');return;}
  input.value='';
  if(result.kind==='close'){say('So close! '+result.answer[0]+' is #'+result.rank+', just above #'+result.last+'. No penalty.');effect('found','Close!');return;}
  if(result.kind==='bust'){
   const why=result.answer[0]+' is #'+result.rank+', more looked-up than #'+result.last+'.';
   if(!mistakes){mistakes=1;draw();effect('spilled','Warning!');say(why+' Warning: the next slip caves in.');return;}
   const before=el('.welcome-gems').childElementCount,amount=Math.ceil(points()/2);
   lost+=amount;mistakes=2;draw();effect('spilled','−'+amount,Math.max(1,before-el('.welcome-gems').childElementCount));
   say(why+' Cave-in! Half the cart spilled. Reset to try again.');return;
  }
  chain.push(result.answer);draw();effect('found','#'+result.rank);
  const last=rank(result.answer[0]),atTop=last>=category.entries.length;
  say(atTop?'That’s the rarest country. Climb out to collect.':chain.length===1?(result.answer[1]<20?'Good start! '+result.answer[0]+' is #'+last+'. Now beat #'+last+'.':result.answer[0]+' is already #'+last+'. A more common first pick leaves more room.'):'Rarer! #'+last+' of '+category.entries.length+'. Keep going, or climb out.');
 };
 el('.welcome-bank').onclick=()=>{if(!chain.length||saved||caved())return;saved=true;draw();effect('banked','Saved ✓');const reward=settlement(chain,lost,false,mistakes);el('.welcome-feedback').textContent='Practice haul saved.'+(reward.bonuses.length?' Combos at home: '+reward.bonuses.map(b=>b.name).join(', ')+'!':' Now try a daily dig.');};
 function reset(){chain=[];mistakes=0;lost=0;saved=false;el('#welcome-answer').value='';draw();el('.welcome-world').className='welcome-world';el('.welcome-pop').textContent='';el('.welcome-spills').replaceChildren();el('.welcome-feedback').textContent='Name a very common country to start.';}
 el('.welcome-replay').onclick=reset;
 el('.welcome-close').onclick=el('.welcome-done').onclick=()=>dialog.close();
 function open(){reset();if(!dialog.open)dialog.showModal();}
 open();window.addEventListener('pageshow',event=>{if(event.persisted)open();});
 fetch('./data/catalog.json').then(response=>{if(!response.ok)throw Error('Catalog unavailable');return response.json();}).then(catalog=>{
  category=catalog.categories.find(c=>c.id==='countries');if(!category?.entries?.length)throw Error('Countries unavailable');draw();
 }).catch(()=>{category=null;draw();el('.welcome-feedback').textContent='Practice couldn’t load. Reload to try again.';});
}
