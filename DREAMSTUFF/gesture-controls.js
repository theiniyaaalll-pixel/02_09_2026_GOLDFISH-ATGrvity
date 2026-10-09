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
    const curlRatios=[[6,8],[10,12],[14,16],[18,20]].map(([p,t])=>distance(hand[t],hand[0])/(distance(hand[p],hand[0])||1));
    if(fingers.every(f=>!f)&&curlRatios.every(r=>r<.95)&&distance(hand[4],hand[9])<palm*.95){
      return {command:'fist',confidence:.75+.25*Math.min(1,(1-Math.max(...curlRatios))/.5)};
    }
    if(!fingers[0]||fingers.slice(1).some(Boolean))return {command:'stop'};
    let command='stop';
    // Up is negative image Y. Use the visible pointing direction for forward,
    // rather than estimated camera depth. X is reversed in our mirrored preview.
    const palmImage=Math.hypot(hand[0].x-hand[9].x,hand[0].y-hand[9].y);
    if(-dy>palmImage*.48&&-dy>Math.abs(dx)*1.25)command='forward';
    else if(Math.abs(dx)>palm*.48&&Math.abs(dx)>Math.abs(dy)*1.25&&Math.abs(dx)>Math.abs(dz)*1.1)command=dx>0?'left':'right';
    const dominance=command==='forward'?(-dy-Math.abs(dx)*1.25)/palm:(Math.abs(dx)-Math.max(Math.abs(dy)*1.25,Math.abs(dz)*1.1))/palm;
    return {command,confidence:command==='stop'?0:.6+.4*Math.min(1,Math.max(0,dominance)),tip:{x:1-tip.x,y:tip.y*.75}};
  }
  class NavigationGestures {
    constructor(){this.command='stop';this.candidate='stop';this.selected='stop';this.since=0;this.lastSeen=-Infinity;this.fistSince=null;this.fistLatched=false;this.releaseSince=null;}
    reset(){this.command='stop';this.candidate='stop';this.selected='stop';this.lastSeen=-Infinity;this.fistSince=null;}
    update(hands,now){
      this.lastSeen=now;
      const results=hands.map(classify),hasFist=results.some(r=>r.command==='fist');
      if(hasFist)this.releaseSince=null;
      else{
        if(this.releaseSince===null)this.releaseSince=now;
        if(now-this.releaseSince>=250)this.fistLatched=false;
      }
      // These are geometric pose scores, not handedness probabilities.
      const recognized=results.filter(r=>r.command!=='stop').map(r=>({...r,confidence:r.confidence??.9})).sort((a,b)=>b.confidence-a.confidence);
      // Keep the previous winner only in a near tie, avoiding hand-order flicker.
      const best=recognized[0],previous=recognized.find(r=>r.command===this.selected);
      const selected=(previous&&best&&best.confidence-previous.confidence<=.025?previous:best)?.command||'stop';
      this.selected=selected;let turn=0;
      if(selected==='fist'&&!this.fistLatched){
        if(this.fistSince===null)this.fistSince=now;
        if(now-this.fistSince>=450){turn=-1;this.fistLatched=true;this.fistSince=null;}
      }else this.fistSince=null;
      const candidate=selected==='fist'||turn?'stop':selected;
      if(candidate!==this.candidate){this.candidate=candidate;this.since=now;this.command='stop';}
      if(candidate==='stop'||now-this.since>=180)this.command=candidate;
      return {command:this.command,turn,fistHeld:selected==='fist'};
    }
    fistHeld(now){return now-this.lastSeen<=250&&this.selected==='fist';}
    current(now){if(now-this.lastSeen>250)this.reset();return this.command;}
  }
  globalThis.DreamGestures={classify,NavigationGestures};
})();
