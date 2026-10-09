// A repeatable, smooth flight route. Only visual 3 uses this controller.
(() => {
  const points=[
    [0,1.68,12],[-2,1.85,-7],[2,2.1,-30],[1,6,-48],[-1.5,17,-60],
    [-17,20,-65],[-22,21,-38],[-18,20,-8],[15,20,-5],[20,21,-38],
    [18,20,-73],[1,18,-90],[-1,8,-107],[1,2.1,-122],[2,1.9,-105],
    [-2,1.9,-76],[0,1.8,-47],[-1,1.75,-18],[-2,1.8,19],
  ];
  // Seeded variations give the loops an irregular shape without frame jitter.
  let seed=92731;const random=()=>((seed=Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;
  for(let i=1;i<points.length-1;i++){points[i][0]+=(random()-.5)*.7;points[i][2]+=(random()-.5)*2;}
  const n=points.length;
  function curve(u){
    const f=((u%1)+1)%1*n,i=Math.floor(f),t=f-i;
    const a=points[(i+n-1)%n],b=points[i],c=points[(i+1)%n],d=points[(i+2)%n];
    return b.map((v,k)=>.5*((2*v)+(-a[k]+c[k])*t+(2*a[k]-5*v+4*c[k]-d[k])*t*t+(-a[k]+3*v-3*c[k]+d[k])*t*t*t));
  }
  const samples=[{distance:0,position:curve(0)}];let length=0;
  for(let i=1;i<=2400;i++){
    const position=curve(i/2400),previous=samples[i-1].position;
    length+=Math.hypot(...position.map((v,k)=>v-previous[k]));samples.push({distance:length,position});
  }
  function positionAt(distance){
    const s=((distance%length)+length)%length;let low=0,high=samples.length-1;
    while(high-low>1){const mid=(low+high)>>1;if(samples[mid].distance<s)low=mid;else high=mid;}
    const a=samples[low],b=samples[high],t=(s-a.distance)/(b.distance-a.distance||1);
    return a.position.map((v,k)=>v+(b.position[k]-v)*t);
  }
  function sample(distance,lateral=0){
    const position=positionAt(distance),a=positionAt(distance-.25),b=positionAt(distance+.25);
    const yaw=Math.atan2(b[0]-a[0],b[2]-a[2]);
    const offset=Math.max(-1.1,Math.min(1.1,lateral));
    return {x:position[0]-Math.cos(yaw)*offset,y:Math.max(1.68,position[1]),z:position[2]+Math.sin(yaw)*offset,yaw};
  }
  globalThis.DreamStreetFlight={length,sample};
})();
