import {treasureValue,treasureSum,baseScore,settlement,challenges} from './rewards.js?v=2e123f57933a';
import {bonusTrackers,rewardReceipt,bonusSummary} from './rewards-view.js?v=2e123f57933a';
import {mountWelcome} from './welcome.js?v=2e123f57933a';
import {visualGuide} from './how-to.js?v=2e123f57933a';
import {categories,tier,sum as oldSum,score as oldScore,assess,missed,shareText} from './core.js?v=2e123f57933a';
import {MineScene} from './scene.js?v=2e123f57933a';
import {BurrowView} from './burrow-view.js?v=2e123f57933a';
import {findFor} from './feedback.js?v=2e123f57933a';
import {mineLayout} from './geology.js?v=2e123f57933a';
import * as legacyProgress from './progress.js?v=2e123f57933a';
import * as dailyProgress from './daily-progress.js?v=2e123f57933a';
import {edition,loadDaily,useDay,utcDay} from './edition.js?v=2e123f57933a';
import {pointsLeft,takePenalty,dailyShare} from './risk.js?v=2e123f57933a';
const $=id=>document.getElementById(id),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const helpGuide=$('help-guide');if(helpGuide)helpGuide.innerHTML=visualGuide({help:true});
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const scene=new MineScene($('mine'),reduced);scene.slow=()=>$('slow').checked;
const burrow=new BurrowView($('burrow'),scene);
if($('help-open')){
  const openHelp=()=>{if(!$('help').open)$('help').showModal();};
  $('help-open').onclick=openHelp;
  $('help-close').onclick=$('help-done').onclick=()=>$('help').close();
}
if(scene.hillside)mountWelcome();
const wantsDaily=scene.hillside;
if(wantsDaily){try{await loadDaily();}catch(error){$('panel').innerHTML='<h1>Couldn’t load today’s digs.</h1><p>Please reload to try again.</p>';throw error;}}
const sum=wantsDaily?treasureSum:oldSum,score=wantsDaily?baseScore:oldScore;
const value=rarity=>wantsDaily?treasureValue(rarity):rarity;
const fmt=points=>points.toLocaleString('en-US');
const {newRun,loadProgress,saveProgress,recordDiscovery,settleRound,homeProfile}=wantsDaily?dailyProgress:legacyProgress;
const runKey=()=>wantsDaily?edition.date:globalThis.crypto?.randomUUID?.()??Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
let storage;try{storage=window.localStorage;}catch{}
const loaded=loadProgress(storage,runKey());
let progress=loaded.state,saveOk=loaded.ok;
if(wantsDaily&&progress.run.day!==edition.date)useDay(progress.run.day);
let {id:runId,ci,stage,chain,results,failed}=progress.run;
let mistakes=progress.run.mistakes||0,lost=progress.run.lost||0,cargo=progress.run.cargo||[];
const haulPoints=()=>wantsDaily?pointsLeft(chain,lost):score(chain);
const bankedPoints=()=>results[ci]?.points??haulPoints();
const potentialBank=()=>wantsDaily?settlement(chain,lost).points:score(chain);
let busy=true,ready=false,autoplay=false;
const game=document.querySelector('.game');
function announce(text){$('announcement').textContent=text;}
function status(text){$('motion-status').textContent=text;}
function homeCaption(){return 'Your home · '+homeProfile(progress).total.toLocaleString('en-US')+' points';}
function homeLabel(){
  const home=homeProfile(progress);
  $('home-total').textContent=home.total.toLocaleString('en-US')+' total points';
  $('save-status').textContent=saveOk?(wantsDaily?edition.date+' · '+(home.streak?home.streak+' day streak · ':'')+'Saved on this device':scene.hillside?'Sample edition · Saved on this device':'Saved on this device · Sample answers'):'Saving unavailable · Keep this tab open';
  $('save-status').classList.toggle('error',!saveOk);
  $('collection-count').textContent=progress.legendary.length;
  $('burrow-open').disabled=!ready;
}
function persist(){
  progress.run={id:runId,ci,stage,chain,results,failed,...(wantsDaily?{day:edition.date,mistakes,lost,cargo}:{})};
  const saved=saveProgress(storage,progress);if(saved.conflict){location.reload();return;}progress=saved.state;saveOk=saved.ok;homeLabel();
}
function settle(ending){
  stage=ending;const reward=wantsDaily?settlement(chain,lost,ending==='bust'):null;results[ci]={name:categories[ci].label,chain:[...chain],bust:ending==='bust',...(wantsDaily?{points:reward.points,reward,mistakes}:{})};
  progress=settleRound(progress,runId,ci,chain,ending==='bust',{lost,mistakes,cargo});persist();
}
function showFind(answer){
  const f=findFor(answer[1]),el=$('find-feedback');el.className='find-feedback '+f.className;
  el.innerHTML='<img src="./assets/one-more-swing/'+scene.meta.images[f.asset]+'" alt=""><span><strong>'+f.tier+' find'+(f.level===3?'!':'')+'</strong><small>'+escape(answer[0])+' · '+value(answer[1])+' points · '+f.name.toLowerCase()+'</small></span>';
}
function hideFind(){$('find-feedback').className='find-feedback';$('find-feedback').replaceChildren();}
function lock(value){busy=value;document.querySelectorAll('#controls button,.test-row button').forEach(b=>b.disabled=value||autoplay);const input=$('answer');if(input)input.readOnly=value||autoplay;}
function chainRows(){return '<ol class="chain">'+chain.map(a=>{const t=tier(a[1]);return '<li><strong>'+escape(a[0])+'</strong><small class="'+t.className+'">'+t.mark+' '+t.label+'</small><span class="rating '+t.className+'">'+value(a[1])+'<em>pts</em></span></li>';}).join('')+'</ol>';}
function render(){
  const focused=document.activeElement?.id==='answer';
  game.className='game '+stage;
  $('progress').textContent=stage==='home'?'Three digs a day':stage==='result'?'Daily result':(ci+1)+' of 3';
  homeLabel();
  if(stage==='home'){
    $('panel').innerHTML='<p class="eyebrow">A fresh little adventure</p><h1>Today’s three digs</h1><ul class="categories">'+categories.map(c=>'<li><span class="category-icon">'+c.icon+'</span>'+c.name+'</li>').join('')+'</ul><p class="rule">Name an answer. Then a rarer one.<br>Climb out whenever you like.</p>';
    $('controls').innerHTML='<button class="primary" id="start">Start digging</button><p class="message">No timer. Unknown answers cost nothing.</p>';
    $('start').onclick=start;
  }else if(stage==='result'){
    const total=results.reduce((n,r)=>n+(wantsDaily?r.points:score(r.chain)),0);
    $('panel').innerHTML='<p class="eyebrow">All three digs complete</p><h1>That’s a good day’s digging.</h1><div class="result-score">'+total.toLocaleString('en-US')+'</div><p class="subtitle">Total points</p>'+bonusSummary(results)+'<pre class="share" id="share-text"></pre>';
    $('share-text').textContent=wantsDaily?dailyShare(results,edition.date):shareText(results);
    $('controls').innerHTML='<button class="primary" id="copy">Copy result</button><p class="message" id="copy-status">One square for every successful answer.</p>';
    $('copy').onclick=copy;
  }else{
    $('panel').innerHTML='<p class="eyebrow">Dig '+(ci+1)+' of 3</p><h1>'+categories[ci].name+'</h1><p class="subtitle">'+(stage==='play'?(chain.length?'Find a rarer answer.':'Start with any answer you know.'):stage==='banked'?(busy?'Bringing your haul home…':'Safely back at the surface.'):'That answer was too common.')+'</p>'+(chain.length?chainRows():'<p class="empty">Your first discovery starts the tunnel.</p>');
    if(stage==='play'){
      $('controls').innerHTML='<div class="scoreline"><strong>'+fmt(haulPoints())+' points</strong><small>'+fmt(sum(chain))+' × '+chain.length+' links</small></div><form class="answer-form" id="answer-form"><label class="sr" for="answer">'+categories[ci].name+'</label><input id="answer" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="go" placeholder="'+(chain.length?'A rarer answer…':'Type an answer…')+'"><button class="submit" aria-label="Submit answer">→</button></form><p class="message" id="message">Unknown answers are free.</p><button class="primary" id="bank">Climb out · '+fmt(potentialBank())+'</button>';
      $('answer-form').onsubmit=e=>{e.preventDefault();submit($('answer').value);};$('bank').onclick=bank;
      if(focused)$('answer').focus({preventScroll:true});
    }else if(stage==='banked'){
      const missing=missed(categories[ci],chain);
      const exact=!wantsDaily&&ci===0&&chain.at(-1)?.[1]===88;
      $('controls').innerHTML='<h2 class="ending-title">'+fmt(bankedPoints())+' points banked</h2>'+rewardReceipt(results[ci]?.reward)+'<p class="ending-sub">'+(exact?'You were 2 answers away from the top.':missing.length?'Rarer answers you missed.':'You reached the rarest answer in this category.')+'</p><ul class="missed">'+missing.map(a=>'<li><span class="'+tier(a[1]).className+'">'+tier(a[1]).mark+' '+escape(a[0])+'</span><strong>'+value(a[1])+' pts</strong></li>').join('')+'</ul><button class="primary" id="next">'+(ci===2?'See today’s result':'Next category')+'</button>';
      $('next').onclick=next;
    }else{
      $('controls').innerHTML='<h2 class="ending-title">Chain ended. '+fmt(haulPoints())+' points kept.</h2><p class="ending-sub">'+escape(failed[0])+' '+failed[1]+' is not rarer than '+escape(chain.at(-1)[0])+' '+chain.at(-1)[1]+'.<br>'+fmt(sum(chain))+' × '+chain.length+' links</p><button class="primary" id="next">'+(ci===2?'See today’s result':'Next category')+'</button>';
      if(wantsDaily)$('controls').innerHTML='<h2 class="ending-title">Three mistakes. Your cart is empty.</h2><p class="ending-sub">This dig’s points and treasure are gone.<br>Everything already at home is safe.</p><button class="primary" id="next">'+(ci===2?'See today’s result':'Next category')+'</button>';
      $('next').onclick=next;
    }
  }

  if(scene.hillside){
    $('category-steps').innerHTML='<ol class="dig-steps">'+categories.map((c,i)=>'<li'+(stage!=='result'&&i===ci?' aria-current="step"':'')+(results[i]?' class="done"':'')+'><strong><span class="dig-icon">'+c.icon+'</span>'+escape(c.name)+'</strong><small>'+(results[i]?'✓ Complete':'Dig '+(i+1))+'</small></li>').join('')+'</ol>';
    if(stage==='home')$('panel').innerHTML='<p class="eyebrow">Three new digs every day</p><h1>Go rarer. Go longer.</h1><p class="guide-intro">Each answer must be rarer than your last.</p>'+visualGuide({risk:wantsDaily});
    if(stage==='play')$('controls').insertAdjacentHTML('afterbegin','<h2 class="answer-prompt">'+(chain.length?'Find '+escape(categories[ci].name.replace(/^A /,'a rarer '))+'.':'Name '+escape(categories[ci].name.replace(/^A /,'a '))+'.')+'</h2>');
    if(stage==='result'&&!wantsDaily){$('controls').insertAdjacentHTML('beforeend','<button class="quiet-button" id="play-again">Play another sample</button>');$('play-again').onclick=reset;}
  }
  if(wantsDaily){
    if(stage==='play'){
      const risk=document.createElement('div');risk.className='riskline';risk.innerHTML='<span class="mistake-dots" aria-hidden="true">'+[0,1,2].map(i=>'<i class="'+(i<mistakes?'used':'')+'">'+(i<mistakes?'×':'·')+'</i>').join('')+'</span><span>'+mistakes+'/3 mistakes</span><small>'+(mistakes===2?'Next mistake loses this haul':'Wrong step: −25%')+'</small>';
      $('controls').insertBefore(risk,$('answer-form'));
      document.querySelector('.scoreline small').textContent=sum(chain)+' × '+chain.length+' links'+(lost?' − '+lost+' lost':'');
      $('message').textContent='Go a little rarer each time. Build a longer chain.';
      if(!chain.length)$('message').textContent='Start common. Leave room to go rarer.';
      $('bank').insertAdjacentHTML('beforebegin',bonusTrackers(chain));
    }
    if(stage==='result')$('controls').insertAdjacentHTML('beforeend','<p class="next-day">'+(utcDay()>edition.date?'<button class="primary" id="new-day">Start today’s digs</button>':'All three digs complete. New categories at 00:00 UTC.')+'</p>');
    if($('new-day'))$('new-day').onclick=()=>{useDay(utcDay());location.reload();};
    if($('test-bust'))$('test-bust').textContent='Try a less rare answer';
    if($('restart'))$('restart').hidden=true;
  }
  $('scene-caption').textContent=['home','banked','bust','result'].includes(stage)?homeCaption():'';
  if(scene.hillside)$('scene-caption').textContent='';
  lock(busy);const list=document.querySelector('.chain');if(list)list.scrollTop=list.scrollHeight;scene.draw();
}
async function start(){
  if(busy)return;if(wantsDaily&&stage==='home'&&utcDay()>edition.date){location.reload();return;}const leavingHome=scene.atHome;chain=[];failed=null;mistakes=0;lost=0;cargo=[];stage='play';hideFind();scene.setHome(homeProfile(progress));scene.reset();busy=true;persist();render();status('Down the ladder, then over to the wall.');
  if(leavingHome){scene.state.x=scene.doorX();scene.state.cam=scene.homeCamera(true);scene.pose('walk',-1);await scene.tween({x:mineLayout.shaftX,cam:scene.ladderCamera()},550);}
  else if(scene.hillside){scene.pose('walk');await scene.tween({x:mineLayout.shaftX,cam:scene.ladderCamera()},220);}
  scene.homeFocus=false;scene.pose('climb');await scene.tween({y:scene.floor,viewY:0,cam:scene.ladderCamera()},640);scene.pose('walk');await scene.tween({x:scene.standX(),cam:scene.cameraFor(scene.state.edge)},390);scene.pose('idle');lock(false);status('Ready for the first answer.');announce('Name '+categories[ci].name.toLowerCase()+'.');
}
async function submit(text){
  if(busy||stage!=='play')return;const result=assess(categories[ci],chain,text);
  if(result.kind==='ambiguous'){$('message').textContent='More than one match. Add the year or use the full name. No penalty.';return;}
  if(result.kind==='unknown'){$('message').textContent=(wantsDaily?'Not recognized for this category. Check the spelling. No penalty.':'Not in this sample’s answer list. No penalty.');$('message').classList.add('error');announce('Answer not recognized. No penalty.');return;}
  if(result.kind==='bust'){if(wantsDaily)await mistake(result.answer);else await bust(result.answer);return;}
  const beforeBonuses=challenges(chain).filter(b=>b.earned).map(b=>b.id);
  const answer=result.answer;chain.push(answer);if(wantsDaily)cargo.push(answer);progress=recordDiscovery(progress,ci,answer);persist();
  // Commit scoring before the animation. Visual timing never decides game outcomes.
  busy=true;render();scene.pose('swing');status('Swing → crack → discovery → into the cart.');
  await scene.hold(scene.meta.animations.swing.impactAt??250);scene.strike(answer[1]);await scene.hold(80);
  const wallX=scene.state.edge;scene.state.crack=false;scene.state.edge+=32;scene.releaseFind(answer,wallX);showFind(answer);
  await scene.hold(100);scene.pose('walk');await scene.tween({x:scene.standX(),cam:scene.cameraFor(scene.state.edge)},390);
  scene.pose('idle');await scene.hold(170);scene.landFind();
  if(answer[1]>=95){scene.pose('celebrate');await scene.hold(610);}else await scene.hold(150);
  scene.pose('idle');hideFind();lock(false);status(answer[0]+' '+value(answer[1])+' points · '+fmt(sum(chain))+' × '+chain.length+' = '+fmt(haulPoints())+' points. '+scene.haul.length+' '+(scene.haul.length===1?'find':'finds')+' in your cart.');announce(answer[0]+' accepted. '+fmt(haulPoints())+' points. '+challenges(chain).filter(b=>b.earned&&!beforeBonuses.includes(b.id)).map(b=>b.name+' unlocked. Bank for a 25 percent bonus.').join(' '));
}
async function bank(){
  if(busy||stage!=='play')return;lock(true);hideFind();document.activeElement?.blur();settle('banked');render();
  await bringHome();
  scene.state.revealCount=missed(categories[ci],chain).length;
  if(scene.state.revealCount){
    $('scene-caption').textContent='Look what was just ahead.';scene.homeFocus=false;
    await scene.tween({reveal:1,cam:scene.revealCamera(),viewY:0},400);await scene.hold(900);
    scene.homeFocus=true;await scene.tween({cam:scene.homeCamera(true),viewY:scene.homeViewY(),reveal:0},400);
  }
  lock(false);render();status(bankedPoints()+' points brought home. '+homeProfile(progress).total+' total points. Missed answers do not count.');announce(bankedPoints()+' points banked and brought home.');
}
async function mistake(answer){
  lock(true);hideFind();document.activeElement?.blur();failed=answer;
  const penalty=takePenalty(chain,lost,mistakes,cargo);({mistakes,lost,cargo}=penalty);
  // Persist the loss before motion so refresh cannot undo a penalty.
  if(penalty.ended)settle('bust');else persist();
  render();scene.pose('swing');await scene.hold(scene.meta.animations.swing.impactAt??250);scene.strike(0,true);
  $('scene-caption').textContent=penalty.ended?'Three mistakes. The whole haul is lost.':'Not rarer. −'+penalty.amount+' points.';
  await scene.spillHaul(penalty.spill,penalty.amount,penalty.ended);
  if(penalty.ended){await scene.hold(300);await bringHome();lock(false);render();announce('Three mistakes. This dig’s treasure and points are lost.');}
  else {lock(false);render();$('message').textContent=answer[0]+' isn’t rarer than '+chain.at(-1)[0]+'. −'+penalty.amount+' points. '+(3-mistakes)+' mistakes left.';$('message').classList.add('error');announce($('message').textContent);}
}
async function bust(answer){
  lock(true);hideFind();document.activeElement?.blur();failed=answer;settle('bust');scene.pose('swing');await scene.hold(scene.meta.animations.swing.impactAt??250);scene.state.bust=true;scene.strike(0,true);scene.pose('recoil');await scene.hold(420);scene.pose('idle');render();$('scene-caption').textContent='Too common. Your finds are safe.';await scene.hold(450);
  await bringHome();lock(false);status('Chain ended. All '+chain.length+' finds and '+fmt(haulPoints())+' points brought home.');announce('Chain ended. '+fmt(haulPoints())+' points kept and brought home.');
}
async function bringHome(){
  status('Back to the ladder with your cart.');$('scene-caption').textContent='Let’s bring it all home.';
  scene.pose('walk',-1);await scene.tween({x:mineLayout.shaftX,cam:scene.ladderCamera(),viewY:0},650);
  scene.takeHaul();scene.pose('climb');status('Every find goes in the backpack.');await scene.hold(250);
  scene.homeFocus=true;await scene.tween({y:scene.surface,viewY:scene.homeViewY()},950);
  scene.pose('walk');status('A full backpack. A little walk home.');await scene.tween({x:scene.doorX(),cam:scene.homeCamera(true)},Math.max(650,(scene.doorX()-mineLayout.shaftX)*5));
  scene.pose('idle');$('scene-caption').textContent=chain.length?'A little more for the pile.':'Home safe.';
  status('Adding the haul to the outdoor pile.');
  await scene.depositHaul(homeProfile(progress));scene.pose('celebrate');await scene.hold(550);scene.pose('idle');
  $('scene-caption').textContent=homeCaption();
}
async function next(){
  if(busy)return;
  if(ci===2){stage='result';persist();render();return;}ci++;await start();
}
function reset(){if(busy||wantsDaily)return;({id:runId,ci,stage,chain,results,failed}=newRun(runKey()));hideFind();persist();scene.setHome(homeProfile(progress));scene.reset();render();status('A fresh sample run. Your house and legendary collection are kept.');}
async function sample(){
  if(busy||autoplay)return;autoplay=true;
  if(stage!=='play'){reset();await start();}
  for(const answer of (wantsDaily?[0,25,50,75].map(n=>categories[ci].entries.find(a=>a.rarity>=n)).filter(Boolean).map(a=>[a.name,a.rarity]):categories[ci].answers)){if(answer[1]>(chain.at(-1)?.[1]??-1)){await submit(answer[0]);await scene.hold(200);}}
  autoplay=false;lock(false);
}
async function testBust(){if(busy||autoplay)return;if(wantsDaily){if(stage!=='play')await start();if(!chain.length)await sample();await submit(categories[ci].entries[0].name);return;}reset();await sample();await submit('France');}
async function copy(){try{await navigator.clipboard.writeText(wantsDaily?dailyShare(results,edition.date):shareText(results));$('copy-status').textContent='Copied. Ready to paste.';}catch{$('copy-status').textContent='Select the result above and copy it.';}}
$('sample').onclick=sample;$('test-bust').onclick=testBust;$('restart').onclick=reset;
$('burrow-open').onclick=()=>burrow.open(homeProfile(progress));
$('theme').onclick=()=>{const isDark=getComputedStyle(document.documentElement).colorScheme==='dark';document.documentElement.dataset.theme=isDark?'light':'dark';$('theme').setAttribute('aria-label','Switch to '+(isDark?'dark':'light')+' mode');if(scene.hillside)try{localStorage.setItem('rarer.theme',isDark?'light':'dark')}catch{}scene.draw();burrow.draw();};
$('collection-open').onclick=()=>{$('collection-content').innerHTML=progress.legendary.length?'<ul>'+progress.legendary.map(a=>'<li class="legendary">⬟ '+escape(a.name)+' · '+value(a.rarity)+' points</li>').join('')+'</ul>':'<p>Your legendary answers will appear here.</p>';$('collection-note').textContent=saveOk?'Only answers you give are collected. Your collection stays across digs and reloads on this device.':'Only answers you give are collected. Saving is unavailable, so these finds are kept only while this tab stays open.';$('collection').showModal();};$('collection-close').onclick=()=>$('collection').close();
function syncKeyboard(){
  const compact=innerWidth<900&&(window.visualViewport?.height??innerHeight)<550&&document.activeElement?.id==='answer';
  document.body.classList.toggle('keyboard',compact);
  if(compact){const list=document.querySelector('.chain');if(list)list.scrollTop=list.scrollHeight;}
}
if(window.visualViewport)visualViewport.addEventListener('resize',syncKeyboard);
document.addEventListener('focusin',event=>{if(event.target.id==='answer')syncKeyboard();});
document.addEventListener('focusout',()=>setTimeout(()=>{if(document.activeElement?.id!=='answer')document.body.classList.remove('keyboard');},80));
render();
try{await scene.load();scene.restore(progress.run,homeProfile(progress));ready=true;lock(false);render();status(stage==='home'?'Ready. Every finished dig adds to your home.':'Welcome back. Your dig and discoveries are saved.');}catch(error){status('The art could not load. Serve this folder over local HTTP and reload. '+error.message);}
const preview=$('swing-preview');let previewVisible=false,previewFrame=0;
const previewLoop=time=>{if(!previewVisible||document.hidden)return;scene.drawShowcase(preview,time);if(!reduced.matches)previewFrame=requestAnimationFrame(previewLoop);};
if(preview)new IntersectionObserver(entries=>{previewVisible=entries[0].isIntersecting;cancelAnimationFrame(previewFrame);if(previewVisible&&ready)previewFrame=requestAnimationFrame(previewLoop);}).observe(preview);
document.addEventListener('visibilitychange',()=>{cancelAnimationFrame(previewFrame);if(!document.hidden&&previewVisible&&ready)previewFrame=requestAnimationFrame(previewLoop);});


if($('dev-controls'))$('dev-controls').hidden=true;

if(wantsDaily){
  $('reset-progress').onclick=()=>{if(busy)return;try{dailyProgress.resetProgress(storage);location.reload();}catch{$('reset-status').textContent='Reset failed: browser storage is unavailable.';}};
  $('undo-reset').hidden=!storage?.getItem(dailyProgress.BACKUP_KEY);
  $('undo-reset').onclick=()=>{const b=JSON.parse(storage.getItem(dailyProgress.BACKUP_KEY));if(b.legacy)storage.setItem('rarer.home.v1',b.legacy);if(b.daily){storage.setItem(dailyProgress.SAVE_KEY,b.daily);location.reload();}else $('reset-status').innerHTML='Your previous sample save has been restored.';};
  window.addEventListener('storage',e=>{if(e.key===dailyProgress.SAVE_KEY){const data=JSON.parse(e.newValue||'null');if(data?.resetId!==progress.resetId)location.reload();}});
  setInterval(()=>{if(!busy&&(stage==='home'||stage==='result')&&utcDay()>edition.date)location.reload();},30000);
}
