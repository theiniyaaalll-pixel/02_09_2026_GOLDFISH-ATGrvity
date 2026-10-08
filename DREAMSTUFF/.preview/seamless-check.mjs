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

await send('Network.setBlockedURLs',{urls:['https://*','*/assets/*','*/vendor/*','*/visual2.js']});
async function waitReady(){await evaluate('new Promise((resolve,reject)=>{const deadline=performance.now()+20000;const check=()=>{if(ruralLoadError)reject(String(ruralLoadError));else if(ruralScene)resolve(true);else if(performance.now()>deadline)reject("Landscape prepare timeout");else setTimeout(check,100)};check()})');}
await send('Page.navigate',{url:'http://127.0.0.1:8080/index.html?mode=controller'});
await new Promise(r=>setTimeout(r,1800));
await waitReady();
const age=await evaluate('performance.now()-firstSceneStarted');console.log('HTTP preloaded in',Math.round(age),'ms');
await evaluate('window.transitionSamples=[];window.transitionProbe=setInterval(()=>transitionSamples.push({age:Math.round(performance.now()-firstSceneStarted),fade:whiteProgress,visible:document.querySelector("#rural-scene")?.style.display}),200)');
await new Promise(r=>setTimeout(r,Math.max(0,51500-age)));
console.log('Automatic HTTP flow:',await evaluate('clearInterval(transitionProbe);({firstFade:transitionSamples.find(s=>s.fade>0),firstLandscape:transitionSamples.find(s=>s.visible==="block"),finished:whiteProgress===1&&ruralScene&&ruralRevealStarted!==null&&performance.now()-ruralRevealStarted>3500})'));
if(!await evaluate('whiteProgress===1&&!!ruralScene&&ruralRevealStarted!==null'))throw Error('Automatic transition failed');
await send('Page.navigate',{url:"file:///C:/Users/iniya/OneDrive/Desktop/Final%20-%20interactive%20art/02_09_2026_GOLDFISH-ATGrvity/DREAMSTUFF/index.html?mode=solo"});
await new Promise(r=>setTimeout(r,1800));await waitReady();
console.log('Direct HTML preloaded:',await evaluate('({protocol:location.protocol,ready:!!ruralScene})'));
await evaluate('pos.x=3.15;pos.y=1.68;pos.z=-139;advanceWhiteScene(performance.now())');
await new Promise(r=>setTimeout(r,6500));
console.log('Direct HTML orb flow:',await evaluate('({whiteProgress,landscape:document.querySelector("#rural-scene").style.display,finished:ruralRevealStarted!==null&&performance.now()-ruralRevealStarted>3500})'));
if(!await evaluate('whiteProgress===1&&!!ruralScene&&ruralRevealStarted!==null'))throw Error('Direct HTML transition failed');
await send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true,screenWidth:844,screenHeight:390});
await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
await send('Page.navigate',{url:"file:///C:/Users/iniya/OneDrive/Desktop/Final%20-%20interactive%20art/02_09_2026_GOLDFISH-ATGrvity/DREAMSTUFF/index.html?mode=headset&room=localcheck"});
await new Promise(r=>setTimeout(r,1800));await waitReady();
await evaluate('target.x=0;target.y=1.68;target.z=7;target.yaw=Math.PI;target.pitch=0;target.transition=true;target.whiteProgress=1;target.ruralOrigin={x:0,z:7};target.ruralAge=10;target.serverTime=performance.now();synced=true;bodyYaw=Math.PI;headTrackingEnabled=true;headBase=null;document.body.classList.add("headset-ready");document.body.classList.remove("offline");onDeviceOrientation({alpha:15,beta:90,gamma:0})');
await new Promise(r=>setTimeout(r,1200));
console.log('Packaged mobile VR:',await evaluate('({coarse:matchMedia("(pointer:coarse)").matches,vr,landscape:document.querySelector("#rural-scene").style.display,calibration:calib})'));
console.log('Runtime/shader errors:',JSON.stringify(errors));if(errors.length)throw Error('Rendering errors occurred');
await send('Browser.close');ws.close();
