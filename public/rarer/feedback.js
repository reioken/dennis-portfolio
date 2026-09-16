import {tier} from './core.js?v=b6103573572c';
const finds={
  common:{asset:'rocks',name:'Stone',chips:7,color:'#d5a18a',level:0},
  uncommon:{asset:'ore',name:'Ore',chips:9,color:'#75bd8b',level:1},
  unusual:{asset:'ore',name:'Blue ore',chips:12,color:'#74bce7',level:1},
  rare:{asset:'amethyst',name:'Amethyst',chips:15,color:'#cd9cef',level:2},
  'very-rare':{asset:'amethyst',name:'Crystal',chips:18,color:'#f4a465',level:2},
  legendary:{asset:'diamond',name:'Diamond',chips:21,color:'#ffe6a1',level:3}
};
export function findFor(rarity){const t=tier(rarity);return {...finds[t.className],tier:t.label,className:t.className};}
export function cargoSlot(index,cartX,ground){return {x:cartX+(index%3-1)*6,y:ground-22-Math.floor(index/3)*5};}
export function lootPosition(from,to,t,ceiling){
  const p=Math.max(0,Math.min(1,t)),peak=Math.max(ceiling+18,Math.min(from.y,to.y)-24);
  return {x:from.x+(to.x-from.x)*p,y:(1-p)*(1-p)*from.y+2*(1-p)*p*(2*peak-(from.y+to.y)/2)+p*p*to.y};
}
