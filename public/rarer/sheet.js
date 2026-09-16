// One dialog shell for every sheet in Spelunkle (help, archive, album, quick modes,
// home, welcome, confirms). See docs/ux/UX-SPEC.md §2.4.
//
// Behaviour contract:
// - Escape closes (explicit keydown: Chrome can skip `cancel` without a recent gesture).
// - A click on the backdrop closes.
// - Focus moves into the sheet on open and returns to the opener on close.
// - Tab cycles inside the sheet.
import {iconSvg} from './icons.js?v=52b81d98bb60';

const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])';
const openers=new WeakMap();
const closers=new WeakMap();

// Runs once per open. Chrome does not reliably deliver the `close` event without
// a recent user gesture, so closeSheet() does this work explicitly and the event
// listener is only a backstop for closes that bypass us. Idempotent either way.
function afterClose(dialog){
 if(!openers.has(dialog))return;
 const opener=openers.get(dialog);openers.delete(dialog);
 const done=closers.get(dialog);closers.delete(dialog);
 if(opener?.isConnected&&typeof opener.focus==='function')opener.focus({preventScroll:true});
 if(done)done();
}

const visible=el=>!el.hidden&&el.offsetParent!==null||el.getClientRects().length>0;
const focusables=dialog=>[...dialog.querySelectorAll(FOCUSABLE)].filter(el=>!el.hidden&&!el.closest('[hidden]')&&visible(el));

// Head markup shared by every sheet. `back` adds the (initially hidden) back button.
export function sheetHead(id,title,{back=false}={}){
 return `<div class="sheet-head">`
  +`<button type="button" class="icon-button sheet-back"${back?'':' hidden'} aria-label="Back">${iconSvg('ui-back')}</button>`
  +`<h2 id="${id}-title" tabindex="-1">${title}</h2>`
  +`<button type="button" class="icon-button sheet-close" aria-label="Close">${iconSvg('ui-close')}</button>`
  +`</div>`;
}

// Wire a dialog once. Safe to call repeatedly.
export function initSheet(dialog){
 if(!dialog||dialog.dataset.sheetReady)return dialog;
 dialog.dataset.sheetReady='1';
 dialog.classList.add('sheet');
 dialog.addEventListener('click',event=>{if(event.target===dialog)closeSheet(dialog);});
 dialog.addEventListener('keydown',event=>{
  if(event.key==='Escape'){event.preventDefault();closeSheet(dialog);return;}
  if(event.key!=='Tab')return;
  const items=focusables(dialog);
  if(!items.length){event.preventDefault();return;}
  const first=items[0],last=items.at(-1),active=document.activeElement;
  if(event.shiftKey&&(active===first||!dialog.contains(active))){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&active===last){event.preventDefault();first.focus();}
 });
 dialog.addEventListener('close',()=>afterClose(dialog));
 return dialog;
}

// Move focus to the sheet's own starting point: an explicit [autofocus], else the
// first focusable in the body, else the title (long bodies), else the close button.
export function focusSheet(dialog){
 const body=dialog.querySelector('.sheet-body');
 const wanted=dialog.querySelector('[autofocus]')
  ||(body?focusables(dialog).find(el=>body.contains(el)):null)
  ||dialog.querySelector('.sheet-head h2')
  ||dialog.querySelector('.sheet-close');
 wanted?.focus({preventScroll:true});
}

export function openSheet(dialog,{opener,onClose}={}){
 if(!dialog)return null;
 initSheet(dialog);
 const wasOpen=dialog.open;
 if(!wasOpen){openers.set(dialog,opener||document.activeElement);dialog.showModal();}
 if(onClose)closers.set(dialog,onClose);
 focusSheet(dialog);
 return dialog;
}

export function closeSheet(dialog){if(dialog?.open){dialog.close();afterClose(dialog);}}

// Bind the standard head buttons of an already-rendered sheet.
export function bindSheetControls(dialog,{onBack}={}){
 initSheet(dialog);
 const close=dialog.querySelector('.sheet-close');if(close)close.onclick=()=>closeSheet(dialog);
 const back=dialog.querySelector('.sheet-back');if(back&&onBack)back.onclick=onBack;
 return dialog;
}
