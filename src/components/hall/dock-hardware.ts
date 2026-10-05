import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { prepareDockAsset } from './dock-asset';
import { createDockScreen } from './dock-screen';
import { inflatedBinary } from './bitmapTextures';
import { fittedFontSize } from './fitText.mjs';
import { marbleBall } from './heroMaterial';
import { roomPowerLevels, ROOM_POWER_MS, withRoomPower, collectRoomPowerTargets } from './roomPower.mjs';
import { visibleTimeout } from './visibleTimeout.mjs';
type Control = { element: HTMLElement; object: THREE.Object3D; origin: THREE.Vector3; value: number; velocity: number; target: number; moving: boolean; pressUntil: number; glow?: THREE.ShaderMaterial; lamp?: THREE.PointLight };
/** Moving keys and the CRT transition: never above 60 fps, whatever the panel's rate (2026-10-05 live: 104 fps at 240 Hz). */
const MOTION_FRAME_MS = 15.5;
/** The idle phosphor (slow row crawl, drift, grain) reads the same at 12 fps; at 24 it was the hall's second renderer all the time. */
const IDLE_FRAME_MS = 1000 / 12;
/** Key shadows follow travel of a few millimetres: refresh them at most this often while moving, then once at rest. */
const SHADOW_MS = 100;

