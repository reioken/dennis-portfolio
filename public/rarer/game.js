import {treasureValue,findValues,baseScore,settlement,challenges} from './rewards.js?v=8b851d4060c4';
import {rewardReceipt,bonusSummary,playReveal,clearReveal,showToast,comboIcon} from './rewards-view.js?v=8b851d4060c4';
import {mountWelcome} from './welcome.js?v=8b851d4060c4';
import {visualGuide} from './how-to.js?v=8b851d4060c4';
import {categories,tier,score as oldScore,assess,missed,shareText,rankOf} from './core.js?v=8b851d4060c4';
import {MineScene} from './scene.js?v=8b851d4060c4';
import {BurrowView} from './burrow-view.js?v=8b851d4060c4';
import {findFor} from './feedback.js?v=8b851d4060c4';
import {mineLayout} from './geology.js?v=8b851d4060c4';
import * as legacyProgress from './progress.js?v=8b851d4060c4';
import * as dailyProgress from './daily-progress.js?v=8b851d4060c4';
import {edition,loadDaily,useDay,utcDay,selectCategories,dailyNumber,dayForNumber,FIRST_DAY} from './edition.js?v=8b851d4060c4';
import {pointsLeft,takePenalty,dailyShare} from './risk.js?v=8b851d4060c4';
import {loadModes,updateModes,recordFinds,recordBest} from './modes-store.js?v=8b851d4060c4';
import {openQuickMode} from './quick-modes.js?v=8b851d4060c4';
import {openAlbum} from './album.js?v=8b851d4060c4';
const $=id=>document.getElementById(id),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search);
// Dig modes are URL-driven: ?mode=free|deep|climb (&cat=id). Past dailies use ?day=YYYY-MM-DD.
const mode=['free','deep','climb'].includes(params.get('mode'))?params.get('mode'):null;
const reverse=mode==='climb';
const modeNames={free:'Free Dig',deep:'Deep Mine',climb:'Climb Up'},modeIcons={free:'⛏',deep:'⤓',climb:'⤒'};
let archiveDay=/^\d{4}-\d{2}-\d{2}$/.test(params.get('day')||'')?params.get('day'):null;
const helpGuide=$('help-guide');if(helpGuide)helpGuide.innerHTML=visualGuide({help:true});
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const scene=new MineScene($('mine'),reduced);scene.slow=()=>$('slow').checked;
const burrow=new BurrowView($('burrow'),scene);
if($('help-open')){
  const openHelp=()=>{if(!$('help').open)$('help').showModal();};
  $('help-open').onclick=openHelp;
  $('help-close').onclick=$('help-done').onclick=()=>$('help').close();
}
if(scene.hillside&&!mode&&!archiveDay)mountWelcome();
const wantsDaily=scene.hillside&&!params.has('sample');
if(wantsDaily){try{await loadDaily();}catch(error){$('panel').innerHTML='<h1>Couldn’t load today’s digs.</h1><p>Please reload to try again.</p>';throw error;}}
if(archiveDay&&(!wantsDaily||mode||archiveDay<FIRST_DAY||archiveDay>=utcDay()))archiveDay=null;
const catalogCategories=wantsDaily?edition.catalog.categories:[];
const randomCategory=except=>{const pool=catalogCategories.filter(c=>c.id!==except?.id);return pool[Math.floor(Math.random()*pool.length)];};
let practiceCategory=!mode||!wantsDaily?null:mode==='deep'?randomCategory():catalogCategories.find(c=>c.id===params.get('cat'))||null;
if(practiceCategory)categories.splice(0,categories.length,practiceCategory);
const deep={level:1,total:0};let bestNote='';
const score=wantsDaily?chain=>baseScore(chain,reverse):oldScore;
const value=rarity=>wantsDaily?treasureValue(rarity):rarity;
const fmt=points=>points.toLocaleString('en-US');
const rankText=name=>'#'+rankOf(categories[ci],name)+' of '+categories[ci].entries.length;
const {newRun,loadProgress,saveProgress,recordDiscovery,settleRound,homeProfile}=wantsDaily?dailyProgress:legacyProgress;
const runKey=()=>wantsDaily?edition.date:globalThis.crypto?.randomUUID?.()??Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
let storage;try{storage=window.localStorage;}catch{}
const loaded=loadProgress(storage,runKey());
let progress=loaded.state,saveOk=loaded.ok;
if(wantsDaily&&!mode){
  if(archiveDay){useDay(archiveDay);progress.run={...(progress.days[archiveDay]||newRun(archiveDay)),archive:true};}
  else if(progress.run.day!==edition.date)useDay(progress.run.day);
  // A run saved before the category catalog changed can hold answers from other categories.
  // Start that day afresh under a new id; points already banked at home are kept.
  const r=progress.run,foreign=(chain,i)=>(chain||[]).some(a=>!categories[i]||rankOf(categories[i],a[0])===null);
  if(foreign(r.chain,r.ci)||(r.results||[]).some((x,i)=>foreign(x?.chain,i))){const day=archiveDay||utcDay();useDay(day);progress.run={...newRun(day),id:day+':catalog-v2',...(archiveDay?{archive:true}:{})};}
}
if(mode&&wantsDaily)progress.run={...newRun(edition.date),id:'practice'};
let {id:runId,ci,stage,chain,results,failed}=progress.run;
let mistakes=progress.run.mistakes||0,lost=progress.run.lost||0,cargo=progress.run.cargo||[];
const haulPoints=()=>wantsDaily?pointsLeft(chain,lost,reverse):score(chain);
const bankedPoints=()=>results[ci]?.points??haulPoints();
const potentialBank=()=>wantsDaily?settlement(chain,lost,false,mistakes,reverse).points:score(chain);
let busy=true,ready=false,autoplay=false;
const game=document.querySelector('.game');
function announce(text){$('announcement').textContent=text;}
function status(text){$('motion-status').textContent=text;}
function homeCaption(){return 'Your home · '+homeProfile(progress).total.toLocaleString('en-US')+' points';}
function homeLabel(){
  const home=homeProfile(progress);
  $('home-total').textContent=home.total.toLocaleString('en-US')+' total points';
  const label=mode?modeNames[mode]+' · Doesn’t count toward the daily':archiveDay?'Archive · Rarer #'+dailyNumber(edition.date)+' · Saved on this device':'Rarer #'+dailyNumber(edition.date)+' · '+(home.streak?home.streak+' day streak · ':'')+'Saved on this device';
  $('save-status').textContent=saveOk?(wantsDaily?label:scene.hillside?'Sample edition · Saved on this device':'Saved on this device · Sample answers'):'Saving unavailable · Keep this tab open';
  $('save-status').classList.toggle('error',!saveOk);
  $('collection-count').textContent=progress.legendary.length;
  $('burrow-open').disabled=!ready;
}
function persist(){
  if(mode){homeLabel();return;}
  progress.run={id:runId,ci,stage,chain,results,failed,...(wantsDaily?{day:edition.date,mistakes,lost,cargo}:{}),...(archiveDay?{archive:true}:{})};
  const saved=saveProgress(storage,progress);if(saved.conflict){location.reload();return;}progress=saved.state;saveOk=saved.ok;homeLabel();
}
// Practice modes keep their own records and never touch the daily pile or streak.
function recordPractice(points,caveIn){
  if(mode==='deep'){
    deep.total+=points;const before=loadModes(storage).best.deep;
    updateModes(storage,s=>recordBest(recordBest(s,'deep',deep.total).state,'deep-level',deep.level).state);
    bestNote=!Number.isFinite(before)||deep.total>before?(caveIn?'New best run!':'On track for a new best.'):'Best run: '+fmt(before)+' points';return;
  }
  const key=mode+':'+categories[ci].id,before=loadModes(storage).best[key];
  updateModes(storage,s=>recordBest(s,key,points).state);
  bestNote=!Number.isFinite(before)||points>before?'New best for '+categories[ci].label+'!':'Best: '+fmt(before)+' points';
}
function settle(ending){
  stage=ending;const reward=wantsDaily?settlement(chain,lost,ending==='bust',mistakes,reverse):null;results[ci]={name:categories[ci].label,chain:[...chain],bust:ending==='bust',...(wantsDaily?{points:reward.points,reward,mistakes}:{})};
  if(mode){recordPractice(reward.points,ending==='bust');return;}
  progress=settleRound(progress,runId,ci,chain,ending==='bust',{lost,mistakes,cargo,archive:!!archiveDay});persist();
}
function showFind(answer){
  const f=findFor(answer[1]),el=$('find-feedback');el.className='find-feedback '+f.className;
  el.innerHTML='<img src="./assets/one-more-swing/'+scene.meta.images[f.asset]+'" alt=""><span><strong>'+f.tier+' find'+(f.level===3?'!':'')+'</strong><small>'+escape(answer[0])+' · '+(wantsDaily?rankText(answer[0])+' · '+findValues(chain,reverse).at(-1):value(answer[1]))+' points · '+f.name.toLowerCase()+'</small></span>';
}
function hideFind(){$('find-feedback').className='find-feedback';$('find-feedback').replaceChildren();}
function lock(value){busy=value;document.querySelectorAll('#controls button,.test-row button').forEach(b=>b.disabled=value||autoplay);const input=$('answer');if(input)input.readOnly=value||autoplay;}
function chainRows(){const values=wantsDaily?findValues(chain,reverse):chain.map(a=>value(a[1]));return '<ol class="chain">'+chain.map((a,i)=>{const t=tier(a[1]);return '<li><strong>'+escape(a[0])+'</strong><small class="'+t.className+'">'+t.mark+' '+(wantsDaily?'#'+rankOf(categories[ci],a[0])+' · ':'')+t.label+'</small><span class="rating '+t.className+'">'+values[i]+'<em>pts</em></span></li>';}).join('')+'</ol>';}
const modeRule=()=>({free:'Dig any category as often as you like. It doesn’t count toward the daily.',deep:'Bank a dig to go one level deeper, with a new category. Slips carry over, and one cave-in ends the run.',climb:'Start with the rarest answer you know, then name a more looked-up one each time.'})[mode];
const quietLink=(href,text)=>'<a class="quiet-button mode-link" href="'+href+'">'+text+'</a>';
function modesMenu(){
  const items=[['higher-lower','⇅','Higher or Lower','Tap the more looked-up one'],['free','⛏','Free Dig','Any category, any time'],['deep','⤓','Deep Mine','One endless run'],['bullseye','◎','Bullseye','Hit the target rank'],['climb','⤒','Climb Up','Rarest first, then more common'],['blitz','⏱','Top 10 Blitz','The top 10 in 90 seconds'],['archive','▦','Archive','Replay past dailies'],['album','❏','Collection','Every answer you’ve found']];
  const inner=(icon,name,hint)=>'<span class="mode-icon" aria-hidden="true">'+icon+'</span><strong>'+name+'</strong><small>'+hint+'</small>';
  return '<section class="modes-menu" aria-labelledby="modes-title"><h2 id="modes-title">More ways to play</h2><div class="modes-grid">'+items.map(([id,icon,name,hint])=>modeNames[id]?'<a class="mode-card" href="?mode='+id+'">'+inner(icon,name,hint)+'</a>':'<button class="mode-card" data-mode="'+id+'">'+inner(icon,name,hint)+'</button>').join('')+'</div></section>';
}
function bindModes(){document.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{const id=button.dataset.mode;if(id==='archive')openArchive();else if(id==='album')openAlbum({catalog:edition.catalog,storage});else openQuickMode(id,{catalog:edition.catalog,storage});});}
function openArchive(){
  let dialog=$('archive');if(!dialog){dialog=document.createElement('dialog');dialog.id='archive';dialog.setAttribute('aria-labelledby','archive-title');document.body.append(dialog);}
  const rows=[];
  for(let n=dailyNumber(utcDay())-1;n>=1;n--){
    const day=dayForNumber(n),run=progress.days[day],points=(run?.results||[]).reduce((s,r)=>s+(r?.points||0),0);
    rows.push('<li><a href="?day='+day+'"><strong>Rarer #'+n+'</strong><span>'+selectCategories(edition.catalog,day).map(c=>c.icon+' '+escape(c.label)).join(' · ')+'</span><small>'+(run?.stage==='result'?'✓ '+fmt(points)+' points':run&&run.stage!=='home'?'In progress':'Not played yet')+'</small></a></li>');
  }
  dialog.innerHTML='<div class="dialog-top"><h2 id="archive-title">Archive</h2><button data-close aria-label="Close archive">×</button></div><p class="quiet">Replay any past daily. Points count toward your home; the streak only counts days played on the day.</p>'+(rows.length?'<ol class="archive-list">'+rows.join('')+'</ol>':'<p>No past dailies yet. Come back tomorrow.</p>');
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.showModal();
}
function renderModeHome(){
  const best=loadModes(storage).best,back=quietLink('./','← Today’s digs');
  if(!practiceCategory){
    $('panel').innerHTML='<p class="eyebrow">'+modeNames[mode]+'</p><h1>Pick a category</h1><p class="guide-intro">'+modeRule()+'</p><div class="category-picker">'+catalogCategories.map(c=>{const b=best[mode+':'+c.id];return '<a class="picker-item" href="?mode='+mode+'&cat='+encodeURIComponent(c.id)+'"><span class="category-icon" aria-hidden="true">'+c.icon+'</span><strong>'+escape(c.label)+'</strong><small>'+(Number.isFinite(b)?'Best '+fmt(b):c.entries.length+' answers')+'</small></a>';}).join('')+'</div>';
    $('controls').innerHTML=back;return;
  }
  const b=mode==='deep'?best.deep:best[mode+':'+practiceCategory.id];
  $('panel').innerHTML='<p class="eyebrow">'+modeNames[mode]+(mode==='deep'?' · Level '+deep.level:'')+'</p><h1>'+escape(practiceCategory.name)+'</h1><p class="guide-intro">'+modeRule()+'</p><p class="mode-best">'+(Number.isFinite(b)?'Best: '+fmt(b)+' points'+(mode==='deep'&&Number.isFinite(best['deep-level'])?' · deepest level '+best['deep-level']:''):'No best score yet')+'</p>';
  $('controls').innerHTML='<button class="primary" id="start">Start digging</button>'+(mode==='deep'?'':quietLink('?mode='+mode,'Other category'))+back;
  $('start').onclick=start;
}
function nextLabel(){return mode==='deep'?(stage==='bust'?'Start a new run':'Go deeper · Level '+(deep.level+1)):mode?'Dig again':ci===2?(archiveDay?'See the result':'See today’s result'):'Next category';}
function modeLinks(){return mode?(mode==='deep'?'':quietLink('?mode='+mode,'Other category'))+quietLink('./','← Today’s digs'):'';}
function render(){
  const focused=document.activeElement?.id==='answer';
  game.className='game '+stage;
  $('progress').textContent=mode?modeNames[mode]:stage==='home'?'Three digs a day':stage==='result'?'Daily result':(ci+1)+' of 3';
  homeLabel();
  const rarer=reverse?'more looked-up':'rarer';
  if(stage==='home'){
    if(mode)renderModeHome();
    else{
      $('panel').innerHTML='<p class="eyebrow">A fresh little adventure</p><h1>Today’s three digs</h1><ul class="categories">'+categories.map(c=>'<li><span class="category-icon">'+c.icon+'</span>'+c.name+'</li>').join('')+'</ul><p class="rule">Name an answer. Then a rarer one.<br>Climb out whenever you like.</p>';
      $('controls').innerHTML='<button class="primary" id="start">Start digging</button><p class="message">No timer. Unknown answers cost nothing.</p>'+(wantsDaily?(archiveDay?quietLink('./','← Today’s digs'):'')+modesMenu():'');
      $('start').onclick=start;
    }
  }else if(stage==='result'){
    const total=results.reduce((n,r)=>n+(wantsDaily?r.points:score(r.chain)),0);
    $('panel').innerHTML='<p class="eyebrow">'+(wantsDaily?'Rarer #'+dailyNumber(edition.date)+' complete':'All three digs complete')+'</p><h1>That’s a good day’s digging.</h1><div class="result-score">'+total.toLocaleString('en-US')+'</div><p class="subtitle">Total points</p>'+bonusSummary(results)+'<pre class="share" id="share-text"></pre>';
    $('share-text').textContent=wantsDaily?dailyShare(results,edition.date):shareText(results);
    $('controls').innerHTML='<button class="primary" id="copy">Copy result</button><p class="message" id="copy-status">One square for every successful answer.</p>'+(wantsDaily?modesMenu():'');
    $('copy').onclick=copy;
  }else{
    $('panel').innerHTML='<p class="eyebrow">'+(mode?modeNames[mode]+(mode==='deep'?' · Level '+deep.level:''):'Dig '+(ci+1)+' of 3')+'</p><h1>'+categories[ci].name+'</h1><p class="subtitle">'+(stage==='play'?(chain.length?'Find a '+rarer+' answer.':reverse?'Name something rare to start.':'Name something very common to start.'):stage==='banked'?(busy?'Bringing your haul home…':'Safely back at the surface.'):reverse?'That answer was too rare.':'That answer was too common.')+'</p>'+(chain.length?chainRows():'<p class="empty">An empty cart. Your first answer.</p>');
    if(stage==='play'){
      $('controls').innerHTML='<div class="scoreline"><strong>'+fmt(haulPoints())+' points</strong><small>'+(mode==='deep'?'Run '+fmt(deep.total)+' · ':'')+chain.length+' '+(chain.length===1?'find':'finds')+'</small></div><form class="answer-form" id="answer-form"><label class="sr" for="answer">'+categories[ci].name+'</label><input id="answer" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="go" placeholder="'+(chain.length?(reverse?'A more looked-up answer…':'A rarer answer…'):reverse?'Start with a rare answer…':'Start with a very common answer…')+'"><button class="submit" aria-label="Submit answer">→</button></form><p class="message" id="message">Unknown answers are free.</p><button class="primary" id="bank">Climb out · '+fmt(potentialBank())+'</button>';
      if(!chain.length){$('answer').value='';$('answer').removeAttribute('value');}
      $('answer-form').onsubmit=e=>{e.preventDefault();submit($('answer').value);};$('bank').onclick=bank;
      if(focused)$('answer').focus({preventScroll:true});
    }else if(stage==='banked'){
      const missing=missed(categories[ci],chain,reverse);
      const exact=!wantsDaily&&ci===0&&chain.at(-1)?.[1]===88;
      const missLabel=a=>wantsDaily?rankText(a[0]):value(a[1])+' pts';
      $('controls').innerHTML='<h2 class="ending-title">'+fmt(bankedPoints())+' points banked</h2>'+(mode==='deep'?'<p class="mode-best">Run total: '+fmt(deep.total)+' points</p>':'')+(mode&&mode!=='deep'&&bestNote?'<p class="mode-best">'+escape(bestNote)+'</p>':'')+rewardReceipt(results[ci]?.reward)+'<p class="ending-sub">'+(exact?'You were 2 answers away from the top.':missing.length?(reverse?'More looked-up answers you missed.':'Rarer answers you missed.'):reverse?'You reached the most looked-up answer in this category.':'You reached the rarest answer in this category.')+'</p><ul class="missed">'+missing.map(a=>'<li><span class="'+tier(a[1]).className+'">'+tier(a[1]).mark+' '+escape(a[0])+'</span><strong>'+missLabel(a)+'</strong></li>').join('')+'</ul><button class="primary" id="next">'+nextLabel()+'</button>'+modeLinks();
      $('next').onclick=next;
    }else{
      $('controls').innerHTML='<h2 class="ending-title">Chain ended. '+fmt(haulPoints())+' points kept.</h2><p class="ending-sub">'+escape(failed[0])+' '+failed[1]+' is not rarer than '+escape(chain.at(-1)[0])+' '+chain.at(-1)[1]+'.<br>'+fmt(score(chain))+' points</p><button class="primary" id="next">'+nextLabel()+'</button>';
      if(wantsDaily){
        const why=failed&&chain.length?escape(failed[0])+' was '+(reverse?'less':'more')+' looked-up than '+escape(chain.at(-1)[0])+'. ':'';
        $('controls').innerHTML=mode==='deep'
          ?'<h2 class="ending-title">Cave-in at level '+deep.level+'.</h2><p class="ending-sub">'+why+'The run is over.</p><p class="mode-best"><strong>'+fmt(deep.total)+' points</strong> · '+escape(bestNote)+'</p><button class="primary" id="next">'+nextLabel()+'</button>'+modeLinks()
          :'<h2 class="ending-title">Cave-in! '+fmt(bankedPoints())+' points saved.</h2><p class="ending-sub">'+why+'Half the cart spilled'+(reverse?'':' and combos were lost')+'.'+(mode?'':'<br>Everything already at home is safe.')+'</p>'+(mode&&bestNote?'<p class="mode-best">'+escape(bestNote)+'</p>':'')+'<button class="primary" id="next">'+nextLabel()+'</button>'+modeLinks();
      }
      $('next').onclick=next;
    }
  }

  if(scene.hillside){
    $('category-steps').innerHTML=mode
      ?'<ol class="dig-steps mode-steps"><li aria-current="step"><strong><span class="dig-icon">'+modeIcons[mode]+'</span>'+modeNames[mode]+'</strong><small>'+(mode==='deep'?'Level '+deep.level+' · '+fmt(deep.total)+' points':practiceCategory?escape(practiceCategory.label):'Pick a category')+'</small></li></ol>'
      :'<ol class="dig-steps">'+categories.map((c,i)=>'<li'+(stage!=='result'&&i===ci?' aria-current="step"':'')+(results[i]?' class="done"':'')+'><strong><span class="dig-icon">'+c.icon+'</span>'+escape(c.name)+'</strong><small>'+(results[i]?'✓ Complete':'Dig '+(i+1))+'</small></li>').join('')+'</ol>';
    if(stage==='home'&&!mode)$('panel').innerHTML='<p class="eyebrow">'+(wantsDaily?(archiveDay?'Archive · ':'')+'Rarer #'+dailyNumber(edition.date)+(archiveDay?'':' · Three new digs every day'):'Three new digs every day')+'</p><h1>Go rarer. Go longer.</h1><p class="guide-intro">Choose your first answer. Then go a little rarer each time.</p>'+visualGuide({risk:wantsDaily});
    if(stage==='play')$('controls').insertAdjacentHTML('afterbegin','<h2 class="answer-prompt">'+(chain.length?'Find '+escape(categories[ci].name.replace(/^An? /,'a '+rarer+' ')):'Name '+escape(categories[ci].name.replace(/^An? /,'a ')))+'.</h2>');
    if(stage==='result'&&!wantsDaily){$('controls').insertAdjacentHTML('beforeend','<button class="quiet-button" id="play-again">Play another sample</button>');$('play-again').onclick=reset;}
  }
  if(wantsDaily){
    if(stage==='play'){
      const risk=document.createElement('div');risk.className='riskline';risk.innerHTML='<span class="mistake-dots" aria-hidden="true">'+[0,1].map(i=>'<i class="'+(i<mistakes?'used':'')+'">'+(i<mistakes?'!':'·')+'</i>').join('')+'</span><span>'+(mistakes?'Warning used':'No slips yet')+'</span><small>'+(mistakes?'Next slip caves in':'First slip is a warning')+'</small>';
      $('controls').insertBefore(risk,$('answer-form'));
      const last=chain.at(-1),size=categories[ci].entries.length;
      $('message').innerHTML=last?'Beat <strong>#'+rankOf(categories[ci],last[0])+'</strong> of '+size+'. Name something '+(reverse?'more':'less')+' looked-up than '+escape(last[0])+'.':(reverse?'Start with the rarest answer you know. ':'Start with something everyone knows. ')+'All '+size+' answers are ranked by how often people look them up.';
      const secured=reverse?[]:challenges(chain,mistakes).filter(b=>b.earned);
      if(secured.length)$('bank').textContent='Climb out · '+fmt(potentialBank())+' · '+secured.map(b=>comboIcon(b.id)).join('');
    }
    if(stage==='result')$('controls').insertAdjacentHTML('beforeend','<p class="next-day">'+(utcDay()>edition.date?'<button class="primary" id="new-day">Start today’s digs</button>':'All three digs complete. New categories at 00:00 UTC.')+'</p>');
    if($('new-day'))$('new-day').onclick=()=>{location.href='./';};
    if($('test-bust'))$('test-bust').textContent='Try a less rare answer';
    if($('restart'))$('restart').hidden=true;
    bindModes();
  }
  $('scene-caption').textContent=['home','banked','bust','result'].includes(stage)?homeCaption():'';
  if(scene.hillside)$('scene-caption').textContent='';
  lock(busy);const list=document.querySelector('.chain');if(list)list.scrollTop=list.scrollHeight;scene.draw();
}
async function start(){
  if(busy||(mode&&!practiceCategory))return;if(wantsDaily&&!mode&&!archiveDay&&stage==='home'&&utcDay()>edition.date){location.reload();return;}clearReveal($('scene-frame'));const leavingHome=scene.atHome;chain=[];failed=null;if(mode!=='deep')mistakes=0;lost=0;cargo=[];stage='play';hideFind();scene.setHome(homeProfile(progress));scene.reset();busy=true;persist();render();status('Down the ladder, then over to the wall.');
  if(leavingHome){scene.state.x=scene.doorX();scene.state.cam=scene.homeCamera(true);scene.pose('walk',-1);await scene.tween({x:mineLayout.shaftX,cam:scene.ladderCamera()},550);}
  else if(scene.hillside){scene.pose('walk');await scene.tween({x:mineLayout.shaftX,cam:scene.ladderCamera()},220);}
  scene.homeFocus=false;scene.pose('climb');await scene.tween({y:scene.floor,viewY:0,cam:scene.ladderCamera()},640);scene.pose('walk');await scene.tween({x:scene.standX(),cam:scene.cameraFor(scene.state.edge)},390);scene.pose('idle');lock(false);status('Ready for the first answer.');announce('Name '+categories[ci].name.toLowerCase()+'.');
}
async function submit(text){
  if(busy||stage!=='play')return;const result=assess(categories[ci],chain,text,reverse);
  const say=message=>{$('message').textContent=message;$('message').classList.add('error');announce(message);};
  if(result.kind==='ambiguous'){say('More than one match. Add the year or use the full name. No penalty.');return;}
  if(result.kind==='unknown'){say(wantsDaily?'Not recognized for this category. Check the spelling. No penalty.':'Not in this sample’s answer list. No penalty.');return;}
  if(result.kind==='repeat'){say(result.answer[0]+' is already in your cart. No penalty.');return;}
  if(result.kind==='close'){$('answer').value='';say('So close! '+result.answer[0]+' is #'+result.rank+', just '+(reverse?'below ':'above ')+chain.at(-1)[0]+' (#'+result.last+'). No penalty. Go '+(reverse?'more common':'rarer')+'.');return;}
  if(result.kind==='bust'){if(wantsDaily)await mistake(result);else await bust(result.answer);return;}
  const beforeBonuses=challenges(chain,mistakes).filter(b=>b.earned).map(b=>b.id);
  const answer=result.answer;chain.push(answer);if(wantsDaily)cargo.push(answer);if(!mode)progress=recordDiscovery(progress,ci,answer);persist();
  if(wantsDaily)updateModes(storage,s=>recordFinds(s,categories[ci].id,[answer[0]]));
  // Commit scoring before the animation. Visual timing never decides game outcomes.
  busy=true;render();scene.pose('swing');status('Swing → crack → discovery → into the cart.');
  await scene.hold(scene.meta.animations.swing.impactAt??250);scene.strike(answer[1]);await scene.hold(80);
  const wallX=scene.state.edge;scene.state.crack=false;scene.state.edge+=32;scene.releaseFind(answer,wallX);showFind(answer);
  await scene.hold(100);scene.pose('walk');await scene.tween({x:scene.standX(),cam:scene.cameraFor(scene.state.edge)},390);
  scene.pose('idle');await scene.hold(170);scene.landFind();
  if(answer[1]>=95){scene.pose('celebrate');await scene.hold(610);}else await scene.hold(150);
  const secured=wantsDaily&&!reverse?challenges(chain,mistakes).filter(b=>b.earned&&!beforeBonuses.includes(b.id)):[];
  for(const b of secured)showToast($('scene-frame'),comboIcon(b.id)+' '+b.name+' secured',reduced.matches);
  scene.pose('idle');hideFind();lock(false);status(answer[0]+' accepted'+(wantsDaily?' at '+rankText(answer[0]):'')+'. '+fmt(haulPoints())+' points in your cart.');announce(answer[0]+' accepted'+(wantsDaily?', '+rankText(answer[0]):'')+'. '+fmt(haulPoints())+' points. '+secured.map(b=>b.name+' secured. Climb out to collect it at home.').join(' '));
}
async function bank(){
  if(busy||stage!=='play')return;lock(true);hideFind();document.activeElement?.blur();settle('banked');render();
  await bringHome();
  scene.state.revealCount=missed(categories[ci],chain,reverse).length;
  if(scene.state.revealCount){
    $('scene-caption').textContent='Look what was just ahead.';scene.homeFocus=false;
    await scene.tween({reveal:1,cam:scene.revealCamera(),viewY:0},400);await scene.hold(900);
    scene.homeFocus=true;await scene.tween({cam:scene.homeCamera(true),viewY:scene.homeViewY(),reveal:0},400);
  }
  lock(false);render();status(bankedPoints()+' points brought home. '+homeProfile(progress).total+' total points. Missed answers do not count.');announce(bankedPoints()+' points banked and brought home.');
}
async function mistake({answer,rank,last}){
  lock(true);hideFind();document.activeElement?.blur();failed=answer;const previous=chain.at(-1);
  const lostCombos=reverse?[]:challenges(chain,mistakes).filter(b=>b.earned);
  const penalty=takePenalty(chain,lost,mistakes,cargo,reverse);({mistakes,lost,cargo}=penalty);
  // Persist the loss before motion so refresh cannot undo a penalty.
  if(penalty.ended)settle('bust');else persist();
  render();scene.pose('swing');await scene.hold(scene.meta.animations.swing.impactAt??250);scene.strike(0,true);
  const why=answer[0]+' is #'+rank+', '+(reverse?'less':'more')+' looked-up than '+previous[0]+' (#'+last+').';
  if(!penalty.ended){
    scene.pose('recoil');await scene.hold(420);scene.pose('idle');lock(false);render();
    $('message').textContent=why+' Warning! The next slip caves in.';$('message').classList.add('error');announce($('message').textContent);return;
  }
  $('scene-caption').textContent='Cave-in! Half the haul spills.';
  await scene.spillHaul(penalty.spill,penalty.amount,false);
  await scene.hold(300);await bringHome('cavein',lostCombos);lock(false);render();announce('Cave-in. '+why+' Half this dig’s treasure spilled. '+fmt(bankedPoints())+' points saved.');
}
async function bust(answer){
  lock(true);hideFind();document.activeElement?.blur();failed=answer;settle('bust');scene.pose('swing');await scene.hold(scene.meta.animations.swing.impactAt??250);scene.state.bust=true;scene.strike(0,true);scene.pose('recoil');await scene.hold(420);scene.pose('idle');render();$('scene-caption').textContent='Too common. Your finds are safe.';await scene.hold(450);
  await bringHome();lock(false);status('Chain ended. All '+chain.length+' finds and '+fmt(haulPoints())+' points brought home.');announce('Chain ended. '+fmt(haulPoints())+' points kept and brought home.');
}
async function bringHome(kind='bank',lostCombos=[]){
  const caveIn=kind==='cavein',empty=caveIn&&!scene.haul.length;
  status(empty?'Back to the ladder with an empty cart.':'Back to the ladder with your cart.');$('scene-caption').textContent=caveIn?'Let’s save what’s left.':'Let’s bring it all home.';
  scene.pose('walk',-1);await scene.tween({x:mineLayout.shaftX,cam:scene.ladderCamera(),viewY:0},650);
  scene.takeHaul();scene.pose('climb');status('Every find goes in the backpack.');await scene.hold(250);
  scene.homeFocus=true;await scene.tween({y:scene.surface,viewY:scene.homeViewY()},950);
  scene.pose('walk');status('A little walk home.');await scene.tween({x:scene.doorX(),cam:scene.homeCamera(true)},Math.max(650,(scene.doorX()-mineLayout.shaftX)*5));
  scene.pose('idle');$('scene-caption').textContent=empty?'Home, empty-handed.':chain.length?'A little more for the pile.':'Home safe.';
  if(!empty){status('Adding the haul to the outdoor pile.');await scene.depositHaul(homeProfile(progress));}
  // Combos are collected at home: stamp them in, then celebrate.
  const reward=wantsDaily?results[ci]?.reward:null;
  if(reward)await playReveal($('scene-frame'),reward,{reduced:reduced.matches,caveIn,lostCombos,speed:scene.slow()?.5:1});
  else if(empty)await scene.hold(550);
  if(!caveIn){scene.pose('celebrate');await scene.hold(550);}
  scene.pose('idle');$('scene-caption').textContent=homeCaption();
}
async function next(){
  if(busy)return;
  if(mode==='deep'){
    if(stage==='bust'){location.href='?mode=deep';return;}
    deep.level++;practiceCategory=randomCategory(practiceCategory);categories.splice(0,categories.length,practiceCategory);results=[];await start();return;
  }
  if(mode){results=[];await start();return;}
  if(ci===2){clearReveal($('scene-frame'));stage='result';persist();render();return;}ci++;await start();
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


if($('dev-controls'))$('dev-controls').hidden=!params.has('preview');

if(wantsDaily){
  $('reset-progress').onclick=()=>{if(busy)return;try{dailyProgress.resetProgress(storage);location.reload();}catch{$('reset-status').textContent='Reset failed: browser storage is unavailable.';}};
  $('undo-reset').hidden=!storage?.getItem(dailyProgress.BACKUP_KEY);
  $('undo-reset').onclick=()=>{const b=JSON.parse(storage.getItem(dailyProgress.BACKUP_KEY));if(b.legacy)storage.setItem('rarer.home.v1',b.legacy);if(b.daily){storage.setItem(dailyProgress.SAVE_KEY,b.daily);location.reload();}else $('reset-status').innerHTML='Your previous sample save has been restored.';};
  window.addEventListener('storage',e=>{if(e.key===dailyProgress.SAVE_KEY&&!mode){const data=JSON.parse(e.newValue||'null');if(data?.resetId!==progress.resetId)location.reload();}});
  if(!mode&&!archiveDay)setInterval(()=>{if(!busy&&(stage==='home'||stage==='result')&&utcDay()>edition.date)location.reload();},30000);
}
