(() => {
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  function soundState(view){
    const {scene,time,sceneAge=0,reveal=1,x=0,z=0,height=1.68}=view;
    const gains={water:0,grass:0,nature:0,market:0,night:0};let frequency=1800;
    const scare=scene===2&&sceneAge>=10&&sceneAge<13;
    if(scene===1){
      const modulation=Math.sin(x*.043+z*.061-time*.22);
      const surge=.94+.16*Math.sin(time*.43+Math.sin(time*.19));
      const crest=Math.max(0,Math.sin(x*.23+z*.32-time*1.38+modulation*.65));
      gains.water=(.34+.13*crest)*surge*reveal;frequency=1400+1600*crest+300*surge;
    }else if(scene===2&&!scare){gains.grass=.22*reveal;gains.nature=.13*reveal;}
    else if(scene===3){gains.market=.24*reveal/(1+Math.max(0,height-1.68)*.07);gains.night=.08*reveal;}
    return {gains,frequency,scare,scareOffset:sceneAge-10,phase:time};
  }
  class DreamAudio {
    constructor(assets){this.assets=assets;this.context=null;this.buffers={};this.tracks={};this.lastView=null;this.muted=false;this.scream=null;this.scarePlayed=false;this.failures=[];}
    unlock(){
      const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)return Promise.resolve();
      if(!this.context){
        const ctx=this.context=new Context(),master=this.master=ctx.createGain();master.gain.value=.7;
        const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-8;limiter.knee.value=10;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.16;
        master.connect(limiter);limiter.connect(ctx.destination);
        this.ready=Promise.all(Object.entries(this.assets).filter(([,url])=>url).map(async([key,url])=>{
          try{
            const data=Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0));
            const buffer=await ctx.decodeAudioData(data.buffer);
            if(key!=='scream')for(let c=0;c<buffer.numberOfChannels;c++){
              const samples=buffer.getChannelData(c),fade=Math.min(Math.floor(buffer.sampleRate*.025),Math.floor(samples.length/2));
              for(let i=0;i<fade;i++){samples[i]*=i/fade;samples[samples.length-1-i]*=i/fade;}
            }
            this.buffers[key]=buffer;
          }catch(error){this.failures.push(key);console.warn('Audio asset could not decode:',key,error);}
        })).then(()=>{if(this.lastView)this.update(this.lastView);});
      }
      // Resume synchronously inside the existing tap/key event on both devices.
      return this.context.resume().catch(error=>console.warn('Sound requires a tap:',error));
    }
    setMuted(muted){this.muted=muted;if(this.master)this.master.gain.setTargetAtTime(muted?0:.7,this.context.currentTime,.03);}
    startLoop(key,bufferKey,phase){
      const ctx=this.context,buffer=this.buffers[bufferKey];if(!buffer)return null;
      const gain=ctx.createGain();gain.gain.value=0;
      const filter=key==='water'?ctx.createBiquadFilter():null;
      if(filter){filter.type='lowpass';filter.frequency.value=1800;filter.Q.value=.3;filter.connect(gain);}
      gain.connect(this.master);
      const track={gain,filter,buffer,source:null,started:0,offset:0,lastCheck:0};this.tracks[key]=track;
      this.reposition(track,phase);return track;
    }
    reposition(track,phase){
      const ctx=this.context;if(track.source){try{track.source.stop();}catch{}track.source.disconnect();}
      const source=ctx.createBufferSource();source.buffer=track.buffer;source.loop=true;source.connect(track.filter||track.gain);
      track.started=ctx.currentTime;track.offset=((phase%track.buffer.duration)+track.buffer.duration)%track.buffer.duration;track.source=source;source.start(ctx.currentTime,track.offset);
    }
    update(view){
      this.lastView=view;const state=this.lastState=soundState(view),ctx=this.context;
      if(!ctx||ctx.state!=='running')return;
      const now=ctx.currentTime;
      for(const [key,level] of Object.entries(state.gains)){
        const track=this.tracks[key]||(level>0?this.startLoop(key,key==='night'?'nature':key,state.phase):null);
        if(!track)continue;
        track.gain.gain.setTargetAtTime(level,now,state.scare?.008:.09);
        if(track.filter)track.filter.frequency.setTargetAtTime(state.frequency,now,.06);
        if(level>0&&now-track.lastCheck>2){
          track.lastCheck=now;const actual=track.offset+now-track.started;
          const delta=((state.phase-actual+track.buffer.duration*.5)%track.buffer.duration+track.buffer.duration)%track.buffer.duration-track.buffer.duration*.5;
          if(Math.abs(delta)>.3)this.reposition(track,state.phase);
        }
      }
      if(!state.scare){
        this.scarePlayed=false;if(this.scream){try{this.scream.stop();}catch{}this.scream.disconnect();this.scream=null;}
      }else if(!this.scarePlayed&&this.buffers.scream){
        this.scarePlayed=true;const offset=Math.max(0,state.scareOffset),duration=Math.min(3-offset,this.buffers.scream.duration-offset);
        if(duration>0){const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=this.buffers.scream;gain.gain.value=.8;source.connect(gain);gain.connect(this.master);source.start(now,offset,duration);this.scream=source;}
      }
    }
  }
  globalThis.DreamAudio={DreamAudio,soundState};
})();
