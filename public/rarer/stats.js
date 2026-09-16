// Your stats: aggregation over the daily save (progress.rounds / progress.days),
// plus the sheet that shows it. No new storage — everything here is derived.
//
// The helpers above the "Sheet" comment are pure and DOM-free so
// .rarer-tools/test-stats.mjs can run them in Node.
import {utcDay,dailyNumber,FIRST_DAY} from './edition.js?v=b6103573572c';
import {tier} from './core.js?v=b6103573572c';
import {iconSvg,modeIcon,categoryIcon} from './icons.js?v=b6103573572c';
import {sheetHead,openSheet,bindSheetControls} from './sheet.js?v=b6103573572c';

const DAY=86400000;
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=n=>n.toLocaleString('en-US');
export const shiftDay=(day,back=1)=>new Date(Date.parse(day+'T00:00:00Z')-back*DAY).toISOString().slice(0,10);
const validRounds=progress=>Array.isArray(progress?.rounds)?progress.rounds.filter(r=>r&&typeof r.day==='string'&&Number.isFinite(r.points)):[];

// A day counts for the streak only when all three digs were finished on the day
// itself. Archive replays add points but never a streak day — the same rule as
// daily-progress.js homeProfile(); this file must not invent a second one.
export function completedDays(progress){
 const onTime=validRounds(progress).filter(r=>!r.archive);
 const byDay=new Map();
 for(const r of onTime)byDay.set(r.day,(byDay.get(r.day)||0)+1);
 return [...byDay].filter(([,n])=>n>=3).map(([day])=>day).sort();
}

export function currentStreak(progress,today=utcDay()){
 const days=new Set(completedDays(progress));
 let streak=0,day=today;
 if(!days.has(day))day=shiftDay(day);
 while(days.has(day)){streak++;day=shiftDay(day);}
 return streak;
}

export function bestStreak(progress){
 const days=completedDays(progress);
 let best=0,run=0,previous=null;
 for(const day of days){run=previous&&shiftDay(day)===previous?run+1:1;best=Math.max(best,run);previous=day;}
 return best;
}

// Points per puzzle day, counting every finished dig including archive replays.
export function pointsByDay(progress){
 const totals=new Map();
 for(const r of validRounds(progress))totals.set(r.day,(totals.get(r.day)||0)+r.points);
 return totals;
}

export function statsFrom(progress,{today=utcDay()}={}){
 const rounds=validRounds(progress);
 const played=[...new Set(rounds.map(r=>r.day))];
 const totalPoints=rounds.reduce((n,r)=>n+r.points,0);
 return {
  daysPlayed:played.length,
  completedDays:completedDays(progress).length,
  currentStreak:currentStreak(progress,today),
  bestStreak:bestStreak(progress),
  digs:rounds.length,
  caveIns:rounds.filter(r=>r.bust).length,
  finds:rounds.reduce((n,r)=>n+(Array.isArray(r.chain)?r.chain.length:0),0),
  totalPoints,
  avgPoints:played.length?Math.round(totalPoints/played.length):0,
  bestDay:[...pointsByDay(progress).values()].reduce((best,n)=>Math.max(best,n),0)
 };
}

// The last `count` puzzle days ending today, oldest first.
export function dayBars(progress,count=14,{today=utcDay()}={}){
 const totals=pointsByDay(progress);
 const most=Math.max(0,...totals.values());
 return Array.from({length:count},(_,i)=>{
  const day=shiftDay(today,count-1-i),points=totals.get(day)||0;
  // `exists` clamps to real editions, exactly as calendarDays does below: days
  // before the first edition have no Spelunkle number to show or announce.
  return {day,number:dailyNumber(day),exists:day>=FIRST_DAY&&day<=today,points,today:day===today,played:totals.has(day),share:most?points/most:0};
 });
}

export function calendarDays(progress,count=28,{today=utcDay()}={}){
 const totals=pointsByDay(progress),done=new Set(completedDays(progress));
 return Array.from({length:count},(_,i)=>{
  const day=shiftDay(today,count-1-i);
  return {
   day,number:dailyNumber(day),
   exists:day>=FIRST_DAY&&day<=today,
   played:totals.has(day),complete:done.has(day),
   points:totals.get(day)||0,today:day===today
  };
 });
}

// The rarest answer ever found, with its rank inside its category.
export function rarestFind(progress,catalog){
 let best=null;
 for(const round of validRounds(progress)){
  for(const answer of Array.isArray(round.chain)?round.chain:[]){
   if(!Array.isArray(answer)||typeof answer[0]!=='string'||!Number.isFinite(answer[1]))continue;
   if(!best||answer[1]>best.rarity)best={name:answer[0],rarity:answer[1],categoryId:round.categoryId,day:round.day};
  }
 }
 if(!best)return null;
 const category=(catalog?.categories||[]).find(c=>c.id===best.categoryId)||null;
 const entry=category?.entries?.find(e=>e.name===best.name)||null;
 return {
  ...best,
  categoryLabel:category?.label||best.categoryId||'',
  category,
  rank:Number.isFinite(entry?.rank)?entry.rank:null,
  total:category?.entries?.length||null,
  tier:tier(best.rarity)
 };
}

