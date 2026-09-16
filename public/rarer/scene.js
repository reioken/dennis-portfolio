import {findFor,cargoSlot,lootPosition} from './feedback.js?v=0b45fd07d30d';
import {surfaceAt,ceilingAt,wallAt,leftWallAt,railGround,cartFoot,mineLayout} from './geology.js?v=0b45fd07d30d';
import {pileHeight} from './progress.js?v=0b45fd07d30d';
import {drawMaterial,rebaseTween} from './terrain.js?v=0b45fd07d30d';
import {drawBurrow,heapMetrics} from './burrow.js?v=0b45fd07d30d';
const assetRoot='./assets/one-more-swing/';
const loadImage=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Missing art: '+src));img.src=assetRoot+src;});
const clamp=n=>Math.max(0,Math.min(1,n));
export class MineScene {
  constructor(canvas,reduced){
    this.canvas=canvas;this.hillside=canvas.dataset?.layout==='hillside';this.ctx=canvas.getContext('2d');this.reduced=reduced;this.assets={};this.slow=()=>false;this.raf=0;this.visible=false;this.activeTweens=0;this.effects=[];this.flight=null;this.haul=[];this.pack=[];this.home={total:0,finds:{}};this.homeFocus=true;this.atHome=false;this.state=this.freshState();this.poseStart=performance.now();
    new ResizeObserver(()=>this.resize()).observe(canvas);
    new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;this.ambient();}).observe(canvas);
    document.addEventListener('visibilitychange',()=>this.ambient());reduced.addEventListener('change',()=>this.ambient());this.resize();
  }
  freshState(){return {x:mineLayout.shaftX-(this.hillside?20:0),y:this.surface??54,edge:mineLayout.initialEdge,cam:0,viewY:0,pose:'idle',facing:1,crack:false,bust:false,reveal:0,revealCount:0,cartX:mineLayout.cartStart,deposit:0,pile:0};}
  async load(){
    const manifest=await fetch(assetRoot+'v11/manifest.json').then(r=>{if(!r.ok)throw new Error('Missing art manifest');return r.json();});
    await Promise.all(Object.entries(manifest.images).map(async([name,path])=>{this.assets[name]=await loadImage(path);}));
    this.meta=manifest;this.draw();this.ambient();return manifest;
  }
  resize(){
    const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
    const oldFloor=this.floor,oldSurface=this.surface,before={...this.state},oldDoor=this.w?this.doorX():0,oldWidth=this.w,oldHomeView=this.homeViewY();
    const oldTargets=this.hillside&&this.w?{home:this.homeCamera(true),ladder:this.ladderCamera(),play:this.cameraFor(this.state.edge),reveal:this.revealCamera()}:null;
    const oldCameraTarget=this.runningTween?.to.cam;
    // Fit the surface plot on small phones; larger views expose more world.
    // Assets stay at native coordinates and the browser scales the pixel canvas.
    const scale=Math.min(2,rect.width/(this.hillside?240:280));
    this.w=Math.max(1,Math.floor(rect.width/scale));const physicalHeight=Math.max(1,Math.floor(rect.height/scale));this.h=Math.max(128,physicalHeight);this.canvas.width=this.w;this.canvas.height=physicalHeight;
    // The keyboard view crops the sky. Use four pixels of its spare ground
    // margin so even the highest pickaxe frame clears the top of the viewport.
    this.floor=this.h-(physicalHeight<64?20:24);this.surface=this.hillside?this.floor-66:Math.max(45,this.h-100);this.ceiling=this.surface+7;
    if(oldFloor!=null){
      const underground=this.state.y>oldSurface+3;
      const depth=Math.max(0,Math.min(1,(this.state.y-oldSurface)/(oldFloor-oldSurface)));
      this.state.y=this.state.pose==='climb'?this.surface+depth*(this.floor-this.surface):underground?this.floor:this.surface;
      this.state.cam=this.homeFocus?this.homeCamera():this.state.reveal?this.revealCamera():this.cameraFor(this.state.edge);
      if(this.atHome)this.state.x=this.doorX();
      else if(this.homeFocus&&this.state.pose==='walk'&&this.state.y===this.surface){const t=(before.x-mineLayout.shaftX)/(oldDoor-mineLayout.shaftX);this.state.x=mineLayout.shaftX+t*(this.doorX()-mineLayout.shaftX);}
    }else this.state.y=this.surface;
    this.state.viewY=this.homeFocus?this.homeViewY():0;
    if(this.runningTween&&oldFloor!=null){
      for(const key of ['x','y','cam','viewY'])if(key in this.runningTween.to)this.state[key]=before[key];
      rebaseTween(this.runningTween,this.state,
        {floor:oldFloor,surface:oldSurface,width:oldWidth,homeView:oldHomeView,door:oldDoor,shaft:mineLayout.shaftX},
        {floor:this.floor,surface:this.surface,width:this.w,homeView:this.homeViewY(),door:this.doorX(),shaft:mineLayout.shaftX,homeWalk:this.homeFocus&&before.pose==='walk'&&before.y<=oldSurface+1,centered:this.hillside});
      if(oldTargets&&oldCameraTarget!=null){
        const methods={home:()=>this.homeCamera(true),ladder:()=>this.ladderCamera(),play:()=>this.cameraFor(this.state.edge),reveal:()=>this.revealCamera()};
        for(const key of Object.keys(oldTargets))if(Math.abs(oldTargets[key]-oldCameraTarget)<.01){this.runningTween.to.cam=methods[key]();break;}
      }
    }
    this.draw();
  }
  cameraFor(edge){return this.hillside?edge-(this.meta?.standOff??20)-this.w*.5:Math.max(0,edge-(this.w-34));}
  homeCamera(atHome=this.atHome){return this.hillside?(this.w<480?(atHome?this.houseX()+62:45):220)-this.w*.5:0;}
  ladderCamera(){return this.hillside?mineLayout.shaftX-this.w*.4:0;}
  standX(){return this.state.edge-(this.meta?.standOff??16);}
  revealCamera(){return this.hillside?this.state.edge+this.state.revealCount*14-this.w*.5:Math.max(0,this.state.edge+this.state.revealCount*28+18-this.w);}
  houseX(){return this.hillside?280:Math.max(117,this.w-170);}
  doorX(){const p=this.meta?.props?.house;return this.houseX()-(p?.anchorX??48)+(p?.doorX??29);}
  homeViewY(){
    if(this.hillside)return Math.max(0,this.h-this.canvas.height+Math.min(this.canvas.height-16,148)-this.surface);
    const p=this.meta?.props?.house,m=heapMetrics(this.home?.total??0),roofClearance=Math.max(0,Math.min(100,Math.max(80,(p?.foot??71)-(p?.top??12),m.height+16))+18-this.surface);
    // On a phone, frame the surface and let the parked cart sit fully below
    // the camera, rather than showing a thin slice of its rim at the bottom.
    const phone=(this.canvas.getBoundingClientRect?.().width??this.w*2)<480;
    return phone?Math.max(42,roofClearance):roofClearance;
  }
  setHome(profile){this.home=profile;this.state.pile=pileHeight(profile.total);this.draw();}
  reset(){this.state=this.freshState();this.homeFocus=true;this.atHome=false;this.state.cam=this.homeCamera();this.state.viewY=this.homeViewY();this.state.pile=pileHeight(this.home?.total??0);this.haul=[];this.pack=[];this.flight=null;this.effects=[];this.landedAt=0;this.poseStart=performance.now();this.canvas.setAttribute('aria-label','A mole waits by the ladder. A little house with an open treasure room stands to the right. '+(this.home?.total??0)+' total points brought home.');this.draw();}
  restore(run,profile){
    this.setHome(profile);this.reset();
    this.state.edge=mineLayout.initialEdge+run.chain.length*32;
    if(run.stage==='play'){
      this.homeFocus=false;this.state.viewY=0;this.state.x=this.standX();this.state.y=this.floor;this.state.cam=this.cameraFor(this.state.edge);
      this.haul=(run.cargo??run.chain).map(answer=>({...findFor(answer[1]),answer}));
      this.canvas.setAttribute('aria-label','Resumed dig. '+this.haul.length+' finds in your cart. '+profile.total+' points stored at home.');
    }else if(run.stage!=='home'){
      this.atHome=true;this.state.cam=this.homeCamera();this.state.x=this.doorX();this.state.bust=run.stage==='bust';
      this.canvas.setAttribute('aria-label','All earned finds are safely at home. '+profile.total+' total points.');
    }
    this.draw();
  }
  takeHaul(){this.pack=this.haul.splice(0);this.state.deposit=0;this.canvas.setAttribute('aria-label','The mole carries all '+this.pack.length+' finds in a backpack. The minecart is empty.');this.draw();}
  async spillHaul(count,points,all=false){
    const removed=this.haul.splice(Math.max(0,this.haul.length-count));
    const ground=railGround(this.floor);
    this.loss={start:performance.now(),duration:this.duration(1500),points,all,x:this.state.x,y:this.state.y,
      items:removed.slice(-12).map((item,i)=>({...item,from:cargoSlot(Math.min(11,this.haul.length+i),this.state.cartX,ground),i}))};
    this.canvas.setAttribute('aria-label',(all?'The entire haul spills out. ':'Some treasure spills out. ')+points+' points lost. '+this.haul.length+' finds remain in the cart.');
    this.pose('recoil');await this.hold(1500);this.loss=null;this.state.crack=false;this.state.bust=false;this.pose('idle');
  }
  drawLoss(ctx,now){
    const e=this.loss;if(!e)return;const t=e.duration?clamp((now-e.start)/e.duration):.3;
    ctx.save();
    for(const item of e.items){
      const p=clamp((t-item.i*.018)/.8),dir=item.i%2?-1:1;
      const x=item.from.x+dir*(24+item.i%4*9)*p,y=item.from.y-32*Math.sin(p*Math.PI)+38*p*p;
      ctx.globalAlpha=Math.max(0,1-p*p);ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.rotate(Math.floor(p*6)*Math.PI/2);this.sprite(ctx,item.asset,-8,-8);ctx.restore();
      for(let k=0;k<3;k++){ctx.fillStyle=k%2?'#ffad86':'#ef4c67';ctx.fillRect(Math.round(x-dir*k*5),Math.round(y-k*4),2,2);}
    }
    for(let i=0;i<24;i++){const angle=i*2.4,r=(12+i%6*7)*t;ctx.globalAlpha=1-t;ctx.fillStyle=i%3?'#ee526b':'#ffb09b';ctx.fillRect(Math.round(e.x+Math.cos(angle)*r),Math.round(e.y-26+Math.sin(angle)*r+22*t*t),i%4?2:3,2);}
    ctx.globalAlpha=t>.7?(1-t)/.3:1;ctx.font='bold 16px monospace';ctx.textAlign='center';ctx.lineWidth=3;ctx.strokeStyle='#251d2d';
    const label='−'+e.points.toLocaleString('en-US'),x=e.x+13,y=e.y-43-19*t;
    ctx.strokeText(label,Math.round(x),Math.round(y));ctx.fillStyle='#ff7885';ctx.fillText(label,Math.round(x),Math.round(y));ctx.restore();
  }
  async depositHaul(profile){
    this.state.deposit=0;this.atHome=true;this.homeFocus=true;
    this.state.x=this.doorX();this.state.y=this.surface;this.state.cam=this.homeCamera(true);this.state.viewY=this.homeViewY();
    await this.tween({deposit:1},550);
    this.pack=[];this.state.deposit=0;this.home=profile;
    await this.tween({pile:pileHeight(profile.total),viewY:this.homeViewY()},350);
    this.canvas.setAttribute('aria-label','The mole has delivered every find to the outdoor pile beside his home. A marked pole measures its height. '+profile.total+' total points. Open Your home to explore the whole pile.');this.draw();
  }
  duration(ms){return this.reduced.matches?0:ms*(this.slow()?2.5:1);}
  pose(name,facing=1){this.state.pose=name;this.state.facing=facing;this.poseStart=performance.now();this.draw();}
  ambient(){
    cancelAnimationFrame(this.raf);if(!this.visible||document.hidden||this.reduced.matches||!this.meta){this.draw();return;}
    let last=0;const loop=now=>{if(now-last>65&&!this.activeTweens){this.draw(now);last=now;}this.raf=requestAnimationFrame(loop);};this.raf=requestAnimationFrame(loop);
  }
  async tween(changes,ms){
    const start=performance.now(),d=this.duration(ms),from={...this.state};
    if(!d){Object.assign(this.state,changes);this.draw();return;}
    this.activeTweens++;const tween={from,to:{...changes}};this.runningTween=tween;
    try{await new Promise(resolve=>{const frame=now=>{const t=clamp((now-start)/d),ease=t*t*(3-2*t);for(const key of Object.keys(tween.to))this.state[key]=tween.from[key]+(tween.to[key]-tween.from[key])*ease;this.draw(now);if(t<1)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);});}finally{this.activeTweens--;if(this.runningTween===tween)this.runningTween=null;}
  }
  hold(ms){return this.tween({},ms);}
  strike(rarity,bust=false){
    this.state.crack=true;this.effects.push({start:performance.now(),duration:this.duration(760),x:this.state.edge+2,y:this.floor-25,find:findFor(rarity),bust});this.draw();
  }
  releaseFind(answer,wallX){this.flight={...findFor(answer[1]),answer,start:performance.now(),duration:this.duration(650),from:{x:wallX+6,y:this.floor-27}};}
  landFind(){if(!this.flight)return;this.haul.push(this.flight);this.flight=null;this.landedAt=performance.now();this.landDuration=this.duration(350);this.canvas.setAttribute('aria-label','Your cart holds '+this.haul.map(f=>f.name.toLowerCase()+' for '+f.answer[0]).join(', ')+'.');this.draw();}
  sprite(ctx,name,x,y,scale=1){const img=this.assets[name];if(img)ctx.drawImage(img,Math.round(x),Math.round(y),img.width*scale,img.height*scale);}
  draw(now=performance.now()){
    const ctx=this.ctx,{w,h,surface,floor,state:s,ceiling}=this;if(!w)return;
    const css=getComputedStyle(document.documentElement),sky=css.getPropertyValue('--sky').trim(),cave=css.getPropertyValue('--cave').trim(),dark=css.colorScheme==='dark';
    const pixel=(x,y,ww,hh,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),ww,hh);};
    const viewY=s.viewY??0;
    ctx.setTransform(1,0,0,1,0,this.canvas.height-h+Math.round(viewY));ctx.imageSmoothingEnabled=false;pixel(0,-viewY,w,h+viewY,sky);
    const cam=Math.round(s.cam);
    if(this.hillside)this.drawHills(ctx,cam,surface,w,dark);
    const horizon=this.assets[dark?'horizon-dark':'horizon'];
    if(horizon){ctx.globalAlpha=.7;for(let x=-Math.round(cam*.12)%horizon.width;x<w;x+=horizon.width)ctx.drawImage(horizon,x,surface-horizon.height+2);ctx.globalAlpha=1;}
    const cloudShift=this.reduced.matches?0:Math.floor(now/3500)%170;
    for(let x=-150;x<w+170;x+=170){const xx=x+cloudShift;pixel(xx,20,24,3,dark?'#443947':'#fffaee');pixel(xx+6,17,11,3,dark?'#443947':'#fffaee');}
    this.effects=this.effects.filter(e=>now-e.start<e.duration);
    const hit=this.effects.at(-1),hitT=hit?clamp((now-hit.start)/hit.duration):1;
    const kick=hitT<.2?Math.round(Math.sin(hitT*65)*(1-hitT/.2)*(hit.bust?2:1+hit.find.level/2)):0;
    ctx.save();ctx.translate(-cam+kick,0);
    this.drawRock(ctx,cam-kick,w+4);
    // One continuous silhouette joins the surface mouth, rounded left wall and
    // tunnel. All contour turns use whole pixels, including the shaft shoulders.
    this.cavePath(ctx);ctx.fillStyle=cave;ctx.fill();
    ctx.save();ctx.clip();
    drawMaterial(ctx,this.assets['cave-back'],{x:cam-kick-3,y:surface-8,width:w+6,height:floor-surface+16},{x:0,y:surface-8});
    ctx.restore();
    this.drawCaveEdges(ctx,cam-kick-4,w+8);
    this.drawSupports(ctx,now);
    this.drawLadder(ctx);
    this.drawLedge(ctx);
    const entrance=this.assets.entrance,ep=this.meta?.props?.entrance;
    if(entrance){
      const ew=ep?.width??entrance.width,eh=ep?.height??entrance.height,ea=ep?.anchorX??Math.round(ew/2),ef=ep?.foot??eh;
      ctx.drawImage(entrance,0,0,entrance.width,entrance.height,Math.round(mineLayout.shaftX-ea),Math.round(surface-ef),ew,eh);
    }
    this.drawHome(ctx,now);
    if(s.bust){ctx.save();ctx.beginPath();ctx.moveTo(s.edge+21,ceiling);for(let y=ceiling;y<floor;y+=3)ctx.lineTo(wallAt(y,s.edge,floor),y);ctx.lineTo(s.edge+21,floor);ctx.closePath();ctx.fillStyle='#303b4c99';ctx.fill();ctx.restore();}
    if(s.crack){ctx.strokeStyle='#302333';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(s.edge+8,floor-44);ctx.lineTo(s.edge+2,floor-34);ctx.lineTo(s.edge+7,floor-27);ctx.lineTo(s.edge+3,floor-12);ctx.moveTo(s.edge+7,floor-27);ctx.lineTo(s.edge+13,floor-23);ctx.stroke();}
    if(s.reveal&&s.revealCount){ctx.globalAlpha=s.reveal;for(let i=0;i<s.revealCount;i++){const x=s.edge+13+i*28,y=floor-29-i*5;this.sprite(ctx,'diamond',x,y);this.sparkle(ctx,x+8,y+8,'#ffe6a1',now+i*270,4);}ctx.globalAlpha=1;}
    if(s.y>surface+6&&s.pose!=='climb')s.cartX=Math.max(mineLayout.cartStart,s.x-26);
    // The cart occupies the rear depth plane, so the mole walks in front of its handle.
    this.drawCart(ctx,now);
    this.drawMiner(ctx,s.x,s.y,now);
    for(const e of this.effects)this.drawImpact(ctx,e,now);
    if(this.flight){
      const f=this.flight,t=f.duration?clamp((now-f.start)/f.duration):1,to=cargoSlot(Math.min(11,this.haul.length),s.cartX,railGround(floor)),p=lootPosition(f.from,to,t,ceiling),size=16*(1+(f.level*.07+.1)*Math.sin(Math.PI*t));
      ctx.drawImage(this.assets[f.asset],Math.round(p.x-size/2),Math.round(p.y-size/2),Math.round(size),Math.round(size));if(f.level>1)this.sparkle(ctx,p.x,p.y,f.color,now,12+f.level*2);
    }
    this.drawDeposit(ctx,now);
    this.drawLoss(ctx,now);
    ctx.restore();
    if(this.hillside){
      // A rocky silhouette, rather than a rectangular card edge, meets the page.
      ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle=sky;
      for(let x=0;x<w;x+=3){const depth=3+Math.round((Math.sin((x+cam)*.39)+Math.sin((x+cam)*.13)+2)*2);ctx.fillRect(x,this.canvas.height-depth,3,depth);}
    }
  }
  drawHills(ctx,cam,surface,w,dark){
    const colors=dark?['#302b3e','#3c3247','#504051']:['#ede0dc','#d9c2cd','#b89caf'];
    for(let layer=0;layer<3;layer++){
      ctx.fillStyle=colors[layer];ctx.beginPath();ctx.moveTo(0,surface);
      for(let x=-8;x<=w+8;x+=4){const world=x+cam*(.05+layer*.045),height=20+layer*4+Math.sin(world*.013+layer*5)*14+Math.sin(world*.037+layer)*8;ctx.lineTo(x,Math.round((surface-height)/2)*2);}
      ctx.lineTo(w+8,surface);ctx.closePath();ctx.fill();
    }
  }
  drawHome(ctx,now){
    const p=this.meta?.props?.house;if(!p||!this.assets.house)return;
    // The room floor shares the ground line of the path from the shaft.
    const end=this.houseX()-p.anchorX+p.pileX+heapMetrics(this.home.total,this.state.pile).span+20;
    ctx.fillStyle='#625244';ctx.fillRect(mineLayout.shaftRight,this.surface,end-mineLayout.shaftRight,4);
    for(let xx=mineLayout.shaftRight;xx<this.doorX()+8;xx+=9){ctx.fillStyle=xx%2?'#b09a7c':'#94816a';ctx.fillRect(xx,this.surface,7,1);}
    const top=this.h-this.canvas.height-(this.state.viewY??0);
    const m=drawBurrow(ctx,this.assets,this.meta,this.home,this.houseX(),this.surface,this.state.pile,{top,bottom:top+this.canvas.height,left:this.state.cam-12,right:this.state.cam+this.w+12});
    if(m&&this.state.deposit>0)this.sparkle(ctx,m.x+20,this.surface-18,'#ffe6a1',now,10);
  }
  packSlot(index,rear=false){return {x:(rear?0:-16)+(index%3-1)*(rear?8:5),y:(rear?-18:-24)-Math.floor(index/3)*5};}
  drawPack(ctx,rear,now){
    if(!this.pack?.length)return;
    const bounce=this.reduced.matches?0:Math.floor(now/140)%2;
    this.sprite(ctx,rear?'pack-rear':'pack-side',rear?-12:-27,(rear?-23:-27)+bounce);
    for(const [i,item] of this.pack.slice(-9).entries()){
      if(this.state.deposit>0)continue;
      const p=this.packSlot(i,rear);ctx.drawImage(this.assets[item.asset],p.x-6,p.y-6+bounce,12,12);
    }
  }
  drawDeposit(ctx,now){
    const t=this.state.deposit,p=this.meta?.props?.house;if(!t||!this.pack?.length||!p)return;
    // Toss the load onto the outdoor heap, clear of the roof and living room.
    const m=heapMetrics(this.home.total,this.state.pile),x=this.houseX()-p.anchorX+p.pileX+m.peak,y=this.surface-Math.max(12,m.height);
    for(const [i,item] of this.pack.slice(-9).entries()){
      const phase=clamp((t-i*.07)/(1-i*.07)),from=this.packSlot(i),xx=this.state.x+from.x,yy=this.state.y+from.y;
      const px=xx+(x+(i%3-1)*5-xx)*phase,py=yy+(y-yy)*phase-12*Math.sin(phase*Math.PI),size=Math.round(12-4*phase);
      ctx.drawImage(this.assets[item.asset],Math.round(px-size/2),Math.round(py-size/2),size,size);
      if(item.level===3)this.sparkle(ctx,px,py,item.color,now+i*70,5);
    }
  }
  cavePath(ctx){
    const {surface,floor,ceiling,state:s}=this,{shaftLeft,shaftRight}=mineLayout;
    ctx.beginPath();ctx.moveTo(shaftLeft,surface);ctx.lineTo(shaftRight,surface);
    let previous=ceilingAt(shaftRight,ceiling);ctx.lineTo(shaftRight,previous);
    for(let x=shaftRight+2;x<s.edge;x+=2){const next=ceilingAt(x,ceiling);ctx.lineTo(x,previous);ctx.lineTo(x,next);previous=next;}
    ctx.lineTo(s.edge,previous);
    let wall=s.edge;
    for(let y=previous+2;y<floor;y+=2){const next=wallAt(y,s.edge,floor);ctx.lineTo(wall,y);ctx.lineTo(next,y);wall=next;}
    ctx.lineTo(s.edge,floor);ctx.lineTo(leftWallAt(floor,surface,floor),floor);
    let left=leftWallAt(floor,surface,floor);
    for(let y=floor-2;y>surface;y-=2){const next=leftWallAt(y,surface,floor);ctx.lineTo(left,y);ctx.lineTo(next,y);left=next;}
    ctx.lineTo(shaftLeft,surface);ctx.closePath();
  }
  drawLadder(ctx){
    const img=this.assets.ladder;if(!img)return;
    const p=this.meta?.props?.ladder;
    if(p){
      const top=this.surface-6,height=this.floor-top;
      this.drawFittedColumn(ctx,img,p,mineLayout.shaftX-p.width/2,top,height);
      if(this.state.y<=this.surface+1&&this.state.pose!=='climb')this.sprite(ctx,'hatch',mineLayout.shaftLeft,this.surface-1);
      return;
    }
    const top=this.surface-5,end=this.floor,x=mineLayout.shaftX-10;
    ctx.drawImage(img,0,0,20,10,x,top,20,10);
    for(let y=top+10;y<end-10;y+=21){const height=Math.min(21,end-10-y);ctx.drawImage(img,0,12,20,height,x,y,20,height);}
    ctx.drawImage(img,0,54,20,10,x,end-10,20,10);
    // A closed hatch gives the surface idle pose a real platform. It opens as
    // soon as the climb begins, leaving the ladder's top rungs accessible.
    if(this.state.y<=this.surface+1&&this.state.pose!=='climb'&&this.assets.track){
      ctx.drawImage(this.assets.track,9,2,24,3,mineLayout.shaftLeft,this.surface-1,28,3);
    }
  }
  drawFittedColumn(ctx,img,p,x,y,height){
    // Native-size head, repeat socket and foot. Never scale pixels or clip an
    // outside edge; the repeat socket contains only the straight upright.
    ctx.drawImage(img,0,0,p.width,p.head,x,y,p.width,p.head);
    const footStart=height-p.footHeight;
    for(let row=p.head;row<footStart;row+=p.repeatHeight){const count=Math.min(p.repeatHeight,footStart-row);ctx.drawImage(img,0,p.repeatY,p.width,count,x,y+row,p.width,count);}
    ctx.drawImage(img,0,p.footY,p.width,p.footHeight,x,y+footStart,p.width,p.footHeight);
  }
  drawSupports(ctx,now){
    const img=this.assets.support;if(!img)return;
    for(let x=70;x<this.state.edge-27;x+=94){
      const roof=ceilingAt(x,this.ceiling)-2,foot=this.floor;
      const p=this.meta?.props?.support;
      // Continue a cropped section of the generated post, keeping pixel scale
      // constant when the desktop cave is taller than the phone cave.
      if(p){const top=roof-p.top;this.drawFittedColumn(ctx,img,p,x,top,foot-top+p.paddingBottom);}
      else {for(let y=roof+20;y<foot;y+=8){const height=Math.min(8,foot-y);ctx.drawImage(img,0,24,8,height,x,y,8,height);}ctx.drawImage(img,0,0,24,25,x,roof,24,25);}
      const pulse=this.reduced.matches?0:Math.sin(now/730+x)*.008;
      const lx=x+19,ly=roof+15;
      for(let ring=3;ring>0;ring--){ctx.fillStyle=`rgba(239,187,109,${.022+pulse})`;ctx.fillRect(lx-ring*6,ly-ring*5,ring*12,ring*10);}
      this.sprite(ctx,'lantern',x+13,roof+6);
    }
  }
  drawLedge(ctx){
    const start=leftWallAt(this.floor,this.surface,this.floor),end=this.state.edge;
    // The walkable top is continuous; its fractured depth varies below the
    // boots, without clipping a row of boulders into rectangular fragments.
    for(let x=start;x<end;x++){
      const depth=3+Math.round((Math.sin(x*.19)+1)*1.5);
      ctx.fillStyle='#a38a6c';ctx.fillRect(x,this.floor,1,1);
      ctx.fillStyle='#736052';ctx.fillRect(x,this.floor+1,1,depth);
      ctx.fillStyle='#4d4041';ctx.fillRect(x,this.floor+1+depth,1,1);
      if(x%13===5){ctx.fillStyle='#594847';ctx.fillRect(x,this.floor+1,1,2);}
    }
  }
  drawCaveEdges(ctx,left,width){
    const {surface,floor,ceiling,state:s}=this,end=Math.ceil(left+width);
    // Stepped contours finish the exposed cross section on the rock side.
    // The shapes derive from the same coordinates as the excavated cavity.
    for(let x=Math.max(mineLayout.shaftRight,Math.floor(left));x<Math.min(s.edge,end);x++){
      const y=ceilingAt(x,ceiling),depth=2+Math.round((Math.sin(x*.31)+1)*1.5);
      ctx.fillStyle='#4a3b3e';ctx.fillRect(x,y-depth,1,depth);
      ctx.fillStyle='#ac9070';ctx.fillRect(x,y-depth,1,1);
      ctx.fillStyle='#211e2c';ctx.fillRect(x,y,1,2);
    }
    for(let y=ceiling+2;y<floor;y++){
      const x=wallAt(y,s.edge,floor);if(x<left-5||x>end+5)continue;
      const depth=3+Math.round((Math.sin(y*.37)+1)*1.5);
      ctx.fillStyle='#261f2b';ctx.fillRect(x-1,y,2,1);
      ctx.fillStyle='#735d50';ctx.fillRect(x+1,y,depth,1);
      if(y%11<7){ctx.fillStyle='#aa8969';ctx.fillRect(x+depth,y,1,1);}
    }
    for(let y=surface+1;y<floor;y++){
      const x=leftWallAt(y,surface,floor);if(x<left-5||x>end+5)continue;
      ctx.fillStyle='#715d50';ctx.fillRect(x-4,y,4,1);
      ctx.fillStyle='#a48a6c';ctx.fillRect(x-4,y,1,1);
      ctx.fillStyle='#24202c';ctx.fillRect(x,y,2,1);
    }
  }
  drawRock(ctx,left,width){
    const {surface,h}=this,start=Math.floor(left)-2,end=Math.ceil(left+width)+2;
    ctx.save();ctx.beginPath();ctx.moveTo(start,h+2);ctx.lineTo(start,surfaceAt(start,surface));
    for(let x=start;x<end;x++){const y=surfaceAt(x,surface);ctx.lineTo(x,y);ctx.lineTo(x+1,y);}
    ctx.lineTo(end,h+2);ctx.closePath();ctx.clip();
    ctx.fillStyle='#655649';ctx.fillRect(start,surface-3,end-start,h-surface+5);
    drawMaterial(ctx,this.assets.terrain,{x:start,y:surface-3,width:end-start,height:h-surface+5},{x:0,y:surface-27});
    // A coherent weathered crust hides arbitrary cuts through the fill art.
    for(let x=start;x<end;x++){
      const y=surfaceAt(x,surface),depth=3+Math.round((Math.sin(x*.23)+1)*1.5);
      ctx.fillStyle='#baa082';ctx.fillRect(x,y,1,1);
      ctx.fillStyle='#7c6653';ctx.fillRect(x,y+1,1,depth);
      ctx.fillStyle='#4e3f40';ctx.fillRect(x,y+depth+1,1,1);
    }
    ctx.restore();
  }
  drawRails(ctx){
    const img=this.assets.track;if(!img)return;
    const floor=this.floor,start=mineLayout.trackStart,end=this.state.edge-7;
    if(this.meta?.props?.track){
      const p=this.meta.props.track,unit=p.tileWidth,count=Math.max(0,Math.floor((end-start-unit*2)/unit)),y=floor+p.offset;
      if(this.assets['track-bed-0']){
        for(let i=0;i<Math.ceil((count+2)*unit/16);i++)this.sprite(ctx,'track-bed-'+i%3,start+i*16,floor+p.bedOffset);
      }
      this.sprite(ctx,'track-start',start,y);
      for(let i=0;i<count;i++)this.sprite(ctx,'track-tile',start+unit+i*unit,y);
      this.sprite(ctx,'track-end',start+(count+1)*unit,y);
      return;
    }
    ctx.save();ctx.beginPath();ctx.rect(start-1,floor+1,end-start+2,20);ctx.clip();
    ctx.fillStyle='#211f2855';ctx.fillRect(start,floor+4,end-start,14);
    for(let x=start;x<end;x+=img.width)ctx.drawImage(img,x,floor+3);
    ctx.restore();
  }
  drawCart(ctx,now){
    const x=this.state.cartX,ground=railGround(this.floor),t=this.landDuration?clamp((now-this.landedAt)/this.landDuration):1;
    const settle=t<1?Math.round(Math.sin(t*Math.PI*3)*(1-t)):0;
    const roll=this.state.pose==='walk'&&!this.reduced.matches?Math.round(Math.sin(now/92)):0;
    const p=this.meta?.props?.cart??{anchorX:16,foot:cartFoot,frontY:10,width:32,height:32};
    const cart=this.assets.cart,top=ground-p.foot+roll;
    // PixelLab's cart keeps a generous transparent margin. Draw it into the
    // manifest footprint so the visible hopper stays compact behind the mole.
    if(cart)ctx.drawImage(cart,0,0,cart.width,cart.height,Math.round(x-p.anchorX),Math.round(top),p.width,p.height);
    for(const [i,item]of this.haul.slice(-12).entries()){const p=cargoSlot(i,x,ground),img=this.assets[item.asset];this.sprite(ctx,item.asset,p.x-img.width/2,p.y-img.height/2+settle+roll);if(item.level===3&&!this.reduced.matches)this.sparkle(ctx,p.x,p.y+roll,item.color,now+i*220,8);}
    if(this.haul.length>12){ctx.fillStyle='#fff2d9';ctx.font='8px monospace';ctx.textAlign='center';ctx.fillText('×'+this.haul.length,x,ground-36);}
    // Repaint the hopper's front over the cargo, with its wheels fixed to the rail.
    if(cart){const sourceY=Math.round((p.frontY/p.height)*cart.height),sourceHeight=Math.max(1,cart.height-sourceY),destHeight=p.height-p.frontY;ctx.drawImage(cart,0,sourceY,cart.width,sourceHeight,Math.round(x-p.anchorX),Math.round(top+p.frontY),p.width,destHeight);}
  }
  drawImpact(ctx,e,now){
    if(!e.duration)return;const t=clamp((now-e.start)/e.duration),pixel=(x,y,w,h,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),w,h);};
    // Larger pieces of the actual face make the cleared space feel excavated.
    if(!e.bust&&this.assets.terrain){
      for(let i=0;i<4;i++){
        const age=clamp((t-.08)/.75);if(!age)continue;
        const x=e.x-(12+i*5)*age,y=this.floor-44+i*9-12*Math.sin(age*Math.PI)+26*age*age;
        ctx.save();ctx.globalAlpha=1-age;ctx.translate(Math.round(x),Math.round(Math.min(this.floor-3,y)));ctx.rotate(Math.floor(age*3+i%2)*Math.PI/2);ctx.drawImage(this.assets.terrain,(e.x+i*21)%(this.assets.terrain.width-8),30+i*16,8,8,-4,-4,8,8);ctx.restore();
      }
    }
    for(let i=0;i<(e.bust?11:e.find.chips);i++){
      const a=i*2.399,x=e.x-Math.abs(Math.cos(a))*(9+i%7*4)*t,y=e.y+Math.sin(a)*(13+i%4*5)*t+29*t*t;ctx.globalAlpha=1-t;
      pixel(x,Math.min(this.floor-1,y),i%3===0?3:2,i%3===0?3:2,e.bust?(i%2?'#aba7ae':'#696775'):i%3===0?e.find.color:i%2?'#b8a58c':'#776b64');
    }
    if(t<.24){ctx.globalAlpha=1-t/.24;const r=5+t*40;pixel(e.x-r,e.y-1,5,2,e.bust?'#d4cdd7':e.find.color);pixel(e.x-2,e.y-r,2,5,e.bust?'#d4cdd7':e.find.color);pixel(e.x-6,e.y+6,3,3,'#fff0d4');}
    if(!e.bust&&e.find.level>1&&t<.7){ctx.globalAlpha=1-t/.7;this.sparkle(ctx,e.x-9,e.y-3,e.find.color,now,10+16*t);}ctx.globalAlpha=1;
  }
  sparkle(ctx,x,y,color,now,r){
    const phase=this.reduced.matches?1:Math.floor(now/110)%4;ctx.fillStyle=color;
    for(let i=0;i<3;i++){const a=i*2.1+.3,xx=Math.round(x+Math.cos(a)*r),yy=Math.round(y+Math.sin(a)*r);ctx.fillRect(xx,yy,1,1);if((i+phase)%3===0){ctx.fillRect(xx-2,yy,5,1);ctx.fillRect(xx,yy-2,1,5);}}
  }
  frameFor(kind,elapsed){
    if(!this.meta)return null;const anim=this.meta.animations[kind]||this.meta.animations.idle,total=anim.frames.reduce((sum,f)=>sum+f.duration,0);let time=this.reduced.matches?0:elapsed/(this.slow()?2.5:1);time=anim.loop?time%total:Math.min(time,total-1);
    for(const frame of anim.frames){if(time<frame.duration)return frame;time-=frame.duration;}return anim.frames.at(-1);
  }
  drawMiner(ctx,x,y,now){
    if(!this.assets.idle||!this.meta)return;const kind=this.meta.animations[this.state.pose]?this.state.pose:'idle',frame=this.frameFor(kind,now-this.poseStart);
    const width=this.meta.frameWidth,height=this.meta.frameHeight,anchor=this.meta.footAnchor;
    ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(this.state.facing,1);
    const rear=kind==='climb';if(!rear)this.drawPack(ctx,false,now);
    ctx.drawImage(this.assets[kind],frame.index*width,0,width,height,-anchor.x,-anchor.y,width,height);
    if(rear&&this.pack?.length){
      this.drawPack(ctx,true,now);
      // The load sits behind his head. Keep the full helmet silhouette clear.
      ctx.drawImage(this.assets[kind],frame.index*width,0,width,31,-anchor.x,-anchor.y,width,31);
    }
    ctx.restore();
  }
  drawShowcase(canvas,now){
    if(!this.assets.idle)return;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,192,192);ctx.imageSmoothingEnabled=false;const frame=this.frameFor('idle',now),width=this.meta.frameWidth,height=this.meta.frameHeight;ctx.drawImage(this.assets.idle,frame.index*width,0,width,height,0,0,192,192);
  }
}
