import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { cabinetWidth } from './hallLayout';
import type { HallItem } from './Hall';
import type { TextureSource } from './bitmapTextures';

const MAX_STATIONS=20;
/**
 * three's lights_fragment_begin with the rect-area loop behind a uniform. The six station lights and the TV light
 * on the wall and floor (most of the frame's pixels) were the costliest part of a frame on an integrated GPU
 * (2026-10-05: 15–17 fps with them, ~29 without); below full quality those surfaces use CHEAP_AREA_LIGHT instead.
 * A uniform branch is the same for the whole draw, so a GPU skips the loop instead of masking it (measured as fast
 * as compiling it out), and at 1 the result equals the stock chunk. One program serves both states: no compile
 * when the quality changes.
 */
const AREA_OPEN='#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )\n\tRectAreaLight rectAreaLight;\n\t#pragma unroll_loop_start\n\tfor ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {\n\t\trectAreaLight = rectAreaLights[ i ];\n';
const AREA_CLOSE='\t#pragma unroll_loop_end\n#endif';
/**
 * Below full quality the same lights still reach the wall and floor, but as small emitters: the irradiance of a disc
 * of the rectangle's area (exact on its axis, A / (d² + A/π)) with Lambert diffuse and one GGX lobe, instead of two
 * LTC integrations per light. Without any of it the wall went nearly black on the lower levels (2026-10-05).
 */
const CHEAP_AREA_LIGHT=`#if NUM_RECT_AREA_LIGHTS > 0
void hallCheapAreaLight( const in RectAreaLight light, const in vec3 P, const in vec3 N, const in vec3 V, const in PhysicalMaterial material, const in float gain, inout ReflectedLight reflectedLight ) {
	vec3 toLight = light.position - P;
	float d2 = max( dot( toLight, toLight ), 1e-4 );
	vec3 L = toLight * inversesqrt( d2 );
	float area = 4.0 * length( light.halfWidth ) * length( light.halfHeight );
	float facing = saturate( dot( L, normalize( cross( light.halfWidth, light.halfHeight ) ) ) );
	vec3 irradiance = light.color * ( gain * area * facing * saturate( dot( N, L ) ) / ( d2 + area * RECIPROCAL_PI ) );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_GGX( L, V, N, material );
}
#endif
`;
const GATED_LIGHTS_BEGIN=(()=>{
 const chunk=THREE.ShaderChunk.lights_fragment_begin,open=chunk.indexOf(AREA_OPEN),close=open<0?-1:chunk.indexOf(AREA_CLOSE,open);
 if(close<0)return null;
 const cheap='\tif ( hallAreaGain < 1.0 ) {\n\t#pragma unroll_loop_start\n\tfor ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {\n\t\thallCheapAreaLight( rectAreaLights[ i ], geometryPosition, geometryNormal, geometryViewDir, material, 1.0 - hallAreaGain, reflectedLight );\n\t}\n\t#pragma unroll_loop_end\n\t}\n';
 return chunk.slice(0,open)+AREA_OPEN.replace('\t#pragma unroll_loop_start','\tif ( hallAreaGain > 0.0 ) {\n\t#pragma unroll_loop_start')
  +'\t\trectAreaLight.color *= hallAreaGain;\n'+chunk.slice(open+AREA_OPEN.length,close)+'\t#pragma unroll_loop_end\n\t}\n'+cheap+'#endif'+chunk.slice(close+AREA_CLOSE.length);
})();
/** Local emitters never follow the composition offset of the camera. */
export class HallLighting {
 readonly positions={value:Array.from({length:MAX_STATIONS},()=>new THREE.Vector2(1000,1))};
 readonly colors={value:Array.from({length:MAX_STATIONS},()=>new THREE.Vector3())};
 readonly count={value:0};
 readonly power={value:1};
 /** Wall and floor area lights: 1 = exact (full quality), 0 = the cheap approximation; faded between (hallScene). */
 readonly surfaceArea={value:1};
 private surfaceAreaGoal=1;
 private focus=0; private initialized=false;
 private weights:number[]=[];
 private palette:THREE.Color[]=[];
 private slots:{index:number;screen:THREE.RectAreaLight;key:THREE.RectAreaLight;gain:number}[]=[];
 readonly resources:THREE.Texture[]=[];
 private maps:Record<string,THREE.Texture>={};
 constructor(private scene:THREE.Scene,private items:HallItem[],private xs:number[],loader:TextureSource,private lite:boolean){
  RectAreaLightUniformsLib.init();this.count.value=Math.min(items.length,MAX_STATIONS);
  items.slice(0,MAX_STATIONS).forEach((it,i)=>{const color=new THREE.Color(it.kind==='kasse'||it.kind==='phone'?'#b7b9df':('brand' in it ? it.brand.primary : '#c3bbd4'));this.palette.push(color);this.weights.push(.12);this.positions.value[i].set(xs[i],cabinetWidth(it.slug)/.96);});
  for(const surface of ['floor','wall'])for(const kind of ['bounce','contact']){const key=surface+'-'+kind;const map=loader.load('/textures/hall-light/'+key+'-v1.webp');map.colorSpace=THREE.NoColorSpace;this.maps[key]=map;this.resources.push(map);}
  for(let i=0;i<3;i++){const screen=new THREE.RectAreaLight(0xffffff,0,.8,.55),key=new THREE.RectAreaLight(0xe3deed,0,1.8,.7);screen.name='hall-screen-light';key.name='hall-overhead-light';scene.add(screen,key);this.slots.push({index:-1,screen,key,gain:0});}
 }
 setFocus(index:number){this.focus=index;if(!this.initialized){this.initialized=true;this.weights=this.items.map((_,i)=>i===index?1:Math.abs(i-index)===1?.32:.1);this.update(1,true);}}
 setSurfaceAreaLights(on:boolean){this.surfaceAreaGoal=on?1:0;}
 update(dt:number,inHall:boolean){let moving=false;const alpha=1-Math.exp(-dt*7);
  if(this.surfaceArea.value!==this.surfaceAreaGoal){const v=this.surfaceArea.value+(this.surfaceAreaGoal-this.surfaceArea.value)*(1-Math.exp(-dt*6));this.surfaceArea.value=Math.abs(this.surfaceAreaGoal-v)<.01?this.surfaceAreaGoal:v;moving=true;}
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
  material.onBeforeCompile=(shader,renderer)=>{before(shader,renderer);Object.assign(shader.uniforms,{hallPositions:this.positions,hallColors:this.colors,hallCount:this.count,hallPower:this.power,hallAreaGain:this.surfaceArea,hallBounce:{value:this.maps[surface+'-bounce']},hallContact:{value:this.maps[surface+'-contact']}});
   shader.vertexShader='varying vec3 vHallWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvHallWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
   shader.fragmentShader=`varying vec3 vHallWorld;uniform vec2 hallPositions[${MAX_STATIONS}];uniform vec3 hallColors[${MAX_STATIONS}];uniform int hallCount;uniform float hallPower;uniform float hallAreaGain;uniform sampler2D hallBounce;uniform sampler2D hallContact;\n`+shader.fragmentShader;
   if(GATED_LIGHTS_BEGIN)shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',GATED_LIGHTS_BEGIN).replace('void main() {',CHEAP_AREA_LIGHT+'void main() {');
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
  };material.customProgramCacheKey=()=>previousKey()+'-hall-'+surface+'-v3';
 }
 dispose(){this.resources.forEach(t=>t.dispose());this.slots.forEach(s=>{this.scene.remove(s.screen,s.key);s.screen.dispose();s.key.dispose();});}
}
