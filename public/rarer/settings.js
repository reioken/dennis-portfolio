// Settings: theme, reduced motion, high-contrast tiers, moving a save between
// browsers, and the danger zone.
//
// Preferences live in rarer.settings.v1 ({v,theme,motion,contrast}); the theme
// also keeps writing rarer.theme so an older build (and index.html's boot
// script) still reads it. Save transfer only ever reads or writes rarer.* keys.
//
// Everything above "Sheet" is pure apart from the storage object it is handed,
// so .rarer-tools/test-save-transfer.mjs can exercise it in Node.
import {iconSvg} from './icons.js?v=0b45fd07d30d';
import {sheetHead,openSheet,closeSheet,bindSheetControls} from './sheet.js?v=0b45fd07d30d';
import {decodeProgress,SAVE_KEY,BACKUP_KEY} from './daily-progress.js?v=0b45fd07d30d';
import {statsFrom} from './stats.js?v=0b45fd07d30d';
import {utcDay} from './edition.js?v=0b45fd07d30d';

export const SETTINGS_KEY='rarer.settings.v1';
export const THEME_KEY='rarer.theme';
export const SAVE_PREFIX='rarer.';
export const SAVE_VERSION=1;
export const APP='spelunkle';
export {BACKUP_KEY};

const THEMES=['system','light','dark'],TRISTATE=['system','on','off'];
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=n=>n.toLocaleString('en-US');
const pick=(value,allowed,fallback)=>allowed.includes(value)?value:fallback;

export const defaultSettings=()=>({v:1,theme:'system',motion:'system',contrast:'system'});

export function loadSettings(storage){
 const settings=defaultSettings();
 try{
  const data=JSON.parse(storage?.getItem(SETTINGS_KEY)||'null');
  if(data&&typeof data==='object'){
   settings.theme=pick(data.theme,THEMES,settings.theme);
   settings.motion=pick(data.motion,TRISTATE,settings.motion);
   settings.contrast=pick(data.contrast,TRISTATE,settings.contrast);
  }
  // A theme stored by an older build wins only when this file has no opinion yet.
  if(!data){const legacy=storage?.getItem(THEME_KEY);settings.theme=pick(legacy,THEMES,settings.theme);}
 }catch{}
 return settings;
}

export function saveSettings(storage,settings){
 const clean={v:1,theme:pick(settings?.theme,THEMES,'system'),motion:pick(settings?.motion,TRISTATE,'system'),contrast:pick(settings?.contrast,TRISTATE,'system')};
 try{storage?.setItem(SETTINGS_KEY,JSON.stringify(clean));}catch{}
 // Compatibility: rarer.theme keeps its name and now accepts system|light|dark.
 try{storage?.setItem(THEME_KEY,clean.theme);}catch{}
 return clean;
}

// System means "no attribute", so the media queries in style.css govern.
export function applySettings(settings,root=globalThis.document?.documentElement){
 if(!root)return settings;
 const s={...defaultSettings(),...settings};
 if(s.theme==='light'||s.theme==='dark')root.dataset.theme=s.theme;else delete root.dataset.theme;
 if(s.motion==='on')root.dataset.motion='reduce';else if(s.motion==='off')root.dataset.motion='full';else delete root.dataset.motion;
 if(s.contrast==='on')root.dataset.contrast='high';else if(s.contrast==='off')root.dataset.contrast='normal';else delete root.dataset.contrast;
 return s;
}

// ---- Save transfer ----
export function rarerKeys(storage){
 const keys=[];
 try{
  if(!storage)return keys;
  if(typeof storage.key==='function'&&Number.isInteger(storage.length)){
   for(let i=0;i<storage.length;i++){const key=storage.key(i);if(typeof key==='string'&&key.startsWith(SAVE_PREFIX))keys.push(key);}
  }else{
   for(const key of Object.keys(storage))if(key.startsWith(SAVE_PREFIX))keys.push(key);
  }
 }catch{}
 return [...new Set(keys)].sort();
}

export function collectSave(storage,{now=new Date()}={}){
 const data={};
 for(const key of rarerKeys(storage)){
  if(key===BACKUP_KEY)continue;// a backup of a backup helps nobody
  const value=storage.getItem(key);
  if(typeof value==='string')data[key]=value;
 }
 return {v:SAVE_VERSION,app:APP,exported:now.toISOString(),data};
}