// ---- Countdown to the next reset (00:00 UTC) ----
export function msUntilReset(now=new Date()){
 const next=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1);
 return Math.max(0,next-now.getTime());
}
const pad=n=>String(n).padStart(2,'0');
export function countdownParts(ms){
 const total=Math.max(0,Math.floor(ms/1000));
 return {hours:Math.floor(total/3600),minutes:Math.floor(total%3600/60),seconds:total%60};
}
export function countdownText(ms){
 const {hours,minutes,seconds}=countdownParts(ms);
 return pad(hours)+':'+pad(minutes)+':'+pad(seconds);
}
export function countdownDuration(ms){
 const {hours,minutes,seconds}=countdownParts(ms);
 return 'PT'+hours+'H'+minutes+'M'+seconds+'S';
}
// "Resets at 00:00 UTC (02:00 your time)" — the local clock time of the next reset.
export function resetLocalTime(now=new Date()){
 const next=new Date(now.getTime()+msUntilReset(now));
 return pad(next.getHours())+':'+pad(next.getMinutes());
}

// ---- Sheet ----
const tile=(label,value)=>`<li class="stat-tile"><span class="stat-label">${label}</span><strong class="stat-value">${escape(value)}</strong></li>`;

function chartHtml(bars){
 // The chart keeps all 14 columns so its shape never jumps, but the sr-only
 // table is its accessible equivalent: only real editions get a row, so nobody
 // is read "Spelunkle #-9" for a day that never existed.
 const real=bars.filter(b=>b.exists);
 const rows=real.map(b=>`<tr><th scope="row">Spelunkle #${b.number}</th><td>${number(b.points)} points</td></tr>`).join('');
 const columns=bars.map(b=>`<li class="bar-col${b.today?' is-today':''}${b.exists?'':' is-empty'}"><span class="bar" style="--h:${Math.round(b.share*100)}%"></span><span class="bar-label">${b.day.slice(8)}</span></li>`).join('');
 return `<section class="stats-block" aria-labelledby="stats-chart-title">
 <h3 id="stats-chart-title" class="stats-heading">Points per day</h3>
 <ol class="bar-chart" aria-hidden="true">${columns}</ol>
 <table class="sr-only"><caption>Points per day, last ${real.length} ${real.length===1?'day':'days'}</caption><tbody>${rows}</tbody></table>
 </section>`;
}

function rarestHtml(find){
 if(!find)return `<section class="stats-block"><h3 class="stats-heading">Rarest find ever</h3><p class="stats-empty">Your rarest answer will appear here.</p></section>`;
 const beat=find.rank&&find.total?`Beat #${find.rank} of ${find.total}`:'';
 return `<section class="stats-block"><h3 class="stats-heading">Rarest find ever</h3>
 <div class="card rarest-card"><span class="rarest-icon" aria-hidden="true">${find.category?categoryIcon(find.category):iconSvg('ui-gem')}</span>
 <span class="rarest-body"><strong>${escape(find.name)}</strong><small>${escape(find.categoryLabel)}${beat?' · '+beat:''}</small></span>
 <span class="chip chip--tier ${find.tier.className}">${escape(find.tier.label)}</span></div></section>`;
}

function calendarHtml(days){
 const cells=days.map(d=>{
  if(!d.exists)return '<li class="cal-cell empty" aria-hidden="true"></li>';
  const label=`Spelunkle #${d.number}, ${d.played?number(d.points)+' points':'not played'}`;
  const classes='cal-cell'+(d.complete?' complete':d.played?' partial':'')+(d.today?' is-today':'');
  if(!d.played&&!d.today)return `<li class="${classes}"><span aria-hidden="true">${d.day.slice(8)}</span><span class="sr-only">${label}</span></li>`;
  return `<li class="${classes}"><a href="?day=${d.day}" aria-label="${escape(label)}"><span aria-hidden="true">${d.day.slice(8)}</span></a></li>`;
 }).join('');
 return `<section class="stats-block" aria-labelledby="stats-calendar-title"><h3 id="stats-calendar-title" class="stats-heading">Last 28 days</h3><ol class="calendar">${cells}</ol></section>`;
}

export function statsHtml({progress,catalog,today=utcDay(),now=new Date()}={}){
 const s=statsFrom(progress,{today});
 const tiles=[['Days played',number(s.daysPlayed)],['Current streak',number(s.currentStreak)],['Best streak',number(s.bestStreak)],['Avg points',number(s.avgPoints)]];
 return `<ul class="stat-tiles">${tiles.map(([label,value])=>tile(label,value)).join('')}</ul>
 ${s.daysPlayed?'':'<p class="stats-empty">Finish a dig to start your streak.</p>'}
 ${chartHtml(dayBars(progress,14,{today}))}
 ${rarestHtml(rarestFind(progress,catalog))}
 ${calendarHtml(calendarDays(progress,28,{today}))}
 <p class="countdown-line"><span class="combo-glyph">${iconSvg('ui-countdown')}</span> New digs in <time datetime="${countdownDuration(msUntilReset(now))}">${countdownText(msUntilReset(now))}</time><small>Resets at 00:00 UTC (${resetLocalTime(now)} your time)</small></p>`;
}

let ticking=null;
export function openStats({progress,catalog,opener}={}){
 let dialog=document.getElementById('stats');
 if(!dialog){
  dialog=document.createElement('dialog');dialog.id='stats';dialog.className='sheet';
  dialog.setAttribute('aria-labelledby','stats-title');document.body.append(dialog);
 }
 dialog.innerHTML=sheetHead('stats','Your stats')+`<div class="sheet-body stats-body">${statsHtml({progress,catalog})}</div>`;
 bindSheetControls(dialog);
 // The countdown ticks, but it is never inside a live region.
 const time=dialog.querySelector('.countdown-line time');
 clearInterval(ticking);
 ticking=setInterval(()=>{
  if(!dialog.open||!time.isConnected){clearInterval(ticking);ticking=null;return;}
  const left=msUntilReset();time.textContent=countdownText(left);time.dateTime=countdownDuration(left);
 },1000);
 openSheet(dialog,{opener,onClose:()=>{clearInterval(ticking);ticking=null;}});
 return dialog;
}
