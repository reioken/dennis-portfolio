import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const project=path.dirname(dir);
const routes=[['/assets/',path.join(project,'public')],['/vendor/',path.join(project,'node_modules')],['/',dir]];
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.glb':'model/gltf-binary','.webp':'image/webp','.avif':'image/avif','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
http.createServer((req,res)=>{try{const url=new URL(req.url,'http://localhost');const name=decodeURIComponent(url.pathname);const [prefix,root]=routes.find(([p])=>name.startsWith(p));const target=path.resolve(root,name.slice(prefix.length)||'index.html');if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.stat(target,(err,st)=>{if(err||!st.isFile()){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(target)]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(target).pipe(res);});}catch{res.writeHead(400).end();}}).listen(4323,'127.0.0.1',()=>console.log('Mockups: http://localhost:4323'));
