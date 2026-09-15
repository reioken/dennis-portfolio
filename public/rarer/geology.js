// Stable world coordinates keep the rock edge from changing as the camera moves.
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const noise=(x,scale,seed)=>{const p=x/scale,i=Math.floor(p),t=p-i;return hash(i+seed)*(1-t)+hash(i+seed+1)*t;};
export const mineLayout=Object.freeze({shaftX:45,shaftLeft:31,shaftRight:59,initialEdge:118,cartStart:65,trackStart:35});
export const surfaceAt=(x,y)=>x<73?y:y+Math.round(noise(x,23,4)*5-2);
export const leftWallAt=(y,surface,floor)=>{
  const t=Math.max(0,Math.min(1,(y-surface)/(floor-surface)));
  return Math.round(31-8*Math.sin(t*Math.PI)+noise(y,11,47)*3);
};
export const ceilingAt=(x,y)=>y+Math.round(noise(x,19,17)*6);
export const wallAt=(y,edge,floor)=>y>floor-3?edge:edge+Math.round(noise(y,13,29)*8-4);
// The rails are the tunnel's walking surface. Keep their top edge on the
// miner's foot baseline so the cart wheels and mole feet share one plane.
export const railGround=floor=>floor;
export const minerFoot=41;
export const cartFoot=30;
