// Classic script so webcam navigation also works when index.html is opened locally.
(() => {
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0));
  function extended(hand,mcp,pip,tip){
    const a=hand[mcp],b=hand[pip],c=hand[tip];
    const u=[b.x-a.x,b.y-a.y,(b.z||0)-(a.z||0)],v=[c.x-b.x,c.y-b.y,(c.z||0)-(b.z||0)];
    const alignment=u.reduce((sum,n,i)=>sum+n*v[i],0)/(Math.hypot(...u)*Math.hypot(...v)||1);
    return alignment>.55&&distance(c,a)>distance(b,a)*1.35;
  }
  function classify(hand){
    if(!hand||hand.length!==21||hand.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.z)))return {command:'stop'};
    const palm=distance(hand[0],hand[9]);if(palm<.035)return {command:'stop'};
    const fingers=[[5,6,8],[9,10,12],[13,14,16],[17,18,20]].map(([m,p,t])=>
      extended(hand,m,p,t)&&distance(hand[t],hand[0])>distance(hand[p],hand[0])*1.08);
    const tip=hand[8],base=hand[5],dx=tip.x-base.x,dy=tip.y-base.y,dz=tip.z-base.z;
    const openPalm=fingers.every(Boolean)&&[[5,6,8],[9,10,12],[13,14,16],[17,18,20]]
      .every(([,pip,t])=>distance(hand[t],hand[0])>distance(hand[pip],hand[0])*1.12);
    if(openPalm)return {command:'backward'};
    if(!fingers[0]||fingers.slice(1).some(Boolean))return {command:'stop'};
    let command='stop';
    // Up is negative image Y. Use the visible pointing direction for forward,
    // rather than estimated camera depth. X is reversed in our mirrored preview.
    const palmImage=Math.hypot(hand[0].x-hand[9].x,hand[0].y-hand[9].y);
    if(-dy>palmImage*.48&&-dy>Math.abs(dx)*1.25)command='forward';
    else if(Math.abs(dx)>palm*.48&&Math.abs(dx)>Math.abs(dy)*1.25&&Math.abs(dx)>Math.abs(dz)*1.1)command=dx>0?'left':'right';
    return {command,tip:{x:1-tip.x,y:tip.y*.75}};
  }
  class NavigationGestures {
    constructor(){this.command='stop';this.candidate='stop';this.since=0;this.lastSeen=-Infinity;this.path=[];this.cooldown=0;}
    reset(){this.command='stop';this.candidate='stop';this.path=[];this.lastSeen=-Infinity;}
    update(hands,now){
      this.lastSeen=now;
      // One hand at a time prevents switching between two fingertips mid-circle.
      if(hands.length!==1){this.reset();return {command:'stop',turn:0};}
      const result=classify(hands[0]);let turn=0,moving=false;
      if(result.tip&&now>=this.cooldown){
        this.path.push({...result.tip,time:now});this.path=this.path.filter(p=>now-p.time<3000);
        const recent=this.path.filter(p=>now-p.time<180);
        if(recent.length>1)moving=Math.hypot(result.tip.x-recent[0].x,result.tip.y-recent[0].y)>.018;
        const points=this.path;
        if(points.length>=20&&now-points[0].time>650){
          const cx=points.reduce((s,p)=>s+p.x,0)/points.length,cy=points.reduce((s,p)=>s+p.y,0)/points.length;
          const radii=points.map(p=>Math.hypot(p.x-cx,p.y-cy)),radius=radii.reduce((s,r)=>s+r,0)/points.length;
          const deviation=Math.sqrt(radii.reduce((s,r)=>s+(r-radius)**2,0)/points.length)/(radius||1);
          let winding=0,total=0;
          for(let i=1;i<points.length;i++){
            const a=Math.atan2(points[i-1].y-cy,points[i-1].x-cx),b=Math.atan2(points[i].y-cy,points[i].x-cx);
            const delta=Math.atan2(Math.sin(b-a),Math.cos(b-a));winding+=delta;total+=Math.abs(delta);
          }
          const closure=Math.hypot(points.at(-1).x-points[0].x,points.at(-1).y-points[0].y);
          if(radius>.035&&deviation<.3&&Math.abs(winding)>5.5&&Math.abs(winding)/(total||1)>.85&&closure<radius*.65){
            // Screen clockwise is a right turn; scene yaw decreases when turning right.
            turn=-Math.sign(winding);this.cooldown=now+6500;this.path=[];
          }
        }
      }else this.path=[];
      const candidate=moving||turn?'stop':result.command;
      if(candidate!==this.candidate){this.candidate=candidate;this.since=now;this.command='stop';}
      if(candidate==='stop'||now-this.since>=180)this.command=candidate;
      return {command:this.command,turn};
    }
    current(now){if(now-this.lastSeen>250)this.reset();return this.command;}
  }
  globalThis.DreamGestures={classify,NavigationGestures};
})();
