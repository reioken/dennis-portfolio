import {drawMaterial} from './terrain.js?v=2e123f57933a';
import {drawPixelText,pixelTextWidth} from './pixel-type.js?v=2e123f57933a';
// Height keeps growing; the outdoor plot keeps the home and ruler together.
export const pileHeight=points=>points>0?5+Math.sqrt(points/8):0;
export const pointsAtHeight=height=>height<=5?0:8*(height-5)**2;
export function heapMetrics(points,height=pileHeight(points)){
  const pile=Math.max(0,height);
  const span=Math.max(36,Math.min(60,Math.ceil(pile*1.4)));
  return {pile,height:pile?Math.ceil(pile)+10:0,span,peak:Math.round(span*.45)};
}
export const heightLabel=height=>(height/16).toFixed(1)+' m';
// Start at eight metres, then add whole two-metre sections with four metres
// of headroom above the pile. The same extent drives the scrollable view.
export const rulerHeight=height=>Math.max(128,Math.ceil((height+64)/32)*32);
export const rulerLabelWidth=height=>Math.max(pixelTextWidth(heightLabel(height)),pixelTextWidth((rulerHeight(height)/16)+' m'))+16;
export function pileRowBounds(metrics,dy){
  // The upper shoulder tapers; old layers below it remain a broad rough stack.
  const taper=Math.max(0,1-(metrics.pile-dy)/Math.min(42,Math.max(1,metrics.pile)));
  return {a:metrics.peak*taper,b:metrics.span-12-(metrics.span-12-metrics.peak)*taper};
}
export function drawHeightPole(ctx,x,ground,metrics,view){
  const height=Math.round(metrics.height),poleHeight=rulerHeight(height),top=ground-poleHeight-8;
  x=Math.round(x);ground=Math.round(ground);
  if(x+rulerLabelWidth(height)<view.left||x-7>view.right)return;
  const from=Math.max(top,view.top),to=Math.min(ground+3,view.bottom);
  if(to<=from)return;
  ctx.fillStyle='#352c30';ctx.fillRect(x-1,from,7,to-from);
  ctx.fillStyle='#8f6847';ctx.fillRect(x,from,4,to-from);
  ctx.fillStyle='#cba374';ctx.fillRect(x,from,1,to-from);
  ctx.fillStyle='#e7c89a';ctx.fillRect(x-2,top,8,2);
  ctx.fillStyle='#554347';ctx.fillRect(x-4,ground,12,3);
  const plaque=(label,y,active=false)=>{
    const left=x+9,width=pixelTextWidth(label)+6;
    ctx.fillStyle=active?'#f2bd49':'#302a34';ctx.fillRect(left,y-6,width,13);
    ctx.fillStyle=active?'#ffe09a':'#705940';ctx.fillRect(left,y-6,width,1);
    ctx.fillStyle=active?'#302a34':'#f6e2bd';drawPixelText(ctx,label,left+3,y-3);
  };
  const first=Math.max(0,Math.ceil((ground-view.bottom)/8)*8),last=Math.min(poleHeight,ground-view.top);
  for(let rise=first;rise<=last;rise+=8){
    const major=rise%16===0,y=Math.round(ground-rise);
    ctx.fillStyle=major?'#ffe2ae':'#493530';ctx.fillRect(x,y,major?6:3,1);
    if(rise%32===0&&Math.abs(rise-height)>10){
      plaque((rise/16)+' m',y);
    }
  }
  const y=Math.round(ground-height),label=heightLabel(height);
  if(y>=view.top-6&&y<=view.bottom+6){
    ctx.fillStyle='#f2bd49';ctx.fillRect(x-5,y-2,10,5);ctx.fillRect(x-7,y-1,2,3);
    plaque(label,y,true);
  }
}
const types=['rocks','ore','amethyst','diamond'];
const smallSlots=[[0,0],[9,0],[18,0],[7,-7],[16,-7],[12,-14],[27,0],[25,-7],[22,-14],[17,-21],[34,0],[32,-7]];
const hash=seed=>{let h=Math.imul(seed^0x9e3779b9,0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);return(h^(h>>>16))>>>0;};
export function findsAtHeight(profile,row){
  const layers=profile.layers;if(!layers?.length)return profile.finds||{};
  const points=pointsAtHeight(row*5);let lo=0,hi=layers.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(layers[mid].to<=points)lo=mid+1;else hi=mid;}
  return layers[lo].finds;
}
function earnedType(finds,seed){
  const total=types.reduce((n,t)=>n+(finds[t]||0),0);let sample=hash(seed)%Math.max(1,total);
  for(const type of types){sample-=finds[type]||0;if(sample<0)return type;}return 'rocks';
}
function measuredTop(profile,m,meta){
  const finds=profile.finds||{},count=types.reduce((n,t)=>n+(finds[t]||0),0),inset=type=>meta.props.pile?.[type]?.top||0;
  if(!count||!m.pile)return 0;
  if(count<=12){
    const items=types.flatMap(type=>Array.from({length:finds[type]||0},()=>type));
    return Math.max(...items.map((type,i)=>12-smallSlots[i][1]-inset(type)));
  }
  return Math.max(33,12+(Math.ceil(m.pile/5)-1)*5);
}
export function visiblePileRows(height,ground,top,bottom){
  const rows=Math.max(0,Math.ceil(height/5));
  return {rows,first:Math.max(0,Math.floor((ground-bottom-12)/5)),last:Math.min(rows-1,Math.ceil((ground-top)/5))};
}
export function drawBurrow(ctx,assets,meta,profile,center,ground,height,view={top:-Infinity,bottom:Infinity,left:-Infinity,right:Infinity}){
  const house=meta.props.house;if(!house||!assets.house)return;
  const x=Math.round(center-house.anchorX),y=Math.round(ground-house.foot),base=Math.round(ground),left=x+house.pileX,m=heapMetrics(profile.total,height);
  // The same rock material as the mine forms the cutaway's recessed back wall.
  if(!house.selfContained){
    drawMaterial(ctx,assets['cave-back'],{x:x+14,y:y+26,width:68,height:house.foot-26},{x:0,y:ground-80});
    ctx.fillStyle='#211c2859';ctx.fillRect(x+14,y+26,68,house.foot-26);
  }
  ctx.drawImage(assets.house,x,y);
  const finds=profile.finds||{},count=types.reduce((n,t)=>n+(finds[t]||0),0);
  if(count>12)m.pile=Math.max(25,m.pile);
  if(count&&m.pile){
    const small=count<=12?types.flatMap(type=>Array.from({length:finds[type]||0},()=>type)):null;
    if(small){
      for(let i=0;i<small.length;i++){
        const [dx,dy]=smallSlots[i];ctx.drawImage(assets['pile-'+small[i]]||assets[small[i]],left+dx,base-12+dy,12,12);
      }
    }else{
      const r=visiblePileRows(m.pile,base,view.top,view.bottom),vl=view.left??-Infinity,vr=view.right??Infinity;
      // Stepped silhouettes fill interior gaps without rectangular sprite clipping.
      ctx.fillStyle='#51454b';
      for(let row=r.first;row<=r.last;row++){
        if(row===r.rows-1)continue;
        const dy=row*5,bounds=pileRowBounds(m,dy),a=left+bounds.a,b=left+bounds.b;
        const l=Math.max(Math.floor(a)+3,vl),rr=Math.min(Math.ceil(b)+3,vr);
        if(rr>l)ctx.fillRect(l,base-dy-5,rr-l,5);
      }
      for(let row=r.first;row<=r.last;row++){
        if(row===r.rows-1)continue;
        const dy=row*5,bounds=pileRowBounds(m,dy),a=left+bounds.a,b=left+bounds.b;
        const first=Math.max(Math.ceil((a-left)/8),Math.floor((vl-left-12)/8));
        const last=Math.min(Math.floor((b-left)/8),Math.ceil((vr-left)/8));
        for(let col=first;col<=last;col++){
          const seed=row*92821+col*68917,type=earnedType(findsAtHeight(profile,row),seed),jitter=hash(seed+5)%3-1;
          ctx.drawImage(assets['pile-'+type]||assets[type],Math.round(left+col*8+(row%2)*2),base-12-row*5+jitter,12,12);
        }
      }
      // Anchor one summit find by its opaque top. Lateral spacing or a new
      // material must never make the recorded height drop after another haul.
      const summit=measuredTop(profile,m,meta),row=r.rows-1,type=earnedType(findsAtHeight(profile,row),row*92821);
      if(base-summit<view.bottom&&base-summit+20>view.top){
        const support=earnedType(findsAtHeight(profile,Math.max(0,row-1)),row*92821+5);
        ctx.drawImage(assets['pile-'+support]||assets[support],left+m.peak-6,base-summit+7,12,12);
        const y=base-summit-(meta.props.pile?.[type]?.top||0);
        ctx.drawImage(assets['pile-'+type]||assets[type],left+m.peak-6,y,12,12);
      }
    }
  }
  // The living room remains empty of treasure; the complete pile is outside.
  if(assets['house-front'])ctx.drawImage(assets['house-front'],x,y);
  m.height=measuredTop(profile,m,meta);
  const poleX=left+m.span+12;
  drawHeightPole(ctx,poleX,base,m,view);
  return {x:left,top:base-m.height,base,...m,poleX};
}
