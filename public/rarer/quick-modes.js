// Quick modes: Higher or Lower, Bullseye and Top 10 Blitz, played in one dialog.
// The pure helpers at the top have no DOM access so they can be tested in Node.
import {normalize,tier} from './core.js?v=b6103573572c';
import {updateModes,loadModes,recordFinds,recordBest} from './modes-store.js?v=b6103573572c';
import {sheetHead,openSheet,bindSheetControls,closeSheet} from './sheet.js?v=b6103573572c';
import {iconSvg} from './icons.js?v=b6103573572c';

// ---------- Pure logic ----------
export const QUICK_MODES={
 'higher-lower':{title:'Higher or Lower',rule:'Tap the answer more people look up. One wrong pick ends the game.'},
 bullseye:{title:'Bullseye',rule:'Name an answer as close to the target rank as you can. Five targets, three tries each.'},
 blitz:{title:'Top 10 Blitz',rule:'Name the 10 most looked-up answers before 90 seconds run out.'}
};
export const BULLSEYE_TARGETS=5,BULLSEYE_TRIES=3,BLITZ_SECONDS=90,SWITCH_EVERY=5;

const pick=(list,random)=>list[Math.min(list.length-1,Math.floor(random()*list.length))];

// Name or alias match. An alias shared by two entries is ambiguous.
export function findEntry(category,text){
 const key=normalize(String(text||''));
 if(!key)return {kind:'unknown'};
 const matches=(category?.entries||[]).filter(e=>[e.name,...(e.aliases||[])].some(n=>normalize(n)===key));
 if(matches.length>1){const exact=matches.filter(e=>normalize(e.name)===key);if(exact.length!==1)return {kind:'ambiguous'};return {kind:'found',entry:exact[0]};}
 return matches.length?{kind:'found',entry:matches[0]}:{kind:'unknown'};
}

// Higher or Lower: the minimum rank gap shrinks from 30% of the list to 5% as the streak grows.
export const gapFraction=streak=>Math.max(.05,.3-.025*Math.max(0,streak));
export function pickNext(category,current,streak,random=Math.random,avoid=[]){
 const list=category.entries,n=list.length,frac=gapFraction(streak);
 const lo=Math.max(1,Math.round(frac*n)),hi=Math.max(lo,Math.round(Math.min(1,frac*2)*n));
 const gap=e=>Math.abs(e.rank-current.rank);
 const open=list.filter(e=>e.rank!==current.rank&&!avoid.includes(e.name));
 const pool=[open.filter(e=>gap(e)>=lo&&gap(e)<=hi),open.filter(e=>gap(e)>=lo),open].find(p=>p.length);
 return pool?pick(pool,random):null;
}
export function pickPair(catalog,streak=0,random=Math.random,excludeCategoryId=null){
 let cats=catalog.categories.filter(c=>c.entries?.length>=10);
 if(cats.length>1&&excludeCategoryId)cats=cats.filter(c=>c.id!==excludeCategoryId);
 for(let attempt=0;attempt<20;attempt++){
  const category=pick(cats,random),current=pick(category.entries,random),next=pickNext(category,current,streak,random,[current.name]);
  if(next)return {category,current,next};
 }
 throw Error('No playable pair');
}
// choice: 'more' = the second answer is more looked-up (smaller rank number).
export const judgeHigherLower=(current,next,choice)=>choice==='more'?next.rank<current.rank:next.rank>current.rank;

// Bullseye
export function pickTarget(catalog,random=Math.random,avoidCategoryIds=[]){
 let cats=catalog.categories.filter(c=>c.entries?.length>=20);
 const fresh=cats.filter(c=>!avoidCategoryIds.includes(c.id));if(fresh.length)cats=fresh;
 const category=pick(cats,random),size=category.entries.length;
 const lo=Math.ceil(size*.15),hi=Math.floor(size*.85);
 const ranks=[...new Set(category.entries.map(e=>e.rank))].filter(r=>r>=lo&&r<=hi);
 const rank=pick(ranks,random);
 return {category,rank,size,answers:category.entries.filter(e=>e.rank===rank)};
}
export const bullseyePoints=(distance,size)=>distance===0?100:Math.max(0,100-Math.round(100*distance/size*4));
export const warmth=(previous,distance)=>previous==null?'':distance<previous?'Warmer':distance>previous?'Colder':'Same distance';
export function bullseyeGuess(target,text,guessedNames=[]){
 const found=findEntry(target.category,text);
 if(found.kind!=='found')return found;
 if(guessedNames.includes(found.entry.name))return {kind:'repeat',entry:found.entry};
 return {kind:'valid',entry:found.entry,distance:Math.abs(found.entry.rank-target.rank)};
}

