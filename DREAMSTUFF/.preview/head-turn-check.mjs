import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const source=fs.readFileSync('index.html','utf8');
const sensor=source.slice(source.indexOf('function onDeviceOrientation('),source.indexOf('async function startHeadTracking('));
const delta=source.match(/function angleDelta\(a,b\)\{[^\n]+/)[0];
const context=vm.createContext({headTrackingEnabled:true,headLook:null,headBase:null,Math});
vm.runInContext(delta+'\n'+sensor,context);
for(const scene of [2,3])for(const direction of ['left','right']){
 context.recenterHead();context.onDeviceOrientation({alpha:0,beta:90,gamma:0});
 context.onDeviceOrientation({alpha:direction==='left'?25:335,beta:90,gamma:0});
 const yaw=context.headViewYaw(Math.PI,context.headLook.yaw,true);
 // At the initial -Z heading, world -X is left and +X is right.
 const x=Math.sin(yaw);assert.ok(direction==='left'?x<0:x>0);
 assert.ok(Math.abs(context.headLook.pitch)<1e-8);
 console.log('Visual '+scene+' physical '+direction+' turn: correct');
}
for(const angle of [0,90,180,270,360]){
 assert.ok(Math.abs(context.headViewYaw(1,angle*Math.PI/180,true)-(1-angle*Math.PI/180))<1e-8);
 assert.equal(context.headViewYaw(1,.3,false),1.3);
}
context.recenterHead();context.onDeviceOrientation({alpha:145,beta:90,gamma:0});
assert.equal(context.headLook.yaw,0);
console.log('Full-turn mapping, recentering, and visual 1 convention: passed');
new Function(source.match(/<script>([\s\S]*?)<\/script>/)[1]);
