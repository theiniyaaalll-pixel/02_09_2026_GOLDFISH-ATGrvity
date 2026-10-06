// Local static server for development only. In production the site is plain static files on
// GitHub Pages; laptop <-> phone sync goes peer-to-peer through PeerJS, not through this server.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.PORT||8080);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost');
 let rel=decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname).replace(/^\/+/, '');
 const file=path.resolve(root,rel);if(!file.startsWith(root)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data)});
});
server.listen(port,()=>{
 console.log('\nLIMINAL VR — local dev server');
 console.log(`Laptop (controller): http://localhost:${port}/`);
 console.log(`Test headset in a second tab: copy the link under the QR code.\n`);
});
