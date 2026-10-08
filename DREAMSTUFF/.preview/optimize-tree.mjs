import fs from 'node:fs';
const root='assets/rural/tree/';
const source=JSON.parse(fs.readFileSync(root+'tree.gltf','utf8'));
const input=fs.readFileSync(root+'tree_small_02.bin');
function accessor(index){
 const a=source.accessors[index],v=source.bufferViews[a.bufferView];
 const count={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
 const offset=input.byteOffset+(v.byteOffset||0)+(a.byteOffset||0);
 const Type=a.componentType===5126?Float32Array:a.componentType===5125?Uint32Array:Uint16Array;
 return new Type(input.buffer,offset,a.count*count);
}
const output={asset:source.asset,scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:'Tree Small 02 — web optimized'}],meshes:[{primitives:[]}],materials:source.materials,textures:source.textures,images:source.images,samplers:source.samplers,extensionsUsed:source.extensionsUsed,accessors:[],bufferViews:[],buffers:[]};
const chunks=[];let byteLength=0;
function add(data,type,componentType,target){
 const buffer=Buffer.from(data.buffer,data.byteOffset,data.byteLength);
 const view=output.bufferViews.length;output.bufferViews.push({buffer:0,byteOffset:byteLength,byteLength:buffer.length,target});
 chunks.push(buffer);byteLength+=buffer.length;
 const padding=(4-byteLength%4)%4;if(padding){chunks.push(Buffer.alloc(padding));byteLength+=padding;}
 const size={SCALAR:1,VEC2:2,VEC3:3}[type];
 const a={bufferView:view,componentType,count:data.length/size,type};
 if(type==='VEC3'){
  a.min=[Infinity,Infinity,Infinity];a.max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<data.length;i++) {const j=i%3;a.min[j]=Math.min(a.min[j],data[i]);a.max[j]=Math.max(a.max[j],data[i]);}
 }
 output.accessors.push(a);return output.accessors.length-1;
}
for(const primitive of source.meshes[0].primitives){
 const positions=accessor(primitive.attributes.POSITION),normals=accessor(primitive.attributes.NORMAL);
 const uv=accessor(primitive.attributes.TEXCOORD_0),uv1=accessor(primitive.attributes.TEXCOORD_1);
 const indices=accessor(primitive.indices),count=positions.length/3;
 const vertices=[],outNormals=[],outUV=[],outUV1=[],faces=[];
 function copy(i){const n=vertices.length/3;vertices.push(...positions.subarray(i*3,i*3+3));outNormals.push(...normals.subarray(i*3,i*3+3));outUV.push(...uv.subarray(i*2,i*2+2));outUV1.push(...uv1.subarray(i*2,i*2+2));return n;}
 if(primitive.material===1){
  const parent=new Int32Array(count);for(let i=0;i<count;i++)parent[i]=i;
  function find(a){while(parent[a]!==a){parent[a]=parent[parent[a]];a=parent[a];}return a;}
  for(let i=0;i<indices.length;i+=3){const a=find(indices[i]),b=find(indices[i+1]),c=find(indices[i+2]);parent[b]=a;parent[c]=a;}
  const groups=new Map();for(let i=0;i<count;i++){const r=find(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(i);}
  let groupIndex=0;
  for(const group of groups.values()){
   // Keep a deterministic, evenly distributed canopy without the source subdivisions.
   if((groupIndex++*2654435761>>>0)%100>62)continue;
   let nx=0,ny=0,nz=0;for(const i of group){nx+=normals[i*3];ny+=normals[i*3+1];nz+=normals[i*3+2];}
   const length=Math.hypot(nx,ny,nz)||1;nx/=length;ny/=length;nz/=length;
   let ax=Math.abs(ny)>.8?1:0,ay=Math.abs(ny)>.8?0:1,az=0;
   let ux=ay*nz-az*ny,uy=az*nx-ax*nz,uz=ax*ny-ay*nx;
   const ul=Math.hypot(ux,uy,uz)||1;ux/=ul;uy/=ul;uz/=ul;
   const vx=ny*uz-nz*uy,vy=nz*ux-nx*uz,vz=nx*uy-ny*ux;
   const points=group.map(i=>({i,x:positions[i*3]*ux+positions[i*3+1]*uy+positions[i*3+2]*uz,y:positions[i*3]*vx+positions[i*3+1]*vy+positions[i*3+2]*vz})).sort((a,b)=>a.x-b.x||a.y-b.y);
   const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
   const lower=[],upper=[];
   for(const p of points){while(lower.length>=2&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
   for(let i=points.length-1;i>=0;i--){const p=points[i];while(upper.length>=2&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
   const hull=lower.slice(0,-1).concat(upper.slice(0,-1));if(hull.length<3)continue;
   const first=vertices.length/3;for(const p of hull)copy(p.i);
   for(let i=1;i<hull.length-1;i++)faces.push(first,first+i,first+i+1);
  }
 }else{
  const map=new Map(),remap=new Uint32Array(count),cell=primitive.material===0?.025:.018;
  for(let i=0;i<count;i++){
   const key=[Math.round(positions[i*3]/cell),Math.round(positions[i*3+1]/cell),Math.round(positions[i*3+2]/cell),Math.round(uv1[i*2]*32),Math.round(uv1[i*2+1]*32)].join(',');
   if(!map.has(key))map.set(key,copy(i));remap[i]=map.get(key);
  }
  for(let i=0;i<indices.length;i+=3){const a=remap[indices[i]],b=remap[indices[i+1]],c=remap[indices[i+2]];if(a!==b&&b!==c&&a!==c)faces.push(a,b,c);}
 }
 const attributes={POSITION:add(new Float32Array(vertices),'VEC3',5126,34962),NORMAL:add(new Float32Array(outNormals),'VEC3',5126,34962),TEXCOORD_0:add(new Float32Array(outUV),'VEC2',5126,34962),TEXCOORD_1:add(new Float32Array(outUV1),'VEC2',5126,34962)};
 output.meshes[0].primitives.push({attributes,indices:add(new Uint32Array(faces),'SCALAR',5125,34963),material:primitive.material});
 console.log(source.materials[primitive.material].name,Math.round(indices.length/3),'→',Math.round(faces.length/3),'triangles');
}
output.buffers=[{uri:'tree-web.bin',byteLength}];
output.materials[1].alphaMode='OPAQUE';
fs.writeFileSync(root+'tree-web.gltf',JSON.stringify(output));
fs.writeFileSync(root+'tree-web.bin',Buffer.concat(chunks));
console.log('Optimized tree:',Math.round(byteLength/1024)+' KB');
