import assert from 'node:assert/strict';
import '../gesture-controls.js';
const {classify,NavigationGestures}=globalThis.DreamGestures;
function hand(command){
 const h=Array.from({length:21},()=>({x:.5,y:.7,z:0}));h[0]={x:.5,y:.85,z:0};
 for(const [m,p,d,t] of [[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]]){
  const x=.46+(m-5)*.009;h[m]={x,y:.65,z:0};h[p]={x,y:.55,z:0};h[d]={x,y:.61,z:0};h[t]={x,y:.68,z:0};
  if(command==='backward'){h[d]={x,y:.48,z:0};h[t]={x,y:.40,z:0};}
 }
 if(command!=='backward'&&command!=='stop'){
  const b=h[5],v=command==='left'?[.25,0,0]:command==='right'?[-.25,0,0]:command==='camera'?[0,0,-.25]:[0,-.25,0];
  for(const [i,f] of [[6,.4],[7,.7],[8,1]])h[i]={x:b.x+v[0]*f,y:b.y+v[1]*f,z:b.z+v[2]*f};
 }
 return h;
}
for(const c of ['left','right','forward','backward','stop'])assert.equal(classify(hand(c)).command,c,c);
const g=new NavigationGestures();g.update([hand('left')],0);assert.equal(g.current(0),'stop');g.update([hand('left')],200);assert.equal(g.current(200),'left');assert.equal(g.current(451),'stop');
g.update([hand('right'),hand('left')],500);assert.equal(g.current(500),'stop');
for(const direction of [1,-1]){
 const circle=new NavigationGestures();let turns=[];
 for(let i=0;i<=64;i++){
  const h=hand('index'),angle=direction*i/64*Math.PI*2;
  const dx=.12*Math.cos(angle),dy=.12*Math.sin(angle)/.75;
  for(const p of h){p.x+=dx;p.y+=dy;}
  const r=circle.update([h],i*30);if(r.turn)turns.push(r.turn);
 }
 assert.deepEqual(turns,[direction],'circle direction and single trigger');
}
const line=new NavigationGestures();for(let i=0;i<70;i++){const h=hand('index');for(const p of h)p.x+=i*.003;assert.equal(line.update([h],i*30).turn,0);}
assert.equal(classify([]).command,'stop');
console.log('Passed: five poses, dwell, tracking timeout, conflicting hands, both circle directions, and no turn from straight motion.');


// Regression: upward pointing stays distinct from open-palm reverse.
const foreshortened=hand('forward');
for(const [m,p,d,t] of [[9,10,11,12],[13,14,15,16],[17,18,19,20]]){
 foreshortened[p]={...foreshortened[m],y:.69};foreshortened[d]={...foreshortened[m],y:.73};foreshortened[t]={...foreshortened[m],y:.77};
}
assert.equal(classify(foreshortened).command,'forward');
const forwardControl=new NavigationGestures();forwardControl.update([foreshortened],0);
assert.equal(forwardControl.update([foreshortened],200).command,'forward');
assert.equal(classify(hand('backward')).command,'backward');
assert.equal(classify(hand('camera')).command,'stop');
console.log('Passed index-up forward, open-palm reverse, and disabled camera-pointing checks.');
