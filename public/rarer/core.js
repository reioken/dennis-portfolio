export const categories = [
  {name:'A country',label:'Countries',icon:'◆',answers:[['Germany',12],['Portugal',31],['Bhutan',64],['Nauru',88]],missed:[['Tuvalu',96],['Niue',99]],extra:[['France',20]]},
  {name:'A Beatles song',label:'Beatles',icon:'♫',answers:[['Help!',17],['Something',34],['Rain',56]],missed:[['You know my name',94],['Revolution 9',99]],extra:[['Yesterday',8]]},
  {name:'A chemical element',label:'Elements',icon:'⚗',answers:[['Iron',20],['Tungsten',55]],missed:[['Astatine',96],['Tennessine',99]],extra:[['Hydrogen',10]]}
];
export const tiers=[{label:'Common',className:'common',mark:'■',color:'#a5a0b6',square:'⬜'},{label:'Uncommon',className:'uncommon',mark:'◆',color:'#75bd8b',square:'🟩'},{label:'Unusual',className:'unusual',mark:'◇',color:'#74bce7',square:'🟦'},{label:'Rare',className:'rare',mark:'✦',color:'#b78acc',square:'🟪'},{label:'Very rare',className:'very-rare',mark:'✹',color:'#f4a465',square:'🟧'},{label:'Legendary',className:'legendary',mark:'⬟',color:'#edbd57',square:'🟨'}];
export const tier = n => tiers[n<20?0:n<40?1:n<60?2:n<80?3:n<95?4:5];
export const sum = chain => chain.reduce((n,a)=>n+a[1],0);
export const score = chain => sum(chain)*chain.length;
export const normalize = text => text.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]/g,'');
export function allAnswers(category){return category.entries?category.entries.map(a=>[a.name,a.rarity]):[...category.answers,...category.missed,...category.extra];}
// Rank 1 is the most looked-up answer. Equal views share the better rank.
export function rankOf(category,name){
  const list=category.entries;if(!list)return null;
  const i=list.findIndex(a=>a.name===name);if(i<0)return null;
  if(Number.isInteger(list[i].rank))return list[i].rank;
  let r=i;while(r>0&&list[i].views!==undefined&&list[r-1].views===list[i].views)r--;return r+1;
}
// Answers only slightly more looked-up than the last are a free close call.
export const closeBand=category=>Math.max(1,Math.round((category.entries?.length||0)*.03));
// reverse (Climb Up): each answer must be MORE looked-up than the last.
export function assess(category,chain,text,reverse=false){
  const key=normalize(text);
  const matches=category.entries?.filter(a=>[a.name,...a.aliases].some(n=>normalize(n)===key));
  if(matches?.length>1)return {kind:'ambiguous'};
  const answer=category.entries?(matches[0]?[matches[0].name,matches[0].rarity]:null):allAnswers(category).find(a=>normalize(a[0])===key);
  if(!answer)return {kind:'unknown'};
  if(chain.some(a=>a[0]===answer[0]))return {kind:'repeat',answer};
  const rank=rankOf(category,answer[0]);
  if(!chain.length)return {kind:'accepted',answer,rank};
  const previous=chain.at(-1),last=rankOf(category,previous[0]);
  if(rank===null||last===null)return (reverse?answer[1]>=previous[1]:answer[1]<=previous[1])?{kind:'bust',answer}:{kind:'accepted',answer};
  if(reverse?rank<last&&answer[1]<=previous[1]:rank>last&&answer[1]>=previous[1])return {kind:'accepted',answer,rank,last};
  return {kind:Math.abs(last-rank)<=closeBand(category)?'close':'bust',answer,rank,last};
}
export function missed(category,chain,reverse=false){
  const last=chain.length?chain.at(-1)[1]:reverse?101:-1;
  return allAnswers(category).filter(a=>(reverse?a[1]<last:a[1]>last)&&!chain.some(b=>a[0]===b[0])).sort((a,b)=>reverse?a[1]-b[1]:b[1]-a[1]).slice(0,2).reverse();
}
export function shareText(results){return 'Rarer · Sample day\n'+results.map(r=>r.name+' '+r.chain.map(a=>tier(a[1]).square).join('')+(r.bust?' ×':'')+' · '+score(r.chain)+' · ×'+r.chain.length).join('\n')+'\nTotal '+results.reduce((n,r)=>n+score(r.chain),0).toLocaleString('en-US');}
