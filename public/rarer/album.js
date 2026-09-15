// Collection album: every answer found in any mode, per category, with unfound ranks as silhouettes.
// The helpers at the top are pure (no DOM) so they can be tested in Node.
import {tier} from './core.js?v=804e5dbc4495';
import {loadModes} from './modes-store.js?v=804e5dbc4495';
import {categoryIcon} from './icons.js?v=804e5dbc4495';

const art='./assets/one-more-swing/v11/';
// Same materials as the dig feedback (feedback.js findFor): stone, ore, amethyst, diamond.
export const gems={common:'rocks',uncommon:'ore',unusual:'ore',rare:'amethyst','very-rare':'amethyst',legendary:'diamond'};
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=n=>n.toLocaleString('en-US');
const entriesOf=category=>Array.isArray(category?.entries)?category.entries:[];

// Catalog entries whose exact name was collected. Unknown or duplicate names are ignored.
export function foundEntries(category,names){
 const wanted=new Set(names instanceof Set?names:Array.isArray(names)?names:[]);
 return entriesOf(category).filter(entry=>wanted.has(entry.name));
}

export function albumSummary(catalog,modesState){
 const collection=modesState?.collection||{};
 const categories=(catalog?.categories||[]).map(category=>{
  const found=foundEntries(category,Object.hasOwn(collection,category.id)?collection[category.id]:[]);
  const rarest=found.reduce((best,entry)=>best===null||entry.rarity>best?entry.rarity:best,null);
  return {id:category.id,label:category.label,icon:category.icon,found:found.length,total:entriesOf(category).length,rarestTier:rarest===null?null:tier(rarest)};
 });
 return {found:categories.reduce((n,c)=>n+c.found,0),total:categories.reduce((n,c)=>n+c.total,0),categories};
}

// Tiles in rank order (1 = most looked-up). Unfound tiles carry only their rank, never the name.
export function categoryTiles(category,foundNames,{rarestFirst=false}={}){
 const found=new Set(foundNames instanceof Set?foundNames:Array.isArray(foundNames)?foundNames:[]);
 const rows=entriesOf(category).map((entry,index)=>({entry,index,rank:Number.isFinite(entry.rank)?entry.rank:index+1}));
 rows.sort((a,b)=>a.rank-b.rank||a.index-b.index);
 if(rarestFirst)rows.reverse();
 return rows.map(({entry,rank})=>{
  if(!found.has(entry.name))return {rank,found:false};
  const t=tier(entry.rarity);
  return {rank,found:true,name:entry.name,rarity:entry.rarity,tier:t.className,tierLabel:t.label,color:t.color,gem:gems[t.className]};
 });
}

// ---- Dialog ----
let context=null;
const defaultStorage=()=>{try{return globalThis.localStorage;}catch{return null;}};
const bar=(found,total,label)=>`<span class="album-progress" role="progressbar" aria-label="${escape(label)}: ${found} of ${total} found" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${found}"><span style="--p:${total?(found/total*100).toFixed(2):0}%"></span></span>`;
const gem=t=>t?`<img class="album-gem" src="${art}${gems[t.className]}.png" alt="" width="16" height="16"><span class="album-sr">, rarest find ${escape(t.label)}</span>`:'<span class="album-gem empty" aria-hidden="true"></span>';
const tileHtml=t=>t.found
 ?`<li class="album-tile found" data-tier="${t.tier}" style="--tier:${t.color}"><span class="album-rank">#${t.rank}</span><img src="${art}${t.gem}.png" alt="" width="16" height="16"><span class="album-answer">${escape(t.name)}</span><span class="album-sr">${escape(t.tierLabel)}</span></li>`
 :`<li class="album-tile missing"><span class="album-rank">#${t.rank}</span><span class="album-mystery" aria-hidden="true">?</span><span class="album-sr">Not found yet</span></li>`;

