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
export function assess(category,chain,text){
  const key=normalize(text);
  const matches=category.entries?.filter(a=>[a.name,...a.aliases].some(n=>normalize(n)===key));
  if(matches?.length>1)return {kind:'ambiguous'};
  const answer=category.entries?(matches[0]?[matches[0].name,matches[0].rarity]:null):allAnswers(category).find(a=>normalize(a[0])===key);
  if(!answer)return {kind:'unknown'};
  if(chain.length&&answer[1]<=chain.at(-1)[1])return {kind:'bust',answer};
  return {kind:'accepted',answer};
}
export function missed(category,chain){
  const last=chain.length?chain.at(-1)[1]:-1;
  return allAnswers(category).filter(a=>a[1]>last&&!chain.some(b=>a[0]===b[0])).sort((a,b)=>b[1]-a[1]).slice(0,2).reverse();
}
export function shareText(results){return 'Rarer · Sample day\n'+results.map(r=>r.name+' '+r.chain.map(a=>tier(a[1]).square).join('')+(r.bust?' ×':'')+' · '+score(r.chain)+' · ×'+r.chain.length).join('\n')+'\nTotal '+results.reduce((n,r)=>n+score(r.chain),0).toLocaleString('en-US');}
