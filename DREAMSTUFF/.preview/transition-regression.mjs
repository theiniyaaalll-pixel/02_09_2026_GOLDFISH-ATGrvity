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

await send('Page.navigate',{url:'http://127.0.0.1:8080/index.html?mode=solo'});
await new Promise(r=>setTimeout(r,2500));
await evaluate('new Promise(resolve=>{const check=()=>ruralScene?resolve(true):setTimeout(check,100);check()})');
console.log('Orb trigger:',await evaluate('pos.x=3.15;pos.z=-139;pos.y=1.68;advanceWhiteScene(performance.now());({triggered:whiteFadeStarted!==null,progress:whiteProgress})'));
await evaluate('window.savedRural=ruralScene;ruralScene=null;whiteFadeStarted=performance.now()-8000;advanceWhiteScene(performance.now())');
await new Promise(r=>setTimeout(r,300));
if(!await evaluate('document.body.classList.contains("transitioning")&&ruralRevealStarted===null'))throw Error('Missing white loading bridge');
await evaluate('ruralScene=window.savedRural;true');
await new Promise(r=>setTimeout(r,200));
console.log('Delayed reveal:',await evaluate('({started:ruralRevealStarted!==null,elapsed:performance.now()-ruralRevealStarted,visible:document.querySelector("#rural-scene").style.display})'));
await new Promise(r=>setTimeout(r,4000));
console.log('Finished:',await evaluate('({revealComplete:performance.now()-ruralRevealStarted>=3500,visible:document.querySelector("#rural-scene").style.display,whiteOverlay:document.body.classList.contains("transitioning")})'));
if(errors.length)throw Error(JSON.stringify(errors));
await send('Network.setBlockedURLs',{urls:['https://*','*visual2.js']});
await send('Page.navigate',{url:'http://127.0.0.1:8080/index.html?mode=solo'});
await new Promise(r=>setTimeout(r,1500));
await evaluate('whiteFadeStarted=performance.now()-3000;advanceWhiteScene(performance.now())');
await new Promise(r=>setTimeout(r,250));
console.log('Missing module:',await evaluate('({error:!!ruralLoadError,whiteOverlay:document.body.classList.contains("transitioning"),message:status.textContent})'));
if(!await evaluate('!!ruralLoadError&&!document.body.classList.contains("transitioning")'))throw Error('Loading error hidden');
await send('Browser.close');ws.close();