// Top 10 Blitz
export const topTen=category=>category.entries.slice(0,10);
export const blitzScore=(found,secondsLeft)=>found*10+(found>=10?Math.max(0,Math.floor(secondsLeft)):0);
export const secondsLeft=(deadline,now)=>Math.max(0,Math.ceil((deadline-now)/1000));
export function blitzGuess(category,text,triedNames=[]){
 const found=findEntry(category,text);
 if(found.kind!=='found')return found;
 const slot=topTen(category).findIndex(e=>e.name===found.entry.name);
 if(triedNames.includes(found.entry.name))return {kind:'repeat',entry:found.entry,slot};
 return {kind:slot>=0?'top':'other',entry:found.entry,slot};
}

// ---------- Dialog ----------
const art='./assets/one-more-swing/';
const esc=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gem=entry=>`<img class="qm-gem" src="${art}v11/${entry.rarity<40?'ore':entry.rarity<80?'amethyst':'diamond'}.png" alt="">`;
const rankTag=(entry,hidden=false)=>hidden?'<b class="qm-rank">#?</b>':`<b class="qm-rank ${tier(entry.rarity).className}">#${entry.rank}</b>`;
const lower=name=>name.replace(/^(A|An) /,m=>m.toLowerCase());
const inputAttrs='autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="go"';

let timers=[];
const stop=()=>{timers.forEach(fn=>fn());timers=[];};
const later=(fn,ms)=>{const id=setTimeout(fn,ms);timers.push(()=>clearTimeout(id));};

function getDialog(){
 let dialog=document.getElementById('quick-mode');
 if(!dialog){
  dialog=document.createElement('dialog');dialog.id='quick-mode';dialog.className='sheet';dialog.setAttribute('aria-labelledby','quick-mode-title');
  dialog.innerHTML=sheetHead('quick-mode','Quick game')+'<div class="sheet-body qm-body"><div class="qm-screen"></div><p class="sr-only qm-live" role="status" aria-live="polite"></p></div>';
  // Escape, backdrop click and focus return are handled by the shared sheet shell.
  bindSheetControls(dialog);
  dialog.addEventListener('close',stop);
  document.body.append(dialog);
 }
 return dialog;
}

