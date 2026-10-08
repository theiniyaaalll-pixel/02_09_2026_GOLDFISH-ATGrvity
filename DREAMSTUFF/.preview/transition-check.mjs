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
await send('Page.navigate',{url:'http://127.0.0.1:8080/index.html?mode=controller'});
await new Promise(r=>setTimeout(r,1800));
console.log('Initial:',await evaluate('({age:performance.now()-firstSceneStarted,progress:whiteProgress,loaded:!!ruralScene})'));
await evaluate(`window.transitionSamples=[];window.transitionProbe=setInterval(()=>transitionSamples.push({age:Math.round(performance.now()-firstSceneStarted),fade:whiteProgress,origin:!!ruralOrigin,visible:document.querySelector('#rural-scene')?.style.display,ruralAge}),250)`);
await new Promise(r=>setTimeout(r,52000));
const samples=await evaluate('clearInterval(transitionProbe);transitionSamples');
console.log('Milestones:',JSON.stringify([samples.find(s=>s.fade===0),samples.find(s=>s.fade>0&&s.fade<1),samples.find(s=>s.fade===1),samples.find(s=>s.visible==="block"),samples.at(-1)]));
console.log('Errors:',JSON.stringify(errors));
await send('Browser.close');ws.close();
