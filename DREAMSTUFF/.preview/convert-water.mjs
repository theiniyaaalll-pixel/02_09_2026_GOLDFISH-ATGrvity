import fs from 'node:fs';
const tabs=await(await fetch('http://127.0.0.1:9335/json')).json();
const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
await new Promise(r=>ws.addEventListener('open',r,{once:true}));
const encoded=fs.readFileSync('.preview/stream-waterfall/stream-waterfall/loudstream.ogg').toString('base64');
const expression=`(async()=>{const bytes=Uint8Array.from(atob(${JSON.stringify(encoded)}),c=>c.charCodeAt(0));const ctx=new OfflineAudioContext(2,1,44100);const audio=await ctx.decodeAudioData(bytes.buffer);return {rate:audio.sampleRate,channels:Array.from({length:audio.numberOfChannels},(_,i)=>Array.from(audio.getChannelData(i))),duration:audio.duration};})()`;
ws.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression,awaitPromise:true,returnByValue:true}}));
const result=await new Promise(r=>ws.addEventListener('message',e=>r(JSON.parse(e.data)),{once:true}));
if(result.result.exceptionDetails)throw Error(JSON.stringify(result.result.exceptionDetails));
const {rate,channels,duration}=result.result.result.value,n=channels[0].length,count=channels.length;
const wav=Buffer.alloc(44+n*count*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(count,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*count*2,28);wav.writeUInt16LE(count*2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(n*count*2,40);
for(let i=0;i<n;i++)for(let c=0;c<count;c++){const sample=Math.max(-1,Math.min(1,channels[c][i]));wav.writeInt16LE(Math.round(sample*32767),44+(i*count+c)*2);}
fs.writeFileSync('assets/audio/rushing-water.wav',wav);console.log({duration,rate,count,bytes:wav.length});ws.close();
