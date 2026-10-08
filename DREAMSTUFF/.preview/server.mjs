import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.gltf':'model/gltf+json','.jpg':'image/jpeg','.png':'image/png','.webmanifest':'application/manifest+json'};
http.createServer((req,res)=>{
 const u=new URL(req.url,'http://127.0.0.1');
 const file=path.resolve(root,'.'+decodeURIComponent(u.pathname==='/'?'/index.html':u.pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
 fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(data);
 });
}).listen(8080,'127.0.0.1',()=>console.log('Preview listens only on 127.0.0.1:8080'));