export function openQuickMode(kind,{catalog,storage=null,categoryId=null,random=Math.random,opener}={}){
 const mode=QUICK_MODES[kind];
 if(!mode)throw Error('Unknown quick mode: '+kind);
 if(!catalog?.categories?.length)throw Error('Catalog missing');
 const dialog=getDialog(),screen=dialog.querySelector('.qm-screen'),live=dialog.querySelector('.qm-live');
 dialog.querySelector('#quick-mode-title').textContent=mode.title;
 const $=s=>screen.querySelector(s);
 const say=text=>{const f=$('.qm-feedback');if(f)f.textContent=text;live.textContent=text;};
 const save=(categoryIdToSave,names)=>updateModes(storage,s=>recordFinds(s,categoryIdToSave,names));
 const show=html=>{stop();screen.innerHTML=html;live.textContent='';};
 const pose=name=>{const mole=$('.qm-mole');if(!mole)return;mole.dataset.pose='';void mole.offsetWidth;mole.dataset.pose=name;};
 const mole=(p='idle')=>`<div class="qm-mole" data-pose="${p}" aria-hidden="true"></div>`;
 const hud=(meta,score)=>`<div class="qm-hud">${mole()}<div><p class="qm-meta">${meta}</p><p class="qm-score">${score}</p></div></div>`;

 function intro(){
  const best=loadModes(storage).best[kind];
  show(`<p class="qm-kicker">Quick game</p>${mole()}<p class="qm-headline">${mode.title}</p><p class="qm-rule">${mode.rule}</p><p class="qm-best">${Number.isFinite(best)?`Your best <b>${best}</b>`:'No best score yet'}</p><button type="button" class="qm-primary qm-start">Start</button>`);
  $('.qm-start').onclick=games[kind];$('.qm-start').focus();
 }

 function finish({title,score,detail,missedTitle,missed}){
  let result;updateModes(storage,s=>{result=recordBest(s,kind,score);return result.state;});
  show(`<p class="qm-kicker">${mode.title}</p>${mole(result.isBest&&score>0?'celebrate':'idle')}<p class="qm-headline">${title}</p><p class="qm-final"><b>${score}</b><span>${kind==='higher-lower'?'streak':'points'}</span></p>${result.isBest&&score>0?'<p class="qm-new-best">New best!</p>':`<p class="qm-best">Your best <b>${result.previous??score}</b></p>`}${detail?`<p class="qm-rule">${detail}</p>`:''}${missed?.length?`<section class="qm-missed" aria-label="${esc(missedTitle)}"><h3>${esc(missedTitle)}</h3><ul>${missed.join('')}</ul></section>`:''}<div class="qm-actions"><button type="button" class="qm-primary qm-again">Play again</button><button type="button" class="qm-secondary qm-done">Close</button></div>`);
  $('.qm-again').onclick=games[kind];$('.qm-done').onclick=()=>closeSheet(dialog);
  live.textContent=`${title} ${score} ${kind==='higher-lower'?'streak':'points'}.${result.isBest&&score>0?' New best!':''}`;
  $('.qm-again').focus();
 }

 // ----- Higher or Lower -----
 function higherLower(){
  let streak=0,{category,current,next}=pickPair(catalog,0,random),used=[current.name,next.name];
  function draw(){
   const size=category.entries.length;
   show(`${hud(esc(category.name)+' · '+size+' answers',`<b>${streak}</b> streak`)}<p class="qm-question">Which do more people look up?</p><div class="qm-duel"><div class="qm-card">${gem(current)}<strong>${esc(current.name)}</strong><span>${rankTag(current)} of ${size}</span></div><span class="qm-vs" aria-hidden="true">vs</span><div class="qm-card qm-hidden"><img class="qm-gem" src="${art}v11/rocks.png" alt=""><strong>${esc(next.name)}</strong><span class="qm-next-rank">${rankTag(next,true)} of ${size}</span></div></div><p class="qm-prompt">Is <b>${esc(next.name)}</b> more or less looked-up than ${esc(current.name)}?</p><div class="qm-choices"><button type="button" data-choice="more">More looked-up</button><button type="button" data-choice="less">Less looked-up</button></div><p class="qm-feedback" aria-hidden="true"></p>`);
   screen.querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>choose(b.dataset.choice));
   $('[data-choice]').focus();
  }
  function choose(choice){
   screen.querySelectorAll('[data-choice]').forEach(b=>b.disabled=true);
   const ok=judgeHigherLower(current,next,choice),card=$('.qm-hidden');
   card.classList.remove('qm-hidden');card.classList.add(ok?'qm-right':'qm-wrong');
   $('.qm-next-rank').innerHTML=`${rankTag(next)} of ${category.entries.length}`;
   if(ok){
    streak++;save(category.id,[current.name,next.name]);pose('celebrate');
    $('.qm-score').innerHTML=`<b>${streak}</b> streak`;
    say(`Yes! ${next.name} is #${next.rank}. Streak ${streak}.`);
    later(advance,1100);
   }else{
    pose('recoil');
    const lost={current,next,category};
    say(`Oh no! ${next.name} is #${next.rank}, ${next.rank<current.rank?'more':'less'} looked-up than ${current.name}.`);
    $('.qm-choices').innerHTML='<button type="button" class="qm-primary qm-see">See your score</button>';
    $('.qm-see').onclick=()=>finish({title:'Game over',score:streak,missedTitle:'The pick that got you',missed:[`<li>${gem(lost.next)}<span>${esc(lost.next.name)}</span>${rankTag(lost.next)}</li>`,`<li>${gem(lost.current)}<span>${esc(lost.current.name)}</span>${rankTag(lost.current)}</li>`],detail:`${esc(lost.category.label||lost.category.name)}: ${esc(lost.next.name)} is ${lost.next.rank<lost.current.rank?'more':'less'} looked-up.`});
    $('.qm-see').focus();
   }
  }
  function advance(){
   let fresh=null;
   if(streak%SWITCH_EVERY!==0){current=next;fresh=pickNext(category,current,streak,random,used);}
   if(fresh){next=fresh;used.push(fresh.name);}
   else{({category,current,next}=pickPair(catalog,streak,random,category.id));used=[current.name,next.name];}
   draw();
   if(streak%SWITCH_EVERY===0)say(`New category: ${category.label||category.name}.`);
  }
  draw();
 }

 // ----- Bullseye -----
 function bullseye(){
  let index=0,total=0,target,guesses,best,done;const results=[],usedCats=[];
  function start(){
   target=pickTarget(catalog,random,usedCats);usedCats.push(target.category.id);guesses=[];best=null;done=false;
   const {category,rank,size}=target;
   show(`${hud(`Target ${index+1} of ${BULLSEYE_TARGETS}`,`<b>${total}</b> points`)}<p class="qm-question">${esc(category.name)} as close to <b class="qm-target">#${rank}</b> of ${size} as you can</p><div class="qm-meter" aria-hidden="true"><i class="qm-mark-target" style="--at:${(rank-1)/(size-1)*100}%"></i></div><div class="qm-meter-ends" aria-hidden="true"><span>#1 most looked-up</span><span>#${size}</span></div><ol class="qm-guesses" aria-label="Your guesses"></ol><p class="qm-tries"></p><form class="qm-form"><label class="sr-only" for="qm-guess">Your guess: ${esc(lower(category.name))}</label><input id="qm-guess" ${inputAttrs} placeholder="${esc(category.name)}…"><button type="submit">Guess</button></form><p class="qm-feedback" aria-hidden="true"></p>`);
   $('.qm-form').onsubmit=guess;drawGuesses();$('#qm-guess').focus();
  }
  function drawGuesses(){
   const {size}=target;
   $('.qm-guesses').innerHTML=guesses.map(g=>`<li>${gem(g.entry)}<span>${esc(g.entry.name)}</span>${rankTag(g.entry)}<small>${g.distance?`${g.distance} away${g.note?' · '+g.note:''}`:'Bullseye!'}</small></li>`).join('');
   const left=BULLSEYE_TRIES-guesses.length;
   $('.qm-tries').innerHTML=`<span class="qm-pips" aria-hidden="true">${'<i class="qm-pip"></i>'.repeat(Math.max(0,left))}${'<i class="qm-pip used"></i>'.repeat(guesses.length)}</span> ${done?'':`${left} ${left===1?'try':'tries'} left`}`;
   $('.qm-meter').querySelectorAll('.qm-mark-guess').forEach(m=>m.remove());
   guesses.forEach(g=>$('.qm-meter').insertAdjacentHTML('beforeend',`<i class="qm-mark-guess ${tier(g.entry.rarity).className}" style="--at:${(g.entry.rank-1)/(size-1)*100}%"></i>`));
  }
  function guess(event){
   event.preventDefault();
   const input=$('#qm-guess');if(done||!input.value.trim())return;
   const r=bullseyeGuess(target,input.value,guesses.map(g=>g.entry.name)),what=lower(target.category.name);
   if(r.kind==='unknown'){say(`That's not on the list for ${what}. Free try.`);input.select();return;}
   if(r.kind==='ambiguous'){say('Which one? Try the full name. Free try.');input.select();return;}
   if(r.kind==='repeat'){say(`You already guessed ${r.entry.name}. Free try.`);input.value='';return;}
   input.value='';
   const note=warmth(guesses.length?guesses.at(-1).distance:null,r.distance);
   guesses.push({entry:r.entry,distance:r.distance,note});save(target.category.id,[r.entry.name]);
   best=best===null?r.distance:Math.min(best,r.distance);
   if(r.distance===0||guesses.length>=BULLSEYE_TRIES){done=true;drawGuesses();settle();return;}
   drawGuesses();pose('idle');
   say(`${r.entry.name} is #${r.entry.rank}. ${r.distance} away${note?'. '+note:''}.`);
  }
  function settle(){
   const points=bullseyePoints(best,target.size),hit=best===0,at=target.answers.map(e=>e.name).join(' / ');
   total+=points;results.push({target,best,points,at});
   pose(hit||points>=75?'celebrate':points?'idle':'recoil');
   $('.qm-score').innerHTML=`<b>${total}</b> points`;
   const last=index+1>=BULLSEYE_TARGETS;
   $('.qm-form').outerHTML=`<div class="qm-result"><p class="qm-result-head">${hit?'Bullseye!':`Closest: ${best} away`} <b>+${points}</b></p><p>At #${target.rank}: <strong>${esc(at)}</strong></p><button type="button" class="qm-primary qm-next">${last?'See your score':'Next target'}</button></div>`;
   say(`${hit?'Bullseye!':`Closest guess ${best} away.`} Plus ${points}. At #${target.rank}: ${at}.`);
   $('.qm-next').onclick=()=>{index++;if(!last)start();else finish({title:total>=400?'Sharp shooting!':'All targets done',score:total,missedTitle:'What sat on each target',missed:results.map(x=>`<li><span>${esc(x.target.category.label||x.target.category.name)} #${x.target.rank}: ${esc(x.at)}</span><b class="qm-points">+${x.points}</b></li>`)});};
   $('.qm-next').focus();
  }
  start();
 }

 // ----- Top 10 Blitz -----
 function blitz(){
  const category=catalog.categories.find(c=>c.id===categoryId&&c.entries?.length>=10)||pick(catalog.categories.filter(c=>c.entries?.length>=10),random);
  const board=topTen(category),found=new Set(),tried=[];
  let over=false;
  show(`<div class="qm-hud">${mole()}<div><p class="qm-meta">${esc(category.label||category.name)}</p><p class="qm-score"><b class="qm-found">0</b>/10 found</p></div><p class="qm-timer" role="timer" aria-label="Time left"><b>1:30</b></p></div><p class="qm-question">Name the top 10: ${esc(lower(category.name))}</p><ol class="qm-board" aria-label="Top 10 board">${board.map((e,i)=>`<li data-slot="${i}"><span class="qm-slot-rank">#${e.rank}</span><span class="qm-slot-name">?</span></li>`).join('')}</ol><form class="qm-form"><label class="sr-only" for="qm-blitz">Name ${esc(lower(category.name))}</label><input id="qm-blitz" ${inputAttrs} placeholder="${esc(category.name)}…"><button type="submit">Go</button></form><p class="qm-feedback" aria-hidden="true">Type fast. Wrong answers cost nothing.</p>`);
  // Wall-clock deadline: throttled or backgrounded tabs catch up on the next tick.
  const deadline=Date.now()+BLITZ_SECONDS*1000;let shown=BLITZ_SECONDS;
  const tick=()=>{
   if(over)return;
   const left=secondsLeft(deadline,Date.now());
   if(left!==shown){
    shown=left;const t=$('.qm-timer');
    t.querySelector('b').textContent=`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;t.classList.toggle('qm-low',left<=10);
    if(left===30||left===10)live.textContent=`${left} seconds left.`;
   }
   if(left<=0)end();
  };
  const interval=setInterval(tick,250),onVisible=()=>tick();
  document.addEventListener('visibilitychange',onVisible);
  timers.push(()=>{clearInterval(interval);document.removeEventListener('visibilitychange',onVisible);});
  $('.qm-form').onsubmit=event=>{
   event.preventDefault();tick();
   const input=$('#qm-blitz');if(over||!input.value.trim())return;
   const r=blitzGuess(category,input.value,tried);
   if(r.kind==='unknown'){say('Not on the list. Try another!');input.select();return;}
   if(r.kind==='ambiguous'){say('Which one? Try the full name.');input.select();return;}
   input.value='';
   if(r.kind==='repeat'){say(`${r.entry.name} is already tried.`);return;}
   tried.push(r.entry.name);save(category.id,[r.entry.name]);
   if(r.kind==='other'){say(`${r.entry.name}: #${r.entry.rank} · not top 10`);return;}
   found.add(r.slot);
   const slot=$(`[data-slot="${r.slot}"]`);slot.classList.add('qm-filled',tier(r.entry.rarity).className);
   slot.querySelector('.qm-slot-name').innerHTML=`${gem(r.entry)}${esc(r.entry.name)}`;
   $('.qm-found').textContent=found.size;pose('celebrate');
   say(`${r.entry.name} is #${r.entry.rank}! ${found.size} of 10.`);
   if(found.size>=10)end();
  };
  function end(){
   if(over)return;over=true;
   const left=secondsLeft(deadline,Date.now()),all=found.size>=10;
   finish({title:all?'All 10 found!':'Time!',score:blitzScore(found.size,left),detail:all?`10 points each, plus ${left} seconds left`:`${found.size} of 10 found.`,missedTitle:'The top 10 you missed',missed:board.filter((e,i)=>!found.has(i)).map(e=>`<li>${gem(e)}<span>${esc(e.name)}</span>${rankTag(e)}</li>`)});
  }
  $('#qm-blitz').focus();
 }

 const games={'higher-lower':higherLower,bullseye,blitz};
 intro();
 if(!dialog.open)openSheet(dialog,{opener,onClose:stop});
 $('.qm-start')?.focus();
 return dialog;
}
