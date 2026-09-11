import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { cabinetWidth } from './hallLayout';
import type { HallItem } from './Hall';

const MAX_STATIONS=20;
/** Local emitters never follow the composition offset of the camera. */
export class HallLighting {
 readonly positions={value:Array.from({length:MAX_STATIONS},()=>new THREE.Vector2(1000,1))};
 readonly colors={value:Array.from({length:MAX_STATIONS},()=>new THREE.Vector3())};
 readonly count={value:0};
 readonly power={value:1};
 private focus=0; private initialized=false;
 private weights:number[]=[];
 private palette:THREE.Color[]=[];
 private slots:{index:number;screen:THREE.RectAreaLight;key:THREE.RectAreaLight;gain:number}[]=[];
 readonly resources:THREE.Texture[]=[];
 private maps:Record<string,THREE.Texture>={};
 constructor(private scene:THREE.Scene,private items:HallItem[],private xs:number[],loader:THREE.TextureLoader,private lite:boolean){
  RectAreaLightUniformsLib.init();this.count.value=Math.min(items.length,MAX_STATIONS);
  items.slice(0,MAX_STATIONS).forEach((it,i)=>{const color=new THREE.Color(it.kind==='kasse'||it.kind==='phone'?'#b7b9df':('brand' in it ? it.brand.primary : '#c3bbd4'));this.palette.push(color);this.weights.push(.12);this.positions.value[i].set(xs[i],cabinetWidth(it.slug)/.96);});
  for(const surface of ['floor','wall'])for(const kind of ['bounce','contact']){const key=surface+'-'+kind;const map=loader.load('/textures/hall-light/'+key+'-v1.webp');map.colorSpace=THREE.NoColorSpace;this.maps[key]=map;this.resources.push(map);}
  for(let i=0;i<3;i++){const screen=new THREE.RectAreaLight(0xffffff,0,.8,.55),key=new THREE.RectAreaLight(0xe3deed,0,1.8,.7);screen.name='hall-screen-light';key.name='hall-overhead-light';scene.add(screen,key);this.slots.push({index:-1,screen,key,gain:0});}
 }
 setFocus(index:number){this.focus=index;if(!this.initialized){this.initialized=true;this.weights=this.items.map((_,i)=>i===index?1:Math.abs(i-index)===1?.32:.1);this.update(1,true);}}
 update(dt:number,inHall:boolean){let moving=false;const alpha=1-Math.exp(-dt*7);
  const desired=[this.focus,this.focus-1,this.focus+1].filter(i=>i>=0&&i<this.items.length);
  for(let i=0;i<this.weights.length;i++){const d=Math.abs(i-this.focus),target=d===0?1:inHall?(d===1?.34:.11):.065;const next=this.weights[i]+(target-this.weights[i])*alpha;moving ||=Math.abs(target-next)>.002;this.weights[i]=Math.abs(target-next)<.002?target:next;const c=this.palette[i];this.colors.value[i].set(c.r,c.g,c.b).multiplyScalar(this.weights[i]);}
  for(const slot of this.slots){if(!desired.includes(slot.index)){slot.gain*=Math.exp(-dt*22);moving ||=slot.gain>.005;if(slot.gain<.005){slot.index=desired.find(i=>!this.slots.some(s=>s.index===i))??-1;slot.gain=0;}}
   if(slot.index<0){slot.screen.intensity=slot.key.intensity=0;continue;}
   const idx=slot.index;const target=desired.includes(idx)?1:0;if(target){slot.gain+=(1-slot.gain)*alpha;moving ||=1-slot.gain>.002;if(1-slot.gain<.002)slot.gain=1;}
   const x=this.xs[idx],w=cabinetWidth(this.items[idx].slug),weight=this.weights[idx]*slot.gain;
   slot.screen.position.set(x,1.5,.55);slot.screen.lookAt(x,.1,2);slot.screen.width=w*.9;slot.screen.color.copy(this.palette[idx]);slot.screen.intensity=weight*(this.lite?8:10);
   slot.key.position.set(x-.45,3.2,2.1);slot.key.lookAt(x,1,0);slot.key.intensity=weight*(idx===0?32:26);
  }
  return moving;
 }
 /** Cycles diffuse response + contact maps, sampled in stationary world coordinates. */
 decorate(material:THREE.MeshStandardMaterial,surface:'wall'|'floor'){
  const before=material.onBeforeCompile.bind(material);const previousKey=material.customProgramCacheKey.bind(material);
  material.userData.hallPower=this.power;
  material.onBeforeCompile=(shader,renderer)=>{before(shader,renderer);Object.assign(shader.uniforms,{hallPositions:this.positions,hallColors:this.colors,hallCount:this.count,hallPower:this.power,hallBounce:{value:this.maps[surface+'-bounce']},hallContact:{value:this.maps[surface+'-contact']}});
   shader.vertexShader='varying vec3 vHallWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvHallWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
   shader.fragmentShader=`varying vec3 vHallWorld;uniform vec2 hallPositions[${MAX_STATIONS}];uniform vec3 hallColors[${MAX_STATIONS}];uniform int hallCount;uniform float hallPower;uniform sampler2D hallBounce;uniform sampler2D hallContact;\n`+shader.fragmentShader;
   const uv=surface==='wall'?'vec2((vHallWorld.x-hallPositions[i].x)/7.0+0.5,vHallWorld.y/5.0)':'vec2((vHallWorld.x-hallPositions[i].x)/7.0+0.5,(vHallWorld.z+1.8)/6.0)';
   if(surface==='wall')shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n diffuseColor.rgb=mix(vec3(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))),diffuseColor.rgb,.3);');
   shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',`#include <lights_fragment_maps>
    vec3 hallIrradiance=vec3(0.0);float hallOcclusion=1.0;
    for(int i=0;i<${MAX_STATIONS};i++){if(i>=hallCount)break;vec2 hUv=${uv};
      if(hUv.x>0.0&&hUv.x<1.0&&hUv.y>0.0&&hUv.y<1.0){
       float edge=smoothstep(0.0,.09,hUv.x)*smoothstep(0.0,.09,1.0-hUv.x)*smoothstep(0.0,.08,1.0-hUv.y);
       hallIrradiance+=texture2D(hallBounce,hUv).rgb*hallColors[i]*edge*${surface==='wall'?'5.5':'5.0'};
       vec2 contactUv=hUv;contactUv.x=(contactUv.x-.5)/hallPositions[i].y+.5;
       float contact=texture2D(hallContact,contactUv).r;
       hallOcclusion=min(hallOcclusion,mix(1.0,contact,edge*.85));
      }}
    irradiance=(irradiance+hallIrradiance*hallPower)*hallOcclusion;`);
  };material.customProgramCacheKey=()=>previousKey()+'-hall-'+surface+'-v1';
 }
 dispose(){this.resources.forEach(t=>t.dispose());this.slots.forEach(s=>{this.scene.remove(s.screen,s.key);s.screen.dispose();s.key.dispose();});}
}
