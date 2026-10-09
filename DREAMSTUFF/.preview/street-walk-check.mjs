import fs from 'node:fs';
const helper=fs.readFileSync('.preview/street-cart-check.mjs','utf8').split("await evaluate('pos.x")[0];
const expression=`(()=>{
 const frames=[],penetrations=[];
 for(let frame=0;frame<18;frame++){
  const time=20+frame*.05;
  streetScene.render({x:0,z:12,yaw:Math.PI,pitch:0,time,reveal:1,vr:false,geometry:vrGeometry(),viewer:VIEWER,calib,w:canvas.width,h:canvas.height});
  frames.push(streetScene.residents.filter(p=>p.config.kind==='walk').map(p=>({position:p.holder.position.toArray(),yaw:p.holder.rotation.y,weight:p.walk.weight,feet:p.feet.map(f=>f.getWorldPosition(f.position.clone()).toArray()),stride:p.strideSpeed})));
  for(const p of streetScene.residents.filter(p=>p.config.kind!=='cycle')){
   for(const {mesh} of p.soles){mesh.skeleton.update();let worst=Infinity;
    for(let i=0;i<mesh.geometry.attributes.position.count;i++){
     const v=mesh.getVertexPosition(i,mesh.position.clone()).applyMatrix4(mesh.matrixWorld),x=Math.abs(v.x);
     const ground=x>=5.525&&x<=5.775?.4:x>=3.85&&x<=5.55?.15:0;
     worst=Math.min(worst,v.y-ground);
    }
    if(worst<-.003)penetrations.push({frame,kind:p.config.kind,depth:worst});
   }
  }
 }
 const plantedSpeeds=[];
 for(let i=1;i<frames.length;i++)for(let j=0;j<frames[i].length;j++){
  const a=frames[i-1][j],b=frames[i][j];
  if(a.weight<.999||b.weight<.999||Math.abs(a.yaw-b.yaw)>.002)continue;
  for(let foot=0;foot<2;foot++){
   const fa=a.feet[foot],fb=b.feet[foot];
   if(Math.abs(fa[1]-fb[1])>.004||fa[1]>Math.min(...a.feet.map(f=>f[1]))+.004||fb[1]>Math.min(...b.feet.map(f=>f[1]))+.004)continue;
   plantedSpeeds.push(Math.hypot(fb[0]-fa[0],fb[2]-fa[2])/.05);
  }
 }
 plantedSpeeds.sort((a,b)=>a-b);
 return {strideSpeeds:frames[0].map(p=>p.stride),penetrations,plantedSamples:plantedSpeeds.length,medianPlantedSpeed:plantedSpeeds[Math.floor(plantedSpeeds.length/2)],maxPlantedSpeed:Math.max(...plantedSpeeds)};
})()`;
await import('data:text/javascript;base64,'+Buffer.from(helper+`const report=await evaluate(${JSON.stringify(expression)});console.log(report);if(report.penetrations.length||report.plantedSamples<5||report.medianPlantedSpeed>.12)process.exitCode=1;ws.close();`).toString('base64'));
