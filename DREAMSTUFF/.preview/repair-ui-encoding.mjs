import fs from 'node:fs';
const filename='index.html',decoder=new TextDecoder('windows-1252'),encoder=new Map();
for(let i=0;i<256;i++)encoder.set(decoder.decode(Uint8Array.of(i)),i);
let repairs=0;
const text=fs.readFileSync(filename,'utf8').replace(/^\uFEFF/,'').split('\n').map(line=>{
 for(let pass=0;pass<3;pass++){
  if(!/[ÃÂâðï]/.test(line))break;
  const bytes=[];let valid=true;for(const c of line){if(!encoder.has(c)){valid=false;break;}bytes.push(encoder.get(c));}
  if(!valid)break;
  try{const clean=new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(bytes));if(clean===line)break;line=clean;repairs++;}catch{break;}
 }
 return line;
}).join('\n');
fs.writeFileSync(filename,text);console.log('Restored UTF-8 text:',repairs);