const toBase64=text=>{
 const bytes=new TextEncoder().encode(text);
 let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
 return btoa(binary);
};
const fromBase64=code=>{
 const binary=atob(code.replace(/\s+/g,''));
 const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
 return new TextDecoder().decode(bytes);
};

export const encodeSave=payload=>toBase64(JSON.stringify(payload));
export function exportSave(storage,options){return encodeSave(collectSave(storage,options));}

export const SAVE_ERRORS={
 incomplete:'That code looks incomplete. Copy it again.',
 foreign:"This isn't a Spelunkle save.",
 newer:'This save is from a newer version. Update the page and try again.'
};

// Accepts the base64 code or the downloaded JSON, in that order of likelihood.
export function parseSave(text){
 const raw=String(text||'').trim();
 if(!raw)return {ok:false,error:SAVE_ERRORS.incomplete};
 let payload=null;
 for(const candidate of [()=>JSON.parse(raw),()=>JSON.parse(fromBase64(raw))]){
  try{const value=candidate();if(value&&typeof value==='object'){payload=value;break;}}catch{}
 }
 if(!payload)return {ok:false,error:SAVE_ERRORS.incomplete};
 // Version first: a newer save must say so even when nothing else is recognised.
 if(Number.isFinite(payload.v)&&payload.v>SAVE_VERSION)return {ok:false,error:SAVE_ERRORS.newer};
 if(payload.app!==APP||!payload.data||typeof payload.data!=='object')return {ok:false,error:SAVE_ERRORS.foreign};
 const data=Object.fromEntries(Object.entries(payload.data).filter(([key,value])=>key.startsWith(SAVE_PREFIX)&&key!==BACKUP_KEY&&typeof value==='string'));
 if(!Object.keys(data).length)return {ok:false,error:SAVE_ERRORS.foreign};
 return {ok:true,payload:{...payload,data},summary:summarizeSave({...payload,data})};
}

export function summarizeSave(payload,{today=utcDay()}={}){
 let stats={daysPlayed:0,bestStreak:0,finds:0,totalPoints:0};
 try{
  const progress=decodeProgress(payload?.data?.[SAVE_KEY]??'null',today);
  stats=statsFrom(progress,{today});
 }catch{}
 return {days:stats.daysPlayed,bestStreak:stats.bestStreak,finds:stats.finds,points:stats.totalPoints};
}

export const summaryText=summary=>`This save has ${number(summary.days)} ${summary.days===1?'day':'days'} played, best streak ${number(summary.bestStreak)}, ${number(summary.finds)} finds. It will replace this browser's progress.`;

// The current save is always backed up first, under the key the reset tool uses,
// keeping that key's existing { daily, legacy, at } shape for older readers.
export function backupSave(storage,{now=new Date()}={}){
 const all={};
 for(const key of rarerKeys(storage)){if(key!==BACKUP_KEY)all[key]=storage.getItem(key);}
 const backup={daily:storage?.getItem(SAVE_KEY)??null,legacy:storage?.getItem('rarer.home.v1')??null,at:now.toISOString(),all};
 try{storage?.setItem(BACKUP_KEY,JSON.stringify(backup));}catch{return null;}
 return backup;
}

export function applySave(storage,payload,{now=new Date()}={}){
 if(!storage)return {ok:false,error:SAVE_ERRORS.incomplete};
 const data=payload?.data;
 if(!data||typeof data!=='object')return {ok:false,error:SAVE_ERRORS.foreign};
 backupSave(storage,{now});
 for(const key of rarerKeys(storage)){
  if(key===BACKUP_KEY)continue;
  try{storage.removeItem(key);}catch{}
 }
 const written=[];
 for(const [key,value] of Object.entries(data)){
  if(!key.startsWith(SAVE_PREFIX)||key===BACKUP_KEY||typeof value!=='string')continue;
  try{storage.setItem(key,value);written.push(key);}catch{}
 }
 return {ok:true,written:written.sort()};
}

