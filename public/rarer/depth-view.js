// Spelunkle Depths page: pick a layer, then name something that lives there.
import {loadDaily,edition,selectCategories,dailyNumber} from './edition.js?v=cea0b2abe3a6';
import {iconSvg,categoryIcon} from './icons.js?v=cea0b2abe3a6';
import {updateModes,recordFinds,recordBest} from './modes-store.js?v=cea0b2abe3a6';
import {LAYERS,MAX_MISSES,layerIndex,layerRanges,newDig,attempt,bankDig,cartPoints,digPoints,digDone,depthShare,loadDepth,saveDepth} from './depth.js?v=cea0b2abe3a6';

const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n.toLocaleString('en-US');
const ART='./assets/one-more-swing/';
const GEMS=['rocks','ore','amethyst','amethyst','diamond'];
let storage;try{storage=window.localStorage;}catch{}
document.querySelectorAll('[data-icon]').forEach(el=>el.insertAdjacentHTML('afterbegin',iconSvg(el.dataset.icon)));
const root=$('depth');
const say=text=>{$('announcement').textContent=text;};
const lower=name=>name.replace(/^(An?) /,(_,a)=>a.toLowerCase()+' ');

try{await loadDaily();}catch(error){root.innerHTML='<h1>Couldn’t load today’s digs.</h1><p>Please reload to try again.</p>';throw error;}
const day=edition.date,number=dailyNumber(day),cats=selectCategories(edition.catalog,day);
let state=loadDepth(storage,day),selected=null,note=null;
const current=()=>state.digs[state.ci]||(state.digs[state.ci]=newDig());
const persist=()=>saveDepth(storage,state);
render();

function steps(){
 return '<ol class="depth-steps" aria-label="Today’s three digs">'+cats.map((c,i)=>{
  const dig=state.digs[i],done=digDone(dig);
  return `<li class="${i===state.ci?'is-current':''}${done?' is-done':''}"${i===state.ci?' aria-current="step"':''}><span class="depth-step-icon">${categoryIcon(c)}</span><span class="depth-step-name">${esc(c.label)}</span><small>${done?fmt(digPoints(dig))+' pts':'Dig '+(i+1)}</small></li>`;
 }).join('')+'</ol>';
}

