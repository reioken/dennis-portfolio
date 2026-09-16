// First-dig coaching: three short tips beside the play controls.
//
// Each tip is dismissed with "Got it" and never returns; "Skip tips" retires
// all three at once. Flags live in rarer.coach.v1 ({start, after-first,
// first-slip, skip}), so a reload during the same dig does not repeat a tip.
//
// Everything above "View" is pure, so .rarer-tools/test-coach.mjs runs it in
// Node with a plain object for storage.
import {iconSvg} from './icons.js?v=cea0b2abe3a6';

export const COACH_KEY='rarer.coach.v1';

export const TIPS=[
 {id:'start',text:'Start with an easy one.'},
 {id:'after-first',text:'Nice. Now name one fewer people look up.'},
 {id:'first-slip',text:'That’s a slip. One more and the cave caves in.'}
];

export function loadCoach(storage){
 try{const data=JSON.parse(storage?.getItem(COACH_KEY)||'null');return data&&typeof data==='object'?data:{};}
 catch{return {};}
}

export function saveCoach(storage,state){
 try{storage?.setItem(COACH_KEY,JSON.stringify(state));}catch{}
 return state;
}

export const coachSkipped=state=>!!state?.skip;
export const coachDone=(state,id)=>!!state?.skip||!!state?.[id];

export function dismissCoach(storage,id){return saveCoach(storage,{...loadCoach(storage),[id]:1});}

// One click retires every tip, now and in every later dig.
export function skipCoach(storage){
 const state={...loadCoach(storage),skip:1};
 for(const tip of TIPS)state[tip.id]=1;
 return saveCoach(storage,state);
}

// The tip that belongs on screen right now, or null. Coaching only ever runs
// during the very first dig: `firstDig` is false as soon as one is finished,
// which is also what suppresses it for a returning player.
export function nextTip(state,{stage='play',chain=0,mistakes=0,firstDig=true}={}){
 if(!firstDig||coachSkipped(state)||stage!=='play')return null;
 if(mistakes>0&&!coachDone(state,'first-slip'))return TIPS[2];
 if(chain>0&&!coachDone(state,'after-first'))return TIPS[1];
 if(chain===0&&!coachDone(state,'start'))return TIPS[0];
 return null;
}

// ---- View ----
export function coachHtml(tip){
 if(!tip)return '';
 return `<aside class="coach" data-tip="${tip.id}" aria-label="Tip">`
  +`<span class="coach-icon" aria-hidden="true">${iconSvg('ui-info')}</span>`
  +`<p class="coach-text">${tip.text}</p>`
  +`<div class="coach-actions">`
  +`<button type="button" class="btn btn--secondary btn--compact coach-got-it">Got it</button>`
  +`<button type="button" class="btn btn--quiet coach-skip">Skip tips</button>`
  +`</div></aside>`;
}

// Wires the two buttons of an already-rendered tip. `onChange` is called after
// the flag is written so the caller can re-check which tip is due next.
export function bindCoach(root,storage,{onChange}={}){
 const box=root?.querySelector('.coach');
 if(!box)return null;
 const id=box.dataset.tip;
 box.querySelector('.coach-got-it').onclick=()=>{dismissCoach(storage,id);box.remove();onChange?.();};
 box.querySelector('.coach-skip').onclick=()=>{skipCoach(storage);box.remove();onChange?.();};
 return box;
}
