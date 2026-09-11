/** Enlarge physical controls, then partition shared space so neighbouring actions never overlap.
 * @param {Record<string, {x:number,y:number,w:number,h:number}>} rects
 * @returns {Record<string, {x:number,y:number,w:number,h:number}>}
 */
export function controlTargets(rects) {
 const entries = Object.entries(rects).map(([name,r]) => {
  const w=Math.max(name==='joy'||name==='trackball'?88:44,r.w), h=Math.max(44,r.h);
  return {name,cx:r.x+r.w/2,cy:r.y+r.h/2,x:r.x+r.w/2-w/2,y:r.y+r.h/2-h/2,w,h};
 });
 for(let i=0;i<entries.length;i++) for(let j=i+1;j<entries.length;j++) {
  const a=entries[i],b=entries[j];
  if(a.x+a.w<=b.x || b.x+b.w<=a.x || a.y+a.h<=b.y || b.y+b.h<=a.y) continue;
  const dx=b.cx-a.cx,dy=b.cy-a.cy;
  if(Math.abs(dx)/(a.w+b.w)>=Math.abs(dy)/(a.h+b.h)) {
   const [l,r]=dx>=0?[a,b]:[b,a], split=(l.cx+r.cx)/2;
   const end=r.x+r.w; l.w=Math.max(0,Math.min(l.x+l.w,split)-l.x); r.x=Math.max(r.x,split); r.w=Math.max(0,end-r.x);
  } else {
   const [t,bottom]=dy>=0?[a,b]:[b,a], split=(t.cy+bottom.cy)/2;
   const end=bottom.y+bottom.h; t.h=Math.max(0,Math.min(t.y+t.h,split)-t.y); bottom.y=Math.max(bottom.y,split); bottom.h=Math.max(0,end-bottom.y);
  }
 }
 return Object.fromEntries(entries.map(({name,x,y,w,h})=>[name,{x,y,w,h}]));
}