function strata(cat,dig){
 const done=digDone(dig);
 return '<ol class="strata" role="radiogroup" aria-label="Choose a depth">'+layerRanges(cat).map((layer,i)=>{
  const find=dig.finds.find(f=>f.layer===i),wrong=dig.guesses.filter(g=>!g.hit&&g.layer===i);
  const active=selected===i&&!find&&!done;
  const range=layer.from?`#${layer.from}–${layer.to}`:'no answers';
  return `<li class="stratum stratum--${layer.id}${find?' is-found':''}${active?' is-selected':''}">`
   +`<button type="button" class="stratum-button" role="radio" aria-checked="${active}" data-layer="${i}"${find||done?' disabled':''} aria-label="${layer.name}, ranks ${range}, ${layer.points} points${find?', found '+esc(find.name):''}">`
   +`<span class="stratum-name">${layer.name}</span><span class="stratum-range">${range}</span>`
   +`<span class="stratum-points">${find?`<img src="${ART}v11/${GEMS[i]}.png" alt=""><span>${esc(find.name)}</span>`:'+'+layer.points}</span>`
   +(wrong.length?`<span class="stratum-misses">${wrong.map(g=>`<span class="stratum-miss">${esc(g.name)} #${g.rank}</span>`).join('')}</span>`:'')
   +`</button>${active?'<span class="depth-mole" aria-hidden="true"></span>':''}</li>`;
 }).join('')+'</ol>';
}

function controls(cat,dig){
 const layer=selected===null?null:LAYERS[selected],cart=cartPoints(dig);
 const misses=Array.from({length:MAX_MISSES},(_,i)=>`<i class="${i<dig.misses?'used':''}"></i>`).join('');
 return `<form class="depth-form" id="depth-form"><label for="depth-answer">${layer?`Name ${esc(lower(cat.name))} for the <strong>${layer.name}</strong> layer`:'Tap a layer to choose how deep to dig'}</label>`
  +`<div class="depth-answer-row"><input id="depth-answer" autocomplete="off" autocapitalize="words" spellcheck="false" enterkeyhint="go" placeholder="${layer?'Type an answer…':'Pick a layer first'}"${layer?'':' disabled'}>`
  +`<button class="btn btn--primary depth-dig" aria-label="Dig"${layer?'':' disabled'}>${iconSvg('ui-submit')}</button></div></form>`
  +`<p class="message${note?.kind==='miss'?' error':''}${note?.kind==='found'?' success':''}" id="depth-message">${note?note.html:'Each layer pays once. Three misses and the cave falls in.'}</p>`
  +`<div class="depth-cart"><span><strong>${fmt(cart)}</strong> pts in the cart</span><span class="depth-misses" role="img" aria-label="${dig.misses} of ${MAX_MISSES} misses">${misses}</span></div>`
  +`<button type="button" class="btn btn--secondary depth-bank" id="depth-bank"${dig.finds.length?'':' disabled'}>${iconSvg('ui-climb-out')} Climb out · keep ${fmt(cart)}</button>`;
}

function examples(cat,dig){
 const missing=LAYERS.map((_,i)=>i).filter(i=>!dig.finds.some(f=>f.layer===i));
 if(!missing.length)return '';
 return '<p class="depth-examples-title">Where you could have dug:</p><ul class="depth-examples">'+missing.map(i=>{
  const pool=cat.entries.filter(e=>layerIndex(e.rarity)===i),entry=pool[Math.floor(pool.length/2)];
  return entry?`<li><strong>${LAYERS[i].name}:</strong> ${esc(entry.name)} (#${entry.rank})</li>`:'';
 }).join('')+'</ul>';
}

function summary(cat,dig){
 const last=state.ci===2,count=dig.finds.length;
 const title=dig.caved?'Cave-in! Half the cart spilled.':count===LAYERS.length?'Every layer found!':'Safely out of the mine.';
 return `<section class="card depth-summary" aria-labelledby="depth-summary-title"><h2 id="depth-summary-title" tabindex="-1">${title}</h2>`
  +`<p class="depth-summary-points"><strong>${fmt(digPoints(dig))}</strong> points from ${count} ${count===1?'find':'finds'}</p>`
  +examples(cat,dig)
  +`<button type="button" class="btn btn--primary" id="depth-next">${last?'See results':'Next category'}</button></section>`;
}

function rules(){
 return `<details class="depth-rules"><summary>How Depths works</summary><ul>`
  +`<li>Every answer is ranked by how often people look it up. Surface holds the top 10%, then Shallow, Deep and Abyss, and Legendary holds the rarest 15%.</li>`
  +`<li>Tap a layer, then name an answer you think lives there. Each layer shows which ranks belong to it.</li>`
  +`<li>Right layer: treasure worth 10, 20, 40, 80 or 150 points. Each layer pays once.</li>`
  +`<li>Wrong layer: the answer is shown where it really lives, and rocks fall. Three misses cave in and spill half your cart.</li>`
  +`<li>Climb out any time to keep your cart. Unknown and repeated answers cost nothing.</li></ul></details>`;
}

function render(){
 if(state.ci>=3)return results();
 const cat=cats[state.ci],dig=current(),done=digDone(dig);
 root.innerHTML=`<p class="eyebrow">Depths · Spelunkle #${number}</p><h1>${esc(cat.name)}</h1>${steps()}`
  +`<p class="depth-hook">Choose a depth, then name something that belongs there.</p>`
  +strata(cat,dig)+(done?summary(cat,dig):controls(cat,dig))+rules();
 root.querySelectorAll('.stratum-button').forEach(button=>button.onclick=()=>{
  selected=Number(button.dataset.layer);note=null;render();$('depth-answer')?.focus({preventScroll:true});
 });
 const form=$('depth-form');
 if(form)form.onsubmit=event=>{event.preventDefault();swing($('depth-answer').value);};
 if($('depth-bank'))$('depth-bank').onclick=()=>{
  state.digs[state.ci]=bankDig(current());persist();selected=null;note=null;
  say('Climbed out with '+digPoints(current())+' points.');render();$('depth-summary-title')?.focus();
 };
 if($('depth-next'))$('depth-next').onclick=()=>{
  state.ci++;selected=null;note=null;persist();render();
  window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 };
}

function swing(text){
 if(selected===null||!text.trim())return;
 const cat=cats[state.ci],layer=LAYERS[selected],result=attempt(cat,current(),selected,text);
 if(result.kind==='unknown')note={kind:'miss',html:'Not recognized for this category. Check the spelling. No penalty.'};
 else if(result.kind==='ambiguous')note={kind:'miss',html:'More than one match. Use the full name. No penalty.'};
 else if(result.kind==='repeat')note={kind:'miss',html:esc(result.entry.name)+' was already dug up. No penalty.'};
 else if(result.kind==='claimed')note={kind:'miss',html:layer.name+' already paid out. Pick another layer.'};
 else{
  state.digs[state.ci]=result.dig;
  updateModes(storage,s=>recordFinds(s,cat.id,[result.entry.name]));
  const where=`${esc(result.entry.name)} is #${result.entry.rank} of ${cat.entries.length}`;
  if(result.kind==='found'){note={kind:'found',html:`${where}: ${layer.name}. +${layer.points}`};selected=null;}
  else note={kind:'miss',html:`${where}, which is ${LAYERS[result.actual].name}, not ${layer.name}. Rocks fall! (${result.dig.misses}/${MAX_MISSES})`};
  persist();
 }
 say(note.html.replace(/<[^>]+>/g,''));
 render();
 if(digDone(current()))$('depth-summary-title')?.focus();
 else $('depth-answer')?.focus({preventScroll:true});
}

function results(){
 const total=state.digs.reduce((sum,dig)=>sum+(dig?digPoints(dig):0),0),share=depthShare(number,cats,state.digs);
 const touch=!!navigator.share&&matchMedia('(pointer:coarse)').matches;
 root.innerHTML=`<p class="eyebrow">Depths · Spelunkle #${number} complete</p><h1>${fmt(total)} points</h1>`
  +'<ul class="depth-results">'+cats.map((c,i)=>{
   const dig=state.digs[i]||newDig();
   return `<li><span class="depth-step-icon">${categoryIcon(c)}</span><span class="depth-result-name">${esc(c.label)}</span>`
    +`<span class="depth-result-gems">${LAYERS.map((layer,k)=>dig.finds.some(f=>f.layer===k)?`<img src="${ART}v11/${GEMS[k]}.png" alt="${layer.name}" title="${layer.name}">`:'').join('')}${dig.caved?'<span class="depth-cavein">cave-in</span>':''}</span>`
    +`<strong>${fmt(digPoints(dig))}</strong></li>`;
  }).join('')+'</ul>'
  +`<label class="depth-share-label" for="depth-share">Your result</label><textarea id="depth-share" class="depth-share" readonly rows="6">${esc(share)}</textarea>`
  +`<button type="button" class="btn btn--primary depth-copy" id="depth-copy">${iconSvg(touch?'ui-share':'ui-copy')} ${touch?'Share':'Copy result'}</button>`
  +`<p class="message">New categories at 00:00 UTC. <a href="./">Play classic Spelunkle</a></p>`+rules();
 $('depth-copy').onclick=async()=>{
  const button=$('depth-copy');
  try{
   if(touch)await navigator.share({text:share});
   else{await navigator.clipboard.writeText(share);button.textContent='Copied!';say('Result copied.');setTimeout(()=>{if(button.isConnected)button.innerHTML=iconSvg('ui-copy')+' Copy result';},2000);}
  }catch{$('depth-share').select();}
 };
 if(!state.recorded){updateModes(storage,s=>recordBest(s,'depths',total).state);state.recorded=true;persist();}
}
