import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { clone as cloneSkeleton } from './vendor/SkeletonUtils.js';
import { mergeGeometries } from './vendor/BufferGeometryUtils.js';

// Life-sized street, built in metres. All animation takes the master's clock.
export function createStreetScene({rural,assets}) {
  const renderer=rural.renderer,canvas=renderer.domElement;
  const mobile=typeof matchMedia==='function'&&matchMedia('(pointer:coarse)').matches;
  const scene=new THREE.Scene();scene.name='Visual 3 — evening neighborhood';
  scene.background=new THREE.Color('#a18486');scene.fog=new THREE.FogExp2('#a196a2',.011);
  const timeUniform={value:0},random=seed=>{let s=seed;return()=>((s=Math.imul(s,1664525)+1013904223)>>>0)/4294967296;};
  const rng=random(731),staticBatches=new Map(),moving=[],residents=[];
  // World-space pockets of low mist on both sides, visible from every heading.
  // Their drift follows the same shared time as the rest of the street.
  const mist=new THREE.Group();mist.name='Street-edge dream mist';scene.add(mist);
  const mistGeometry=new THREE.BoxGeometry(1,1,1);
  for(const side of [-1,1])for(let i=0;i<10;i++){
    const center=new THREE.Vector3(side*4.7,1.05,36-i*16),extent=new THREE.Vector3(1.8,1.45,10);
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,
      uniforms:{streetTime:timeUniform,center:{value:center},extent:{value:extent}},
      vertexShader:'varying vec3 mistWorld;void main(){vec4 world=modelMatrix*vec4(position,1.);mistWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}',
      fragmentShader:`varying vec3 mistWorld;uniform vec3 center,extent;uniform float streetTime;
        float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
        float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1)),f.x),f.y),f.z);}
        void main(){vec3 ray=normalize(mistWorld-cameraPosition);
          vec3 inv=sign(ray)/max(abs(ray),vec3(.00001));
          vec3 a=(center-extent-cameraPosition)*inv,b=(center+extent-cameraPosition)*inv;
          vec3 nearT=min(a,b),farT=max(a,b);
          float start=max(0.,max(nearT.x,max(nearT.y,nearT.z))),end=min(farT.x,min(farT.y,farT.z));
          if(end<=start)discard;
          float stepSize=(end-start)/10.,density=0.;
          for(int j=0;j<10;j++){
            vec3 p=cameraPosition+ray*(start+(float(j)+.5)*stepSize),q=abs((p-center)/extent);
            float edge=(1.-smoothstep(.45,1.,q.x))*(1.-smoothstep(.45,1.,q.z));
            float height=smoothstep(-.2,.25,p.y)*(1.-smoothstep(.65,2.5,p.y));
            float n=noise(p*vec3(.8,1.3,.38)+vec3(streetTime*.045,0.,streetTime*.027));
            density+=edge*height*smoothstep(.22,.8,n)*stepSize*.10;
          }
          float alpha=1.-exp(-density);if(alpha<.002)discard;
          gl_FragColor=vec4(vec3(.62,.49,.40),alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    const pocket=new THREE.Mesh(mistGeometry,mat);pocket.position.copy(center);pocket.scale.copy(extent).multiplyScalar(2);mist.add(pocket);
  }
  const boxGeometry=new THREE.BoxGeometry(1,1,1),sphereGeometry=new THREE.SphereGeometry(1,24,16);
  const matrix=new THREE.Object3D();
  function material(color,roughness=.85,metalness=0){return new THREE.MeshStandardMaterial({color,roughness,metalness});}
  const dark=material('#252722'),metal=material('#404942',.63,.55),rust=material('#685041',.88,.3),wood=material('#57483c');
  const concrete=material('#928676'),curb=material('#9f9785'),roof=material('#665747'),cloth=material('#5d6b5f');
  function staticGeometry(geometry,mat,position=[0,0,0],scale=[1,1,1],rotation=[0,0,0]){
    matrix.position.set(...position);matrix.scale.set(...scale);matrix.rotation.set(...rotation);matrix.updateMatrix();
    const transformed=geometry.clone().applyMatrix4(matrix.matrix);
    if(!staticBatches.has(mat))staticBatches.set(mat,[]);staticBatches.get(mat).push(transformed);
  }
  function box(position,scale,mat,rotation=[0,0,0]){staticGeometry(boxGeometry,mat,position,scale,rotation);}
  function rod(a,b,radius,mat=metal,parent=null){
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
    const geometry=new THREE.CylinderGeometry(radius,radius,delta.length(),8);
    const mesh=new THREE.Mesh(geometry,mat);mesh.position.copy(start.add(end).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    if(parent){parent.add(mesh);return mesh;}
    const transformed=geometry.clone();mesh.updateMatrix();transformed.applyMatrix4(mesh.matrix);
    if(!staticBatches.has(mat))staticBatches.set(mat,[]);staticBatches.get(mat).push(transformed);geometry.dispose();
  }
  const textureLoader=new THREE.TextureLoader(),texturePromises=[];
  function texture(name,repeat,color=false){
    let resolveReady,rejectReady;texturePromises.push(new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;}));
    const map=textureLoader.load(assets[name],resolveReady,undefined,rejectReady);map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(...repeat);
    if(color)map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());
    return map;
  }
  const plasterMap=texture('plasterColor',[2,1],true),plasterNormal=texture('plasterNormal',[2,1]);
  const plasterRough=texture('plasterRough',[2,1]);
  const plasterColors=['#c3b09a','#929e94','#a6aa94','#c1aa8c','#aa998d','#a4a4a0'];
  const plaster=plasterColors.map(color=>new THREE.MeshStandardMaterial({color,map:plasterMap,normalMap:plasterNormal,normalScale:new THREE.Vector2(.32,.32),roughnessMap:plasterRough,roughness:.93}));
  const glass=new THREE.MeshPhysicalMaterial({color:'#817b68',roughness:.22,metalness:.05,transparent:true,opacity:.28,depthWrite:false});
  scene.add(new THREE.HemisphereLight('#bdc6da','#55514a',.95));
  const sun=new THREE.DirectionalLight('#ffc18c',1.55);sun.position.set(-28,16,-80);sun.castShadow=true;
  sun.shadow.mapSize.set(1536,1536);Object.assign(sun.shadow.camera,{left:-28,right:28,top:38,bottom:-38,near:1,far:180});
  sun.shadow.bias=-.0003;sun.shadow.normalBias=.035;scene.add(sun);scene.add(sun.target);
  const sky=new THREE.Mesh(new THREE.SphereGeometry(280,40,24),new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    uniforms:{streetTime:timeUniform},vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec3 direction;uniform float streetTime;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
      void main(){vec3 d=normalize(direction);float h=max(d.y,0.);
      vec3 color=mix(vec3(.85,.27,.095),vec3(.16,.135,.19),pow(h,.55));
      float clouds=noise(d.xz/(h+.2)*2.8+vec2(streetTime*.002,0.))*.65+noise(d.xz/(h+.3)*8.)*.35;
      color=mix(color,color*.66,smoothstep(.46,.76,clouds)*smoothstep(.02,.2,h));
      float light=pow(max(dot(d,normalize(vec3(-.24,.1,-1.))),0.),650.);color+=vec3(1.,.68,.31)*light*3.;
      gl_FragColor=vec4(color,1.);#include <tonemapping_fragment>
      #include <colorspace_fragment>}`.replace(';#include',';\n#include'),
  }));scene.add(sky);

  // PBR asphalt with a real planar reflection pass for the shallow wet patches.
  const reflectionTarget=new THREE.WebGLRenderTarget(512,512);
  const reflectionCamera=new THREE.PerspectiveCamera(),reflectionMatrix=new THREE.Matrix4();
  const roadMaterial=new THREE.MeshStandardMaterial({color:'#827d72',map:texture('asphaltColor',[40,70],true),normalMap:texture('asphaltNormal',[40,70]),normalScale:new THREE.Vector2(.3,.3),roughnessMap:texture('asphaltRough',[40,70]),roughness:.43});
  roadMaterial.onBeforeCompile=shader=>{
    shader.uniforms.streetReflection={value:reflectionTarget.texture};shader.uniforms.streetReflectionMatrix={value:reflectionMatrix};
    shader.vertexShader='varying vec3 streetWorld;varying vec4 streetReflect;uniform mat4 streetReflectionMatrix;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nstreetWorld=(modelMatrix*vec4(transformed,1.)).xyz;streetReflect=streetReflectionMatrix*vec4(streetWorld,1.);');
    shader.fragmentShader='varying vec3 streetWorld;varying vec4 streetReflect;uniform sampler2D streetReflection;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`#include <opaque_fragment>
      float wetPatch=sin(streetWorld.x*.8+sin(streetWorld.z*.46))*sin(streetWorld.z*.31+streetWorld.x*.13);
      float wet=smoothstep(-.35,.5,wetPatch);
      vec2 reflectedUV=streetReflect.xy/streetReflect.w+normal.xz*.006;
      vec3 reflectedColor=texture2D(streetReflection,clamp(reflectedUV,.002,.998)).rgb;
      float fresnel=pow(1.-max(dot(normalize(cameraPosition-streetWorld),normal),0.),3.);
      gl_FragColor.rgb=mix(gl_FragColor.rgb,reflectedColor,wet*(.10+fresnel*.38));`);
  };
  const road=new THREE.Mesh(new THREE.PlaneGeometry(160,250),roadMaterial);road.rotation.x=-Math.PI/2;road.receiveShadow=true;scene.add(road);
  for(const side of [-1,1]){
    box([side*4.7,.075,-25],[1.7,.15,210],curb);box([side*5.65,.2,-25],[.25,.4,210],concrete);
  }
  function sign(text,subtext,width,height,color){
    const image=document.createElement('canvas');image.width=768;image.height=256;const c=image.getContext('2d');
    c.fillStyle=color;c.fillRect(0,0,768,256);c.strokeStyle='#d7c492';c.lineWidth=9;c.strokeRect(12,12,744,232);
    c.fillStyle='#e4d3a0';c.textAlign='center';c.font='bold 74px "Nirmala UI", Arial';c.fillText(text,384,115);
    c.font='34px Arial';c.fillText(subtext,384,192);
    const sr=random(text.length*777);for(let i=0;i<2600;i++){c.fillStyle=sr()>.5?'#35291f12':'#dfd0ae16';c.fillRect(sr()*768,sr()*256,sr()*16,1+sr()*3);}
    const map=new THREE.CanvasTexture(image);map.colorSpace=THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshStandardMaterial({map,roughness:.9}));
  }
  const shopNames=[['किराना','GENERAL STORE'],['चाय · नाश्ता','CHAI & SNACKS'],['दर्जी','TAILOR'],['जनरल स्टोर','DAILY NEEDS'],['साइकिल','CYCLE REPAIRS'],['फल · सब्ज़ी','FRESH PRODUCE']];
  const luminousSigns=[];
  const warmWindow=new THREE.MeshStandardMaterial({color:'#777568',emissive:'#c6a575',emissiveIntensity:.35,roughness:.8});
  const signPalette=['#70dbdf','#ee7158','#a6cdda','#e9c478'];
  function lightbox(text,subtext,width,height,color,position,rotation){
    const board=sign(text,subtext,width,height,'#26363e');
    board.position.set(...position);board.rotation.y=rotation;
    board.material.emissive.set(color);board.material.emissiveMap=board.material.map;board.material.emissiveIntensity=1.85;
    board.material.side=THREE.DoubleSide;scene.add(board);
    const frame=new THREE.Mesh(new THREE.BoxGeometry(width+.12,height+.12,.14),metal);
    frame.position.copy(board.position);frame.quaternion.copy(board.quaternion);
    frame.translateZ(-.09);scene.add(frame);
    const reverse=board.clone();reverse.rotation.y+=Math.PI;reverse.translateZ(.19);scene.add(reverse);
    luminousSigns.push({material:board.material,phase:luminousSigns.length*1.37});
    return board;
  }
  for(const side of [-1,1])for(let row=-2;row<8;row++){
    const z=14-row*15.8,height=4.8+rng()*3.4,width=12.3+rng()*2.5,wall=plaster[Math.floor(rng()*plaster.length)],front=side*5.9;
    box([side*9.7,height*.5,z],[7.4,height,width],wall);box([side*9.7,height+.12,z],[7.85,.24,width+.45],roof);
    box([side*6.05,height+.4,z],[.22,.65,width],wall);
    const isShop=row>=0&&row<5;
    for(const dz of [-3.6,2.8]){
      box([front-side*.03,1.4,z+dz],[.15,2.5,2.7],dark);
      if(!isShop||dz<0){
        for(let slat=-5;slat<=5;slat++)box([front-side*.13,1.4+slat*.21,z+dz],[.09,.025,2.55],metal);
      }else{
        box([front+side*.35,1.15,z+dz],[.15,1.9,2.5],wood);
        for(const level of [.55,1.2,1.85]){
          box([front-side*.16,level,z+dz],[.42,.07,2.5],wood);
          for(let jar=0;jar<6;jar++)box([front-side*.32,level+.17,z+dz-1+jar*.39],[.22,.28,.2],plaster[(jar+row)%plaster.length]);
        }
      }
      if(height>5.9){
        box([front-side*.08,4.3,z+dz],[.13,1.25,1.9],dark);
        for(const offset of [-.7,-.35,0,.35,.7])rod([front-side*.19,3.73,z+dz+offset],[front-side*.19,4.9,z+dz+offset],.018);
      }
    }
    if(isShop){
      const [title,subtitle]=shopNames[(row+(side===1?2:0))%shopNames.length];const board=sign(title,subtitle,6.6,.88,row%2?'#37564c':'#897345');
      board.position.set(front-side*.18,3.2,z);board.rotation.y=side===1?-Math.PI/2:Math.PI/2;scene.add(board);
      box([front-side*.68,2.76,z],[1.5,.08,7.1],cloth,[0,0,side*.12]);
      for(const offset of [-3.3,3.3])rod([front-side*1.25,.15,z+offset],[front-side*1.25,2.72,z+offset],.025,rust);
      // Older illuminated signs and projecting boards accumulate across the street.
      lightbox(title,subtitle,2.8,.68,signPalette[(row+(side>0?1:0))%4],[front-side*.28,4.95,z-2.9],side===1?-Math.PI/2:Math.PI/2);
      const projectingX=front-side*1.05,signZ=z+4.9;
      rod([front,4.3,signZ],[projectingX,4.3,signZ],.028,metal);
      lightbox(title,subtitle,1.25,1.6,signPalette[(row+2)%4],[projectingX,3.85,signZ],row%2?Math.PI:0);
      if(row<2){
        const spill=new THREE.PointLight(signPalette[(row+(side>0?1:0))%4],12,11,2);
        spill.position.set(front-side*.85,3.1,z-2.9);scene.add(spill);
      }
    }
    if(row>=0&&row<6){
      const upperHeight=2.6+rng()*1.8;
      box([side*10,height+upperHeight*.5,z+1],[6.4,upperHeight,width*.72],plaster[(row+2)%plaster.length]);
      box([side*6.55,height+.65,z+1],[.95,.15,width*.65],concrete);
      for(let n=-2;n<=2;n++){
        box([side*6.76,height+1.55,z+1+n*1.7],[.12,1.1,.8],dark);
        if((n+row)%2===0)box([side*6.68,height+1.55,z+1+n*1.7],[.025,.83,.58],warmWindow);
      }
      rod([side*6.05,height+.9,z-width*.3],[side*6.05,height+.9,z+width*.3],.025,metal);
    }
    // Exposed drainpipes, meter boxes, roof tanks and imperfect masonry.
    rod([front-side*.18,.2,z+width*.45],[front-side*.18,height+.3,z+width*.45],.055,rust);
    box([front-side*.24,1.1,z-width*.43],[.24,.38,.31],metal);
    staticGeometry(new THREE.CylinderGeometry(.62,.62,1.15,20),dark,[side*10,height+.8,z-2]);
    for(let brick=0;brick<7;brick++)box([front-side*.12,.25+rng()*.65,z-5+rng()*10],[.04,.14,.4+rng()*.4],roof);
  }
  // Sparse, world-space light fragments: a suggestion of suspended city memories.
  const fragmentCount=1100,fragmentPositions=[],fragmentPhases=[];
  for(let i=0;i<fragmentCount;i++){
    fragmentPositions.push((rng()-.5)*10,.5+rng()*11,38-rng()*165);fragmentPhases.push(rng()*Math.PI*2);
  }
  const fragmentGeometry=new THREE.BufferGeometry();fragmentGeometry.setAttribute('position',new THREE.Float32BufferAttribute(fragmentPositions,3));fragmentGeometry.setAttribute('phase',new THREE.Float32BufferAttribute(fragmentPhases,1));
  const fragmentMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{streetTime:timeUniform},vertexShader:`attribute float phase;uniform float streetTime;varying float glow;void main(){vec3 p=position;p.x+=sin(streetTime*.07+phase)*.28;p.y+=sin(streetTime*.09+phase)*.22;vec4 view=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*view;gl_PointSize=clamp(18./max(1.,-view.z),1.,2.5);glow=.12+.14*(.5+.5*sin(streetTime*.21+phase));}`,
    fragmentShader:'varying float glow;void main(){float soft=1.-smoothstep(.1,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(.55,.75,.88,soft*glow);}',
  });scene.add(new THREE.Points(fragmentGeometry,fragmentMaterial));
  // Light fixtures have physical geometry, restrained halos and local light spill.
  const haloCanvas=document.createElement('canvas');haloCanvas.width=128;haloCanvas.height=128;
  const hc=haloCanvas.getContext('2d'),gradient=hc.createRadialGradient(64,64,0,64,64,64);
  gradient.addColorStop(0,'rgba(255,233,176,1)');gradient.addColorStop(.12,'rgba(255,196,111,.6)');gradient.addColorStop(.4,'rgba(255,169,79,.10)');gradient.addColorStop(1,'rgba(255,140,60,0)');hc.fillStyle=gradient;hc.fillRect(0,0,128,128);
  const haloMap=new THREE.CanvasTexture(haloCanvas);
  function lamp(position,power,reach,haloSize=1.8){
    const bulb=new THREE.Mesh(sphereGeometry,new THREE.MeshBasicMaterial({color:new THREE.Color(3,1.65,.55),toneMapped:false}));bulb.scale.setScalar(.065);bulb.position.set(...position);scene.add(bulb);
    const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:haloMap,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:.6}));halo.position.copy(bulb.position);halo.scale.set(haloSize,haloSize,1);scene.add(halo);
    if(power){const light=new THREE.PointLight('#ffb76c',power,reach,2);light.position.copy(bulb.position);scene.add(light);return light;}
  }
  for(let i=0;i<7;i++){
    const z=10-i*19,side=i%2?1:-1,x=side*4.95;
    rod([x,.15,z],[x,5.5,z],.055,rust);rod([x,5.5,z],[x-side*.9,5.6,z],.035,rust);
    box([x-side*.95,5.56,z],[.34,.08,.2],dark);lamp([x-side*.95,5.48,z],i<4?34:0,22,2.2);
    const next=new THREE.Vector3(x,5.5,z-19),from=new THREE.Vector3(x,5.5,z);
    const curve=new THREE.CatmullRomCurve3([from,from.clone().lerp(next,.5).add(new THREE.Vector3(0,-.65,0)),next]);
    staticGeometry(new THREE.TubeGeometry(curve,16,.009,4,false),dark);
  }
  function bicycle(position,rotation=0){
    const group=new THREE.Group();group.position.set(...position);group.rotation.y=rotation;scene.add(group);const wheels=[];
    for(const z of [-.63,.63]){
      const wheel=new THREE.Group();wheel.position.set(0,.35,z);group.add(wheel);wheels.push(wheel);
      const tire=new THREE.Mesh(new THREE.TorusGeometry(.33,.025,8,40),dark);tire.rotation.y=Math.PI/2;wheel.add(tire);
      const rim=new THREE.Mesh(new THREE.TorusGeometry(.307,.008,6,40),metal);rim.rotation.y=Math.PI/2;wheel.add(rim);
      for(let spoke=0;spoke<16;spoke++){const a=spoke/16*Math.PI*2;rod([0,0,0],[0,Math.cos(a)*.3,Math.sin(a)*.3],.0025,metal,wheel);}
    }
    for(const [a,b] of [[[0,.35,-.63],[0,.65,-.28]],[[0,.65,-.28],[0,.36,.0]],[[0,.36,0],[0,.35,-.63]],[[0,.65,-.28],[0,.72,.4]],[[0,.72,.4],[0,.36,0]],[[0,.72,.4],[0,.35,.63]]])rod(a,b,.018,metal,group);
    rod([0,.65,-.28],[0,.87,-.32],.016,metal,group);rod([-.13,.89,-.35],[.13,.89,-.35],.04,dark,group);
    rod([0,.72,.4],[0,.99,.43],.014,metal,group);rod([-.22,1.01,.44],[.22,1.01,.44],.015,metal,group);
    return {group,wheels};
  }
  // A teal pushcart, glass cabinet, cups, jars, fruit and a warm hanging bulb.
  const cart=new THREE.Group();cart.position.set(-3.65,0,-4);cart.rotation.y=Math.PI/2;scene.add(cart);
  const cartPaint=material('#376e68',.72,.18),brass=material('#af9365',.52,.4);
  function cartBox(position,scale,mat){const m=new THREE.Mesh(boxGeometry,mat);m.position.set(...position);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;cart.add(m);return m;}
  cartBox([0,.83,0],[2.3,.86,1.15],cartPaint);cartBox([0,1.3,0],[2.4,.09,1.25],wood);
  for(const x of [-1.08,1.08])for(const z of [-.52,.52])rod([x,1.3,z],[x,2.3,z],.025,cartPaint,cart);
  cartBox([0,2.3,0],[2.6,.09,1.6],roof);cartBox([0,2.51,0],[2.65,.35,1.5],brass);
  cartBox([0,1.73,.54],[2.12,.75,.018],glass);
  for(const x of [-1.08,1.08])cartBox([x,1.73,0],[.018,.75,1.05],glass);
  for(let jar=0;jar<6;jar++){
    const cup=new THREE.Mesh(new THREE.CylinderGeometry(.055,.045,.14,16),material(jar%2?'#d0b99a':'#bca38b'));
    cup.position.set(-.7+jar*.28,1.43,.16);cart.add(cup);
  }
  for(let fruit=0;fruit<28;fruit++){
    const orange=new THREE.Mesh(sphereGeometry,material(fruit%3?'#b59a39':'#ac6443'));orange.scale.set(.055,.05,.055);orange.position.set(-.7+rng()*.65,1.43+rng()*.11,-.3+rng()*.22);cart.add(orange);
  }
  const cartSign=sign('चाय · नाश्ता','CHAI & SNACKS',2.4,.3,'#82713e');cartSign.position.set(0,2.51,.76);cart.add(cartSign);
  const cartLampPos=cart.localToWorld(new THREE.Vector3(.45,2.16,.22));lamp(cartLampPos.toArray(),26,9,1.8);
  bicycle([-5.05,0,-2.3],.12);
  for(const z of [-.7,.7]){
    const wheel=new THREE.Mesh(new THREE.TorusGeometry(.35,.028,8,40),dark);wheel.position.set(-3.65,.35,-4+z);wheel.rotation.y=Math.PI/2;scene.add(wheel);
  }
  // Reuse the photographed CC0 tree geometry, without visual 2's cellular shader.
  const treePrototype=rural.scene.userData.treePrototype;
  if(treePrototype){
    treePrototype.updateMatrixWorld(true);const treePositions=[[-6.3,5,1.75],[6.5,-17,1.6],[-6.4,-32,1.9],[6.7,-48,1.7],[-6.6,-68,1.65],[6.4,29,1.6],[-6.7,42,1.8],[6.6,-90,1.8]];
    treePrototype.traverse(source=>{if(!source.isMesh)return;const mat=source.material.clone();mat.color.multiplyScalar(.76);mat.roughness=.9;
      if(source.material.name.includes('leaves')){
        mat.onBeforeCompile=shader=>{shader.uniforms.streetTime=timeUniform;shader.vertexShader='uniform float streetTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x+=sin(streetTime*.8+position.y*1.4+instanceMatrix[3].z)*.018*max(position.y,0.);');};mat.customProgramCacheKey=()=> 'street-tree-wind';
      }
      const trees=new THREE.InstancedMesh(source.geometry,mat,treePositions.length);
      treePositions.forEach(([x,z,s],i)=>{matrix.position.set(x,.12,z);matrix.rotation.set(0,i*2.4,0);matrix.scale.set(s*1.15,s,s*1.15);matrix.updateMatrix();trees.setMatrixAt(i,matrix.matrix.clone().multiply(source.matrixWorld));});
      trees.castShadow=true;trees.receiveShadow=true;trees.computeBoundingSphere();scene.add(trees);
    });
  }
  for(const [mat,geometries] of staticBatches){const merged=mergeGeometries(geometries,false);const mesh=new THREE.Mesh(merged,mat);mesh.castShadow=true;mesh.receiveShadow=true;scene.add(mesh);for(const geo of geometries)geo.dispose();}

  // Small roadside fire. The light varies with flame motion; smoke expands,
  // slows and drifts as it rises, with depth-tested translucent density.
  const fire=new THREE.Group();fire.position.set(4.6,.1,-66);scene.add(fire);
  for(let i=0;i<5;i++){const log=new THREE.Mesh(new THREE.CylinderGeometry(.045,.06,.65,10),wood);log.rotation.set(Math.PI/2,0,i*.65);log.position.set(Math.sin(i)*.16,.07,Math.cos(i)*.16);fire.add(log);}
  const flameMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
    uniforms:{streetTime:timeUniform},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float streetTime;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
      void main(){vec2 p=vUv;float n=noise(vec2(p.x*6.,p.y*5.-streetTime*2.8));
      float center=.5+sin(p.y*6.-streetTime*3.)*.07*p.y;float width=(1.-p.y)*(.29+n*.18);
      float density=1.-smoothstep(width*.3,width,abs(p.x-center));density*=smoothstep(0.,.13,p.y)*(1.-smoothstep(.64,.98,p.y+n*.12));
      vec3 color=mix(vec3(1.,.12,.015),vec3(1.,.73,.22),pow(density,3.)*(1.-p.y));gl_FragColor=vec4(color*2.,density*.65);}`,
  });
  for(let i=0;i<3;i++){const flame=new THREE.Mesh(new THREE.PlaneGeometry(.8,1.1),flameMaterial);flame.position.y=.55;flame.rotation.y=i*Math.PI/3;fire.add(flame);}
  const fireLight=new THREE.PointLight('#ff9d43',9,16,2);fireLight.position.set(0,.75,0);fire.add(fireLight);
  const smokeMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{streetTime:timeUniform,opacity:{value:.18}},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`varying vec2 vUv;uniform float streetTime,opacity;float hash(vec2 p){return fract(sin(dot(p,vec2(12.98,78.23)))*43758.54);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
      void main(){float edge=1.-smoothstep(.17,.5,length(vUv-.5));float n=noise(vUv*6.+vec2(streetTime*.09,-streetTime*.12));gl_FragColor=vec4(.24,.23,.22,edge*n*opacity);}`,
  });
  const smoke=[];for(let i=0;i<22;i++){const puff=new THREE.Mesh(new THREE.PlaneGeometry(1,1),smokeMaterial.clone());puff.material.uniforms.streetTime=timeUniform;fire.add(puff);smoke.push(puff);}

  // Rigged human assets, not primitive mannequins. Different routes, animation
  // phases, pauses and speeds avoid crowds walking in lockstep.
  const loader=new GLTFLoader();
  const peopleReady=Promise.all(['sam','maya','jordan'].map(async name=>{
    const model=await loader.loadAsync(assets.people[name]);return {name,...model};
  })).then(models=>{
    function person(modelIndex,config){
      const model=models[modelIndex],root=cloneSkeleton(model.scene);
      root.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;const original=object.material;object.material=original.clone();object.material.roughness=Math.max(.65,object.material.roughness||.65);if(/original top|original bottom/i.test(original.name))object.material.color.set(config.clothes||'#7b7562');if(/accessory/i.test(object.name))object.visible=false;}});
      const holder=new THREE.Group();holder.add(root);scene.add(holder);const mixer=new THREE.AnimationMixer(root);
      const idleClip=model.animations.find(a=>a.name==='Idle_Standing'),walkClip=model.animations.find(a=>a.name==='Walk_Relaxed')||model.animations[0];
      const walk=mixer.clipAction(walkClip);walk.play();const idle=idleClip?mixer.clipAction(idleClip):null;if(idle)idle.play();
      walk.weight=config.kind==='walk'?1:0;if(idle)idle.weight=1-walk.weight;
      mixer.setTime(0);holder.updateMatrixWorld(true);
      const head=root.getObjectByName('head'),feet=['foot_l','foot_r'].map(name=>root.getObjectByName(name)).filter(Boolean);
      if(head&&feet.length){
        const headY=head.getWorldPosition(new THREE.Vector3()).y,footY=Math.min(...feet.map(b=>b.getWorldPosition(new THREE.Vector3()).y));
        root.scale.multiplyScalar((config.height||1.72)/Math.max(.1,headY-footY+.15));holder.updateMatrixWorld(true);
      }
      // Measure the stance foot's backward travel in the actual scaled clip.
      // Matching this speed keeps the planted shoe still as the body advances.
      walk.weight=1;if(idle)idle.weight=0;
      const samples=[],speeds=[],duration=walkClip.duration,step=duration/80;
      for(let i=0;i<=80;i++){
        mixer.setTime(i*step);holder.updateMatrixWorld(true);
        samples.push(feet.map(foot=>holder.worldToLocal(foot.getWorldPosition(new THREE.Vector3()))));
      }
      for(let f=0;f<feet.length;f++){
        const lowest=Math.min(...samples.map(sample=>sample[f].y));
        for(let i=1;i<samples.length;i++){
          const a=samples[i-1][f],b=samples[i][f],speed=(a.z-b.z)/step;
          if(a.y<lowest+.012&&b.y<lowest+.012&&speed>.2&&speed<3)speeds.push(speed);
        }
      }
      speeds.sort((a,b)=>a-b);const strideSpeed=speeds[Math.floor(speeds.length/2)]||1.3;
      mixer.setTime(0);holder.updateMatrixWorld(true);
      const soles=[];
      root.traverse(mesh=>{
        if(!mesh.isSkinnedMesh||!/shoes/i.test(mesh.name))return;
        // Sample the deformed shoe geometry, rather than its ankle joint:
        // the ankle sits above the sole and the pavement is above the road.
        const count=mesh.geometry.attributes.position.count,indices=[];
        for(let i=0;i<count;i+=Math.max(1,Math.floor(count/128)))indices.push(i);
        soles.push({mesh,indices});
      });
      const resident={holder,root,mixer,walk,idle,feet,soles,strideSpeed,config,seed:residents.length*.713};residents.push(resident);return resident;
    }
    // Young and middle-aged adults use distinct source bodies and faces.
    person(0,{kind:'vendor',x:-4.05,z:-4,yaw:Math.PI/2,height:1.72,clothes:'#c0b39a'});
    person(1,{kind:'customer',x:-2.1,z:-4.3,yaw:-Math.PI/2,height:1.62,clothes:'#9a7065'});
    person(0,{kind:'standing',x:5.05,z:-20,yaw:-Math.PI/2,height:1.77,clothes:'#62746f'});
    person(1,{kind:'standing',x:4.8,z:-21.3,yaw:Math.PI/2,height:1.64,clothes:'#9b8c74'});
    const count=8;
    for(let i=0;i<count;i++){
      const side=i%2?1:-1,z0=27-i*14;
      const route=new THREE.CatmullRomCurve3([new THREE.Vector3(side*4.1,0,z0),new THREE.Vector3(side*4.2,0,z0-27),new THREE.Vector3(-side*4.1,0,z0-36),new THREE.Vector3(-side*4.1,0,z0+7)],true,'catmullrom',.18);
      person(i%3,{kind:'walk',route,length:route.getLength(),speed:.9+(i%4)*.12,phase:i*.137,height:[1.7,1.61,1.77][i%3],clothes:['#65776d','#997761','#a7a08b','#787b86'][i%4]});
    }
    const cycle=bicycle([1.3,0,16]);const cyclist=person(0,{kind:'cycle',height:1.72,clothes:'#796857'});cycle.group.add(cyclist.holder);moving.push({cycle,cyclist});
  });

  const presenter=createStreetPresenter(renderer,scene,mobile);
  let lastReflection=-Infinity;
  function aimBone(bone,point){
    const origin=bone.getWorldPosition(new THREE.Vector3()),direction=point.clone().sub(origin).normalize();
    const world=bone.getWorldQuaternion(new THREE.Quaternion());
    const current=new THREE.Vector3(0,1,0).applyQuaternion(world);
    world.premultiply(new THREE.Quaternion().setFromUnitVectors(current,direction));
    const parent=bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();bone.quaternion.copy(parent.multiply(world));bone.updateWorldMatrix(false,true);
  }
  function solveLimb(upper,lower,end,target,pole){
    if(!upper||!lower||!end)return;
    const hip=upper.getWorldPosition(new THREE.Vector3()),oldKnee=lower.getWorldPosition(new THREE.Vector3()),oldFoot=end.getWorldPosition(new THREE.Vector3());
    const a=Math.max(.18,hip.distanceTo(oldKnee)),b=Math.max(.18,Math.min(.55,oldKnee.distanceTo(oldFoot)));
    const delta=target.clone().sub(hip),d=Math.min(a+b-.005,Math.max(.02,delta.length())),direction=delta.normalize();
    const along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along));
    const bend=pole.clone().sub(direction.clone().multiplyScalar(pole.dot(direction))).normalize();
    const knee=hip.clone().addScaledVector(direction,along).addScaledVector(bend,height);
    aimBone(upper,knee);aimBone(lower,target);
    // This source rig exports the foot controls separately from the calf bones.
    if(!end.parent||end.parent!==lower){end.position.copy(end.parent.worldToLocal(target.clone()));end.updateWorldMatrix(false,true);}
  }
  function updatePeople(time){
    for(const resident of residents){
      const {holder,root,mixer,walk,idle,config:c,seed}=resident;let walkWeight=0,gaitTime=0;
      if(c.kind==='walk'){
        const period=43+seed*11,pause=2.5+(seed%1)*3,clock=time+seed*17,cycles=Math.floor(clock/period),phase=clock-cycles*period;
        const ramp=.7,active=period-pause,t=THREE.MathUtils.clamp(phase-pause,0,active);
        const integral=u=>u*u*u-.5*u*u*u*u;
        const travelled=t<ramp?ramp*integral(t/ramp):t>active-ramp?active-ramp-ramp*integral((active-t)/ramp):t-ramp*.5;
        // A source with no idle clip keeps walking instead of freezing mid-step.
        const distance=(idle?cycles*(active-ramp)+travelled:clock)*c.speed;
        const raw=c.phase+distance/c.length;
        const u=((raw%1)+1)%1,point=c.route.getPointAt(u),tangent=c.route.getTangentAt(u);
        holder.position.copy(point);holder.rotation.y=Math.atan2(tangent.x,tangent.z);
        walkWeight=THREE.MathUtils.smoothstep(t,0,ramp)*(1-THREE.MathUtils.smoothstep(t,active-ramp,active));
        gaitTime=distance/resident.strideSpeed+seed*.47;
      }else if(c.kind!=='cycle'){holder.position.set(c.x,0,c.z);holder.rotation.y=c.yaw;}
      walk.weight=idle?walkWeight:1;walk.time=gaitTime%walk.getClip().duration;
      if(idle){idle.weight=1-walkWeight;idle.time=(time+seed*4.7)%idle.getClip().duration;}
      mixer.update(0);
      if(c.kind!=='cycle'&&resident.feet.length){
        holder.updateMatrixWorld(true);
        let correction=-Infinity;const vertex=new THREE.Vector3();
        for(const {mesh,indices} of resident.soles){
          mesh.skeleton.update();
          for(const index of indices){
            mesh.getVertexPosition(index,vertex).applyMatrix4(mesh.matrixWorld);
            const x=Math.abs(vertex.x),ground=x>=5.525&&x<=5.775?.4:x>=3.85&&x<=5.55?.15:0;
            correction=Math.max(correction,ground+.006-vertex.y);
          }
        }
        if(Number.isFinite(correction))root.position.y+=correction;
        holder.updateMatrixWorld(true);
      }
      // Breathing and conversational head/hand shifts remain small and asynchronous.
      if(c.kind!=='walk'){
        const head=root.getObjectByName('head');if(head)head.rotation.y+=Math.sin(time*.53+seed)*.065;
        if(c.kind==='vendor'){
          const target=new THREE.Vector3(-3.7,1.42,-4+.15*Math.sin(time*.61));
          solveLimb(root.getObjectByName('upperarm_r'),root.getObjectByName('lowerarm_r'),root.getObjectByName('hand_r'),target,new THREE.Vector3(0,-1,0));
        }
      }
    }
    for(const {cycle,cyclist} of moving){
      const progress=((time*.065)%1+1)%1,angle=progress*Math.PI*2;
      cycle.group.position.set(Math.sin(angle)*1.8,0,10-Math.cos(angle)*31);cycle.group.rotation.y=Math.atan2(Math.cos(angle)*1.8,Math.sin(angle)*31);
      for(const wheel of cycle.wheels)wheel.rotation.x=time*3.9;
      const root=cyclist.root;
      cycle.group.updateMatrixWorld(true);
      const pelvis=root.getObjectByName('pelvis');
      if(pelvis){
        const hip=cyclist.holder.worldToLocal(pelvis.getWorldPosition(new THREE.Vector3()));
        const seat=cyclist.holder.worldToLocal(cycle.group.localToWorld(new THREE.Vector3(0,.91,-.31)));
        root.position.add(seat.sub(hip));cycle.group.updateMatrixWorld(true);
      }
      const pole=new THREE.Vector3(0,0,1).applyQuaternion(cycle.group.quaternion);
      for(const side of ['l','r']){
        const phase=time*3.9+(side==='r'?Math.PI:0);
        const pedal=cycle.group.localToWorld(new THREE.Vector3(side==='l'?.13:-.13,.38+Math.sin(phase)*.17,Math.cos(phase)*.17));
        solveLimb(root.getObjectByName('thigh_'+side),root.getObjectByName('calf_'+side),root.getObjectByName('foot_'+side),pedal,pole);
        const handle=cycle.group.localToWorld(new THREE.Vector3(side==='l'?.2:-.2,1.01,.44));
        solveLimb(root.getObjectByName('upperarm_'+side),root.getObjectByName('lowerarm_'+side),root.getObjectByName('hand_'+side),handle,new THREE.Vector3(0,-1,0));
      }
    }
  }
  function render(view){
    renderer.shadowMap.needsUpdate=true;
    const {x,z,time,reveal,w,h}=view;canvas.style.display='block';timeUniform.value=time;updatePeople(time);
    for(const sign of luminousSigns)sign.material.emissiveIntensity=1.85+.12*Math.sin(time*.33+sign.phase)+.04*Math.sin(time*.91+sign.phase);
    fireLight.intensity=8.5+Math.sin(time*8.7)*.65+Math.sin(time*13.1)*.4;
    presenter.setView(view);const camera=presenter.camera;sky.position.copy(camera.position);
    smoke.forEach((puff,i)=>{const age=((time*.042+i/smoke.length)%1+1)%1;const height=.8+age*9;const spread=.4+age*2.6;
      puff.position.set(age*1.8+Math.sin(i*2.4+time*.17)*spread*.3,height,Math.cos(i*2.7+time*.12)*spread*.22);
      puff.scale.setScalar(.45+age*2.7);puff.quaternion.copy(camera.quaternion);puff.material.uniforms.opacity.value=.22*Math.sin(age*Math.PI)*(1.-age*.5);
    });
    sun.target.position.set(x,0,z-18);sun.position.copy(sun.target.position).add(new THREE.Vector3(-28,16,-65));sun.target.updateMatrixWorld();
    if(time-lastReflection>.08||lastReflection===-Infinity){
      lastReflection=time;reflectionCamera.copy(camera);reflectionCamera.position.y=-camera.position.y;
      const direction=camera.getWorldDirection(new THREE.Vector3());direction.y=-direction.y;
      reflectionCamera.up.set(0,-1,0);reflectionCamera.lookAt(reflectionCamera.position.clone().add(direction));reflectionCamera.updateMatrixWorld();
      const bias=new THREE.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
      reflectionMatrix.copy(bias).multiply(reflectionCamera.projectionMatrix).multiply(reflectionCamera.matrixWorldInverse);
      road.visible=false;renderer.setRenderTarget(reflectionTarget);renderer.setScissorTest(false);renderer.setViewport(0,0,reflectionTarget.width,reflectionTarget.height);renderer.clear();renderer.render(scene,reflectionCamera);road.visible=true;
    }
    presenter.draw(view);
  }
  function hide(){canvas.style.display='none';}
  const ready=Promise.all([peopleReady,...texturePromises]);
  async function prepare(view){await ready;presenter.setView(view);if(renderer.compileAsync)await renderer.compileAsync(scene,presenter.camera);const previousDisplay=canvas.style.display;try{render({...view,reveal:0});}finally{canvas.style.display=previousDisplay;}}
  return {render,hide,prepare,ready,scene,renderer,residents,camera:presenter.camera};
}