export function undoImport(storage){
 try{
  const backup=JSON.parse(storage?.getItem(BACKUP_KEY)||'null');
  if(!backup)return {ok:false};
  const entries=backup.all&&typeof backup.all==='object'
   ?Object.entries(backup.all)
   :[[SAVE_KEY,backup.daily],['rarer.home.v1',backup.legacy]].filter(([,value])=>typeof value==='string');
  for(const key of rarerKeys(storage)){if(key!==BACKUP_KEY)storage.removeItem(key);}
  for(const [key,value] of entries){if(key.startsWith(SAVE_PREFIX)&&key!==BACKUP_KEY&&typeof value==='string')storage.setItem(key,value);}
  return {ok:true,restored:entries.length};
 }catch{return {ok:false};}
}

export const saveFileName=(now=new Date())=>'spelunkle-save-'+now.toISOString().slice(0,10)+'.json';

// ---- Sheet ----
// Labelled by the section heading above it (#setting-theme/-motion/-contrast), so a
// screen reader announces "Reduce motion", not the internal key.
const segment=(name,value,options)=>`<div class="segmented" role="radiogroup" aria-labelledby="setting-${escape(name)}">`
 +options.map(([id,label,icon])=>`<button type="button" class="segment" role="radio" data-setting="${name}" data-value="${id}" aria-checked="${value===id}">`
  +(icon?`<span class="segment-icon" aria-hidden="true">${iconSvg(icon)}</span>`:'')+`<span>${label}</span></button>`).join('')
 +`</div>`;

function settingsBody(settings,{hasBackup}){
 return `<section class="setting-row" aria-labelledby="setting-theme"><h3 class="setting-label" id="setting-theme">Theme</h3>
 ${segment('theme',settings.theme,[['system','System','ui-theme-system'],['light','Light','ui-theme-light'],['dark','Dark','ui-theme-dark']])}</section>
 <section class="setting-row" aria-labelledby="setting-motion"><h3 class="setting-label" id="setting-motion">Reduce motion</h3>
 <p class="setting-hint">System follows your device setting.</p>
 ${segment('motion',settings.motion,[['system','System'],['on','On'],['off','Off']])}</section>
 <section class="setting-row" aria-labelledby="setting-contrast"><h3 class="setting-label" id="setting-contrast">High-contrast tiers</h3>
 <p class="setting-hint">Stronger tier colours, always with a label.</p>
 ${segment('contrast',settings.contrast,[['system','System'],['on','On'],['off','Off']])}</section>
 <section class="setting-row" aria-labelledby="setting-transfer"><h3 class="setting-label" id="setting-transfer">Move your progress</h3>
 <p class="setting-hint">Copy the code into another browser, or keep the file as a backup.</p>
 <div class="transfer-actions">
  <button type="button" class="btn btn--secondary btn--compact" id="save-copy"><span class="combo-glyph">${iconSvg('ui-save-code')}</span> Copy save code</button>
  <button type="button" class="btn btn--secondary btn--compact" id="save-download"><span class="combo-glyph">${iconSvg('ui-download')}</span> Download file</button>
 </div>
 <textarea class="transfer-code" id="save-code" readonly hidden aria-label="Your save code"></textarea>
 <p class="transfer-status" id="save-status-line" role="status"></p>
 <label class="setting-label" for="import-code">Paste a save code</label>
 <textarea class="transfer-code" id="import-code" rows="3" placeholder="Paste the code from your other browser…"></textarea>
 <div class="transfer-actions">
  <button type="button" class="btn btn--secondary btn--compact" id="import-check"><span class="combo-glyph">${iconSvg('ui-upload')}</span> Check code</button>
  <button type="button" class="btn btn--quiet" id="import-file">Choose a file…</button>
  <input type="file" id="import-picker" accept="application/json,.json,.txt" hidden>
 </div>
 <p class="transfer-error" id="import-error" role="alert"></p>
 <div class="transfer-preview" id="import-preview" hidden>
  <p id="import-summary"></p>
  <div class="transfer-actions">
   <button type="button" class="btn btn--quiet" id="import-cancel">Cancel</button>
   <button type="button" class="btn btn--primary btn--compact" id="import-replace">Replace</button>
  </div>
 </div>
 <button type="button" class="btn btn--secondary btn--compact" id="undo-import" hidden><span class="combo-glyph">${iconSvg('ui-undo')}</span> Undo import</button>
 </section>
 <section class="setting-row danger-zone" aria-labelledby="setting-danger"><h3 class="setting-label" id="setting-danger">Danger zone</h3>
 <button type="button" class="btn btn--danger btn--compact" id="reset-progress">Reset all progress…</button>
 <button type="button" class="btn btn--quiet" id="undo-reset"${hasBackup?'':' hidden'}>Undo last reset</button>
 <p class="setting-hint" id="settings-note">Progress is saved in this browser only.</p></section>`;
}

