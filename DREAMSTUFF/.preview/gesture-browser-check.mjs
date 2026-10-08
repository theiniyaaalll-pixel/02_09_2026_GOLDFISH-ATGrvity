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

errors.length=0;
await send('Page.navigate',{url:"file:///C:/Users/iniya/OneDrive/Desktop/Final%20-%20interactive%20art/02_09_2026_GOLDFISH-ATGrvity/DREAMSTUFF/index.html?mode=solo"});
await new Promise(r=>setTimeout(r,1800));
for(const stage of [1,2]){
 if(stage===2){await evaluate('advanceWhiteScene=()=>{whiteProgress=1;ruralOrigin={x:0,z:7};ruralAge=12};ruralRevealStarted=performance.now()-5000;true');await new Promise(r=>setTimeout(r,1500));}
 for(const command of ['forward','backward','left','right']){
 const before=await evaluate('({x:pos.x,z:pos.z})');
 await evaluate('navigationGestures.current=()=>'+JSON.stringify(command));await new Promise(r=>setTimeout(r,230));
 await evaluate("navigationGestures.current=()=> 'stop'");
 const after=await evaluate('({x:pos.x,z:pos.z})');
 if(Math.hypot(after.x-before.x,after.z-before.z)<.01)throw Error('No movement '+stage+' '+command);
 console.log('Visual '+stage+' '+command+': moved');
 }
}
const initialYaw=await evaluate('yaw');await evaluate('gestureTurn={started:performance.now(),previous:0,direction:1};true');
await new Promise(r=>setTimeout(r,6300));const turn=await evaluate('({yaw,turning:!!gestureTurn})');
if(Math.abs(turn.yaw-initialYaw-Math.PI*2)>.01||turn.turning)throw Error('Turn did not complete');
console.log('360 turn: passed');console.log('Browser errors:',JSON.stringify(errors));
await send('Browser.close');ws.close();