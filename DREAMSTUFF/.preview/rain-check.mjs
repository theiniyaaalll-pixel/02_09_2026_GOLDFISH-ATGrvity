import fs from 'node:fs';
const tabs=await(await fetch('http://127.0.0.1:9335/json')).json();
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map(),errors=[];
ws.addEventListener('message',event=>{
 const message=JSON.parse(event.data);
 if(message.id){const p=pending.get(message.id);pending.delete(message.id);message.error?p.reject(message.error):p.resolve(message.result);}
 if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);
 if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')errors.push(message.params.args.map(a=>a.value||a.description).join(' '));
});
function send(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
await send('Network.setBlockedURLs',{urls:['https://*']});

errors.length=0;await send('Page.navigate',{url:"file:///C:/Users/iniya/OneDrive/Desktop/Final%20-%20interactive%20art/02_09_2026_GOLDFISH-ATGrvity/DREAMSTUFF/index.html?mode=solo"});
await new Promise(r=>setTimeout(r,2000));
console.log('Shader:',await evaluate('({linked:gl.getProgramParameter(pr,gl.LINK_STATUS),error:gl.getError()})'));
fs.writeFileSync('.preview/rain-desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
const checks=await evaluate(`(()=>{
 const saved={x:pos.x,z:pos.z,y:pos.y};pos.x=0;pos.z=7;whiteFadeStarted=null;
 advanceWhiteScene(firstSceneStarted+45000);const oldBoundary=whiteFadeStarted===null;
 advanceWhiteScene(firstSceneStarted+239999);const before=whiteFadeStarted===null;
 advanceWhiteScene(firstSceneStarted+240000);const boundary=whiteFadeStarted===firstSceneStarted+240000;
 advanceWhiteScene(firstSceneStarted+241000);const midpoint=whiteProgress===.5;
 advanceWhiteScene(firstSceneStarted+242000);const complete=whiteProgress===1&&!!ruralOrigin;
 whiteFadeStarted=null;whiteProgress=0;ruralOrigin=null;pos.x=3.15;pos.y=2.1;pos.z=-140;
 advanceWhiteScene(firstSceneStarted+10000);const orb=whiteFadeStarted===firstSceneStarted+10000;
 Object.assign(pos,saved);whiteFadeStarted=null;whiteProgress=0;ruralOrigin=null;ruralAge=0;dreamTransition=false;
 return {oldBoundary,before,boundary,midpoint,complete,orb};
})()`);console.log('Timing:',checks);if(Object.values(checks).some(v=>!v))throw Error('Timing check failed');
await evaluate('vr=true;true');await new Promise(r=>setTimeout(r,500));
console.log('Stereo shader error:',await evaluate('gl.getError()'));
console.log('Browser errors:',JSON.stringify(errors));await send('Browser.close');ws.close();