function createDialog(){
 const dialog=document.createElement('dialog');
 dialog.id='album';dialog.setAttribute('aria-labelledby','album-title');
 dialog.innerHTML=`<div class="album-bar"><button type="button" class="album-back" hidden>‹ All</button><h2 id="album-title">Collection album</h2><button type="button" class="album-close" aria-label="Close collection album">×</button></div><div class="album-body"></div>`;
 dialog.addEventListener('click',event=>{
  if(event.target===dialog){dialog.close();return;}
  const button=event.target.closest('button');if(!button||!context)return;
  if(button.classList.contains('album-close'))dialog.close();
  else if(button.classList.contains('album-back'))showOverview(dialog,context.category);
  else if(button.classList.contains('album-order')){context.rarestFirst=!context.rarestFirst;showCategory(dialog,context.category,'.album-order');}
  else if(button.dataset.category)showCategory(dialog,button.dataset.category,'.album-back');
 });
 // Native cancel can be skipped without user activation; close explicitly so Escape always works.
 dialog.addEventListener('keydown',event=>{if(event.key==='Escape'&&dialog.open){event.preventDefault();dialog.close();}});
 dialog.addEventListener('close',()=>{const opener=context?.opener;if(opener?.isConnected&&typeof opener.focus==='function')opener.focus();});
 document.body.append(dialog);
 return dialog;
}

function showOverview(dialog,focusId){
 const summary=albumSummary(context.catalog,context.modes),body=dialog.querySelector('.album-body');
 context.category=null;
 dialog.querySelector('#album-title').textContent='Collection album';
 dialog.querySelector('.album-back').hidden=true;
 body.innerHTML=`<p class="album-total"><strong>${number(summary.found)}</strong> of ${number(summary.total)} answers found</p>${bar(summary.found,summary.total,'All categories')}<ul class="album-categories">${summary.categories.map(c=>`<li><button type="button" class="album-category${c.total&&c.found===c.total?' complete':''}" data-category="${escape(c.id)}"><span class="album-icon" aria-hidden="true">${categoryIcon(c)}</span><span class="album-name">${escape(c.label)}</span>${gem(c.rarestTier)}${bar(c.found,c.total,c.label)}<span class="album-count">${c.found}/${c.total}</span></button></li>`).join('')}</ul>`;
 const target=focusId&&[...body.querySelectorAll('[data-category]')].find(b=>b.dataset.category===focusId);
 if(target){target.focus();target.scrollIntoView({block:'nearest'});}
 else{body.scrollTop=0;dialog.querySelector('.album-close').focus();}
}

function showCategory(dialog,id,focusSelector){
 const category=context.catalog?.categories?.find(c=>c.id===id);
 if(!category)return showOverview(dialog);
 const body=dialog.querySelector('.album-body'),keepScroll=context.category===id;
 const tiles=categoryTiles(category,context.modes.collection[id],{rarestFirst:context.rarestFirst});
 const found=tiles.filter(t=>t.found).length;
 context.category=id;
 dialog.querySelector('#album-title').textContent=category.label;
 const back=dialog.querySelector('.album-back');back.hidden=false;back.setAttribute('aria-label','Back to all categories');
 body.innerHTML=`${category.scope?`<p class="album-scope">${escape(category.scope)}</p>`:''}<div class="album-head">${bar(found,tiles.length,category.label)}<span class="album-count">${found}/${tiles.length}</span></div><button type="button" class="album-order" aria-pressed="${context.rarestFirst}">Show rarest first</button><ol class="album-tiles" aria-label="${escape(category.label)}, ${context.rarestFirst?'rarest':'most looked-up'} first">${tiles.map(tileHtml).join('')}</ol>`;
 if(!keepScroll)body.scrollTop=0;
 dialog.querySelector(focusSelector)?.focus({preventScroll:keepScroll});
}

export function openAlbum({catalog,storage=defaultStorage()}={}){
 const dialog=document.getElementById('album')||createDialog();
 const wasOpen=dialog.open;
 context={catalog,storage,modes:loadModes(storage),category:null,rarestFirst:context?.rarestFirst||false,opener:wasOpen?context?.opener:document.activeElement};
 if(!wasOpen)dialog.showModal();
 showOverview(dialog);
 return dialog;
}
