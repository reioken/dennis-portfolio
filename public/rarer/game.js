import {treasureValue,findValues,baseScore,settlement,challenges} from './rewards.js?v=0b45fd07d30d';
import {rewardReceipt,bonusSummary,playReveal,clearReveal,showToast,comboGlyph} from './rewards-view.js?v=0b45fd07d30d';
import {mountWelcome,welcomeSeen} from './welcome.js?v=0b45fd07d30d';
import {visualGuide} from './how-to.js?v=0b45fd07d30d';
import {categories,tier,score as oldScore,assess,missed,shareText,rankOf} from './core.js?v=0b45fd07d30d';
import {MineScene} from './scene.js?v=0b45fd07d30d';
import {BurrowView} from './burrow-view.js?v=0b45fd07d30d';
import {findFor} from './feedback.js?v=0b45fd07d30d';
import {mineLayout} from './geology.js?v=0b45fd07d30d';
import * as legacyProgress from './progress.js?v=0b45fd07d30d';
import * as dailyProgress from './daily-progress.js?v=0b45fd07d30d';
import {edition,loadDaily,useDay,utcDay,selectCategories,dailyNumber,dayForNumber,FIRST_DAY} from './edition.js?v=0b45fd07d30d';
import {pointsLeft,takePenalty,dailyShare} from './risk.js?v=0b45fd07d30d';
import {loadModes,updateModes,recordFinds,recordBest} from './modes-store.js?v=0b45fd07d30d';
import {openQuickMode} from './quick-modes.js?v=0b45fd07d30d';
import {openAlbum} from './album.js?v=0b45fd07d30d';
import {modeIcon,categoryIcon,iconSvg} from './icons.js?v=0b45fd07d30d';
import {sheetHead,openSheet,closeSheet,bindSheetControls} from './sheet.js?v=0b45fd07d30d';
import {openStats,statsFrom,bestStreak,msUntilReset,countdownText,countdownDuration,resetLocalTime} from './stats.js?v=0b45fd07d30d';
import {openSettings,bootSettings,undoImport} from './settings.js?v=0b45fd07d30d';
import {pickerSection,pickerLink,bindPicker,openPicker} from './modes-picker.js?v=0b45fd07d30d';
import {loadCoach,nextTip,coachHtml,bindCoach} from './coach.js?v=0b45fd07d30d';
const $=id=>document.getElementById(id),escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search);
// Dig modes are URL-driven: ?mode=free|deep|climb (&cat=id). Past dailies use ?day=YYYY-MM-DD.
const mode=['free','deep','climb'].includes(params.get('mode'))?params.get('mode'):null;
const reverse=mode==='climb';
const modeNames={free:'Free Dig',deep:'Deep Mine',climb:'Climb Up'};
let archiveDay=/^\d{4}-\d{2}-\d{2}$/.test(params.get('day')||'')?params.get('day'):null;
// Static markup asks for its icons by key; fill them once at boot.
document.querySelectorAll('[data-icon]').forEach(el=>el.insertAdjacentHTML('afterbegin',iconSvg(el.dataset.icon)));
const helpGuide=$('help-guide');if(helpGuide)helpGuide.innerHTML=visualGuide({help:true});
const backLink=()=>quietLink('./','<span class="combo-glyph">'+iconSvg('ui-back')+'</span>Today’s digs');
// One motion answer for the whole app. Settings can force it either way
// (data-motion), otherwise the device decides. scene.js takes this in place of
// the media query it used to get: it reads `.matches` and subscribes to
// `change`, and the MutationObserver below redraws when the setting changes.
const prefersReduced=matchMedia('(prefers-reduced-motion: reduce)');
// It stands in for a MediaQueryList, so it forwards listeners to the real one.
const reduced={
  get matches(){const set=document.documentElement.dataset.motion;return set==='reduce'||(set!=='full'&&prefersReduced.matches);},
  addEventListener:(...args)=>prefersReduced.addEventListener(...args),
  removeEventListener:(...args)=>prefersReduced.removeEventListener(...args)
};
const scene=new MineScene($('mine'),reduced);scene.slow=()=>$('slow').checked;
const burrow=new BurrowView($('burrow'),scene);
if($('help-open')){
  bindSheetControls($('help'));
  $('help-open').onclick=()=>openSheet($('help'),{opener:$('help-open')});
  $('help-done').onclick=()=>closeSheet($('help'));
}
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
bootSettings(storage);
const loaded=loadProgress(storage,runKey());
let progress=loaded.state,saveOk=loaded.ok;
// First visit only: never once a dig has been finished, and never twice.
if(scene.hillside&&!mode&&!archiveDay&&!welcomeSeen(storage)&&!progress.rounds.length)mountWelcome(storage);
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
// A dig saved mid-swing, and a day already finished, both land on the Today card:
// one screen, one button. Clicking it drops back into the real stage.
let homeView=wantsDaily&&!mode&&(stage==='play'||stage==='result');
let emojiFree=false,countdownTimer=null;
const game=document.querySelector('.game');
function announce(text){$('announcement').textContent=text;}
function status(text){$('motion-status').textContent=text;}
function homeCaption(){return 'Your home · '+homeProfile(progress).total.toLocaleString('en-US')+' points';}
function homeLabel(){
  const home=homeProfile(progress);
  $('home-total').textContent=home.total.toLocaleString('en-US')+' total points';
  const label=mode?modeNames[mode]+' · Doesn’t count toward the daily':archiveDay?'Archive · Spelunkle #'+dailyNumber(edition.date)+' · Saved in this browser':'Spelunkle #'+dailyNumber(edition.date)+' · '+(home.streak?home.streak+'-day streak · ':'')+'Saved in this browser';
  $('save-status').textContent=saveOk?(wantsDaily?label:'Saved in this browser'):'Saving unavailable · Keep this tab open';
  $('save-status').classList.toggle('error',!saveOk);
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
    bestNote=!Number.isFinite(before)||deep.total>before?(caveIn?'New best!':'On track for a new best.'):'Best: '+fmt(before)+' points';return;
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
// The tier mark (■ ◆ ✦ …) belongs to share text and data only. On screen a tier
// is a coloured dot beside its written label, so colour is never the only cue.
function chainRows(){const values=wantsDaily?findValues(chain,reverse):chain.map(a=>value(a[1]));return '<ol class="chain">'+chain.map((a,i)=>{const t=tier(a[1]);return '<li><strong>'+escape(a[0])+'</strong><small class="'+t.className+'"><span class="tier-dot" aria-hidden="true"></span>'+(wantsDaily?'#'+rankOf(categories[ci],a[0])+' · ':'')+t.label+'</small><span class="rating '+t.className+'">'+values[i]+'<em>pts</em></span></li>';}).join('')+'</ol>';}
const modeRule=()=>({free:'Dig any category as often as you like. It doesn’t count toward the daily.',deep:'Climb out to go one level deeper, with a new category. Slips carry over, and one cave-in ends it.',climb:'Start with the rarest answer you know, then name a more looked-up one each time.'})[mode];
const quietLink=(href,text)=>'<a class="quiet-button mode-link" href="'+href+'">'+text+'</a>';
// The picker is gated: one quiet link until the day is finished, the full list after.
function openMode(id,opener){
  if(id==='archive')openArchive(opener);
  else if(id==='album')openAlbum({catalog:edition.catalog,storage,opener});
  else openQuickMode(id,{catalog:edition.catalog,storage,opener});
}
function bindPickerRows(){
  bindPicker(document,{onSelect:openMode});
  const open=$('picker-open');
  if(open)open.onclick=()=>openPicker({opener:open,onSelect:openMode});
}
function openArchive(opener){
  let dialog=$('archive');if(!dialog){dialog=document.createElement('dialog');dialog.id='archive';dialog.className='sheet';dialog.setAttribute('aria-labelledby','archive-title');document.body.append(dialog);}
  const rows=[];
  for(let n=dailyNumber(utcDay())-1;n>=1;n--){
    const day=dayForNumber(n),run=progress.days[day],points=(run?.results||[]).reduce((s,r)=>s+(r?.points||0),0);
    rows.push('<li><a href="?day='+day+'"><strong>Spelunkle #'+n+'</strong><span>'+selectCategories(edition.catalog,day).map(c=>'<span class="archive-icon" aria-hidden="true">'+categoryIcon(c)+'</span>'+escape(c.label)).join(' · ')+'</span><small>'+(run?.stage==='result'?'<span class="combo-glyph">'+iconSvg('ui-check')+'</span> '+fmt(points)+' points':run&&run.stage!=='home'?'In progress':'Not played yet')+'</small></a></li>');
  }
  dialog.innerHTML=sheetHead('archive','Archive')+'<div class="sheet-body"><p class="quiet">Replay any past daily. Points count toward your home; the streak only counts days played on the day.</p>'+(rows.length?'<ol class="archive-list">'+rows.join('')+'</ol>':'<p>No past dailies yet. Come back tomorrow.</p>')+'</div>';
  bindSheetControls(dialog);openSheet(dialog,{opener});
}
function renderModeHome(){
  const best=loadModes(storage).best,back=backLink();
  if(!practiceCategory){
    $('panel').innerHTML='<p class="eyebrow">'+modeNames[mode]+'</p><h1>Pick a category</h1><p class="guide-intro">'+modeRule()+'</p><div class="category-picker">'+catalogCategories.map(c=>{const b=best[mode+':'+c.id];return '<a class="picker-item" href="?mode='+mode+'&cat='+encodeURIComponent(c.id)+'"><span class="category-icon" aria-hidden="true">'+categoryIcon(c)+'</span><strong>'+escape(c.label)+'</strong><small>'+(Number.isFinite(b)?'Best '+fmt(b):c.entries.length+' answers')+'</small></a>';}).join('')+'</div>';
    $('controls').innerHTML=back;return;
  }
  const b=mode==='deep'?best.deep:best[mode+':'+practiceCategory.id];
  $('panel').innerHTML='<p class="eyebrow">'+modeNames[mode]+(mode==='deep'?' · Level '+deep.level:'')+'</p><h1>'+escape(practiceCategory.name)+'</h1><p class="guide-intro">'+modeRule()+'</p><p class="mode-best">'+(Number.isFinite(b)?'Best: '+fmt(b)+' points'+(mode==='deep'&&Number.isFinite(best['deep-level'])?' · deepest level '+best['deep-level']:''):'No best score yet')+'</p>';
  $('controls').innerHTML='<div class="action-bar"><button class="btn btn--primary btn--block" id="start">Start digging</button></div>'
    +'<p class="action-note">'+modeNames[mode]+' — doesn’t count toward the daily.</p>'
    +(mode==='deep'?'':quietLink('?mode='+mode,'Other category'))+back;
  $('start').onclick=start;
}
function nextLabel(){return mode==='deep'?(stage==='bust'?'Start again':'Go deeper · Level '+(deep.level+1)):mode?'Dig again':ci===2?(archiveDay?'See the result':'See today’s result'):'Next category';}
function modeLinks(){return mode?(mode==='deep'?'':quietLink('?mode='+mode,'Other category'))+backLink():'';}

// ---- The countdown to 00:00 UTC ----
// It ticks once a second and lives outside every live region, so a screen reader
// is never interrupted by it. At zero it becomes the button to today's digs.
function stopCountdown(){if(countdownTimer){clearInterval(countdownTimer);countdownTimer=null;}}
function countdownTick(){
  const line=$('countdown-line');
  if(!line||!line.isConnected){stopCountdown();return;}
  const left=msUntilReset();
  if(left<=0||(wantsDaily&&utcDay()>edition.date)){
    stopCountdown();
    line.innerHTML='<button class="btn btn--primary btn--block" id="new-day">New digs are ready</button>';
    $('new-day').onclick=()=>{location.href='./';};
    return;
  }
  const time=$('countdown');
  if(time){time.textContent=countdownText(left);time.dateTime=countdownDuration(left);}
}
function startCountdown(){stopCountdown();countdownTick();countdownTimer=setInterval(countdownTick,1000);}
function countdownBlock(){
  const left=msUntilReset();
  return '<p class="countdown-line" id="countdown-line"><span class="combo-glyph">'+iconSvg('ui-countdown')+'</span> New digs in <time id="countdown" datetime="'+countdownDuration(left)+'">'+countdownText(left)+'</time><small>Resets at 00:00 UTC ('+resetLocalTime()+' your time)</small></p>';
}

// ---- Home: the Today card ----
// Fixed "Wed 16 Sep" in every locale: en-GB renders "Sept", en-US "Wed, Sep 16".
const WEEKDAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const dateLabel=day=>{const d=new Date(Date.parse(day+'T00:00:00Z'));return WEEKDAYS[d.getUTCDay()]+' '+d.getUTCDate()+' '+MONTHS[d.getUTCMonth()];};
const dayFinished=()=>[0,1,2].every(i=>results[i]);
const pendingDig=()=>[0,1,2].find(i=>!results[i]);
function digStatus(i){
  const done=results[i];
  if(done)return '<span class="row-points">'+(done.bust?'<span class="sr-only">Cave-in. </span><span class="combo-glyph" aria-label="Cave-in">'+iconSvg('ui-warning')+'</span>':'')+fmt(wantsDaily?done.points:score(done.chain))+' pts</span>';
  if(stage==='play'&&i===ci)return '<span class="chip chip--active">In progress</span>';
  return '<span class="chip">Not dug yet</span>';
}
function homePrimary(){
  if(dayFinished())return {label:'See results',action:'result'};
  if(stage==='play')return {label:'Continue: '+categories[ci].label,action:'continue'};
  const pending=pendingDig();
  if(pending)return {label:'Continue: '+categories[pending].label,action:'continue'};
  return {label:'Start digging',action:'start'};
}
function homeNote(action){
  if(action==='result')return countdownBlock();
  const streak=wantsDaily?homeProfile(progress).streak:0,left=msUntilReset();
  if(action==='continue')return '<p class="action-note">'+(streak?'Finish all three digs to keep your '+streak+'-day streak.':'Finish all three digs each day (UTC) to keep your streak.')+'</p>';
  if(streak&&left<3*3600000&&!archiveDay)return '<p class="action-note">'+Math.max(1,Math.round(left/3600000))+'h left to keep your streak.</p>';
  return '<p class="action-note">No timer. Unknown answers cost nothing.</p>';
}
function howItWorks(){
  return '<details class="how-it-works"'+(welcomeSeen(storage)?'':' open')+'><summary>How it works<span class="summary-mark" aria-hidden="true">'+iconSvg('ui-expand')+'</span></summary><div class="how-body"><p class="rule-sentence">Name an answer, then keep naming rarer ones. Two slips and the cave falls in.</p>'+visualGuide({risk:wantsDaily})+'</div></details>';
}
function renderToday(){
  const streak=wantsDaily?homeProfile(progress).streak:0,primary=homePrimary();
  const banner=archiveDay
    ?'<p class="banner"><span class="combo-glyph">'+iconSvg('mode-archive')+'</span>Archive · Spelunkle #'+dailyNumber(edition.date)+' — doesn’t count toward your streak.'+backLink()+'</p>'
    :'';
  $('panel').innerHTML='<section class="card today-card">'
    +(streak?'<p class="today-streak"><span class="combo-glyph">'+iconSvg('ui-streak')+'</span>'+streak+'-day streak</p>':'')
    +'<h1>'+(wantsDaily?'Spelunkle #'+dailyNumber(edition.date):'Spelunkle')+'</h1>'
    +(wantsDaily?'<p class="today-date">'+dateLabel(edition.date)+'</p>':'')
    +banner
    +'<ul class="today-list">'+categories.map((c,i)=>'<li class="list-row"><span class="row-icon" aria-hidden="true">'+categoryIcon(c)+'</span><span class="row-title">'+escape(c.label)+'</span>'+digStatus(i)+'</li>').join('')+'</ul>'
    +'</section>';
  $('controls').innerHTML='<div class="action-bar"><button class="btn btn--primary btn--block" id="start">'+escape(primary.label)+'</button></div>'
    +homeNote(primary.action)
    +howItWorks();
  $('after').innerHTML=wantsDaily?(dayFinished()?pickerSection():pickerLink()):'';
  $('start').onclick=()=>{
    if(primary.action==='start')return start();
    homeView=false;
    if(primary.action==='continue'&&stage!=='play'&&stage!=='banked'&&stage!=='bust')return start();
    render();
    if(stage==='play')$('answer')?.focus({preventScroll:true});
  };
  if(primary.action==='result')startCountdown();
}

// ---- Results ----
function rarestToday(){
  let best=null;
  results.forEach((r,i)=>{for(const a of r?.chain||[])if(!best||a[1]>best.rarity)best={name:a[0],rarity:a[1],ci:i};});
  if(!best)return null;
  const category=categories[best.ci];
  return {...best,category,label:category?.label||'',rank:wantsDaily&&category?rankOf(category,best.name):null,total:category?.entries?.length||null,tier:tier(best.rarity)};
}
const rarestBeat=()=>{const r=rarestToday();return r?.rank?'Beat #'+r.rank+' of '+r.total:'';};
const shareOutput=()=>wantsDaily
  ?dailyShare(results,edition.date,{emoji:!emojiFree,rarest:rarestBeat()})
  :shareText(results,mode?'Spelunkle · '+modeNames[mode]:'Spelunkle');
const canShare=text=>{try{return !!(navigator.share&&(!navigator.canShare||navigator.canShare({text})));}catch{return false;}};
function renderResult(){
  const total=results.reduce((n,r)=>n+(wantsDaily?r.points:score(r.chain)),0);
  const rolled=wantsDaily&&utcDay()>edition.date,rarest=rarestToday();
  const rows=results.map((r,i)=>'<li class="list-row"><span class="row-icon" aria-hidden="true">'+categoryIcon(categories[i])+'</span><span class="row-title">'+escape(r.name)+'<small class="row-meta">'+r.chain.length+' '+(r.chain.length===1?'find':'finds')+'</small></span>'+digStatus(i)+'</li>').join('');
  $('panel').innerHTML='<p class="eyebrow">'+(wantsDaily?'Spelunkle #'+dailyNumber(edition.date)+' complete':'All three digs complete')+'</p>'
    +'<h1>That’s a good day’s digging.</h1>'
    +'<p class="result-total">'+fmt(total)+'</p><p class="result-label">Total points</p>'
    +(rarest?'<section class="result-block" aria-labelledby="rarest-title"><h2 class="result-heading" id="rarest-title">Rarest find</h2><div class="card rarest-card"><span class="rarest-icon" aria-hidden="true">'+categoryIcon(rarest.category)+'</span><span class="rarest-body"><strong>'+escape(rarest.name)+'</strong><small>'+escape(rarest.label)+(rarest.rank?' · Beat #'+rarest.rank+' of '+rarest.total:'')+'</small></span><span class="chip chip--tier '+rarest.tier.className+'">'+rarest.tier.label+'</span></div></section>':'')
    +'<section class="result-block" aria-labelledby="digs-title"><h2 class="result-heading" id="digs-title">Your three digs</h2><ul class="result-rows">'+rows+'</ul>'+bonusSummary(results)+'</section>'
    +(wantsDaily?'<section class="result-block" aria-labelledby="streak-title"><h2 class="result-heading" id="streak-title">Streak</h2><ul class="streak-tiles"><li class="stat-tile"><span class="stat-label">Current streak</span><strong class="stat-value">'+homeProfile(progress).streak+'</strong></li><li class="stat-tile"><span class="stat-label">Best streak</span><strong class="stat-value">'+bestStreak(progress)+'</strong></li></ul></section>':'')
    +(wantsDaily?countdownBlock():'');
  $('controls').innerHTML='<div class="action-bar"><button class="btn '+(rolled?'btn--secondary':'btn--primary')+' btn--block" id="copy">'+(canShare(shareOutput())?'Share':'Copy result')+'</button></div>'
    +'<p class="message" id="copy-status">One square for every successful answer.</p>'
    +'<div class="share-options"><label><input type="checkbox" id="emoji-free"'+(emojiFree?' checked':'')+'> Emoji-free version</label></div>'
    +'<textarea class="share" id="share-text" readonly hidden aria-label="Your result, ready to copy"></textarea>';
  $('after').innerHTML=wantsDaily?pickerSection({prefix:'result-picker'}):'';
  $('share-text').value=shareOutput();
  $('copy').onclick=share;
  // Swap the text in place: re-rendering here would take the focus off the checkbox.
  $('emoji-free').onchange=event=>{emojiFree=event.target.checked;$('share-text').value=shareOutput();};
  if(wantsDaily)startCountdown();
}
// The rail's three numbers, shown beside the Today card at 960px and up.
function railStats(){
  if(!wantsDaily||mode)return '';
  const s=statsFrom(progress);
  return '<ul class="rail-stat-list">'+[['Current streak',s.currentStreak],['Best streak',s.bestStreak],['Days played',s.daysPlayed]]
    .map(([label,value])=>'<li class="stat-tile"><span class="stat-label">'+label+'</span><strong class="stat-value">'+fmt(value)+'</strong></li>').join('')+'</ul>';
}
// "More ways to dig" always sits below the controls, in one centred column at
// every width: Today card → canvas → how it works → modes.
function placeRail(){
  const node=$('rail-modes').firstElementChild;
  if(node)$('after').append(node);
}
// The tip due right now, if this is still the player's first dig.
function showCoach(){
  if(!wantsDaily||stage!=='play'||!$('answer-form'))return;
  $('controls').querySelector('.coach')?.remove();
  const tip=nextTip(loadCoach(storage),{stage:'play',chain:chain.length,mistakes,firstDig:!progress.rounds.length});
  if(!tip)return;
  $('answer-form').insertAdjacentHTML('beforebegin',coachHtml(tip));
  bindCoach($('controls'),storage,{onChange:()=>{showCoach();$('answer')?.focus({preventScroll:true});}});
}
function render(){
  const focused=document.activeElement?.id==='answer';
  // What the player sees, which is the Today card whenever homeView is set.
  const view=homeView?'home':stage;
  stopCountdown();
  $('after').replaceChildren();$('rail-modes').replaceChildren();
  game.className='game '+view;
  $('progress').textContent=mode?modeNames[mode]:view==='home'?'Today’s three digs':view==='result'?'Daily result':'Dig '+(ci+1)+' of 3';
  homeLabel();
  const rarer=reverse?'more looked-up':'rarer';
  if(view==='home'){
    if(mode)renderModeHome();
    else renderToday();
  }else if(view==='result'){
    renderResult();
  }else{
    $('panel').innerHTML='<p class="eyebrow">'+(mode?modeNames[mode]+(mode==='deep'?' · Level '+deep.level:''):'Dig '+(ci+1)+' of 3')+'</p><h1>'+categories[ci].name+'</h1><p class="subtitle">'+(stage==='play'?(chain.length?'Find a '+rarer+' answer.':reverse?'Name something rare to start.':'Name something very common to start.'):stage==='banked'?(busy?'Bringing your haul home…':'Safely back at the surface.'):reverse?'That answer was too rare.':'That answer was too common.')+'</p>'+(chain.length?chainRows():'<p class="empty">Nothing found yet. Name your first answer.</p>');
    if(stage==='play'){
      $('controls').innerHTML='<div class="scoreline"><strong>'+fmt(haulPoints())+' points</strong><small>'+(mode==='deep'?'Run '+fmt(deep.total)+' · ':'')+chain.length+' '+(chain.length===1?'find':'finds')+'</small></div><form class="answer-form" id="answer-form"><label class="sr-only" for="answer">'+categories[ci].name+'</label><input id="answer" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="go" placeholder="'+(chain.length?(reverse?'A more looked-up answer…':'A rarer answer…'):reverse?'Start with a rare answer…':'Start with a very common answer…')+'"><button class="submit" type="submit" aria-label="Submit answer">'+iconSvg('ui-submit')+'</button></form><p class="message" id="message">Unknown answers are free.</p><div class="action-bar"><button class="btn btn--secondary btn--block" id="bank">Climb out · '+fmt(potentialBank())+'</button></div>';
      if(!chain.length){$('answer').value='';$('answer').removeAttribute('value');}
      $('answer-form').onsubmit=e=>{e.preventDefault();submit($('answer').value);};$('bank').onclick=bank;
      if(focused)$('answer').focus({preventScroll:true});
    }else if(stage==='banked'){
      const missing=missed(categories[ci],chain,reverse);
      const exact=!wantsDaily&&ci===0&&chain.at(-1)?.[1]===88;
      const missLabel=a=>wantsDaily?rankText(a[0]):value(a[1])+' pts';
      $('controls').innerHTML='<h2 class="ending-title">'+fmt(bankedPoints())+' points brought home</h2>'+(mode==='deep'?'<p class="mode-best">Deep Mine total: '+fmt(deep.total)+' points</p>':'')+(mode&&mode!=='deep'&&bestNote?'<p class="mode-best">'+escape(bestNote)+'</p>':'')+rewardReceipt(results[ci]?.reward)+'<p class="ending-sub">'+(exact?'You were 2 answers away from the top.':missing.length?(reverse?'More looked-up answers you missed.':'Rarer answers you missed.'):reverse?'You reached the most looked-up answer in this category.':'You reached the rarest answer in this category.')+'</p><ul class="missed">'+missing.map(a=>'<li><span>'+escape(a[0])+'</span><span class="chip chip--tier '+tier(a[1]).className+'">'+tier(a[1]).label+'</span><strong>'+missLabel(a)+'</strong></li>').join('')+'</ul><div class="action-bar"><button class="btn btn--primary btn--block" id="next">'+nextLabel()+'</button></div>'+modeLinks();
      $('next').onclick=next;
    }else{
      $('controls').innerHTML='<h2 class="ending-title">Dig ended. '+fmt(haulPoints())+' points kept.</h2><p class="ending-sub">'+escape(failed[0])+' '+failed[1]+' is not rarer than '+escape(chain.at(-1)[0])+' '+chain.at(-1)[1]+'.<br>'+fmt(score(chain))+' points</p><div class="action-bar"><button class="btn btn--primary btn--block" id="next">'+nextLabel()+'</button></div>';
      if(wantsDaily){
        const why=failed&&chain.length?escape(failed[0])+' was '+(reverse?'less':'more')+' looked-up than '+escape(chain.at(-1)[0])+'. ':'';
        $('controls').innerHTML=mode==='deep'
          ?'<h2 class="ending-title"><span class="combo-glyph">'+iconSvg('ui-warning')+'</span> Cave-in at level '+deep.level+'.</h2><p class="ending-sub">'+why+'The run is over.</p><p class="mode-best"><strong>'+fmt(deep.total)+' points</strong> · '+escape(bestNote)+'</p><div class="action-bar"><button class="btn btn--primary btn--block" id="next">'+nextLabel()+'</button></div>'+modeLinks()
          :'<h2 class="ending-title"><span class="combo-glyph">'+iconSvg('ui-warning')+'</span> Cave-in — '+fmt(bankedPoints())+' points saved.</h2><p class="ending-sub">'+why+'Half the haul spilled'+(reverse?'':' and combos were lost')+'.'+(mode?'':'<br>Everything already home is safe.')+'</p>'+(mode&&bestNote?'<p class="mode-best">'+escape(bestNote)+'</p>':'')+'<div class="action-bar"><button class="btn btn--primary btn--block" id="next">'+nextLabel()+'</button></div>'+modeLinks();
      }
      $('next').onclick=next;
    }
  }

  if(scene.hillside){
    $('category-steps').innerHTML=mode
      ?'<ol class="dig-steps mode-steps"><li aria-current="step"><strong><span class="dig-icon">'+modeIcon(mode)+'</span>'+modeNames[mode]+'</strong><small>'+(mode==='deep'?'Level '+deep.level+' · '+fmt(deep.total)+' points':practiceCategory?escape(practiceCategory.label):'Pick a category')+'</small></li></ol>'
      :'<ol class="dig-steps">'+categories.map((c,i)=>'<li'+(view!=='result'&&i===ci?' aria-current="step"':'')+(results[i]?' class="done"':'')+'><strong><span class="dig-icon">'+categoryIcon(c)+'</span>'+escape(c.name)+'</strong><small>'+(results[i]?'<span class="combo-glyph">'+iconSvg('ui-check')+'</span> Complete':'Dig '+(i+1))+'</small></li>').join('')+'</ol>';
    if(view==='play')$('controls').insertAdjacentHTML('afterbegin','<h2 class="answer-prompt">'+(chain.length?'Find '+escape(categories[ci].name.replace(/^An? /,'a '+rarer+' ')):'Name '+escape(categories[ci].name.replace(/^An? /,'a ')))+'.</h2>');
    if(view==='result'&&!wantsDaily){$('controls').insertAdjacentHTML('beforeend','<button class="quiet-button" id="play-again">Play another sample</button>');$('play-again').onclick=reset;}
  }
  if(wantsDaily){
    if(view==='play'){
      const risk=document.createElement('div');risk.className='riskline';risk.innerHTML='<span class="mistake-dots" aria-hidden="true">'+[0,1].map(i=>'<i class="'+(i<mistakes?'used':'')+'">'+(i<mistakes?'!':'·')+'</i>').join('')+'</span><span>'+(mistakes?'<span class="combo-glyph">'+iconSvg('ui-warning')+'</span> Warning used':'No slips yet')+'</span><small>'+(mistakes?'Next slip caves in':'First slip is a warning')+'</small>';
      $('controls').insertBefore(risk,$('answer-form'));
      const last=chain.at(-1),size=categories[ci].entries.length;
      $('message').innerHTML=last?'Beat <strong>#'+rankOf(categories[ci],last[0])+'</strong> of '+size+'. Name something '+(reverse?'more':'less')+' looked-up than '+escape(last[0])+'.':(reverse?'Start with the rarest answer you know. ':'Start with something everyone knows. ')+'All '+size+' answers are ranked by how often people look them up.';
      const secured=reverse?[]:challenges(chain,mistakes).filter(b=>b.earned);
      if(secured.length){
        $('bank').innerHTML='Climb out · '+fmt(potentialBank())+' <span class="combo-glyph">'+secured.map(b=>comboGlyph(b.id)).join('')+'</span>';
        $('bank').setAttribute('aria-label','Climb out with '+fmt(potentialBank())+' points, including '+secured.map(b=>b.name).join(', '));
      }
      showCoach();
    }
    if($('test-bust'))$('test-bust').textContent='Try a less rare answer';
    if($('restart'))$('restart').hidden=true;
    bindPickerRows();
  }
  $('rail-stats').innerHTML=view==='home'||view==='result'?railStats():'';
  placeRail();
  $('scene-caption').textContent=['home','banked','bust','result'].includes(view)?homeCaption():'';
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
  if(result.kind==='repeat'){say(result.answer[0]+' is already one of your finds. No penalty.');return;}
  if(result.kind==='close'){$('answer').value='';say('So close! '+result.answer[0]+' is #'+result.rank+', just '+(reverse?'below ':'above ')+chain.at(-1)[0]+' (#'+result.last+'). No penalty. Go '+(reverse?'more common':'rarer')+'.');return;}
  if(result.kind==='bust'){if(wantsDaily)await mistake(result);else await bust(result.answer);return;}
  const beforeBonuses=challenges(chain,mistakes).filter(b=>b.earned).map(b=>b.id);
  const answer=result.answer;chain.push(answer);if(wantsDaily)cargo.push(answer);if(!mode)progress=recordDiscovery(progress,ci,answer);persist();
  if(wantsDaily)updateModes(storage,s=>recordFinds(s,categories[ci].id,[answer[0]]));
  // Commit scoring before the animation. Visual timing never decides game outcomes.
  busy=true;render();scene.pose('swing');status('Swing, crack, discovery, into the cart.');
  await scene.hold(scene.meta.animations.swing.impactAt??250);scene.strike(answer[1]);await scene.hold(80);
  const wallX=scene.state.edge;scene.state.crack=false;scene.state.edge+=32;scene.releaseFind(answer,wallX);showFind(answer);
  await scene.hold(100);scene.pose('walk');await scene.tween({x:scene.standX(),cam:scene.cameraFor(scene.state.edge)},390);
  scene.pose('idle');await scene.hold(170);scene.landFind();
  if(answer[1]>=95){scene.pose('celebrate');await scene.hold(610);}else await scene.hold(150);
  const secured=wantsDaily&&!reverse?challenges(chain,mistakes).filter(b=>b.earned&&!beforeBonuses.includes(b.id)):[];
  for(const b of secured)showToast($('scene-frame'),b.name+' secured',reduced.matches);
  scene.pose('idle');hideFind();lock(false);status(answer[0]+' accepted'+(wantsDaily?' at '+rankText(answer[0]):'')+'. '+fmt(haulPoints())+' points so far.');announce(answer[0]+' accepted'+(wantsDaily?', '+rankText(answer[0]):'')+'. '+fmt(haulPoints())+' points. '+secured.map(b=>b.name+' secured. Climb out to collect it at home.').join(' '));
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
  lock(false);render();status(bankedPoints()+' points brought home. '+homeProfile(progress).total+' total points. Missed answers do not count.');announce(bankedPoints()+' points brought home.');
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
  await bringHome();lock(false);status('Dig ended. All '+chain.length+' finds and '+fmt(haulPoints())+' points brought home.');announce('Dig ended. '+fmt(haulPoints())+' points kept and brought home.');
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
function reset(){if(busy||wantsDaily)return;({id:runId,ci,stage,chain,results,failed}=newRun(runKey()));hideFind();persist();scene.setHome(homeProfile(progress));scene.reset();render();status('A fresh practice run. Your home and Collection are kept.');}
async function sample(){
  if(busy||autoplay)return;autoplay=true;
  if(stage!=='play'){reset();await start();}
  for(const answer of (wantsDaily?[0,25,50,75].map(n=>categories[ci].entries.find(a=>a.rarity>=n)).filter(Boolean).map(a=>[a.name,a.rarity]):categories[ci].answers)){if(answer[1]>(chain.at(-1)?.[1]??-1)){await submit(answer[0]);await scene.hold(200);}}
  autoplay=false;lock(false);
}
async function testBust(){if(busy||autoplay)return;if(wantsDaily){if(stage!=='play')await start();if(!chain.length)await sample();await submit(categories[ci].entries[0].name);return;}reset();await sample();await submit('France');}
async function share(){
  const button=$('copy'),text=shareOutput(),label=button.innerHTML;
  // The native sheet where there is one. Dismissing it is not a failure.
  if(canShare(text)){
    try{await navigator.share({text});return;}
    catch(error){if(error?.name==='AbortError')return;}
  }
  try{
    await navigator.clipboard.writeText(text);
    button.innerHTML='<span class="combo-glyph">'+iconSvg('ui-check')+'</span> Copied!';
    $('copy-status').textContent='Paste it anywhere.';
    announce('Copied to clipboard.');
    button.focus({preventScroll:true});
    setTimeout(()=>{if(button.isConnected)button.innerHTML=label;},2000);
  }catch{
    // No clipboard permission: show the text so it can be selected by hand.
    const block=$('share-text');
    if(block){block.hidden=false;block.value=text;block.focus({preventScroll:true});block.select();}
    $('copy-status').textContent='Press and hold to copy.';
  }
}
$('sample').onclick=sample;$('test-bust').onclick=testBust;$('restart').onclick=reset;
$('burrow-open').onclick=()=>burrow.open(homeProfile(progress));
// Undo the last reset, from the backup resetProgress writes before it erases.
function undoLastReset(){
  try{
    const backup=JSON.parse(storage?.getItem(dailyProgress.BACKUP_KEY)||'null');
    if(!backup)return;
    if(backup.legacy)storage.setItem('rarer.home.v1',backup.legacy);
    if(backup.daily){storage.setItem(dailyProgress.SAVE_KEY,backup.daily);location.reload();}
    else announce('Your previous save has been restored.');
  }catch{announce('Your previous save could not be restored.');}
}
// Your stats and Settings both open from the header. The theme lives in Settings now.
if($('stats-open'))$('stats-open').onclick=()=>openStats({progress,catalog:edition.catalog,opener:$('stats-open')});
if($('settings-open'))$('settings-open').onclick=()=>openSettings({
  storage,opener:$('settings-open'),
  onReset:opener=>{if(!busy)openSheet($('confirm-reset'),{opener});},
  onUndoReset:undoLastReset
});
// The canvas picks its colours up from the page, so a theme or contrast change
// from Settings has to reach it. No art or animation is touched.
if(scene.hillside)new MutationObserver(()=>{scene.draw();burrow.draw();}).observe(document.documentElement,{attributeFilter:['data-theme','data-contrast','data-motion']});
// One collection: the footer opens the album.
if($('collection-open'))$('collection-open').onclick=()=>openAlbum({catalog:edition.catalog,storage,opener:$('collection-open')});
// The footer also reaches the archive, and names the edition it is showing.
if($('archive-open')){
  if(wantsDaily)$('archive-open').onclick=()=>openArchive($('archive-open'));
  else $('archive-open').hidden=true;
}
if($('footer-edition'))$('footer-edition').textContent=wantsDaily?'Spelunkle #'+dailyNumber(edition.date)+' · v'+edition.date.slice(0,7).replace('-','.'):'Spelunkle';
function syncKeyboard(){
  const compact=innerWidth<600&&(window.visualViewport?.height??innerHeight)<550&&document.activeElement?.id==='answer';
  document.body.classList.toggle('keyboard',compact);
  if(compact){const list=document.querySelector('.chain');if(list)list.scrollTop=list.scrollHeight;}
}
if(window.visualViewport)visualViewport.addEventListener('resize',syncKeyboard);
document.addEventListener('focusin',event=>{if(event.target.id==='answer')syncKeyboard();});
document.addEventListener('focusout',()=>setTimeout(()=>{if(document.activeElement?.id!=='answer')document.body.classList.remove('keyboard');},80));
render();
try{await scene.load();scene.restore(progress.run,homeProfile(progress));ready=true;lock(false);render();status(stage==='home'?'Ready. Every finished dig adds to your home.':'Welcome back. Your dig and discoveries are saved.');}catch(error){status('The artwork couldn’t load. Check your connection and reload.');console.error(error);}
const preview=$('swing-preview');let previewVisible=false,previewFrame=0;
const previewLoop=time=>{if(!previewVisible||document.hidden)return;scene.drawShowcase(preview,time);if(!reduced.matches)previewFrame=requestAnimationFrame(previewLoop);};
if(preview)new IntersectionObserver(entries=>{previewVisible=entries[0].isIntersecting;cancelAnimationFrame(previewFrame);if(previewVisible&&ready)previewFrame=requestAnimationFrame(previewLoop);}).observe(preview);
document.addEventListener('visibilitychange',()=>{
  cancelAnimationFrame(previewFrame);
  if(document.hidden)return;
  // A backgrounded tab can miss ticks, and the UTC day may have rolled over.
  countdownTick();
  if(previewVisible&&ready)previewFrame=requestAnimationFrame(previewLoop);
});


if($('dev-controls'))$('dev-controls').hidden=!params.has('preview');

if(wantsDaily){
  // Erasing everything always takes a second, deliberate step. Both the reset and
  // its undo now live in Settings; this only wires the confirm sheet they open.
  bindSheetControls($('confirm-reset'));
  $('confirm-reset-cancel').onclick=()=>closeSheet($('confirm-reset'));
  $('confirm-reset-go').onclick=()=>{try{dailyProgress.resetProgress(storage);location.reload();}catch{closeSheet($('confirm-reset'));announce('Reset failed: browser storage is unavailable.');}};
  window.addEventListener('storage',e=>{if(e.key===dailyProgress.SAVE_KEY&&!mode){const data=JSON.parse(e.newValue||'null');if(data?.resetId!==progress.resetId)location.reload();}});
  if(!mode&&!archiveDay)setInterval(()=>{if(!busy&&(stage==='home'||stage==='result')&&utcDay()>edition.date)location.reload();},30000);
}
