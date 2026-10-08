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

errors.length=0;await send('Page.navigate',{url:"file:///C:/Users/iniya/OneDrive/Desktop/Final%20-%20interactive%20art/02_09_2026_GOLDFISH-ATGrvity/DREAMSTUFF/index.html?mode=controller"});
for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,250));if(await evaluate('typeof ruralScene!=="undefined"&&!!ruralScene'))break;}
await evaluate('window.testAge=10;advanceWhiteScene=()=>{whiteProgress=1;ruralOrigin={x:0,z:7};ruralAge=testAge};ruralRevealStarted=performance.now()-5000;window.sent=[];conns.add({open:true,send:m=>sent.push(m)});true');
await new Promise(r=>setTimeout(r,250));
await evaluate('pos.x=-18;pos.z=-89;true');await new Promise(r=>setTimeout(r,250));
console.log('Reach:',await evaluate('({exit:ruralExitAge,progress:ruralExitProgress})'));
if(await evaluate('ruralExitAge!==10'))throw Error('Reach trigger failed');
await evaluate('testAge=11');await new Promise(r=>setTimeout(r,250));
if(await evaluate('Math.abs(ruralExitProgress-.5)>.01'))throw Error('Fade midpoint failed');
await evaluate('testAge=12.1');await new Promise(r=>setTimeout(r,250));
console.log('Hold:',await evaluate('({progress:ruralExitProgress,hidden:document.querySelector("#rural-scene").style.display,white:document.body.classList.contains("transitioning")})'));
await evaluate('pos.x=0;pos.z=7;ruralReadyAge=20;ruralExitAge=null;testAge=139.9;true');await new Promise(r=>setTimeout(r,250));
if(await evaluate('ruralExitAge!==null'))throw Error('Timeout triggered early');
await evaluate('testAge=140');await new Promise(r=>setTimeout(r,250));
if(await evaluate('ruralExitAge!==140'))throw Error('Timeout did not trigger');
const packet=await evaluate('sent.at(-1)');if(packet.ruralExitAge!==140)throw Error('Exit timestamp absent from sync');
await evaluate('testAge=142.1');await new Promise(r=>setTimeout(r,250));
if(await evaluate('ruralExitProgress!==1'))throw Error('Timeout did not finish');
console.log('120-second timeout and sync payload: passed');
await send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:1,mobile:true});
await send('Page.navigate',{url:"file:///C:/Users/iniya/OneDrive/Desktop/Final%20-%20interactive%20art/02_09_2026_GOLDFISH-ATGrvity/DREAMSTUFF/index.html?mode=headset"});
for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,250));if(await evaluate('typeof ruralScene!=="undefined"&&!!ruralScene'))break;}
await evaluate('Object.assign(target,'+JSON.stringify({...packet,ruralAge:141,vx:0,vz:0})+');target.serverTime=performance.now();synced=true;ruralRevealStarted=performance.now()-5000;true');
await new Promise(r=>setTimeout(r,150));
const phone=await evaluate('({vr,exit:ruralExitAge,progress:ruralExitProgress})');console.log('Headset fade:',phone);if(!phone.vr||phone.exit!==140||phone.progress<.5)throw Error('Headset fade failed');
await evaluate('target.ruralAge=142.1;target.serverTime=performance.now();true');await new Promise(r=>setTimeout(r,250));
if(await evaluate('ruralExitProgress!==1'))throw Error('Headset hold failed');
console.log('Headset white hold: passed');console.log('Errors:',JSON.stringify(errors));await send('Browser.close');ws.close();