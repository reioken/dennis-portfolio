import * as THREE from 'three';

/** Authored phosphor display: typography is uploaded only when the selected station changes. */
export function createDockScreen() {
  const canvases = [document.createElement('canvas'), document.createElement('canvas')];
  const textures = canvases.map(canvas => {
    canvas.width = 1536; canvas.height = 384;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace; texture.flipY = false;
    texture.anisotropy = 8;
    return texture;
  });
  let current = 0, lastKey = '', changedAt = -10000;
  const uniforms = {
    currentMap: { value: textures[0] }, previousMap: { value: textures[1] },
    clock: { value: 0 }, transition: { value: 1 }, power: { value: 0 }, motion: { value: 1 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, toneMapped: false,
    vertexShader: `varying vec2 screenUV;
      void main(){screenUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `
      precision highp float;
      varying vec2 screenUV;
      uniform sampler2D currentMap, previousMap;
      uniform float clock, transition, power, motion;
      vec3 sampleDisplay(sampler2D displayMap,vec2 p){
        if(p.y<0.0||p.y>1.0)return vec3(0.0);
        return texture2D(displayMap,p).rgb;
      }
      void main(){
        vec2 p=screenUV;
        vec2 centered=p-.5;
        p+=centered*dot(centered,centered)*.035;
        // Horizontal deflection has a tiny continuous drift, like an ageing analogue chassis.
        float drift=(sin(p.y*19.0+clock*1.7)+sin(p.y*53.0-clock*2.1))*.0007*motion;
        float sync=(1.0-smoothstep(.38,.94,transition))*step(.32,transition);
        p.x+=drift+sin(p.y*74.0+clock*23.0)*.007*sync;
        // Retrace collapse, a short dark interval, then a visible raster re-lock.
        float oldSignal=1.0-step(.22,transition);
        float collapse=1.0-smoothstep(0.0,.22,transition);
        vec2 oldUV=vec2(p.x,(p.y-.5)/max(collapse,.008)+.5);
        float newSignal=step(.34,transition);
        float raster=smoothstep(.34,.94,transition);
        float written=1.0-smoothstep(raster-.006,raster+.006,p.y);
        if(transition>=.99)written=1.0;
        vec3 glyph=sampleDisplay(previousMap,oldUV)*oldSignal*sqrt(collapse)
                  +sampleDisplay(currentMap,p)*newSignal*written;
        vec3 halo=texture2D(currentMap,p+vec2(.002,0.0)).rgb
                 +texture2D(currentMap,p-vec2(.002,0.0)).rgb
                 +texture2D(currentMap,p+vec2(0.0,.005)).rgb
                 +texture2D(currentMap,p-vec2(0.0,.005)).rgb;
        // Broad, individually legible dark gaps between phosphor rows, slowly crawling.
        float row=fract(p.y*38.0-clock*.48*motion);
        float scan=.24+.76*smoothstep(.13,.38,row)*(1.0-smoothstep(.76,.96,row));
        float aperture=.91+.09*cos(p.x*512.0*2.094395);
        float grain=fract(sin(dot(floor(p*vec2(768.0,192.0)),vec2(12.9898,78.233))+floor(clock*18.0)*motion)*43758.5453);
        float hum=1.0+.035*sin(p.y*9.0-clock*2.4*motion);
        float edge=pow(max(0.0,1.0-dot(centered*vec2(.8,1.35),centered*vec2(.8,1.35))),.6);
        vec3 color=(glyph*scan*aperture*1.18+halo*.020*newSignal*written)*hum;
        color+=vec3(.014,.019,.030)*(scan*.55+grain*.30)*edge;
        // Brief phosphor trace at the refill boundary; confined to the actual refresh.
        float retrace=exp(-pow((p.y-raster)*210.0,2.0))*sync*.12;
        color+=vec3(.40,.52,.73)*retrace;
        float opening=mix(.006,1.0,smoothstep(.02,.58,power));
        float apertureOpen=1.0-smoothstep(opening*.5,opening*.5+.014,abs(p.y-.5));
        color*=edge*power*apertureOpen;
        gl_FragColor=vec4(color,1.0);
        #include <colorspace_fragment>
      }`,
  });
  function setText(title: string, index: number, total: number, reduce: boolean, force = false) {
    const key = `${title}/${index}/${total}`;
    if (key === lastKey && !force) return;
    const first = !lastKey; lastKey = key;
    const previous = current; current = 1-current;
    const ctx = canvases[current].getContext('2d')!;
    ctx.fillStyle='#000'; ctx.fillRect(0,0,1536,384);
    ctx.textAlign='left'; ctx.textBaseline='middle';
    let size=290;
    do {ctx.font=`600 ${size--}px "Barlow Condensed", "Arial Narrow", sans-serif`;}
    while(ctx.measureText(title).width>1050 && size>95);
    ctx.fillStyle='#d5dcef'; ctx.shadowColor='#8eace0'; ctx.shadowBlur=9;
    ctx.fillText(title,54,197); ctx.shadowBlur=0;
    ctx.fillStyle='#4c5870'; ctx.fillRect(1153,66,2,252);
    ctx.textAlign='center'; ctx.font='600 152px "Barlow Condensed", sans-serif'; ctx.fillStyle='#dce3ef';
    ctx.fillText(String(index).padStart(2,'0'),1330,160);
    ctx.font='600 90px "Barlow Condensed", sans-serif'; ctx.fillStyle='#aebbd0';
    ctx.fillText(`/ ${String(total).padStart(2,'0')}`,1330,279);
    textures[current].needsUpdate=true;
    uniforms.currentMap.value=textures[current]; uniforms.previousMap.value=textures[previous];
    changedAt=first || reduce ? -10000 : performance.now();
  }
  return {
    material, setText,
    tick(now: number, power: number, reduce: boolean) {
      uniforms.clock.value=reduce ? 0 : now/1000;
      uniforms.motion.value=reduce ? 0 : 1;
      uniforms.power.value=power;
      uniforms.transition.value=reduce ? 1 : Math.min(1,(now-changedAt)/620);
      return uniforms.transition.value<1;
    },
    dispose() {textures.forEach(texture=>texture.dispose());material.dispose();},
  };
}