/** Every visible surface is in the Blender GLB. DOM elements are invisible, projected hit targets. */
export function mountDockHardware(root: HTMLElement, reduce: boolean) {
  const canvas = document.createElement('canvas');
  canvas.className = 'hall-console__canvas'; canvas.setAttribute('aria-hidden','true');
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'}); }
  catch { root.dataset.hardware='fallback'; return () => {}; }
  // The hall itself is capped at 1.5 (hallScene pixelRatioFor); the console at 2 drew 1.8× its pixels on Retina panels.
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  // As in the hall: reading every program's info log after compiling stalls on the driver; shaders are fixed in production.
  renderer.debug.checkShaderErrors = import.meta.env.DEV;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  root.prepend(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(12,4.7,.1,30);
  camera.position.set(0,4.3,6); camera.lookAt(0,.20,0);
  const room = new RoomEnvironment(); const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(room,.025); scene.environment = environment.texture; scene.environmentIntensity = .28;
  room.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe5eeff,0x171d2b,.65));
  const key = new THREE.DirectionalLight(0xf0f4ff,2); key.position.set(-3,5,4); key.castShadow = true;
  key.shadow.mapSize.set(1024,1024); key.shadow.camera.left=-2.5; key.shadow.camera.right=2.5;
  key.shadow.camera.top=1.5; key.shadow.camera.bottom=-1.5; key.shadow.camera.near=.1; key.shadow.camera.far=14;
  key.shadow.bias=-.0003; key.shadow.normalBias=.002; key.shadow.radius=2; scene.add(key);
  const fill = new THREE.DirectionalLight(0xa7b9e5,.85); fill.position.set(2,2,-3); scene.add(fill);
  let model: THREE.Group | undefined, ball: THREE.Object3D | undefined;
  let dead=false, compiled=false, raf=0, previous=0, lastDrawn=-1e9, shadowAt=-1e9, shadowStale=false, stickValue=0, stickVelocity=0, stickTarget=0;
  let stickRest: THREE.Quaternion | undefined;
  let pulseTimer: ReturnType<typeof setTimeout> | undefined;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let held: HTMLElement | null = null;
  let powerTargets: ReturnType<typeof collectRoomPowerTargets> | undefined;
  const phosphor=createDockScreen();
  const screenSpill=new THREE.PointLight(0xa5b9ec,.4,2,2);screenSpill.position.set(0,.65,.15);scene.add(screenSpill);
  const controls: Control[] = [];
  const stationLamps = new Map<HTMLElement,THREE.MeshStandardMaterial>();
  const screens = new Map<string,{canvas:HTMLCanvasElement;texture:THREE.CanvasTexture}>();
  const ownedMaterials = new Set<THREE.Material>();
  const ownedTextures = new Set<THREE.Texture>();
  const abort = new AbortController();
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

  function disposeModel(object: THREE.Object3D) {
    const materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    object.traverse(node => {
      if (!(node instanceof THREE.Mesh)) return;
      node.geometry.dispose();
      for (const m of Array.isArray(node.material) ? node.material : [node.material]) {
        materials.add(m);
        for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value);
      }
    });
    materials.forEach(m=>m.dispose());
    textures.forEach(t=>{t.dispose(); if (t.image instanceof ImageBitmap) t.image.close();});
  }
  function addScreen(name: string,width: number,height: number) {
    const object = model?.getObjectByName(name);
    if (!(object instanceof THREE.Mesh)) return;
    const surface=document.createElement('canvas'); surface.width=width; surface.height=height;
    const texture=new THREE.CanvasTexture(surface); texture.colorSpace=THREE.SRGBColorSpace; texture.flipY=false; texture.anisotropy=8;
    const material=name==='display_prev'||name==='display_next'||name.startsWith('display_station_')
      ? new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,toneMapped:false})
      : new THREE.MeshStandardMaterial({map:texture,roughness:.47,metalness:.12,transparent:true,depthWrite:false});
    const old=object.material as THREE.Material; ownedMaterials.add(old);
    for (const value of Object.values(old)) if (value instanceof THREE.Texture) ownedTextures.add(value);
    object.material=material; screens.set(name,{canvas:surface,texture});
  }
  // update() runs on every station change; repainting and re-uploading all 18 printed surfaces each time cost a
  // canvas raster plus a texture upload per surface. Repaint only what changed (or once more after the font loads).
  const printed=new Map<string,string>(); let fontEpoch=0;
  function lettering(name:string,lines:string[],disabled=false) {
    const screen=screens.get(name); if(!screen) return;
    const key=`${fontEpoch}|${disabled}|${lines.join('\n')}`;
    if(printed.get(name)===key) return;
    printed.set(name,key);
    const ctx=screen.canvas.getContext('2d')!; const {width:w,height:h}=screen.canvas;
    ctx.clearRect(0,0,w,h); ctx.fillStyle=name==='display_prev'||name==='display_next'||name.startsWith('display_station_') ? (disabled ? '#625c71' : '#e0d4ec') : '#1a1427';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    // Same result as stepping the font down a pixel at a time (fitText.mjs); `size` ends one below the font, as it did.
    const font=(px:number)=>`600 ${px}px "Barlow Condensed", "Arial Narrow", sans-serif`;
    const fitted=fittedFontSize(lines.length>1 ? 139 : 158,41,w-12,px=>{ctx.font=font(px);return Math.max(...lines.map(line=>ctx.measureText(line).width));});
    ctx.font=font(fitted); const size=fitted-1;
    lines.forEach((line,i)=>ctx.fillText(line,w/2,h/2+(i-(lines.length-1)/2)*size*1.02));
    screen.texture.needsUpdate=true;
  }
  function update() {
    if (!model || dead) return;
    const en=document.documentElement.dataset.lang==='en';
    const index=Number(root.querySelector('.hall-console__ball')?.getAttribute('aria-valuenow') ?? 1);
    const total=Number(root.querySelector('.hall-console__ball')?.getAttribute('aria-valuemax') ?? root.querySelectorAll('.hall-dock__stop').length);
    const title=(root.querySelector('.hall-console__ball')?.getAttribute('aria-valuetext') || '').toUpperCase();
    phosphor.setText(title,index,total,reduce);
    lettering('display_action',[en ? 'OPEN' : 'ÖFFNEN']);
    lettering('display_directory',en ? ['ALL','PROJECTS'] : ['ALLE','PROJEKTE']);
    lettering('display_prev',[en ? 'BACK' : 'ZURÜCK'],index===1);
    lettering('display_next',[en ? 'NEXT' : 'WEITER'],index===total);
    root.querySelectorAll<HTMLElement>('.hall-dock__stop').forEach((element,i)=>{
      lettering(`display_station_${i}`,[String(i+1).padStart(2,'0')]);
      const material=screens.get(`display_station_${i}`);
      // Accessible project names are also available as native tooltips on every selector.
      element.title=element.getAttribute('aria-label') || '';
      const mesh=model?.getObjectByName(`display_station_${i}`) as THREE.Mesh | undefined;
      if(material && mesh)(mesh.material as THREE.MeshBasicMaterial).color.set(i===index-1 ? '#ffffff' : '#a99cbf');
    });
    for(const c of controls) if(c.element.matches(':disabled, [aria-disabled="true"]')) c.target=0;
    if(root.dataset.selected && root.dataset.selected!==String(index)) {
      const selected=controls.find(c=>c.element.classList.contains('hall-dock__stop') && c.element.getAttribute('aria-current')==='location');
      if(selected && !reduce){selected.pressUntil=performance.now()+95;selected.value=Math.max(selected.value,.6);}
    }
    root.dataset.selected=String(index); wake();
  }
  function placeTargets() {
    if(!model) return;
    const {width:w,height:h}=root.getBoundingClientRect(); if(!w || !h) return;
    renderer.setSize(w,h,false);
    const halfWidth=2.20, halfHeight=halfWidth*h/w;
    camera.aspect=w/h;
    camera.fov=THREE.MathUtils.radToDeg(2*Math.atan(halfHeight/camera.position.distanceTo(new THREE.Vector3(0,.20,0))));
    camera.updateProjectionMatrix();
    model.updateMatrixWorld(true); camera.updateMatrixWorld(true);
    renderer.shadowMap.needsUpdate=true;
    for(const {element,object} of controls) {
      const hitObject=object===ball ? model.getObjectByName('joystick_balltop')! : object;
      const bounds=new THREE.Box3().setFromObject(hitObject), points:THREE.Vector3[]=[];
      for(const x of [bounds.min.x,bounds.max.x]) for(const y of [bounds.min.y,bounds.max.y]) for(const z of [bounds.min.z,bounds.max.z]) points.push(new THREE.Vector3(x,y,z).project(camera));
      const minX=Math.min(...points.map(p=>(p.x*.5+.5)*w)), maxX=Math.max(...points.map(p=>(p.x*.5+.5)*w));
      const minY=Math.min(...points.map(p=>(-.5*p.y+.5)*h)), maxY=Math.max(...points.map(p=>(-.5*p.y+.5)*h));
      const width=Math.max(44,maxX-minX+8);
      const height=Math.max(44,maxY-minY+8);
      element.style.setProperty('--hit-x',`${(minX+maxX-width)/2}px`); element.style.setProperty('--hit-y',`${(minY+maxY-height)/2}px`);
      element.style.setProperty('--hit-w',`${width}px`); element.style.setProperty('--hit-h',`${height}px`);
    }
    // Perspective-expanded world bounds must not steal the neighbouring channel's clicks.
    const stops=controls.filter(c=>c.element.classList.contains('hall-dock__stop')).map(({element})=>{
      const x=parseFloat(element.style.getPropertyValue('--hit-x'));
      const width=parseFloat(element.style.getPropertyValue('--hit-w'));
      return {element,x,width,center:x+width/2};
    });
    stops.forEach((stop,i)=>{
      const left=i ? (stops[i-1].center+stop.center)/2 : stop.x;
      const right=i<stops.length-1 ? (stop.center+stops[i+1].center)/2 : stop.x+stop.width;
      stop.element.style.setProperty('--hit-x',`${left}px`);
      stop.element.style.setProperty('--hit-w',`${right-left}px`);
    });
    wake();
  }
  function bind(name:string,selector:string,moving=false) {
    const object=model?.getObjectByName(name), element=root.querySelector<HTMLElement>(selector);
    if(object && element) controls.push({element,object,origin:object.position.clone(),value:0,velocity:0,target:0,moving,pressUntil:0});
  }
  async function load() {
    const [data]=await Promise.all([prepareDockAsset(),loadEnvironment(),document.fonts.load('600 100px "Barlow Condensed"')]);
    if(dead || root.dataset.hardware==='fallback') return;
    const gltf=await loader.parseAsync(data,'/models/');
    if(dead || root.dataset.hardware==='fallback') {disposeModel(gltf.scene); return;}
    model=gltf.scene; scene.add(model);
    // Cool, pearlescent hardware; retain the GLB's scanned grain and roughness.
    const finishes = new Map<THREE.Material,THREE.Material>();
    const palette: Record<string,string> = {
      marquee_powdercoat:'#171c27', satin_nickel:'#8994ac',
      brushed_joystick_plate:'#9ca8ba', ivory_opal_key:'#cbd6df',
      lavender_opal_key:'#969fbf', lavender_balltop:'#a0aecb',
      marquee_light:'#b0c6e6',
    };
    model.traverse(node=>{
      if(!(node instanceof THREE.Mesh)) return;
      const finish = (material: THREE.Material) => {
        if(!(material instanceof THREE.MeshStandardMaterial) || !palette[material.name])return material;
        const existing=finishes.get(material);if(existing)return existing;
        const pearl=new THREE.MeshPhysicalMaterial();
        THREE.MeshStandardMaterial.prototype.copy.call(pearl,material);
        pearl.color.set(palette[material.name]);
        pearl.iridescence=material.name.includes('opal') ? .38 : material.name==='satin_nickel' ? .5 : .16;
        pearl.iridescenceIOR=1.3; pearl.iridescenceThicknessRange=[180,280];
        pearl.clearcoat=material.name.includes('balltop') ? .8 : .08;
        pearl.clearcoatRoughness=.3;
        if(material.name==='marquee_light')pearl.emissive.set('#b0c6e6');
        finishes.set(material,pearl);ownedMaterials.add(material);return pearl;
      };
      node.material=Array.isArray(node.material) ? node.material.map(finish) : finish(node.material);
      node.castShadow=!node.name.startsWith('display_') && !node.name.startsWith('glow_'); node.receiveShadow=true;
      for(const material of Array.isArray(node.material) ? node.material : [node.material]) {
        for(const value of Object.values(material)) if(value instanceof THREE.Texture)value.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
      }
      if(node.name.startsWith('glow_')) {
        const old=node.material as THREE.MeshStandardMaterial;
        ownedMaterials.add(old);
        const power={value:1};
        const glow=new THREE.ShaderMaterial({
          uniforms:{power,strength:{value:node.name==='glow_underlight' ? .36 : .18}},
          transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,
          vertexShader:'varying vec2 glowUV;void main(){glowUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
          fragmentShader:'varying vec2 glowUV;uniform float power,strength;void main(){vec2 q=(glowUV-.5)*2.0;float a=pow(max(0.0,1.0-q.x*q.x),2.0)*pow(max(0.0,1.0-q.y*q.y),3.0);gl_FragColor=vec4(.40,.57,.85,a*power*strength);}',
        });
        glow.userData.hallPower=power;node.material=glow;
      }
    });
    bind('display_prev','.hall-dock__arrow--prev'); bind('display_next','.hall-dock__arrow--next');
    bind('ctl_open','.hall-dock__open',true); bind('ctl_directory','.hall-dock__directory',true); bind('ctl_joystick','.hall-console__ball');
    ball=model.getObjectByName('ctl_joystick'); stickRest=ball?.quaternion.clone();
    const balltop=model.getObjectByName('joystick_balltop') as THREE.Mesh;
    marbleBall(balltop.material as THREE.MeshStandardMaterial);
    root.querySelectorAll<HTMLElement>('.hall-dock__stop').forEach((element,i)=>{
      bind(`ctl_station_${i}`,`.hall-dock__stop:nth-of-type(${i+1})`,true);
      addScreen(`display_station_${i}`,256,156);
      const lamp=model!.getObjectByName(`station_lamp_${i}`) as THREE.Mesh;
      const material=(lamp.material as THREE.MeshStandardMaterial).clone();
      lamp.material=material; stationLamps.set(element,material);
    });
    const display=model.getObjectByName('display_main') as THREE.Mesh;
    const old=display.material as THREE.Material;ownedMaterials.add(old);
    for(const value of Object.values(old))if(value instanceof THREE.Texture)ownedTextures.add(value);
    display.material=phosphor.material;
    addScreen('display_action',512,384); addScreen('display_directory',512,384);
    addScreen('display_prev',512,148); addScreen('display_next',512,148);
    for(const c of controls) {
      if(!c.moving || c.element.classList.contains('hall-dock__stop'))continue;
      const glow=model.getObjectByName(`glow_${c.object.name}`) as THREE.Mesh | undefined;
      if(glow)c.glow=glow.material as THREE.ShaderMaterial;
      c.lamp=new THREE.PointLight(c.object.name==='ctl_open' ? 0xc6dfeb : 0xaabce9,.03,.75,2);
      c.object.add(c.lamp);c.lamp.position.set(0,.15,0);
    }
    powerTargets=collectRoomPowerTargets(scene);
    // Build every program on the driver's worker threads before the first frame. The first render compiled the
    // iridescent/clearcoat MeshPhysical keys with PCF soft shadows synchronously: the worst main-thread stall of
    // the whole load, 1.1–1.5 s at normal CPU speed (2026-10-05 live). The console stays hidden until then.
    try { await renderer.compileAsync(scene,camera); } catch { /* A program failing here fails the same way on first render. */ }
    if(dead) return;
    compiled=true;
    root.dataset.hardware='ready'; placeTargets(); update();
    // The assembly now has its final height: the hall frames the room above its top edge (Hall.tsx hall:reframe).
    document.dispatchEvent(new CustomEvent('hall:reframe'));
    void document.fonts.load('600 100px "Barlow Condensed"').then(()=>{
      if(dead)return;
      fontEpoch++;
      phosphor.setText((track?.getAttribute('aria-valuetext')||'').toUpperCase(),Number(track?.getAttribute('aria-valuenow')||1),Number(track?.getAttribute('aria-valuemax')||root.querySelectorAll('.hall-dock__stop').length),true,true);update();
    });
  }
  async function loadEnvironment() {
    try {
      // The hall's hero machines inflate the same file; both read one shared decode.
      const data=await inflatedBinary('/textures/hero-environment-v1.bin.gz');if(!data || abort.signal.aborted)return;
      const header=new DataView(data),w=header.getUint32(0,true),h=header.getUint32(4,true);
      if(dead||w!==768||h!==1024||data.byteLength!==8+w*h*8)return;
      const texture=new THREE.DataTexture(new Uint16Array(data,8),w,h,THREE.RGBAFormat,THREE.HalfFloatType);
      texture.mapping=THREE.CubeUVReflectionMapping;texture.colorSpace=THREE.LinearSRGBColorSpace;
      texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
      ownedTextures.add(texture);scene.environment=texture;scene.environmentIntensity=.7;wake();
    } catch { /* The prepared reflection environment remains available offline. */ }
  }
  function powerTime(now:number) {
    const stage=root.closest('.hall')?.querySelector<HTMLElement>('.hall__stage');
    if(stage?.dataset.power==='loading' || document.documentElement.classList.contains('gl-pending'))return 0;
    if(stage?.dataset.power==='on')return Math.max(0,now-Number(stage.dataset.powerAt || now));
    return root.closest('.hall')?.classList.contains('is-3d') ? ROOM_POWER_MS : 0;
  }
  function frame(time:number) {
    raf=0; if(dead || !compiled || document.hidden || !model) return;
    // Park the retained GPU assembly on reading/game pages; wake on the hall's
    // mode mutation when returning. No CRT loop runs behind a hidden console.
    const hall=root.closest('.hall');
    if(hall?.getAttribute('data-mode')!=='hall' || hall.classList.contains('is-screen'))return;
    if(time-lastDrawn<MOTION_FRAME_MS){raf=requestAnimationFrame(frame);return;}
    lastDrawn=time;
    const dt=Math.min((time-previous)/1000 || .016,.032); previous=time; let moving=false;
    for(const c of controls) {
      if(!c.moving) continue;
      const station=c.element.classList.contains('hall-dock__stop');
      const selected=c.element.getAttribute('aria-current')==='location';
      const hovering=c.element.matches(':hover,:focus-visible');
      // Radio-style mechanical latch: the chosen key stays seated; unselected keys rise under a finger.
      const resting=selected ? (hovering ? .2 : .32) : hovering ? -.16 : 0;
      const target=station ? (held===c.element || time<c.pressUntil ? 1 : resting) : c.target;
      if(reduce) {c.value=target; c.velocity=0;}
      else {c.velocity+=((target-c.value)*(station ? 620 : 480)-c.velocity*(station ? 27 : 29))*dt; c.value+=c.velocity*dt;}
      c.object.position.copy(c.origin); c.object.position.y-=Math.max(station ? -.24 : -.1,c.value)*(station ? .025 : .026);
      const glow=Math.max(0,c.value);
      if(c.glow)c.glow.uniforms.strength.value=.16+glow*.55;
      if(c.lamp)c.lamp.intensity=.025+glow*.24;
      const indicator=stationLamps.get(c.element);
      if(indicator){
        const compression=Math.max(0,c.value);
        indicator.color.set(selected ? '#d4bdff' : hovering ? '#b699db' : '#2f263d');
        indicator.emissiveIntensity=(selected ? 2 : hovering ? .85 : .025)+compression*1.3;
      }
      if(Math.abs(c.value-target)>.001 || Math.abs(c.velocity)>.01 || time<c.pressUntil) moving=true;
    }
    if(reduce){stickValue=stickTarget;stickVelocity=0;}
    else {stickVelocity+=((stickTarget-stickValue)*210-stickVelocity*19)*dt;stickValue+=stickVelocity*dt;}
    if(ball && stickRest){ball.quaternion.copy(stickRest);ball.rotateZ(-stickValue*.32);}
    if(Math.abs(stickValue-stickTarget)>.001 || Math.abs(stickVelocity)>.01)moving=true;
    const elapsed=reduce ? (powerTime(time)>=ROOM_POWER_MS ? ROOM_POWER_MS : 0) : powerTime(time);
    const power=roomPowerLevels(elapsed).screen;
    const changing=phosphor.tick(time,power,reduce);
    if(moving) shadowStale=true;
    if(shadowStale && (!moving || time-shadowAt>=SHADOW_MS)){renderer.shadowMap.needsUpdate=true;shadowAt=time;shadowStale=false;}
    // Only on change: writing the attribute every frame re-styled the whole page 12 times a second, which the
    // hall's frame loop then paid for in a forced style recalc (2026-10-05 trace).
    const lighting=elapsed>=ROOM_POWER_MS ? 'on' : elapsed>0 ? 'warming' : 'off';
    if(root.dataset.lighting!==lighting)root.dataset.lighting=lighting;
    if(elapsed<ROOM_POWER_MS)withRoomPower(scene,elapsed,0,()=>renderer.render(scene,camera),false,powerTargets);
    else renderer.render(scene,camera);
    if(moving || changing || (elapsed>0 && elapsed<ROOM_POWER_MS))raf=requestAnimationFrame(frame);
    else if(!reduce && power>0)idleTimer=setTimeout(wake,IDLE_FRAME_MS);
  }
  function wake() {clearTimeout(idleTimer);if(!dead && !raf) {previous=performance.now(); raf=requestAnimationFrame(frame);}}
  function press(event:Event) {
    const target=(event.target as Element).closest('button,a');
    held=target instanceof HTMLElement ? target : null;
    for(const c of controls) c.target=c.element===target && !c.element.matches(':disabled, [aria-disabled="true"]') ? 1 : 0;
    // Initial physical travel on pointer down; the spring handles the final compression/release.
    for(const c of controls)if(c.moving && c.target===1){c.value=Math.max(c.value,.65);c.pressUntil=reduce ? 0 : performance.now()+95;}
    wake();
  }
  function release() {held=null;for(const c of controls)c.target=c.element.matches(':hover,:focus-visible') ? .22 : 0; if(!drag)stickTarget=0; wake();}
  function hover(event:Event) {
    if(held || event instanceof PointerEvent && event.buttons) return;
    const hovered=(event.target as Element).closest<HTMLElement>('button,a');
    for(const c of controls)c.target=c.element===hovered && !c.element.matches(':disabled, [aria-disabled="true"]') ? .22 : 0;
    wake();
  }
  function leave() {release();}
  function pulse(direction:number) {clearTimeout(pulseTimer);stickTarget=direction;wake();pulseTimer=setTimeout(()=>{if(!drag)stickTarget=0;wake();},150);}
  function click(event:MouseEvent) {const target=(event.target as Element).closest('button');if(target?.classList.contains('hall-dock__arrow--prev'))pulse(-1);if(target?.classList.contains('hall-dock__arrow--next'))pulse(1);}
  function keyDown(event:KeyboardEvent) {
    if(event.key==='Enter' || event.key===' ')press(event);
    if(event.target===track && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))pulse(['ArrowLeft','ArrowDown'].includes(event.key) ? -1 : 1);
  }
  let drag:{id:number;startX:number;stepX:number;moved:boolean}|null=null;
  const track=root.querySelector<HTMLElement>('.hall-console__ball');
  function dragStart(event:PointerEvent) {
    if(!event.isPrimary || event.button!==0)return;
    drag={id:event.pointerId,startX:event.clientX,stepX:event.clientX,moved:false}; track?.setPointerCapture(event.pointerId); track?.focus();
  }
  function dragMove(event:PointerEvent) {
    if(!drag || event.pointerId!==drag.id)return;
    const dx=event.clientX-drag.startX;if(Math.abs(dx)>5)drag.moved=true;
    stickTarget=THREE.MathUtils.clamp(dx/35,-1,1);
    if(Math.abs(event.clientX-drag.stepX)>=32) {
      root.querySelector<HTMLButtonElement>(event.clientX>drag.stepX ? '.hall-dock__arrow--next' : '.hall-dock__arrow--prev')?.click(); drag.stepX=event.clientX;
    }
    wake();
  }
  function dragEnd(event:PointerEvent) {
    if(!drag || event.pointerId!==drag.id)return;
    if(event.type==='pointerup' && !drag.moved && track){const bounds=track.getBoundingClientRect();root.querySelector<HTMLButtonElement>(event.clientX>=bounds.x+bounds.width/2 ? '.hall-dock__arrow--next' : '.hall-dock__arrow--prev')?.click();}
    drag=null;stickTarget=0;wake();
  }
  function cancelInput(){drag=null;clearTimeout(pulseTimer);clearTimeout(idleTimer);stickTarget=0;release();}
  const resize=new ResizeObserver(placeTargets); resize.observe(root);
  const mutation=new MutationObserver(update); mutation.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-current','aria-valuenow','aria-valuetext','disabled']});
  const visibility=new MutationObserver(update);
  visibility.observe(document.documentElement,{attributes:true,attributeFilter:['class','data-lang']});
  const hall=root.closest('.hall'); if(hall)visibility.observe(hall,{subtree:true,attributes:true,attributeFilter:['class','data-mode','data-power','data-power-at']});
  root.addEventListener('pointerdown',press); root.addEventListener('keydown',keyDown); root.addEventListener('pointerover',hover); root.addEventListener('pointerleave',leave); root.addEventListener('focusin',hover); root.addEventListener('focusout',leave);
  root.addEventListener('click',click);
  window.addEventListener('pointerup',release); window.addEventListener('pointercancel',cancelInput); window.addEventListener('keyup',release); window.addEventListener('blur',cancelInput); document.addEventListener('visibilitychange',cancelInput);
  track?.addEventListener('pointerdown',dragStart); track?.addEventListener('pointermove',dragMove); track?.addEventListener('pointerup',dragEnd); track?.addEventListener('lostpointercapture',dragEnd);
  const lost=(event:Event)=>{event.preventDefault();cancelInput();canvas.style.display='none';root.dataset.hardware='fallback';}; canvas.addEventListener('webglcontextlost',lost);
  void load().catch(()=>{if(!dead){canvas.style.display='none'; root.dataset.hardware='fallback';}});
  // A download that stalls (not fails) used to keep the console hidden and dead for good: after 20 s of visible time
  // the DOM console takes over, and a late GLB is then ignored rather than swapped in under the visitor's hand.
  const cancelBudget=visibleTimeout(20000,()=>{if(!dead && root.dataset.hardware==='loading'){canvas.style.display='none'; root.dataset.hardware='fallback';}});
  return ()=>{
    dead=true; cancelBudget(); abort.abort(); clearTimeout(pulseTimer);clearTimeout(idleTimer);cancelAnimationFrame(raf); resize.disconnect(); mutation.disconnect(); visibility.disconnect();
    root.removeEventListener('pointerdown',press); root.removeEventListener('keydown',keyDown); root.removeEventListener('pointerover',hover); root.removeEventListener('pointerleave',leave); root.removeEventListener('focusin',hover); root.removeEventListener('focusout',leave);
    root.removeEventListener('click',click);
    window.removeEventListener('pointerup',release); window.removeEventListener('pointercancel',cancelInput); window.removeEventListener('keyup',release); window.removeEventListener('blur',cancelInput); document.removeEventListener('visibilitychange',cancelInput);
    track?.removeEventListener('pointerdown',dragStart); track?.removeEventListener('pointermove',dragMove); track?.removeEventListener('pointerup',dragEnd); track?.removeEventListener('lostpointercapture',dragEnd); canvas.removeEventListener('webglcontextlost',lost);
    if(model)disposeModel(model); ownedMaterials.forEach(m=>m.dispose()); ownedTextures.forEach(t=>{t.dispose(); if(t.image instanceof ImageBitmap)t.image.close();});
    phosphor.dispose();environment.dispose(); key.shadow.map?.dispose(); renderer.dispose(); renderer.forceContextLoss(); canvas.remove(); delete root.dataset.hardware;delete root.dataset.lighting;
    for(const {element} of controls) for(const property of ['--hit-x','--hit-y','--hit-w','--hit-h'])element.style.removeProperty(property);
  };
}