export function openSettings({storage,opener,onReset,onUndoReset}={}){
 let dialog=document.getElementById('settings');
 if(!dialog){
  dialog=document.createElement('dialog');dialog.id='settings';dialog.className='sheet';
  dialog.setAttribute('aria-labelledby','settings-title');document.body.append(dialog);
 }
 let settings=loadSettings(storage);
 const hasBackup=!!(()=>{try{return storage?.getItem(BACKUP_KEY);}catch{return null;}})();
 dialog.innerHTML=sheetHead('settings','Settings')+`<div class="sheet-body settings-body">${settingsBody(settings,{hasBackup})}</div>`;
 bindSheetControls(dialog);
 const el=selector=>dialog.querySelector(selector);
 const note=el('#settings-note');
 const backupNote=()=>{
  let last='never';
  try{const backup=JSON.parse(storage?.getItem(BACKUP_KEY)||'null');if(backup?.at)last=backup.at.slice(0,10);}catch{}
  note.textContent='Progress is saved in this browser only. Last backup: '+last+'.';
 };
 backupNote();

 dialog.querySelectorAll('.segment').forEach(button=>{
  button.onclick=()=>{
   settings={...settings,[button.dataset.setting]:button.dataset.value};
   saveSettings(storage,settings);applySettings(settings);
   dialog.querySelectorAll(`.segment[data-setting="${button.dataset.setting}"]`).forEach(other=>other.setAttribute('aria-checked',String(other===button)));
  };
 });

 const status=el('#save-status-line'),codeBox=el('#save-code');
 el('#save-copy').onclick=async()=>{
  const code=exportSave(storage);
  try{await navigator.clipboard.writeText(code);status.textContent='Save code copied. Paste it in your other browser.';}
  catch{codeBox.hidden=false;codeBox.value=code;codeBox.focus({preventScroll:true});codeBox.select();status.textContent='Press and hold to copy.';}
 };
 el('#save-download').onclick=()=>{
  const blob=new Blob([JSON.stringify(collectSave(storage),null,1)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=saveFileName();document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  status.textContent='Downloaded '+saveFileName()+'.';
 };

 const error=el('#import-error'),preview=el('#import-preview'),summary=el('#import-summary');
 let pending=null;
 const showError=message=>{error.textContent=message;preview.hidden=true;pending=null;};
 const check=text=>{
  const result=parseSave(text);
  if(!result.ok)return showError(result.error);
  pending=result.payload;error.textContent='';
  summary.textContent=summaryText(result.summary);
  preview.hidden=false;el('#import-replace').focus({preventScroll:true});
 };
 el('#import-check').onclick=()=>check(el('#import-code').value);
 el('#import-file').onclick=()=>el('#import-picker').click();
 el('#import-picker').onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{check(await file.text());}catch{showError(SAVE_ERRORS.incomplete);}
 };
 el('#import-cancel').onclick=()=>{preview.hidden=true;pending=null;el('#import-code').focus({preventScroll:true});};
 el('#import-replace').onclick=()=>{
  if(!pending)return;
  const result=applySave(storage,pending);
  if(!result.ok)return showError(result.error||SAVE_ERRORS.incomplete);
  location.reload();
 };
 el('#undo-import').hidden=!hasBackup;
 el('#undo-import').onclick=()=>{if(undoImport(storage).ok)location.reload();};

 el('#reset-progress').onclick=()=>onReset?.(el('#reset-progress'));
 el('#undo-reset').onclick=()=>onUndoReset?.(el('#undo-reset'));

 openSheet(dialog,{opener});
 return dialog;
}

// Called once at boot so a stored preference is applied before anything renders.
export function bootSettings(storage){return applySettings(loadSettings(storage));}
