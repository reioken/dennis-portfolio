import {drawBurrow,heapMetrics,pileHeight} from './burrow.js?v=34cffeeb0050';
import {drawMaterial} from './terrain.js?v=34cffeeb0050';
const clamp=n=>Math.max(0,Math.min(1,n));
export class BurrowView{
  constructor(dialog,scene){
    this.dialog=dialog;this.scene=scene;this.canvas=dialog.querySelector('canvas');this.scroll=dialog.querySelector('.burrow-scroll');this.spacer=dialog.querySelector('.burrow-space');this.profile={total:0,finds:{}};
    this.scroll.addEventListener('scroll',()=>this.draw(),{passive:true});
    new ResizeObserver(()=>this.layout()).observe(this.scroll);
    dialog.querySelector('[data-burrow="top"]').onclick=()=>this.go('top');
    dialog.querySelector('[data-burrow="door"]').onclick=()=>this.go('door');
    dialog.querySelector('[data-burrow="close"]').onclick=()=>dialog.close();
  }
  center(){return 58;}
  open(profile){
    this.profile=profile;const p=this.scene.meta.props.house,m=heapMetrics(profile.total);
    const desired=(Math.max(80,p.foot-p.top,m.height+16)+48)*2;
    this.scroll.style.height='max(150px, min(48dvh, '+desired+'px))';
    this.dialog.showModal();this.layout();this.go('door');
  }
  layout(){
    if(!this.dialog.open||!this.scene.meta)return;
    this.scale=Math.min(2,this.scroll.clientWidth/225);
    this.canvas.width=Math.floor(this.scroll.clientWidth/this.scale);this.canvas.height=Math.floor(this.scroll.clientHeight/this.scale);
    const w=this.canvas.width,h=this.canvas.height,m=heapMetrics(this.profile.total),p=this.scene.meta.props.house;
    this.worldHeight=Math.max(h,Math.max(80,p.foot-p.top,m.height+16)+48);
    this.pileLeft=this.center()-p.anchorX+p.pileX;
    this.worldWidth=Math.max(w,this.pileLeft+m.span+50);
    this.canvas.style.width=w*this.scale+'px';this.canvas.style.height=h*this.scale+'px';
    this.spacer.style.height=Math.min(500000,this.worldHeight*this.scale)+'px';
    this.spacer.style.width=Math.min(500000,this.worldWidth*this.scale)+'px';
    this.spacer.style.marginTop=-h*this.scale+'px';
    this.dialog.querySelector('#burrow-total').textContent=this.profile.total.toLocaleString('en-US')+' points brought home';
    this.dialog.querySelector('#burrow-finds').textContent=Object.values(this.profile.finds).reduce((n,v)=>n+v,0).toLocaleString('en-US')+' finds · '+(this.profile.rounds||0).toLocaleString('en-US')+' digs';
    this.draw();
  }
  go(where){
    this.scroll.scrollTop=where==='top'?0:this.scroll.scrollHeight;
    const m=heapMetrics(this.profile.total),target=where==='top'?this.pileLeft+m.peak-this.canvas.width*.5:0;
    this.scroll.scrollLeft=clamp(target/Math.max(1,this.worldWidth-this.canvas.width))*Math.max(0,this.scroll.scrollWidth-this.scroll.clientWidth);
    this.draw();
  }
  draw(){
    if(!this.dialog.open||!this.scene.meta||!this.worldHeight)return;
    const ctx=this.canvas.getContext('2d'),w=this.canvas.width,h=this.canvas.height;
    const maxY=Math.max(1,this.scroll.scrollHeight-this.scroll.clientHeight),maxX=Math.max(1,this.scroll.scrollWidth-this.scroll.clientWidth);
    const offset=Math.round(this.scroll.scrollTop/maxY*Math.max(0,this.worldHeight-h)),cam=Math.round(this.scroll.scrollLeft/maxX*Math.max(0,this.worldWidth-w));
    const ground=this.worldHeight-24,center=this.center(),css=getComputedStyle(document.documentElement),dark=css.colorScheme==='dark';
    ctx.setTransform(1,0,0,1,0,0);ctx.imageSmoothingEnabled=false;ctx.fillStyle=css.getPropertyValue('--sky');ctx.fillRect(0,0,w,h);
    ctx.save();ctx.translate(-cam,-offset);
    const horizon=this.scene.assets[dark?'horizon-dark':'horizon'];
    if(horizon&&ground-offset<h+horizon.height){ctx.globalAlpha=.6;for(let x=Math.floor(cam/horizon.width)*horizon.width;x<cam+w;x+=horizon.width)ctx.drawImage(horizon,x,ground-horizon.height);ctx.globalAlpha=1;}
    ctx.fillStyle=dark?'#514657':'#ead8b7';
    for(let y=Math.floor(offset/95)*95;y<offset+h;y+=95){const x=cam+18+((y*13)%Math.max(20,w-55));ctx.fillRect(x,y+12,22,2);ctx.fillRect(x+5,y+10,10,2);}
    if(ground<offset+h){
      drawMaterial(ctx,this.scene.assets.terrain,{x:cam,y:ground+1,width:w,height:Math.max(0,offset+h-ground)},{x:0,y:ground-27});
      ctx.fillStyle='#aa9171';ctx.fillRect(cam,ground,w,1);ctx.fillStyle='#736052';ctx.fillRect(cam,ground+1,w,3);
    }
    const m=drawBurrow(ctx,this.scene.assets,this.scene.meta,this.profile,center,ground,pileHeight(this.profile.total),{top:offset,bottom:offset+h,left:cam-12,right:cam+w+12});
    if(ground>offset&&ground<offset+h+25){
      const p=this.scene.meta.props.house,moleX=center-p.anchorX+p.doorX;
      ctx.save();ctx.translate(moleX,ground);
      const frame=this.scene.meta.animations.idle.frames[0],a=this.scene.meta.footAnchor;
      ctx.drawImage(this.scene.assets.idle,frame.index*this.scene.meta.frameWidth,0,this.scene.meta.frameWidth,this.scene.meta.frameHeight,-a.x,-a.y,this.scene.meta.frameWidth,this.scene.meta.frameHeight);ctx.restore();
    }
    ctx.restore();
    const atBase=this.scroll.scrollTop>=maxY-2&&this.scroll.scrollLeft<2;
    this.canvas.setAttribute('aria-label','An open shelter with an outdoor treasure pile to its right and a measuring pole marked in metres. '+this.profile.total+' lifetime points. '+(atBase?'At the shelter.':this.scroll.scrollTop<2?'At the top of the pile.':'Exploring the pile.'));
  }
}
