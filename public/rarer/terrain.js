// Texture phase belongs to the world, never to the viewport or a chunk.
// A rectangle may cross any number of horizontal and vertical repeat seams.
export function materialTiles(image,bounds,origin={x:0,y:0}){
  if(!image?.width||!image?.height||bounds.width<=0||bounds.height<=0)return [];
  const left=Math.floor(bounds.x),top=Math.floor(bounds.y),right=Math.ceil(bounds.x+bounds.width),bottom=Math.ceil(bounds.y+bounds.height);
  const firstX=Math.floor((left-origin.x)/image.width),firstY=Math.floor((top-origin.y)/image.height),tiles=[];
  for(let row=firstY;row*image.height+origin.y<bottom;row++){
    for(let col=firstX;col*image.width+origin.x<right;col++)tiles.push({x:col*image.width+origin.x,y:row*image.height+origin.y});
  }
  return tiles;
}
export function drawMaterial(ctx,image,bounds,origin){
  if(!image)return;
  ctx.save();ctx.beginPath();ctx.rect(Math.floor(bounds.x),Math.floor(bounds.y),Math.ceil(bounds.x+bounds.width)-Math.floor(bounds.x),Math.ceil(bounds.y+bounds.height)-Math.floor(bounds.y));ctx.clip();
  for(const tile of materialTiles(image,bounds,origin))ctx.drawImage(image,tile.x,tile.y);
  ctx.restore();
}
// Rebase a tween's already-computed destination when layout geometry changes.
// This prevents an old phone coordinate from being written back after resize.
export function rebaseTween(tween,state,before,after){
  if(!tween)return;
  const maps={
    y:value=>after.surface+(value-before.surface)/(before.floor-before.surface)*(after.floor-after.surface),
    cam:value=>after.centered?value-(after.width-before.width)/2:Math.max(0,value-(after.width-before.width)),
    viewY:value=>after.centered?value+after.homeView-before.homeView:before.homeView?value*after.homeView/before.homeView:0,
    x:value=>after.homeWalk?after.shaft+(value-before.shaft)/(before.door-before.shaft)*(after.door-after.shaft):value
  };
  for(const key of Object.keys(maps))if(key in tween.to){
    state[key]=maps[key](state[key]);tween.from[key]=maps[key](tween.from[key]);tween.to[key]=maps[key](tween.to[key]);
  }
}
