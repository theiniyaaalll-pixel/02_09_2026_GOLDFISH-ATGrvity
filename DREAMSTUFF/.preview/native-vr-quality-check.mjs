import fs from 'node:fs';
const helper=fs.readFileSync('.preview/street-cart-check.mjs','utf8').split("await evaluate('pos.x")[0];
const body=`
await send('Emulation.setDeviceMetricsOverride',{width:844,height:390,deviceScaleFactor:3,mobile:true,screenWidth:844,screenHeight:390});
await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
await send('Page.navigate',{url:'file:///C:/Users/iniya/OneDrive/Desktop/Final%20-%20interactive%20art/02_09_2026_GOLDFISH-ATGrvity/DREAMSTUFF/index.html?mode=solo&scene=2'});
for(let i=0;i<240;i++){await new Promise(r=>setTimeout(r,250));if(await evaluate('typeof streetScene!=="undefined"&&!!streetScene&&ruralReadyAge!==null'))break;}
await evaluate('window.initialCalib=JSON.stringify(calib);vr=true;ruralReadyAge=ruralAge-20;true');
await new Promise(r=>setTimeout(r,500));
const rural=await evaluate('({width:canvas.width,height:canvas.height,dpr:devicePixelRatio,shadows:ruralScene.renderer.shadowMap.enabled,sun:ruralScene.scene.children.filter(o=>o.isDirectionalLight).map(o=>o.castShadow),lensSeparationCss:(vrGeometry().rx-vrGeometry().lx)/(canvas.width/innerWidth),expectedSeparationCss:calib.lensMm/calib.mmPerCss})');
console.log('Visual 2 native stereo:',rural);
if(rural.width!==2532||rural.height!==1170||!rural.shadows||Math.abs(rural.lensSeparationCss-rural.expectedSeparationCss)>.001)throw Error('Resolution/shadow/calibration failure');
fs.writeFileSync('.preview/visual2-native-vr.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
await evaluate('ruralExitAge=ruralAge-2.1;true');
for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,250));if(await evaluate('!!streetOrigin'))break;}
await evaluate('streetStartedAge=ruralAge-8;true');await new Promise(r=>setTimeout(r,500));
const street=await evaluate('({width:canvas.width,height:canvas.height,residents:streetScene.residents.length,shadows:streetScene.scene.children.filter(o=>o.isDirectionalLight).every(o=>o.castShadow),calibrationUnchanged:JSON.stringify(calib)===initialCalib,vr})');console.log('Visual 3 native stereo:',street);
if(street.residents!==13||!street.shadows||!street.vr||!street.calibrationUnchanged)throw Error('Street quality failure');
fs.writeFileSync('.preview/visual3-native-vr.png',Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
console.log('Render errors:',errors);if(errors.length)process.exitCode=1;
await send('Browser.close');ws.close();
`;
await import('data:text/javascript;base64,'+Buffer.from(helper+body).toString('base64'));
