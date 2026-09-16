// "More ways to dig": one grouped picker, used inline on home/results once the
// daily is finished and as a sheet before that. Replaces the flat 8-card grid.
//
// Every row looks the same. Rows that navigate are links and carry a chevron;
// rows that open a sheet are buttons and carry none, so the two never look
// identical but behave differently (UX-SPEC §3.9).
import {modeIcon,iconSvg} from './icons.js?v=b6103573572c';
import {sheetHead,openSheet,bindSheetControls} from './sheet.js?v=b6103573572c';

export const MODE_GROUPS=[
 {id:'new',label:'New',items:[
  {id:'depth',name:'Depths',hint:'Pick a layer, then name something that lives there',href:'depth.html'}
 ]},
 {id:'endless',label:'Endless',items:[
  {id:'free',name:'Free Dig',hint:'Any category, any time',href:'?mode=free'},
  {id:'deep',name:'Deep Mine',hint:'One endless run, deeper each time',href:'?mode=deep'}
 ]},
 {id:'challenges',label:'Challenges',items:[
  {id:'higher-lower',name:'Higher or Lower',hint:'Tap the more looked-up one'},
  {id:'climb',name:'Climb Up',hint:'Rarest first, then more common',href:'?mode=climb'},
  {id:'bullseye',name:'Bullseye',hint:'Hit the target rank'},
  {id:'blitz',name:'Top 10 Blitz',hint:'The top 10 in 90 seconds'}
 ]},
 {id:'collection',label:'Archive & Collection',items:[
  {id:'archive',name:'Archive',hint:'Replay past dailies'},
  {id:'album',name:'Collection',hint:'Every answer you’ve found'}
 ]}
];

const row=(item,prefix)=>{
 const inner=`<span class="picker-icon" aria-hidden="true">${modeIcon(item.id)}</span>`
  +`<span class="picker-text"><strong>${item.name}</strong><small>${item.hint}</small></span>`;
 return item.href
  ? `<li><a class="picker-row" href="${item.href}">${inner}<span class="picker-chevron" aria-hidden="true">${iconSvg('ui-next')}</span></a></li>`
  : `<li><button type="button" class="picker-row" data-mode="${item.id}" data-picker="${prefix}">${inner}</button></li>`;
};

export function pickerGroupsHtml({prefix='picker'}={}){
 return MODE_GROUPS.map(group=>`<section class="picker-group" aria-labelledby="${prefix}-${group.id}">`
  +`<h3 class="picker-group-label" id="${prefix}-${group.id}">${group.label}</h3>`
  +`<ul class="picker-list">${group.items.map(item=>row(item,prefix)).join('')}</ul></section>`).join('');
}

// Inline picker for home and the results screen once the day is finished.
export function pickerSection({prefix='picker',title='More ways to dig'}={}){
 return `<section class="picker" aria-labelledby="${prefix}-title">`
  +`<h2 class="picker-title" id="${prefix}-title">${title}</h2>`
  +pickerGroupsHtml({prefix})+`</section>`;
}

// One quiet control, shown before the daily is finished.
export function pickerLink(id='picker-open'){
 return `<button type="button" class="btn btn--quiet picker-open" id="${id}">More ways to dig</button>`;
}

// `handlers` receives the mode id for every row that opens a sheet.
export function bindPicker(root,handlers={}){
 if(!root)return;
 root.querySelectorAll('[data-mode]').forEach(button=>{
  button.onclick=()=>handlers.onSelect?.(button.dataset.mode,button);
 });
}

export function openPicker({opener,onSelect}={}){
 let dialog=document.getElementById('picker');
 if(!dialog){
  dialog=document.createElement('dialog');dialog.id='picker';dialog.className='sheet';
  dialog.setAttribute('aria-labelledby','picker-title');document.body.append(dialog);
 }
 dialog.innerHTML=sheetHead('picker','More ways to dig')
  +`<div class="sheet-body picker-body">${pickerGroupsHtml({prefix:'picker-sheet'})}</div>`;
 bindSheetControls(dialog);
 bindPicker(dialog,{onSelect});
 openSheet(dialog,{opener});
 return dialog;
}
