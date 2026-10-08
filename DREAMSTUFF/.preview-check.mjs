import fs from 'node:fs';
const tabs=await (await fetch('http://127.0.0.1:9335/json')).json();
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
let id=0;const pending=new Map(),errors=[];
ws.addEventListener('message',event=>{
 const message=JSON.parse(event.data);
 if(message.id){const p=pending.get(message.id);pending.delete(message.id);message.error?p.reject(message.error):p.resolve(message.result);}
 if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);
 if(message.method==='Runtime.consoleAPICalled'&&message.params.type==='error')errors.push(message.params.args.map(a=>a.value||a.description).join(' '));
 if(message.method==='Log.entryAdded'&&message.params.entry.level==='error')errors.push(message.params.entry.text);
});
function send(method,params={}){return new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
await send('Runtime.enable');await send('Log.enable');await send('Page.enable');
// External webcam/broker scripts are unrelated to this solo rendering check.
await send('Network.enable');await send('Network.setBlockedURLs',{urls:['https://*']});
await send('Emulation.setDeviceMetricsOverride',{width:1100,height:720,deviceScaleFactor:1,mobile:false});
await send('Page.navigate',{url:'http://localhost:8080/index.html?mode=solo'});
await new Promise(resolve=>setTimeout(resolve,4500));
console.log('Ready:',await evaluate('({ready:!!ruralScene,shader:!!gl,mode:role})'));
await evaluate('whiteFadeStarted=performance.now()-6500;dreamTransition=true;advanceWhiteScene(performance.now());');
await new Promise(resolve=>setTimeout(resolve,4500));
console.log('Scene:',await evaluate('({age:ruralAge,origin:ruralOrigin,visible:document.querySelector("#rural-scene")?.style.display,stats:ruralScene?.renderer.info.render,programs:ruralScene?.renderer.info.programs?.map(p=>({name:p.name,ok:p.diagnostics?.runnable}))})'));
fs.mkdirSync('.preview',{recursive:true});
const screenshot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('.preview/visual2-desktop.png',Buffer.from(screenshot.data,'base64'));
await evaluate('vr=true;');
await new Promise(resolve=>setTimeout(resolve,2000));
const stereo=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('.preview/visual2-stereo.png',Buffer.from(stereo.data,'base64'));
console.log('Errors:',JSON.stringify(errors));
console.log('Stereo:',await evaluate('({vr,stats:ruralScene?.renderer.info.render,calibration:calib})'));
await evaluate('vr=false');ws.close();
