import fs from 'node:fs';import assert from 'node:assert/strict';
import '../dream-audio.js';
const {soundState}=globalThis.DreamAudio;
for(const age of [10,11,12.999]){const s=soundState({scene:2,time:age,sceneAge:age});assert.equal(s.scare,true);assert.equal(s.gains.grass,0);assert.equal(s.gains.nature,0);}
assert.ok(soundState({scene:2,time:13,sceneAge:13}).gains.grass>0);
assert.notEqual(soundState({scene:1,time:1}).gains.water,soundState({scene:1,time:3}).gains.water);
assert.ok(soundState({scene:3,time:0,height:20}).gains.market<soundState({scene:3,time:0,height:1.68}).gains.market);
const helper=fs.readFileSync('.preview/street-cart-check.mjs','utf8').split("await evaluate('pos.x")[0];
const body=`
await send('Page.navigate',{url:'file:///C:/Users/iniya/OneDrive/Desktop/Final%20-%20interactive%20art/02_09_2026_GOLDFISH-ATGrvity/DREAMSTUFF/index.html?mode=solo&scene=2'});
for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,250));if(await evaluate('typeof dreamSound!=="undefined"&&!!ruralScene&&ruralReadyAge!==null'))break;}
const point=await evaluate('(()=>{const r=soundButton.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...point});await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...point});
await evaluate('dreamSound.ready.then(()=>true)');await new Promise(r=>setTimeout(r,100));
const report=await evaluate('({state:dreamSound.context.state,durations:Object.fromEntries(Object.entries(dreamSound.buffers).map(([k,b])=>[k,b.duration])),failures:dreamSound.failures,scene:dreamSound.lastView.scene,screamProvided:!!dreamSound.assets.scream})');
console.log(report);if(report.state!=='running'||Object.keys(report.durations).length!==5||!report.screamProvided||report.failures.length)throw Error('Audio decoding/unlock failure');
const scare=await evaluate('(()=>{dreamSound.update({scene:2,time:11.2,sceneAge:11.2,reveal:1});const active=!!dreamSound.scream&&dreamSound.scream.buffer===dreamSound.buffers.scream&&dreamSound.lastState.scare&&dreamSound.lastState.gains.nature===0;dreamSound.update({scene:2,time:13,sceneAge:13,reveal:1});return {active,resumed:!dreamSound.scream&&dreamSound.lastState.gains.nature>0};})()');
console.log('Goat scream gating:',scare);if(!scare.active||!scare.resumed)throw Error('Scare/resume failure');
await evaluate('dreamSound.setMuted(true);true');if(!(await evaluate('dreamSound.muted')))throw Error('Mute failed');
console.log('Errors:',errors);if(errors.length)process.exitCode=1;
await send('Browser.close');ws.close();
`;
await import('data:text/javascript;base64,'+Buffer.from(helper+body).toString('base64'));
