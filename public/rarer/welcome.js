import {tier,assess,rankOf} from './core.js?v=cea0b2abe3a6';
import {baseScore,settlement,findValues} from './rewards.js?v=cea0b2abe3a6';
import {sheetHead,openSheet,bindSheetControls,closeSheet} from './sheet.js?v=cea0b2abe3a6';
import {iconSvg} from './icons.js?v=cea0b2abe3a6';
const art='./assets/one-more-swing/';
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// The tutorial is shown once per browser. game.js also checks that no dig has
// been finished yet, so a returning player never meets it again.
export const WELCOME_KEY='rarer.welcome.v1';
const store=storage=>{try{return storage??globalThis.localStorage;}catch{return null;}};
export function welcomeSeen(storage){try{return !!store(storage)?.getItem(WELCOME_KEY);}catch{return false;}}
function remember(storage){try{store(storage)?.setItem(WELCOME_KEY,'1');}catch{}}

export function mountWelcome(storage){
 const dialog=document.createElement('dialog');dialog.id='welcome';dialog.className='sheet';dialog.setAttribute('aria-labelledby','welcome-title');
 dialog.innerHTML=sheetHead('welcome','Practice dig')+`<div class="sheet-body"><p class="welcome-kicker">Practice — this doesn’t count</p><p class="welcome-headline">Name an answer, then keep naming rarer ones.</p><p class="welcome-lead">Rarer means fewer people look it up. Two slips and the cave falls in.</p><section class="welcome-demo" aria-label="Practice dig, separate from your game"><div class="welcome-demo-label"><span>Practice · A country</span><button type="button" class="welcome-replay">${iconSvg('ui-reset')}Reset</button></div><ol class="welcome-chain"></ol><div class="welcome-world" aria-hidden="true"><div class="welcome-mole"></div><div class="welcome-cart"><div class="welcome-gems"></div><img src="${art}v12/cart-small.png" alt=""></div><div class="welcome-spills"></div><span class="welcome-pop"></span></div><div class="welcome-haul"><strong class="welcome-points"></strong><span class="welcome-misses"></span></div><p class="welcome-feedback" id="welcome-feedback">Name a very common country to start.</p><form class="welcome-answer-form"><label class="sr-only" for="welcome-answer">Your country answer</label><input id="welcome-answer" aria-describedby="welcome-feedback" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="go" placeholder="A very common country…" disabled><button type="submit" aria-label="Submit practice answer" disabled>${iconSvg('ui-submit')}</button></form><div class="welcome-risk"><span>1st slip <b>Warning</b></span><span>2nd slip <b>Cave-in −50%</b></span></div><button type="button" class="welcome-bank">${iconSvg('ui-climb-out')} Climb out and collect</button></section><p class="welcome-note">Practice only. No timer. Unknown answers are free.</p></div><div class="sheet-foot"><button type="button" class="btn btn--quiet welcome-skip">Skip</button><button type="button" class="btn btn--primary welcome-done">Try a practice dig</button></div>`;
 document.body.append(dialog);
 // Practice is separate from the daily run and never writes progress.
 let chain=[],mistakes=0,lost=0,saved=false,category=null;
 const el=s=>dialog.querySelector(s);
 const points=()=>Math.max(0,baseScore(chain)-lost);
 const caved=()=>mistakes>=2;
 const over=()=>saved||caved();
 const rank=name=>rankOf(category,name);
 function draw(){
  const links=chain.length,values=findValues(chain);
  el('.welcome-chain').innerHTML=links?chain.slice(-2).map(([name,value],i)=>`<li class="${tier(value).className}"><strong>#${rank(name)}</strong><span>${escape(name)}</span><small>${values[links-Math.min(2,links)+i]} pts</small></li>`).join('')+`<li class="welcome-next"><strong>?</strong><span>Beat #${rank(chain.at(-1)[0])}</span></li>`:'<li class="welcome-next common"><strong>?</strong><span>Your first answer</span><small>Start common</small></li><li class="welcome-next"><strong>?</strong><span>A little rarer</span></li><li class="welcome-next"><strong>?</strong><span>Rarer again</span></li>';
  // The arrow between links is an icon, never a CSS glyph (UX-SPEC §2.6).
  const items=el('.welcome-chain').children;
  for(let i=0;i<items.length-1;i++)items[i].insertAdjacentHTML('beforeend',`<span class="welcome-arrow" aria-hidden="true">${iconSvg('ui-next')}</span>`);
  const amount=!links?0:Math.max(1,Math.round(Math.min(links,4)*3*(caved()?.5:1)));
  el('.welcome-gems').innerHTML=Array.from({length:amount},(_,i)=>`<img style="--gem:${i}" src="${art}v11/${links>2?'amethyst':'ore'}.png" alt="">`).join('');
  el('.welcome-points').innerHTML=saved?`${settlement(chain,lost,caved(),mistakes).points} points safe <span class="combo-glyph">${iconSvg('ui-check')}</span>`:`${points()} points`;
  el('.welcome-misses').textContent=caved()?'Cave-in':mistakes?'Warning used':links?'Your practice haul':'Nothing found yet. Your first pick.';
  el('#welcome-answer').placeholder=links?'A rarer country…':'A very common country…';
  el('#welcome-answer').disabled=el('[type="submit"]').disabled=!category||over();
  el('.welcome-bank').disabled=!links||over();
  el('.welcome-done').textContent=over()?'Start today’s digs':'Try a practice dig';
 }
 function effect(kind,text,spill=0){const world=el('.welcome-world');world.className='welcome-world';void world.offsetWidth;world.classList.add(kind);el('.welcome-pop').textContent=text;el('.welcome-spills').innerHTML=Array.from({length:spill},(_,i)=>`<img style="--spill:${i}" src="${art}v11/ore.png" alt="">`).join('');}
 el('.welcome-answer-form').onsubmit=event=>{
  event.preventDefault();
  const input=el('#welcome-answer');
  if(!category||over()||!input.value.trim())return;
  const result=assess(category,chain,input.value),say=text=>{el('.welcome-feedback').textContent=text;};
  if(result.kind==='unknown'||result.kind==='ambiguous'){say(result.kind==='ambiguous'?'Which country? Try its full name. No penalty.':'Country not recognized. Try another. No penalty.');return;}
  if(result.kind==='repeat'){say(result.answer[0]+' is already one of your finds. No penalty.');return;}
  input.value='';
  if(result.kind==='close'){say('So close! '+result.answer[0]+' is #'+result.rank+', just above #'+result.last+'. No penalty.');effect('found','Close!');return;}
  if(result.kind==='bust'){
   const why=result.answer[0]+' is #'+result.rank+', more looked-up than #'+result.last+'.';
   if(!mistakes){mistakes=1;draw();effect('spilled','Warning!');say(why+' Warning: the next slip caves in.');return;}
   const before=el('.welcome-gems').childElementCount,amount=Math.ceil(points()/2);
   lost+=amount;mistakes=2;draw();effect('spilled','−'+amount,Math.max(1,before-el('.welcome-gems').childElementCount));
   say(why+' Cave-in! Half the haul spilled. Reset to try again.');return;
  }
  chain.push(result.answer);draw();effect('found','#'+result.rank);
  const last=rank(result.answer[0]),atTop=last>=category.entries.length;
  say(atTop?'That’s the rarest country. Climb out to collect.':chain.length===1?(result.answer[1]<20?'Good start! '+result.answer[0]+' is #'+last+'. Now beat #'+last+'.':result.answer[0]+' is already #'+last+'. A more common first pick leaves more room.'):'Rarer! #'+last+' of '+category.entries.length+'. Keep going, or climb out.');
 };
 el('.welcome-bank').onclick=()=>{if(!chain.length||over())return;saved=true;draw();effect('banked','Saved');const reward=settlement(chain,lost,false,mistakes);el('.welcome-feedback').textContent='Practice haul brought home.'+(reward.bonuses.length?' Combos at home: '+reward.bonuses.map(b=>b.name).join(', ')+'.':' Now try a daily dig.');};
 function reset(){chain=[];mistakes=0;lost=0;saved=false;el('#welcome-answer').value='';draw();el('.welcome-world').className='welcome-world';el('.welcome-pop').textContent='';el('.welcome-spills').replaceChildren();el('.welcome-feedback').textContent='Name a very common country to start.';}
 el('.welcome-replay').onclick=reset;
 bindSheetControls(dialog);
 el('.welcome-skip').onclick=()=>closeSheet(dialog);
 el('.welcome-done').onclick=()=>{if(over())closeSheet(dialog);else el('#welcome-answer').focus();};
 reset();
 // Closing by any route — button, Escape, backdrop — counts as seen. The tutorial has
 // no opener (it mounts itself), so focus is handed to the home primary rather than
 // dropped on <body>.
 openSheet(dialog,{onClose:()=>{
  remember(storage);
  const next=document.getElementById('start')||document.getElementById('controls');
  if(next&&typeof next.focus==='function')next.focus({preventScroll:true});
 }});
 fetch('./data/catalog.json').then(response=>{if(!response.ok)throw Error('Catalog unavailable');return response.json();}).then(catalog=>{
  category=catalog.categories.find(c=>c.id==='countries');if(!category?.entries?.length)throw Error('Countries unavailable');draw();
 }).catch(()=>{category=null;draw();el('.welcome-feedback').textContent='Practice couldn’t load. Reload to try again.';});
}
