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

errors.length=0;await send('Page.navigate',{url:"file:///C:/Users/iniya/OneDrive/Desktop/Final%20-%20interactive%20art/02_09_2026_GOLDFISH-ATGrvity/DREAMSTUFF/index.html?mode=solo&scene=3"});
for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,300));if(await evaluate('typeof streetScene!=="undefined"&&!!streetScene&&!!streetOrigin'))break;}
console.log('Street state:',await evaluate('({loaded:!!streetScene,origin:streetOrigin,age:streetAge,error:streetLoadError?.message,residents:streetScene?.residents.length})'));
await evaluate('streetStartedAge=ruralAge-8;true');await new Promise(r=>setTimeout(r,1000));
fs.writeFileSync('.preview/visual3-desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
console.log('Errors:',JSON.stringify(errors).slice(0,5000));
ws.close();
