import fs from 'node:fs';
const helper=fs.readFileSync('.preview/street-cart-check.mjs','utf8').split("await evaluate('pos.x")[0];
const expression=`streetScene.residents.slice(4,7).map(p=>{p.walk.weight=1;if(p.idle)p.idle.weight=0;p.walk.timeScale=1;const rows=[];for(let t=0;t<=2;t+=.05){p.mixer.setTime(t);p.holder.updateMatrixWorld(true);rows.push([t,...p.feet.map(f=>p.holder.worldToLocal(f.getWorldPosition(f.position.clone())).toArray())])}return {duration:p.walk.getClip().duration,scale:p.root.scale.y,rows}})`;
await import('data:text/javascript;base64,'+Buffer.from(helper+`console.log(JSON.stringify(await evaluate(${JSON.stringify(expression)})));ws.close();`).toString('base64'));