// Identical lens mapping, eye separation and calibration inputs to visual 2.
// No screen-size guesses or calibration values are introduced for visual 3.
function createStreetPresenter(renderer,scene,mobile){
  const camera=new THREE.PerspectiveCamera(75,1,.08,360),target=new THREE.WebGLRenderTarget(1,1,{samples:2});
  const postScene=new THREE.Scene(),postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const uniforms={image:{value:target.texture},resolution:{value:new THREE.Vector2()},imageSize:{value:new THREE.Vector2()},lensL:{value:new THREE.Vector2()},lensR:{value:new THREE.Vector2()},pxPerM:{value:1},screenLens:{value:.039},kd:{value:new THREE.Vector2()},fovTan:{value:1},stereo:{value:0},crossOn:{value:0},reveal:{value:0},streetTime:{value:0}};
  const post=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`varying vec2 vUv;uniform sampler2D image;uniform vec2 resolution,imageSize,lensL,lensR,kd;
      uniform float pxPerM,screenLens,fovTan,stereo,crossOn,reveal,streetTime;
      vec3 glowTap(vec2 uv,vec2 offset){vec2 p=uv+offset;
        if(stereo>.5){float eye=step(.5,uv.x);p.x=clamp(p.x,eye*.5+.5/imageSize.x,(eye+1.)*.5-.5/imageSize.x);}
        p.y=clamp(p.y,.5/imageSize.y,1.-.5/imageSize.y);
        return max(texture2D(image,p).rgb-vec3(1.),vec3(0.));}
      void main(){vec2 sampleUV=vUv;vec2 uv=vec2(0.);
      if(stereo>.5){vec2 fc=gl_FragCoord.xy;float side=step(resolution.x*.5,fc.x);vec2 lens=mix(lensL,lensR,side);
      vec2 tn=(fc-lens)/(pxPerM*screenLens);float r2=dot(tn,tn);uv=tn*(1.+kd.x*r2+kd.y*r2*r2);
      if(abs(uv.x)>fovTan||abs(uv.y)>fovTan){gl_FragColor=vec4(mix(vec3(1.),vec3(0.),reveal),1.);return;}
      sampleUV=vec2(side*.5+(uv.x/fovTan*.5+.5)*.5,uv.y/fovTan*.5+.5);
      sampleUV.x=clamp(sampleUV.x,side*.5+.5/imageSize.x,(side+1.)*.5-.5/imageSize.x);sampleUV.y=clamp(sampleUV.y,.5/imageSize.y,1.-.5/imageSize.y);}
      vec3 color=max(texture2D(image,sampleUV).rgb,vec3(0.));
      vec2 halo=vec2(6.)/imageSize;
      color+=(glowTap(sampleUV,vec2(halo.x,0.))+glowTap(sampleUV,vec2(-halo.x,0.))+glowTap(sampleUV,vec2(0.,halo.y))+glowTap(sampleUV,vec2(0.,-halo.y)))*.055;
      color=clamp((color*(2.51*color+.03))/(color*(2.43*color+.59)+.14),0.,1.);
      color=mix(vec3(dot(color,vec3(.2126,.7152,.0722))),color,.96);
      float grain=fract(sin(dot(sampleUV*resolution+floor(streetTime*24.),vec2(12.9898,78.233)))*43758.5453);color+=(grain-.5)*.004;
      if(stereo>.5&&crossOn>.5){vec2 gd=abs(fract(uv*4.+.5)-.5)/4.;float a=step(min(gd.x,gd.y),.0035)+step(min(abs(uv.x),abs(uv.y)),.008);color=mix(color,vec3(0.,1.,.6),clamp(a,0.,1.));}
      color=mix(vec3(1.),color,smoothstep(0.,1.,reveal));gl_FragColor=vec4(color,1.);
      #include <colorspace_fragment>}`,
  });postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),post));
  const forward=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3(),basis=new THREE.Matrix4(),position=new THREE.Vector3();let width=0,height=0,sw=0,sh=0;
  function setView({x,y=1.68,z,yaw,pitch,vr,viewer,w,h}){
    if(w!==width||h!==height){width=w;height=h;const scale=1;sw=Math.max(2,2*Math.round(w*scale/2));sh=Math.max(1,Math.round(h*scale));renderer.setSize(w,h,false);target.setSize(sw,sh);uniforms.resolution.value.set(w,h);uniforms.imageSize.value.set(sw,sh);}
    position.set(x,y,z);forward.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));right.set(-Math.cos(yaw),0,Math.sin(yaw));up.crossVectors(right,forward).normalize();basis.makeBasis(right,up,forward.clone().negate());camera.quaternion.setFromRotationMatrix(basis);camera.position.copy(position);
    camera.fov=vr?viewer.fovDeg*2:75;camera.aspect=vr?1:w/h;camera.updateProjectionMatrix();camera.updateMatrixWorld();
  }
  function draw({time,reveal,vr,geometry,viewer,calib,w,h}){
    target.viewport.set(0,0,sw,sh);target.scissorTest=false;
    renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.setViewport(0,0,sw,sh);renderer.clear();
    if(vr){renderer.setScissorTest(true);for(let eye=0;eye<2;eye++){camera.position.copy(position).addScaledVector(right,geometry.eyeHalf*(eye*2-1));camera.updateMatrixWorld();target.viewport.set(eye*sw/2,0,sw/2,sh);target.scissor.set(eye*sw/2,0,sw/2,sh);target.scissorTest=true;renderer.setViewport(eye*sw/2,0,sw/2,sh);renderer.setScissor(eye*sw/2,0,sw/2,sh);renderer.render(scene,camera);}}
    else{camera.position.copy(position);camera.updateMatrixWorld();renderer.render(scene,camera);}
    renderer.setScissorTest(false);renderer.setRenderTarget(null);renderer.setViewport(0,0,w,h);
    uniforms.stereo.value=vr?1:0;uniforms.reveal.value=reveal;uniforms.streetTime.value=time;uniforms.lensL.value.set(geometry.lx,geometry.ly);uniforms.lensR.value.set(geometry.rx,geometry.ly);uniforms.pxPerM.value=geometry.pxPerM;uniforms.screenLens.value=viewer.screenLensMm/1000;uniforms.kd.value.set(viewer.k[0]*calib.kScale,viewer.k[1]*calib.kScale);uniforms.fovTan.value=Math.tan(viewer.fovDeg*Math.PI/180);uniforms.crossOn.value=calib.cross?1:0;renderer.render(postScene,postCamera);
  }
  return {camera,setView,draw};
}
