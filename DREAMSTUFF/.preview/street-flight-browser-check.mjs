import fs from 'node:fs';
const helper=fs.readFileSync('.preview/street-cart-check.mjs','utf8').split("await evaluate('pos.x")[0];
const body=`
await evaluate('window.savedFlightCalib=JSON.stringify(calib);flightDistance=DreamStreetFlight.length*.26;flightHeading=null;walkVelocity=0;keys={w:true};true');
await new Promise(r=>setTimeout(r,400));
const forward=await evaluate('({distance:flightDistance,y:pos.y,cameraY:streetScene.camera.position.y})');
await evaluate('keys={s:true};walkVelocity=0;true');await new Promise(r=>setTimeout(r,400));
const back=await evaluate('({distance:flightDistance,y:pos.y,cameraY:streetScene.camera.position.y})');
console.log('Forward and backward:',forward,back);if(back.distance>=forward.distance||forward.y<17||Math.abs(back.y-back.cameraY)>.001)throw Error('Flight motion/height failed');
await evaluate('keys={};walkVelocity=0;vr=true;window.flightEyes=[];window.savedRender=streetScene.renderer.render.bind(streetScene.renderer);streetScene.renderer.render=(s,c)=>{if(s===streetScene.scene&&c.position.y>0)flightEyes.push({y:c.position.y,direction:c.getWorldDirection(c.position.clone()).toArray()});return savedRender(s,c)};true');
await new Promise(r=>setTimeout(r,400));
const stereo=await evaluate('({eyes:flightEyes.slice(-2),y:pos.y,calibrationUnchanged:JSON.stringify(calib)===savedFlightCalib})');
console.log('Stereo height and horizon:',stereo);if(stereo.eyes.length!==2||!stereo.calibrationUnchanged||stereo.eyes.some(e=>Math.abs(e.y-stereo.y)>.001||Math.abs(e.direction[1])>.001))throw Error('Stereo height/horizon/calibration failed');
fs.writeFileSync('.preview/visual3-drone-vr.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
console.log('Errors:',errors);if(errors.length)process.exitCode=1;
await send('Browser.close');ws.close();
`;
await import('data:text/javascript;base64,'+Buffer.from(helper+body).toString('base64'));
