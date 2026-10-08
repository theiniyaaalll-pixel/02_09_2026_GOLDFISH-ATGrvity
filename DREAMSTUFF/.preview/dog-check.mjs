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

await send('Page.navigate',{url:"file:///C:/Users/iniya/OneDrive/Desktop/Final%20-%20interactive%20art/02_09_2026_GOLDFISH-ATGrvity/DREAMSTUFF/index.html?mode=solo"});
await new Promise(r=>setTimeout(r,3000));
console.log('Water errors:',JSON.stringify(errors));
fs.writeFileSync('.preview/waves-new.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
await evaluate('advanceWhiteScene=()=>{whiteProgress=1;ruralOrigin={x:0,z:7};ruralAge=12};ruralRevealStarted=performance.now()-5000;true');
for(let i=0;i<30;i++){if(await evaluate('!!ruralScene'))break;await new Promise(r=>setTimeout(r,500));}
await new Promise(r=>setTimeout(r,2000));
console.log('Dog present:',await evaluate("(()=>{const d=ruralScene.scene.getObjectByName('Cellular running dog');return {visible:d.visible,position:d.position.toArray()}})()"));
fs.writeFileSync('.preview/dog-new.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
await evaluate('advanceWhiteScene=()=>{whiteProgress=1;ruralOrigin={x:0,z:7};ruralAge=18};true');
await new Promise(r=>setTimeout(r,500));
console.log('Dog absent:',await evaluate("ruralScene.scene.getObjectByName('Cellular running dog').visible"));
await evaluate('advanceWhiteScene=()=>{whiteProgress=1;ruralOrigin={x:0,z:7};ruralAge=34};true');
await new Promise(r=>setTimeout(r,500));
console.log('Dog returns:',await evaluate("ruralScene.scene.getObjectByName('Cellular running dog').visible"));
console.log('All errors:',JSON.stringify(errors));await send('Browser.close');ws.close();