import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS,EXTTextureWebP} from '@gltf-transform/extensions';
import {dedup,weld,quantize} from '@gltf-transform/functions';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
const root='.source-assets/dennis/meshy-v3/stable-atlas/';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc=await io.read(root+'dennis-stable.glb');
for(const texture of doc.getRoot().listTextures()) {
 const encoded=execFileSync('C:/Users/denni/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',
  ['-c','import sys,io; from PIL import Image; im=Image.open(io.BytesIO(sys.stdin.buffer.read())).convert("RGB"); out=io.BytesIO(); im.save(out,format="WEBP",lossless=sys.argv[1]!="stable-albedo",quality=94,method=6); sys.stdout.buffer.write(out.getvalue())',texture.getName()],
  {input:texture.getImage(),maxBuffer:64*1024*1024});
 texture.setImage(encoded).setMimeType('image/webp');
}
doc.createExtension(EXTTextureWebP).setRequired(true);
for(const material of doc.getRoot().listMaterials()) {
 for(const info of [material.getBaseColorTextureInfo(),material.getNormalTextureInfo(),material.getMetallicRoughnessTextureInfo()])info?.setMinFilter(9987);
}
await doc.transform(dedup(),weld(),quantize({quantizePosition:16,quantizeNormal:12,quantizeTexcoord:16}));
await io.write(root+'dennis-stable-web.glb',doc);
console.log(JSON.stringify({bytes:(await fs.stat(root+'dennis-stable-web.glb')).size,materials:doc.getRoot().listMaterials().map(m=>({name:m.getName(),normalScale:m.getNormalScale()}))}));
