import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import assert from 'node:assert/strict';
const errors=[];
async function connect(tab){const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let id=0;const pending=new Map();ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value||a.description));});const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setBlockedURLs',{urls:['https://*']});return {send,evaluate,ws};}
const tabs=await(await fetch('http://127.0.0.1:9335/json')).json();const master=await connect(tabs.find(t=>t.type==='page'));
const created=await master.send('Target.createTarget',{url:'about:blank'});const more=await(await fetch('http://127.0.0.1:9335/json')).json();const phone=await connect(more.find(t=>t.id===created.targetId));
const mock=`class LocalChannel {constructor(){this.open=true;this.handlers={};}on(name,fn){this.handlers[name]=fn;if(name==='open')setTimeout(fn,0);return this;}send(){}close(){this.open=false;}fire(name,data){this.handlers[name]?.(data);}}
window.Peer=class {constructor(id){this.id=id;this.destroyed=false;}on(name,fn){if(name==='open')setTimeout(()=>fn(this.id),0);return this;}connect(){return window.testChannel=new LocalChannel();}destroy(){}reconnect(){}};`;
await phone.send('Page.addScriptToEvaluateOnNewDocument',{source:mock});await phone.send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});await phone.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
const url=pathToFileURL(path.resolve('index.html')).href;
await master.send('Emulation.setDeviceMetricsOverride',{width:640,height:480,deviceScaleFactor:1,mobile:false});
await master.send('Page.navigate',{url:url+'?mode=controller'});await phone.send('Page.navigate',{url:url+'?mode=headset&room=localtest'});
async function ready(client){for(let i=0;i<160;i++){await new Promise(r=>setTimeout(r,250));if(await client.evaluate('typeof ruralScene!=="undefined"&&!!ruralScene&&!!streetScene'))return;}throw Error('Landscape preload timeout');}
await ready(master);await ready(phone);
const calibration=await phone.evaluate('JSON.stringify(calib)');
await master.evaluate('window.out=[];conns.add({open:true,send:m=>out.push(m)});window.testProgress=0;window.testOrigin=null;window.testAge=0;advanceWhiteScene=()=>{whiteProgress=testProgress;ruralOrigin=testOrigin;ruralAge=testAge;dreamTransition=testProgress>0};window.originalRender=ruralScene.render;ruralScene.render=v=>{window.lastRendered=v;originalRender(v)};true');
await phone.evaluate('window.originalRender=ruralScene.render;ruralScene.render=v=>{window.lastRendered=v;originalRender(v)};true');
async function route(change){await master.send('Page.bringToFront');await master.evaluate(change+';true');await new Promise(r=>setTimeout(r,180));const packet=await master.evaluate('out.at(-1)');assert.ok(packet);await phone.send('Page.bringToFront');await phone.evaluate('testChannel.fire("data",'+JSON.stringify(packet)+');true');await new Promise(r=>setTimeout(r,160));return packet;}
await route('testProgress=.4');assert.equal(await phone.evaluate('target.scene'),1);assert.ok(await phone.evaluate('whiteProgress>=.4&&whiteProgress<1'));console.log('Shared visual 1 white fade: passed');
const stage2=await route('testProgress=1;testOrigin={x:0,z:7};testAge=1;ruralReadyAge=0');assert.equal(stage2.scene,2);
const reveal=await phone.evaluate('({scene:target.scene,visible:document.querySelector("#rural-scene").style.display,reveal:lastRendered.reveal,white:whiteProgress,readyAge:ruralReadyAge})');assert.equal(reveal.visible,'block');assert.equal(reveal.white,1);assert.ok(reveal.reveal>=1/3.5&&reveal.reveal<.5);console.log('Immediate visual 2 and master reveal clock:',reveal);
await phone.evaluate('window.heldScene=ruralScene;ruralScene.hide();ruralScene=null;true');await route('testAge=10');
await phone.evaluate('ruralScene=heldScene;true');await new Promise(r=>setTimeout(r,180));assert.equal(await phone.evaluate('lastRendered.reveal'),1);console.log('Late scene readiness catches up without replaying fade: passed');
assert.equal(await phone.evaluate('JSON.stringify(calib)'),calibration);assert.equal(await phone.evaluate('vr'),true);

await phone.evaluate('window.originalStreetRender=streetScene.render;streetScene.render=v=>{window.lastStreetRender=v;originalStreetRender(v)};true');
await route('testAge=11;pos.x=-18;pos.z=-89');await route('testAge=14');
assert.equal(await phone.evaluate('ruralExitProgress'),1);assert.ok(await phone.evaluate('!!streetOrigin'));assert.equal(await phone.evaluate('document.querySelector("#rural-scene").style.display'),'block');
await route('testAge=18');assert.equal(await phone.evaluate('lastStreetRender.reveal'),1);console.log('Glow-ball exit to visual 3: passed');
await route('streetOrigin=null;streetStartedAge=null;ruralExitAge=null;ruralReadyAge=0;testAge=119.9;pos.x=0;pos.z=7');assert.equal(await master.evaluate('ruralExitAge'),null);
await route('testAge=120');assert.equal(await master.evaluate('ruralExitAge'),120);await route('testAge=122.1');assert.ok(await phone.evaluate('!!streetOrigin'));await route('testAge=126');assert.equal(await phone.evaluate('lastStreetRender.reveal'),1);console.log('Two-minute exit to visual 3: passed');
await phone.evaluate('headTrackingEnabled=true;headBase=null;headLook=null;bodyYaw=Math.PI;target.yaw=Math.PI;window.streetEyes=[];streetScene.scene.onBeforeRender=(renderer,scene,camera)=>{if(renderer.getRenderTarget()?.width!==256){streetEyes.push({direction:camera.getWorldDirection(camera.position.clone()).toArray(),position:camera.position.toArray()});if(streetEyes.length>2)streetEyes.shift();}};onDeviceOrientation({alpha:15,beta:90,gamma:0});true');
for(const [name,alpha,expected] of [['front',15,[0,0,-1]],['right',105,[1,0,0]],['back',195,[0,0,1]],['left',285,[-1,0,0]],['full-turn',375,[0,0,-1]]]){
 await phone.evaluate('target.serverTime=performance.now();onDeviceOrientation({alpha:'+alpha+',beta:90,gamma:0});true');await new Promise(r=>setTimeout(r,450));
 const eyes=await phone.evaluate('streetEyes');assert.equal(eyes.length,2);for(const eye of eyes)assert.ok(eye.direction.reduce((sum,v,i)=>sum+v*expected[i],0)>.99,name+' heading');
 assert.ok(Math.abs(Math.hypot(...eyes[0].position.map((v,i)=>v-eyes[1].position[i]))-.064)<.001);console.log('Stereo 360 view: '+name+' passed');
}
assert.equal(await phone.evaluate('JSON.stringify(calib)'),calibration);console.log('Calibration preserved. Browser errors:',JSON.stringify(errors));assert.deepEqual(errors,[]);
await master.send('Browser.close');master.ws.close();phone.ws.close();


