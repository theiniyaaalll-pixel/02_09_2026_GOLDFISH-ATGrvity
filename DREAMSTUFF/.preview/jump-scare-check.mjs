import fs from 'node:fs';
const helper=fs.readFileSync('.preview/street-cart-check.mjs','utf8').split("await evaluate('pos.x")[0];
const body=`
await send('Page.navigate',{url:'file:///C:/Users/iniya/OneDrive/Desktop/Final%20-%20interactive%20art/02_09_2026_GOLDFISH-ATGrvity/DREAMSTUFF/index.html?mode=solo&scene=2'});
for(let i=0;i<120;i++){await new Promise(r=>setTimeout(r,250));if(await evaluate('typeof ruralScene!=="undefined"&&!!ruralScene&&ruralReadyAge!==null'))break;}
await evaluate('window.savedCalib=JSON.stringify(calib);window.postSnapshot=null;const original=ruralScene.renderer.render.bind(ruralScene.renderer);ruralScene.renderer.render=(s,c)=>{const u=s.children[0]?.material?.uniforms;if(u?.scareOn)postSnapshot={on:u.scareOn.value,stereo:u.stereo.value,loaded:u.jumpScare.value.image?.width};return original(s,c)};true');
for(const [age,on] of [[9.99,0],[10,1],[12.99,1],[13,0]]){
 const report=await evaluate('ruralScene.render({x:0,z:12,yaw:Math.PI,pitch:0,time:20,sceneAge:'+age+',reveal:1,vr:false,geometry:vrGeometry(),viewer:VIEWER,calib,w:canvas.width,h:canvas.height});postSnapshot');
 if(report.on!==on||!report.loaded)throw Error('Timing/image failure '+JSON.stringify(report));console.log(age,report);
}
await evaluate('ruralReadyAge=ruralAge-11;true');await new Promise(r=>setTimeout(r,150));
if(!(await evaluate('postSnapshot.on===1')))throw Error('Shared scene clock not wired');
fs.writeFileSync('.preview/jump-scare-desktop.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
await evaluate('vr=true;true');await new Promise(r=>setTimeout(r,150));
if(!(await evaluate('postSnapshot.on===1&&postSnapshot.stereo===1&&JSON.stringify(calib)===savedCalib')))throw Error('VR/calibration check failed');
fs.writeFileSync('.preview/jump-scare-vr.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
console.log('Shared clock, stereo, calibration passed. Errors:',errors);if(errors.length)process.exitCode=1;
await send('Browser.close');ws.close();
`;
await import('data:text/javascript;base64,'+Buffer.from(helper+body).toString('base64'));
