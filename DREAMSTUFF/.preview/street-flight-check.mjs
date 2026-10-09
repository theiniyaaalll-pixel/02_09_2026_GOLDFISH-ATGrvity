import assert from 'node:assert/strict';import fs from 'node:fs';
import '../street-flight.js';
const {sample,length}=globalThis.DreamStreetFlight;
assert.deepEqual([sample(0).x,sample(0).y,sample(0).z],[0,1.68,12]);
let high=0,low=0,previous=sample(0),worstStep=0;
for(let d=.1;d<=length;d+=.1){
 const p=sample(d);assert.ok(Object.values(p).every(Number.isFinite));
 if(p.y>17)high++;if(p.y<2.5)low++;
 if(Math.abs(p.x)>5.55&&Math.abs(p.x)<13.6)assert.ok(p.y>15,'roof clearance '+JSON.stringify(p));
 worstStep=Math.max(worstStep,Math.hypot(p.x-previous.x,p.y-previous.y,p.z-previous.z));previous=p;
 assert.deepEqual(sample(d),sample(d),'deterministic reverse sampling');
}
assert.ok(high>100&&low>100);assert.ok(worstStep<.102);
assert.ok(Math.hypot(sample(length).x,sample(length).y-1.68,sample(length).z-12)<1e-6);
const source=fs.readFileSync('index.html','utf8');new Function(source.match(/<script>([\s\S]*?)<\/script>/)[1]);
console.log({length,high,low,worstStep,checks:'Smooth route, street/roof levels, roof clearance, loop closure, deterministic reverse, application syntax'});
