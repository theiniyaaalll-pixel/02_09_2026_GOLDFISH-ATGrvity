import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

// The landscape is deterministic: the controller and every headset build the
// same plants, ponds and membranes. Animation uses the master's scene clock.
const MOBILE = typeof matchMedia === 'function' && matchMedia('(pointer:coarse)').matches;
const SUN = new THREE.Vector3(-.55, .48, -.68).normalize();
const FOG = new THREE.Color('#d6d6a0');
const TAU = Math.PI * 2;
function random(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
const ponds = [[12, -16, 12, 22], [-32, -46, 18, 11], [42, 35, 17, 24], [-50, 46, 13, 19]];
// A proper camera basis is essential when the headset turns through 360 degrees.
// Three.js cameras look along local -Z, so right must be forward cross world-up.
export function landscapeViewBasis(yaw, pitch, vectors = {
  forward: new THREE.Vector3(), right: new THREE.Vector3(), up: new THREE.Vector3(),
}) {
  vectors.forward.set(Math.sin(yaw)*Math.cos(pitch), Math.sin(pitch), Math.cos(yaw)*Math.cos(pitch));
  vectors.right.set(-Math.cos(yaw), 0, Math.sin(yaw));
  vectors.up.crossVectors(vectors.right, vectors.forward).normalize();
  return vectors;
}
export function terrainHeight(x, z) {
  let h = .12 * Math.sin(x * .063) * Math.cos(z * .054) + .06 * Math.sin(z * .13 + x * .04);
  for (const [px, pz, rx, rz] of ponds) {
    const d = ((x - px) / rx) ** 2 + ((z - pz) / rz) ** 2;
    h -= .65 * Math.exp(-d * 1.45);
  }
  return h;
}

const CELLS = /* glsl */`
uniform float dreamTime;
varying vec3 dreamWorld;
vec3 cellHash(vec3 p) {
 p=vec3(dot(p,vec3(127.1,311.7,74.7)),dot(p,vec3(269.5,183.3,246.1)),dot(p,vec3(113.5,271.9,124.6)));
 return fract(sin(p)*43758.5453);
}
// A 3D cellular field, anchored to each physical surface, never to the screen.
vec3 dreamCells(vec3 p) {
 p+=.24*sin(p.yzx*1.8+dreamTime*.13)+.14*sin(p.zxy*3.1-dreamTime*.09);
 vec3 base=floor(p),f=fract(p);
 float nearest=9.,second=9.,identity=0.;
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){
  vec3 grid=vec3(float(x),float(y),float(z));
  vec3 seed=cellHash(base+grid);
  vec3 delta=grid+.5+.35*sin(seed*6.283185+dreamTime*.09)-f;
  float d=dot(delta,delta);
  if(d<nearest){second=nearest;nearest=d;identity=seed.x;}
  else if(d<second)second=d;
 }
 float boundary=sqrt(second)-sqrt(nearest);
 float membrane=1.-smoothstep(.025,.115,boundary);
 float nucleus=1.-smoothstep(.055,.15,sqrt(nearest));
 return vec3(membrane,nucleus,identity);
}
`;

function organicMaterial(options, clock, { scale = 2, strength = .25, sway = 0 } = {}) {
  const material = options.isMaterial ? options.clone() : new THREE.MeshStandardMaterial(options);
  material.onBeforeCompile = shader => {
    shader.uniforms.dreamTime = clock;
    shader.vertexShader = `uniform float dreamTime; varying vec3 dreamWorld;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      float plantPhase=0.;
      #ifdef USE_INSTANCING
       plantPhase=instanceMatrix[3].x*.17+instanceMatrix[3].z*.13;
      #endif
      float gust=.75+.55*sin(dreamTime*.83+plantPhase*.4)+.22*sin(dreamTime*1.91+plantPhase);
      float bend=max(position.y,0.);
      transformed.x+=(.65+gust+sin(dreamTime*3.4+plantPhase+position.y*.8)*.24)*${sway.toFixed(4)}*bend;
      transformed.z+=(gust*.35+sin(dreamTime*2.5+plantPhase+position.y*1.1)*.28)*${sway.toFixed(4)}*bend;
    `);
    shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `
      vec4 dreamPosition=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        dreamPosition=instanceMatrix*dreamPosition;
      #endif
      dreamWorld=(modelMatrix*dreamPosition).xyz;
      #include <project_vertex>
    `);
    shader.fragmentShader = CELLS + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec3 cell=dreamCells(dreamWorld*${scale.toFixed(3)});
      diffuseColor.rgb*=mix(.87,1.07,cell.z);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.65,.7,.30),cell.x*${strength.toFixed(3)});
      diffuseColor.rgb*=1.-cell.y*.12;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      roughnessFactor=mix(roughnessFactor,.28,cell.x*.35);
    `);
  };
  material.customProgramCacheKey = () => `organic-${scale}-${strength}-${sway}`;
  return material;
}

// One deterministic run/dissolve cycle, evaluated from the shared scene clock.
export function dogLoopState(time) {
  const cycle=22,runDuration=16;
  const phase=((time%cycle)+cycle)%cycle;
  const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  const presence=phase<runDuration?smooth(phase/1.15)*(1-smooth((phase-14.4)/1.6)):0;
  const angle=Math.PI+phase/runDuration*TAU;
  const x=9*Math.cos(angle),z=-1+5*Math.sin(angle);
  const dx=-9*Math.sin(angle),dz=5*Math.cos(angle);
  return {x,z,yaw:Math.atan2(dx,dz),presence,phase};
}

function createCellularDog(scene,clock) {
  const root=new THREE.Group();root.name='Cellular running dog';scene.add(root);
  const presence={value:0};
  function skin(color,scale=7,strength=.42){
    const material=organicMaterial({color,roughness:.68,transparent:true,opacity:.88,depthWrite:false},clock,{scale,strength});
    const originalCompile=material.onBeforeCompile,cacheKey=material.customProgramCacheKey();
    material.onBeforeCompile=shader=>{
      originalCompile(shader);
      shader.uniforms.dogPresence=presence;
      shader.fragmentShader='uniform float dogPresence;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`
        vec3 dissolveCells=dreamCells(dreamWorld*5.3);
        float dissolve=smoothstep(dissolveCells.z*.74,dissolveCells.z*.74+.24,dogPresence);
        diffuseColor.a*=dissolve*dogPresence;
        if(diffuseColor.a<.015)discard;
        #include <alphatest_fragment>
      `);
    };
    material.customProgramCacheKey=()=>cacheKey+'-dog-dissolve';
    return material;
  }
  const coat=skin('#b2ad75'),pale=skin('#d7ce9c',8,.34),dark=skin('#393b27',15,.12);
  const sphere=new THREE.SphereGeometry(1,24,16);
  const limbGeometry=new THREE.CylinderGeometry(1,1,1,12);
  const shadowMeshes=[];
  function oval(parent,position,scale,material=coat){
    const mesh=new THREE.Mesh(sphere,material);mesh.position.set(...position);mesh.scale.set(...scale);
    mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);shadowMeshes.push(mesh);return mesh;
  }
  const torso=new THREE.Group();root.add(torso);
  oval(torso,[0,.72,0],[.205,.22,.48]);
  oval(torso,[0,.76,.27],[.215,.245,.26]);
  oval(torso,[0,.73,-.31],[.185,.21,.24]);
  oval(torso,[0,.68,.27],[.14,.18,.20],pale);
  const neck=oval(torso,[0,.91,.43],[.125,.24,.135]);neck.rotation.x=.42;
  const head=new THREE.Group();head.position.set(0,1.065,.55);torso.add(head);
  oval(head,[0,0,.06],[.125,.14,.17]);
  oval(head,[0,-.045,.225],[.09,.074,.18],pale);
  oval(head,[0,-.025,.385],[.055,.039,.034],dark);
  oval(head,[-.112,.035,.12],[.018,.017,.024],dark);
  oval(head,[.112,.035,.12],[.018,.017,.024],dark);
  oval(head,[0,-.103,.225],[.073,.022,.135],coat);
  const earShape=new THREE.Shape();
  earShape.moveTo(-.075,0);earShape.quadraticCurveTo(-.09,.12,-.025,.245);
  earShape.quadraticCurveTo(.015,.27,.055,.035);earShape.quadraticCurveTo(.025,-.02,-.075,0);
  const earGeometry=new THREE.ExtrudeGeometry(earShape,{depth:.023,bevelEnabled:true,bevelSize:.012,bevelThickness:.009,bevelSegments:3,steps:1,curveSegments:12});
  for(const side of [-1,1]){
    const ear=new THREE.Mesh(earGeometry,coat);ear.position.set(side*.085,.08,-.025);
    ear.rotation.set(-.18,side*.14,-side*.20);head.add(ear);shadowMeshes.push(ear);
  }
  const tailRoot=new THREE.Group();tailRoot.position.set(0,.78,-.43);torso.add(tailRoot);
  const tailCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(.02,.07,-.19),new THREE.Vector3(.04,.18,-.37),new THREE.Vector3(.06,.28,-.46)]);
  const tail=new THREE.Mesh(new THREE.TubeGeometry(tailCurve,20,.039,8,false),coat);tailRoot.add(tail);shadowMeshes.push(tail);
  const limbs=[];
  const yAxis=new THREE.Vector3(0,1,0),delta=new THREE.Vector3();
  for(const fore of [true,false])for(const side of [-1,1]){
    const upper=new THREE.Mesh(limbGeometry,coat),lower=new THREE.Mesh(limbGeometry,pale);
    const joint=oval(root,[0,0,0],[.047,.048,.047]);
    const paw=oval(root,[0,0,0],[.052,.036,.095],pale);
    root.add(upper,lower);shadowMeshes.push(upper,lower);
    limbs.push({fore,side,upper,lower,joint,paw,phase:((fore&&side===-1)||(!fore&&side===1))?0:.5});
  }
  const contactShadow=new THREE.Mesh(new THREE.PlaneGeometry(1.05,1.65),new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,uniforms:{presence},
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:'varying vec2 vUv;uniform float presence;void main(){vec2 p=(vUv-.5)*2.;float a=exp(-dot(p,p)*4.)*.22*presence;gl_FragColor=vec4(.12,.15,.06,a);}',
  }));
  contactShadow.rotation.x=-Math.PI/2;contactShadow.position.y=.018;root.add(contactShadow);
  function bone(mesh,a,b,radius){
    delta.subVectors(b,a);mesh.position.copy(a).add(b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(yAxis,delta.clone().normalize());mesh.scale.set(radius,delta.length(),radius);
  }
  const hip=new THREE.Vector3(),foot=new THREE.Vector3(),knee=new THREE.Vector3();
  function update(time){
    const state=dogLoopState(time);presence.value=state.presence;root.visible=state.presence>.008;
    if(!root.visible)return;
    root.position.set(state.x,terrainHeight(state.x,state.z)+.018,state.z);root.rotation.y=state.yaw;
    const stride=time*3.5,bob=.025*Math.sin(stride*TAU*2);
    torso.position.y=bob;torso.rotation.x=.035*Math.sin(stride*TAU);
    head.rotation.y=.06*Math.sin(time*.9);head.rotation.x=.035*Math.sin(stride*TAU);
    tailRoot.rotation.y=.36*Math.sin(time*7.2);tailRoot.rotation.x=.07*Math.sin(time*4.);
    for(const leg of limbs){
      const phase=(stride+leg.phase)%1,stance=phase<.58;
      const travel=stance?.23-.46*phase/.58:-.23+.46*(phase-.58)/.42;
      const lift=stance?0:.16*Math.sin((phase-.58)/.42*Math.PI);
      hip.set(leg.side*.155,.70+bob,leg.fore?.29:-.31);
      foot.set(leg.side*.155,.04+lift,(leg.fore?.29:-.31)+travel);
      const dy=foot.y-hip.y,dz=foot.z-hip.z,d=Math.min(.755,Math.hypot(dy,dz));
      const link=.38,along=d*.5,height=Math.sqrt(Math.max(0,link*link-along*along));
      const bend=leg.fore?1:-1;
      knee.set(hip.x,hip.y+dy*along/d-bend*dz*height/d,hip.z+dz*along/d+bend*dy*height/d);
      bone(leg.upper,hip,knee,leg.fore?.043:.055);bone(leg.lower,knee,foot,.028);
      leg.joint.position.copy(knee);leg.paw.position.copy(foot);leg.paw.position.z+=.035;
    }
    for(const mesh of shadowMeshes)mesh.castShadow=state.presence>.98;
  }
  return {update,root};
}

export function createRuralScene({assets=null}={}) {
  const canvas = document.createElement('canvas');
  canvas.id = 'rural-scene';
  canvas.setAttribute('aria-label', 'Dream landscape');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;display:none';
  document.body.append(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = !MOBILE;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = FOG;
  scene.fog = new THREE.FogExp2(FOG, .012);
  const clock = { value: 0 };
  const dog=createCellularDog(scene,clock);
  // A world-space destination marker, shared by both eyes and every viewer.
  const glowBall=new THREE.Group();glowBall.name='Visual 2 transition glow ball';
  // Keep the destination distant, but lift it above the grass-lined horizon.
  glowBall.position.set(-18,terrainHeight(-18,-84)+4.2,-84);
  const glowCore=new THREE.Mesh(new THREE.SphereGeometry(1.45,32,24),new THREE.MeshBasicMaterial({color:new THREE.Color(8,8,8),toneMapped:false,fog:false}));
  glowBall.add(glowCore);
  const glowCanvas=document.createElement('canvas');glowCanvas.width=128;glowCanvas.height=128;
  const glowContext=glowCanvas.getContext('2d');
  const glowGradient=glowContext.createRadialGradient(64,64,0,64,64,64);
  glowGradient.addColorStop(0,'rgba(255,255,255,1)');glowGradient.addColorStop(.13,'rgba(255,255,240,.9)');
  glowGradient.addColorStop(.38,'rgba(255,255,225,.22)');glowGradient.addColorStop(1,'rgba(255,255,220,0)');
  glowContext.fillStyle=glowGradient;glowContext.fillRect(0,0,128,128);
  const glowHalo=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(glowCanvas),color:'#ffffff',transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,fog:false}));
  glowHalo.scale.set(16,16,1);glowBall.add(glowHalo);
  const glowCorona=new THREE.Sprite(glowHalo.material.clone());
  glowCorona.material.opacity=.16;glowCorona.scale.set(28,28,1);glowBall.add(glowCorona);
  const glowSpill=new THREE.PointLight('#ffffed',12,20,2);glowBall.add(glowSpill);scene.add(glowBall);
  scene.add(new THREE.HemisphereLight('#f2edbd', '#59633b', 2.0));
  const sun = new THREE.DirectionalLight('#fff4c9', 3.4);
  sun.position.copy(SUN).multiplyScalar(65);
  sun.castShadow = !MOBILE;
  sun.shadow.mapSize.set(1536, 1536);
  Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 180 });
  sun.shadow.bias = -.0003;
  sun.shadow.normalBias = .04;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);

  // A continuous sky, with a broad sun halo and warm humid horizon.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(280, 48, 32), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { sunDirection: { value: SUN } },
    vertexShader: 'varying vec3 skyRay;void main(){skyRay=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 skyRay;uniform vec3 sunDirection;
      void main(){vec3 d=normalize(skyRay);float h=max(d.y,0.);
      vec3 c=mix(vec3(.76,.77,.47),vec3(.58,.65,.43),pow(h,.55));
      float s=max(dot(d,sunDirection),0.);c+=vec3(.35,.30,.15)*pow(s,9.);
      c+=vec3(1.7,1.5,.95)*smoothstep(.9993,.9997,s);
      gl_FragColor=vec4(c,1.);#include <tonemapping_fragment>
      #include <colorspace_fragment>}`.replace(';#include', ';\n#include'),
  }));
  sky.frustumCulled = false;
  scene.add(sky);

  const groundGeometry = new THREE.PlaneGeometry(640, 640, MOBILE ? 160 : 240, MOBILE ? 160 : 240);
  groundGeometry.rotateX(-Math.PI / 2);
  const groundPositions = groundGeometry.attributes.position;
  const groundColors = new Float32Array(groundPositions.count * 3);
  const tint = new THREE.Color();
  for (let i = 0; i < groundPositions.count; i++) {
    const x = groundPositions.getX(i), z = groundPositions.getZ(i), h = terrainHeight(x, z);
    groundPositions.setY(i, h);
    const field = .5 + .5 * Math.sin(x * .16 + Math.sin(z * .08) * 1.8);
    tint.setHSL(.185 + field * .028, .30, h < -.17 ? .19 : .27 + field * .065);
    groundColors.set([tint.r, tint.g, tint.b], i * 3);
  }
  groundGeometry.setAttribute('color', new THREE.BufferAttribute(groundColors, 3));
  groundGeometry.computeVertexNormals();
  const textureLoader = new THREE.TextureLoader();
  const groundMap=textureLoader.load(assets?.groundColor||'./assets/rural/ground-color.jpg');
  groundMap.colorSpace=THREE.SRGBColorSpace;
  const groundNormal=textureLoader.load(assets?.groundNormal||'./assets/rural/ground-normal.jpg');
  for(const map of [groundMap,groundNormal]){map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(128,128);map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());}
  const ground = new THREE.Mesh(groundGeometry, organicMaterial({ color: '#bdc993', map:groundMap,normalMap:groundNormal,normalScale:new THREE.Vector2(.5,.5), roughness: .94 }, clock, { scale: 3.4, strength: .035 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // Curved blades, instanced as real geometry rather than flat grass sprites.
  const grassGeometry = new THREE.BufferGeometry();
  const bladeVertices = [], bladeUV = [], bladeIndices = [];
  for (let i = 0; i <= 4; i++) {
    const t = i / 4, width = .012 * (1 - t) + .0003;
    bladeVertices.push(-width, t, .19 * t * t, width, t, .19 * t * t);
    bladeUV.push(0, t, 1, t);
    if (i < 4) { const n = i * 2; bladeIndices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
  }
  grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(bladeVertices, 3));
  grassGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(bladeUV, 2));
  grassGeometry.setIndex(bladeIndices);
  grassGeometry.computeVertexNormals();
  const grassMaterial = organicMaterial({ color: '#d3d1a1', roughness: .83, side: THREE.DoubleSide }, clock, { scale: 5, strength: .18, sway: .38 });
  const matrix = new THREE.Object3D();
  const grasses = [];
  const tileSize = 32;
  for (let tx = -2; tx <= 2; tx++) for (let tz = -2; tz <= 2; tz++) {
    const ring=Math.max(Math.abs(tx),Math.abs(tz));
    const tileCount=ring===0?(MOBILE?40000:90000):ring===1?(MOBILE?6000:14000):(MOBILE?1200:2400);
    const rng = random((tx + 100) * 73856093 ^ (tz + 100) * 19349663);
    const mesh = new THREE.InstancedMesh(grassGeometry, grassMaterial, tileCount);
    let count = 0;
    for (let i = 0; i < tileCount; i++) {
      const x = (tx + rng() - .5) * tileSize, z = (tz + rng() - .5) * tileSize;
      const y = terrainHeight(x, z);
      if (y < -.20) continue;
      const bank = y < -.04;
      const h = (bank ? .32 : .16) + rng() * (bank ? .6 : .29);
      matrix.position.set(x, y, z);
      matrix.rotation.set(0, rng() * TAU, (rng() - .5) * .2);
      matrix.scale.set(.6 + rng() * .8, h, 1);
      matrix.updateMatrix(); mesh.setMatrixAt(count, matrix.matrix);
      tint.setHSL(.19 + rng() * .055, .29 + rng() * .12, .24 + rng() * .13);
      mesh.setColorAt(count++, tint);
    }
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.receiveShadow = true;
    scene.add(mesh); grasses.push(mesh);
  }

  // Branching trees carry thousands of individual curved leaves, not polygonal crowns.
  const barkMaterial = organicMaterial({ color: '#686142', roughness: .96 }, clock, { scale: 2.6, strength: .28 });
  const leafMaterial = organicMaterial({ color: '#a5b456', roughness: .75, side: THREE.DoubleSide }, clock, { scale: 2.1, strength: .38, sway: .065 });
  const leafGeometry = new THREE.SphereGeometry(1, 7, 4);
  leafGeometry.scale(.075, .018, .19);
  const branchGeometry = new THREE.CylinderGeometry(1, 1, 1, 7, 1);
  const branches = [], leaves = [];
  const treeRandom = random(19271);
  const treeSpots = [[-9,-9,9], [27,-36,9], [-24,-48,10], [8,-70,8], [47,-63,11], [-48,-24,8], [-66,-63,10], [62,-8,9], [-39,31,8], [25,58,10], [-12,71,9], [76,61,10]];
  for (let i = 0; i < 34; i++) {
    const angle = treeRandom() * TAU, radius = 90 + treeRandom() * 80;
    treeSpots.push([Math.cos(angle) * radius, Math.sin(angle) * radius, 7 + treeRandom() * 7]);
  }
  const yAxis = new THREE.Vector3(0, 1, 0);
  function branch(base, direction, length, radius, depth, rng) {
    const end = base.clone().addScaledVector(direction, length);
    const midpoint = base.clone().add(end).multiplyScalar(.5);
    matrix.position.copy(midpoint);
    matrix.quaternion.setFromUnitVectors(yAxis, direction);
    matrix.scale.set(radius, length, radius);
    matrix.updateMatrix(); branches.push(matrix.matrix.clone());
    if (depth <= 2) {
      const amount = 32;
      for (let i = 0; i < amount; i++) {
        matrix.position.copy(end).add(new THREE.Vector3((rng()-.5)*length*1.4, (rng()-.5)*length*1.25, (rng()-.5)*length*1.4));
        matrix.rotation.set(rng()*TAU, rng()*TAU, rng()*TAU);
        matrix.scale.setScalar(.7 + rng() * .9);
        matrix.updateMatrix();
        const shade=rng();
        // Reduce leaf density, not tree shapes or the deterministic branch sequence.
        if(!MOBILE||i%2===0)leaves.push({ matrix: matrix.matrix.clone(), shade });
      }
    }
    if (depth === 0) return;
    const children = depth > 2 ? 3 : 2;
    for (let i = 0; i < children; i++) {
      const angle = rng() * TAU;
      const child = direction.clone().multiplyScalar(.55).add(new THREE.Vector3(Math.cos(angle)*.85,.25+rng()*.25,Math.sin(angle)*.85)).normalize();
      branch(end, child, length*(.60+rng()*.15), radius*.56, depth-1, rng);
    }
  }
  for (let i = 0; i < treeSpots.length; i++) {
    const [x,z,h] = treeSpots[i];
    branch(new THREE.Vector3(x,terrainHeight(x,z),z), new THREE.Vector3(.04,1,.03).normalize(), h*.36, h*.025, 4, random(227+i*971));
  }
  const trunks = new THREE.InstancedMesh(branchGeometry, barkMaterial, branches.length);
  branches.forEach((m,i) => trunks.setMatrixAt(i,m));
  trunks.castShadow = true; trunks.receiveShadow = true;
  trunks.computeBoundingSphere(); scene.add(trunks);
  const foliage = new THREE.InstancedMesh(leafGeometry, leafMaterial, leaves.length);
  leaves.forEach((leaf,i) => {
    foliage.setMatrixAt(i,leaf.matrix);
    foliage.setColorAt(i,tint.setHSL(.19+leaf.shade*.045,.36,.25+leaf.shade*.12));
  });
  foliage.castShadow = true; foliage.receiveShadow = true;
  foliage.computeBoundingSphere(); scene.add(foliage);

  // A real CC0 tree supplies the near/midground silhouettes and bark detail.
  // The source was reduced locally to avoid sending a 95 MB mesh to headsets.
  const treeLoader=new GLTFLoader();
  const treeLoad=assets?.treeJSON?treeLoader.parseAsync(assets.treeJSON,''):treeLoader.loadAsync('./assets/rural/tree/tree-web.gltf');
  const treeReady=treeLoad.then(gltf=>{
    scene.userData.treePrototype=gltf.scene;
    const meshes=[];gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(object=>{if(object.isMesh)meshes.push(object);});
    const transforms=treeSpots.slice(0,12).map(([x,z,h],i)=>{
      matrix.position.set(x,terrainHeight(x,z),z);matrix.rotation.set(0,i*2.39996,0);
      matrix.scale.set(h/4.55*1.2,h/4.55,h/4.55*1.2);matrix.updateMatrix();return matrix.matrix.clone();
    });
    // Move procedural copies of those near trees out; retain the distant tree line.
    const distantBranches=[],distantLeaves=[];
    for(let i=0;i<branches.length;i++){
      const m=branches[i],x=m.elements[12],z=m.elements[14];
      if(!treeSpots.slice(0,transforms.length).some(([tx,tz])=>Math.hypot(x-tx,z-tz)<8))distantBranches.push(m);
    }
    distantBranches.forEach((m,i)=>trunks.setMatrixAt(i,m));trunks.count=distantBranches.length;trunks.instanceMatrix.needsUpdate=true;
    for(const leaf of leaves){
      const x=leaf.matrix.elements[12],z=leaf.matrix.elements[14];
      if(!treeSpots.slice(0,transforms.length).some(([tx,tz])=>Math.hypot(x-tx,z-tz)<8))distantLeaves.push(leaf);
    }
    distantLeaves.forEach((leaf,i)=>{foliage.setMatrixAt(i,leaf.matrix);foliage.setColorAt(i,tint.setHSL(.19+leaf.shade*.045,.36,.25+leaf.shade*.12));});
    foliage.count=distantLeaves.length;foliage.instanceMatrix.needsUpdate=true;foliage.instanceColor.needsUpdate=true;
    for(const source of meshes){
      const material=organicMaterial(source.material,clock,{scale:1.65,strength:.35,sway:source.material.name.includes('leaves')?.032:.009});
      material.color.multiply(new THREE.Color('#e1deb0'));material.roughness=.85;
      const mesh=new THREE.InstancedMesh(source.geometry,material,transforms.length);
      transforms.forEach((transform,i)=>mesh.setMatrixAt(i,transform.clone().multiply(source.matrixWorld)));
      mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);
    }
  });
  treeReady.catch(error=>console.error('Rural tree asset failed to load',error));

  // Render actual mirrored geometry into a texture for shallow water reflections.
  const reflectionTarget = new THREE.WebGLRenderTarget(MOBILE ? 384 : 768, MOBILE ? 384 : 768);
  const reflectionCamera = new THREE.PerspectiveCamera();
  const reflectionMatrix = new THREE.Matrix4();
  const waterMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { dreamTime: clock, reflectionMap: { value: reflectionTarget.texture }, reflectionMatrix: { value: reflectionMatrix }, sunDirection: { value: SUN } },
    vertexShader: `uniform mat4 reflectionMatrix;varying vec3 dreamWorld;varying vec4 waterReflection;
      void main(){vec4 w=modelMatrix*vec4(position,1.);dreamWorld=w.xyz;waterReflection=reflectionMatrix*w;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: CELLS.replace('varying vec3 dreamWorld;', '') + `
      varying vec3 dreamWorld;varying vec4 waterReflection;
      uniform sampler2D reflectionMap;uniform vec3 sunDirection;
      void main(){
       vec2 p=dreamWorld.xz;
       float gust=.8+.35*sin(dreamTime*.83+p.x*.04+p.y*.03);
       vec2 flow=vec2(sin(p.x*3.1+p.y*1.8-dreamTime*2.8),cos(p.y*4.7-p.x*.6-dreamTime*2.1))*.012*gust;
       vec3 cells=dreamCells(vec3(p*.85,dreamTime*.015));
       vec2 uv=waterReflection.xy/waterReflection.w+flow+vec2(cells.x*.0015);
       vec3 reflection=texture2D(reflectionMap,clamp(uv,.001,.999)).rgb;
       vec3 view=normalize(cameraPosition-dreamWorld);
       float fresnel=.035+.965*pow(1.-max(view.y,0.),5.);
       vec3 base=vec3(.19,.24,.09);
       vec3 color=mix(base,reflection,.50+fresnel*.45);
       color=mix(color,vec3(.60,.65,.30),cells.x*.19);
       vec3 normal=normalize(vec3(flow.x*9.,1.,flow.y*9.));
       float glint=pow(max(dot(normal,normalize(sunDirection+view)),0.),180.);
       color+=vec3(.6,.56,.30)*glint;
       float fog=1.-exp(-length(cameraPosition-dreamWorld)*.012);
       color=mix(color,vec3(.66,.68,.40),fog);
       gl_FragColor=vec4(color,.86);
       #include <tonemapping_fragment>
       #include <colorspace_fragment>
      }`,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(250,250),waterMaterial);
  water.rotation.x=-Math.PI/2;water.position.y=-.19;water.renderOrder=2;
  scene.add(water);

  // Thin, refractive cellular volumes live between plants and around branches.
  // Each surface gets its own parallax, normal lighting and depth occlusion.
  const membraneMaterial = new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
    uniforms: { dreamTime: clock, reflectionMap: { value: reflectionTarget.texture }, reflectionMatrix: { value: reflectionMatrix } },
    vertexShader: `uniform float dreamTime;varying vec3 dreamWorld;varying vec3 membraneNormal;varying vec4 reflectedPosition;
      uniform mat4 reflectionMatrix;
      void main(){vec3 p=position;p+=normal*.09*sin(position.y*3.+position.x*2.+dreamTime*1.7);
      p.x+=.12*sin(dreamTime*.83+instanceMatrix[3].z*.04);
      vec4 w=modelMatrix*instanceMatrix*vec4(p,1.);dreamWorld=w.xyz;
      membraneNormal=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal);
      reflectedPosition=reflectionMatrix*w;gl_Position=projectionMatrix*viewMatrix*w;}`,
    fragmentShader: CELLS.replace('varying vec3 dreamWorld;', '') + `
      varying vec3 dreamWorld;varying vec3 membraneNormal;varying vec4 reflectedPosition;uniform sampler2D reflectionMap;
      void main(){vec3 c=dreamCells(dreamWorld*1.55);
       vec3 view=normalize(cameraPosition-dreamWorld);
       float rim=pow(1.-abs(dot(normalize(membraneNormal),view)),3.);
       vec2 uv=reflectedPosition.xy/reflectedPosition.w+membraneNormal.xz*.008;
       vec3 reflected=texture2D(reflectionMap,clamp(uv,.002,.998)).rgb;
       vec3 color=mix(vec3(.44,.53,.22),vec3(.82,.85,.56),c.x*.8+rim*.2);
       color=mix(color,reflected,.22);
       float alpha=.004+c.x*.105+rim*.055+c.y*.025;
       alpha*=exp(-length(cameraPosition-dreamWorld)*.008);
       gl_FragColor=vec4(color,alpha);
       #include <tonemapping_fragment>
       #include <colorspace_fragment>
      }`,
  });
  const membranes = new THREE.InstancedMesh(new THREE.SphereGeometry(1,24,16), membraneMaterial, 70);
  const mr = random(5771);
  for (let i=0;i<70;i++) {
    let x,z,y,sx,sy,sz;
    if(i<treeSpots.length){
      const spot=treeSpots[i];x=spot[0];z=spot[1];y=terrainHeight(x,z)+spot[2]*.55;
      sx=spot[2]*.32;sy=spot[2]*.36;sz=spot[2]*.31;
    }else{
      x=(mr()-.5)*130;z=(mr()-.5)*130;y=terrainHeight(x,z)+.8+mr()*2;
      sx=.7+mr()*2;sy=.7+mr()*1.8;sz=.45+mr();
    }
    matrix.position.set(x,y,z);matrix.rotation.set(mr(),mr()*TAU,mr());
    matrix.scale.set(sx,sy,sz);matrix.updateMatrix();membranes.setMatrixAt(i,matrix.matrix);
  }
  membranes.computeBoundingSphere();membranes.renderOrder=3;scene.add(membranes);

  const particleGeometry = new THREE.BufferGeometry(), particlePositions=[];
  const pr=random(8819);
  for(let i=0;i<700;i++)particlePositions.push((pr()-.5)*130,.4+pr()*8,(pr()-.5)*130);
  particleGeometry.setAttribute('position',new THREE.Float32BufferAttribute(particlePositions,3));
  const particles=new THREE.Points(particleGeometry,new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,uniforms:{dreamTime:clock},
    vertexShader:`uniform float dreamTime;varying float particleFade;void main(){vec3 p=position;
      p.x=mod(position.x+dreamTime*5.5+65.,130.)-65.;
      p.z=mod(position.z+dreamTime*1.8+65.,130.)-65.;
      p.y+=sin(dreamTime*1.8+position.x)*.35;
      vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp(20./-mv.z,1.,3.);particleFade=exp(-length(mv.xyz)*.025);}`,
    fragmentShader:`varying float particleFade;void main(){float a=1.-smoothstep(.1,.5,length(gl_PointCoord-.5));
      gl_FragColor=vec4(.95,.92,.65,a*particleFade*.3);}`,
  }));scene.add(particles);

  const camera=new THREE.PerspectiveCamera(90,1,.08,360);
  const target=new THREE.WebGLRenderTarget(1,1,{samples:MOBILE?0:2});
  const postScene=new THREE.Scene(),postCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  let jumpScareTexture;
  const jumpScareReady=new Promise((resolve,reject)=>{
    jumpScareTexture=textureLoader.load(assets.jumpScare,resolve,undefined,reject);
    jumpScareTexture.colorSpace=THREE.SRGBColorSpace;
  });
  const postUniforms={
    jumpScare:{value:jumpScareTexture},scareOn:{value:0},eyeAspect:{value:1},
    image:{value:target.texture},resolution:{value:new THREE.Vector2()},imageSize:{value:new THREE.Vector2()},
    lensL:{value:new THREE.Vector2()},lensR:{value:new THREE.Vector2()},
    pxPerM:{value:1},screenLens:{value:.039},kd:{value:new THREE.Vector2()},
    fovTan:{value:1},stereo:{value:0},crossOn:{value:0},reveal:{value:0},
  };
  const postMaterial=new THREE.ShaderMaterial({
    depthTest:false,depthWrite:false,toneMapped:false,uniforms:postUniforms,
    vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`varying vec2 vUv;uniform sampler2D image,jumpScare;uniform float scareOn,eyeAspect;uniform vec2 resolution,imageSize,lensL,lensR,kd;
      uniform float pxPerM,screenLens,fovTan,stereo,crossOn,reveal;
      void main(){vec2 sampleUV=vUv;vec2 uv=vec2(0.);
       if(stereo>.5){
        vec2 fc=gl_FragCoord.xy;float side=step(resolution.x*.5,fc.x);
        vec2 lens=mix(lensL,lensR,side);
        vec2 tn=(fc-lens)/(pxPerM*screenLens);float r2=dot(tn,tn);
        uv=tn*(1.+kd.x*r2+kd.y*r2*r2);
        if(abs(uv.x)>fovTan||abs(uv.y)>fovTan){gl_FragColor=vec4(mix(vec3(1.),vec3(0.),reveal),1.);return;}
        sampleUV=vec2(side*.5+(uv.x/fovTan*.5+.5)*.5,uv.y/fovTan*.5+.5);
        // Keep bilinear filtering inside each eye's image at the centre seam.
        sampleUV.x=clamp(sampleUV.x,side*.5+.5/imageSize.x,(side+1.)*.5-.5/imageSize.x);
        sampleUV.y=clamp(sampleUV.y,.5/imageSize.y,1.-.5/imageSize.y);
       }
       vec3 color=texture2D(image,sampleUV).rgb;
       // Filmic highlight rolloff for the linear offscreen scene.
       color=max(color,vec3(0.));
       color=clamp((color*(2.51*color+.03))/(color*(2.43*color+.59)+.14),0.,1.);
       if(scareOn>.5){
        // Use the already calibrated eye coordinates, never a DOM overlay.
        vec2 photoUV=sampleUV;
        if(stereo>.5)photoUV.x=fract(photoUV.x*2.);
        vec2 fit=vec2(max(eyeAspect/2.,1.),max(2./eyeAspect,1.));
        photoUV=(photoUV-.5)*fit+.5;
        color=vec3(0.);
        if(all(greaterThanEqual(photoUV,vec2(0.)))&&all(lessThanEqual(photoUV,vec2(1.))))color=texture2D(jumpScare,photoUV).rgb;
       }
       if(stereo>.5&&crossOn>.5){vec2 gd=abs(fract(uv*4.+.5)-.5)/4.;
        float a=step(min(gd.x,gd.y),.0035)+step(min(abs(uv.x),abs(uv.y)),.008);
        color=mix(color,vec3(0.,1.,.6),clamp(a,0.,1.));}
       color=mix(vec3(1.),color,smoothstep(0.,1.,reveal));
       gl_FragColor=vec4(color,1.);
       #include <colorspace_fragment>
      }`,
  });
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),postMaterial));
  const forward=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3(),basis=new THREE.Matrix4();
  const viewVectors={forward,right,up};
  const position=new THREE.Vector3(),look=new THREE.Vector3();
  const bias=new THREE.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
  let width=0,height=0,sceneWidth=0,sceneHeight=0,lastReflection=-1;
  let lastReflectionYaw=Infinity,lastReflectionPitch=Infinity;
  let active=false;
  function render({x,z,yaw,pitch,time,sceneAge=0,reveal,vr,geometry,viewer,calib,w,h}) {
    if(!active){canvas.style.display='block';active=true;}
    if(w!==width||h!==height){
      width=w;height=h;
      // Only the offscreen scene is reduced. The final lens pass keeps the
      // original canvas size and all calibration values exactly as supplied.
      const renderScale=MOBILE?.72:1;
      sceneWidth=Math.max(2,2*Math.round(w*renderScale/2));sceneHeight=Math.max(1,Math.round(h*renderScale));
      renderer.setSize(w,h,false);target.setSize(sceneWidth,sceneHeight);
      postUniforms.resolution.value.set(w,h);postUniforms.imageSize.value.set(sceneWidth,sceneHeight);
    }
    clock.value=time;
    postUniforms.scareOn.value=sceneAge>=10&&sceneAge<13?1:0;
    postUniforms.eyeAspect.value=vr?1:w/h;
    dog.update(time);
    const glowPulse=1+.055*Math.sin(time*1.8);
    glowHalo.scale.set(16*glowPulse,16*glowPulse,1);
    glowCorona.scale.set(28*glowPulse,28*glowPulse,1);
    // The eye remains above the shallow water; movement input is unchanged.
    position.set(x,Math.max(-.16,terrainHeight(x,z))+1.68,z);
    landscapeViewBasis(yaw,pitch,viewVectors);
    basis.makeBasis(right,up,forward.clone().negate());
    camera.quaternion.setFromRotationMatrix(basis);
    camera.position.copy(position);
    camera.fov=vr?viewer.fovDeg*2:75;camera.aspect=vr?1:w/h;camera.updateProjectionMatrix();camera.updateMatrixWorld();
    sun.target.position.set(x,0,z);sun.position.copy(sun.target.position).addScaledVector(SUN,65);sun.target.updateMatrixWorld();
    sky.position.copy(position);
    const headTurned=Math.abs(yaw-lastReflectionYaw)>.025||Math.abs(pitch-lastReflectionPitch)>.025;
    if(time-lastReflection>(MOBILE?.09:.035)||lastReflection<0||headTurned){
      lastReflection=time;lastReflectionYaw=yaw;lastReflectionPitch=pitch;
      reflectionCamera.copy(camera);
      reflectionCamera.position.y=-.38-position.y;
      look.copy(position).add(forward);look.y=-.38-look.y;
      reflectionCamera.up.copy(up);reflectionCamera.up.y*=-1;
      reflectionCamera.lookAt(look);reflectionCamera.updateMatrixWorld();
      reflectionMatrix.copy(bias).multiply(reflectionCamera.projectionMatrix).multiply(reflectionCamera.matrixWorldInverse);
      water.visible=false;membranes.visible=false;
      renderer.setRenderTarget(reflectionTarget);renderer.setScissorTest(false);renderer.clear();renderer.render(scene,reflectionCamera);
      water.visible=true;membranes.visible=true;
    }
    renderer.setRenderTarget(target);renderer.setScissorTest(false);renderer.clear();
    if(vr){
      renderer.setScissorTest(true);
      for(let eye=0;eye<2;eye++){
        camera.position.copy(position).addScaledVector(right,geometry.eyeHalf*(eye*2-1));camera.updateMatrixWorld();
        const left=eye*sceneWidth/2,eyeWidth=sceneWidth/2;
        renderer.setViewport(left,0,eyeWidth,sceneHeight);renderer.setScissor(left,0,eyeWidth,sceneHeight);renderer.render(scene,camera);
      }
    }else{renderer.setViewport(0,0,sceneWidth,sceneHeight);renderer.render(scene,camera);}
    renderer.setScissorTest(false);renderer.setRenderTarget(null);renderer.setViewport(0,0,w,h);
    postUniforms.stereo.value=vr?1:0;postUniforms.reveal.value=reveal;
    postUniforms.lensL.value.set(geometry.lx,geometry.ly);postUniforms.lensR.value.set(geometry.rx,geometry.ly);
    postUniforms.pxPerM.value=geometry.pxPerM;postUniforms.screenLens.value=viewer.screenLensMm/1000;
    postUniforms.kd.value.set(viewer.k[0]*calib.kScale,viewer.k[1]*calib.kScale);
    postUniforms.fovTan.value=Math.tan(viewer.fovDeg*Math.PI/180);postUniforms.crossOn.value=calib.cross?1:0;
    renderer.render(postScene,postCamera);
  }
  function hide(){canvas.style.display='none';active=false;}
  async function prepare(view){
    await Promise.all([treeReady,jumpScareReady]);
    // Compile and upload before the transition so the first landscape frame
    // does not incur shader compilation or texture upload in the white fade.
    if(renderer.compileAsync)await renderer.compileAsync(scene,camera);
    try{render({...view,reveal:0});}finally{hide();}
  }
  const reachedGlowBall=(x,z)=>Math.hypot(x-glowBall.position.x,z-glowBall.position.z)<=2.4;
  return {render,hide,prepare,renderer,scene,ready:treeReady,reachedGlowBall};
}
