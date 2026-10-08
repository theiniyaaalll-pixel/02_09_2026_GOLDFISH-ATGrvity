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
await send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true,screenWidth:844,screenHeight:390});
await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
await send('Page.navigate',{url:'http://127.0.0.1:8080/index.html?mode=headset&room=localcheck'});
await new Promise(r=>setTimeout(r,3500));
await evaluate(`ruralScene.ready.then(()=>true)`);
console.log('Mobile setup:',await evaluate('({coarse:matchMedia("(pointer:coarse)").matches,vr,role,calibration:JSON.stringify(calib)})'));
const originalCalibration=await evaluate('JSON.stringify(calib)');
await evaluate(`
 target.x=0;target.y=1.68;target.z=7;target.yaw=Math.PI;target.pitch=0;
 target.transition=true;target.whiteProgress=1;target.ruralOrigin={x:0,z:7};target.ruralAge=10;target.serverTime=performance.now();
 synced=true;bodyYaw=Math.PI;headTrackingEnabled=true;headBase=null;
 document.body.classList.add('headset-ready');document.body.classList.remove('offline');
 onDeviceOrientation({alpha:15,beta:90,gamma:0});
 window.lastEyeViews=[];
 ruralScene.scene.children.find(o=>o.isMesh&&o.geometry?.type==='PlaneGeometry').onBeforeRender=(renderer,scene,camera)=>{
  const rt=renderer.getRenderTarget();
  if(rt?.width!==384){window.lastEyeViews.push({direction:camera.getWorldDirection(camera.position.clone()).toArray(),position:camera.position.toArray(),width:rt.width,height:rt.height});if(window.lastEyeViews.length>2)window.lastEyeViews.shift();}
 };
`);
for(const [name,alpha,expected] of [['front',15,[0,0,-1]],['right',105,[1,0,0]],['back',195,[0,0,1]],['left',285,[-1,0,0]],['full-turn',375,[0,0,-1]]]){
 await evaluate(`onDeviceOrientation({alpha:${alpha},beta:90,gamma:0})`);
 await new Promise(r=>setTimeout(r,650));
 const views=await evaluate('window.lastEyeViews');
 if(views.length!==2)throw Error('Two eye views missing');
 for(const view of views){if(view.direction.reduce((sum,x,i)=>sum+x*expected[i],0)<.999)throw Error('Incorrect '+name+' direction');}
 const separation=Math.hypot(...views[0].position.map((x,i)=>x-views[1].position[i]));
 if(Math.abs(separation-.064)>1e-6)throw Error('Eye spacing changed');
 console.log(name,{direction:views[0].direction.map(x=>Math.round(x*1000)/1000),separation,offscreen:[views[0].width,views[0].height]});
 if(name==='front'||name==='back'){
  const image=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('.preview/visual2-mobile-'+name+'.png',Buffer.from(image.data,'base64'));
 }
}
if(await evaluate('JSON.stringify(calib)')!==originalCalibration)throw Error('Calibration changed during a full turn');
await evaluate('calib.cross=true');
await new Promise(r=>setTimeout(r,350));
const grid=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('.preview/visual2-mobile-grid.png',Buffer.from(grid.data,'base64'));
await evaluate('calib.cross=false');
console.log('Runtime/shader errors:',JSON.stringify(errors));
if(errors.length)throw Error('Rendering errors occurred');
await send('Browser.close');ws.close();
