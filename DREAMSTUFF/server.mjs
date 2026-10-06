import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||8080);
let state={x:0,y:1.68,z:7,yaw:Math.PI,pitch:0,vx:0,vz:0,moving:false,source:'idle',seq:0};
const clients=new Set();
function broadcast(){const msg=`data: ${JSON.stringify(state)}\n\n`;for(const r of clients){try{r.write(msg)}catch{clients.delete(r)}}}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname==='/events'){
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','Access-Control-Allow-Origin':'*','X-Accel-Buffering':'no'});
  res.write(`data: ${JSON.stringify(state)}\n\n`);clients.add(res);req.on('close',()=>clients.delete(res));return;
 }
 if(u.pathname==='/state'&&req.method==='POST'){
  let body='';req.on('data',c=>body+=c);req.on('end',()=>{try{const x=JSON.parse(body||'{}');
   for(const k of ['x','y','z','yaw','pitch','vx','vz']) if(Number.isFinite(x[k])) state[k]=x[k];
   state.moving=!!x.moving;state.source=typeof x.source==='string'?x.source:'controller';state.seq++;broadcast();
   res.writeHead(204,{'Access-Control-Allow-Origin':'*','Cache-Control':'no-store'});res.end();
  }catch{res.writeHead(400);res.end('bad json')}});return;
 }
 if(u.pathname==='/health'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:true,clients:clients.size,state}));return;}
 let rel=decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname).replace(/^\/+/, '');
 const file=path.resolve(root,rel);if(!file.startsWith(root)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data)});
});
server.listen(port,'0.0.0.0',()=>{
 console.log('\nLIMINAL VR — SYNCHRONIZED MASTER / HEADSET');
 console.log(`Laptop MASTER: http://localhost:${port}/?mode=controller`);
 for(const nets of Object.values(os.networkInterfaces())) for(const n of nets||[]) if(n.family==='IPv4'&&!n.internal) console.log(`Phone HEADSET: http://${n.address}:${port}/?mode=headset`);
 console.log('\nBoth devices must be on the same Wi-Fi.\n');
});
