import fs from 'node:fs';
import path from 'node:path';
const manifest=JSON.parse(fs.readFileSync('.preview/tree-small-files.json','utf8')).gltf['1k'].gltf;
const root=path.resolve('assets/rural/tree');
const files=Object.entries(manifest.include).map(([name,file])=>({name,...file}));
files.push({name:'GLTFLoader.js',url:'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/loaders/GLTFLoader.js',vendor:true});
files.push({name:'BufferGeometryUtils.js',url:'https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/utils/BufferGeometryUtils.js',vendor:true});
let next=0;
await Promise.all(Array.from({length:3},async()=>{
 while(next<files.length){
  const file=files[next++];
  const destination=path.resolve(file.vendor?'vendor':root,file.name);
  if(!file.vendor&&!destination.startsWith(root+path.sep))throw Error('Unexpected asset path');
  const response=await fetch(file.url);if(!response.ok)throw Error(`${response.status}: ${file.name}`);
  const data=Buffer.from(await response.arrayBuffer());
  if(file.size&&data.length!==file.size)throw Error('Incomplete asset: '+file.name);
  fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,data);
  console.log(file.name,Math.round(data.length/1024)+' KB');
 }
}));
for(const name of ['GLTFLoader.js','BufferGeometryUtils.js']){
 const file='vendor/'+name;
 fs.writeFileSync(file,fs.readFileSync(file,'utf8').replaceAll("from 'three'","from './three.module.js'").replace("'../utils/BufferGeometryUtils.js'","'./BufferGeometryUtils.js'"));
}
