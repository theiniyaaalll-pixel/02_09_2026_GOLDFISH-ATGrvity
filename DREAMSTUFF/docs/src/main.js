import * as THREE from "three";
import { StereoEffect } from "three/addons/effects/StereoEffect.js";

// Global MediaPipe scripts loaded via index.html
const Hands = window.Hands;
const Camera = window.Camera;

// DOM Elements
const sceneEl = document.querySelector("#scene");
const modeEl = document.querySelector("#mode");
const gestureEl = document.querySelector("#gesture");
const paceStatusEl = document.querySelector("#paceStatus");
const speedValueEl = document.querySelector("#speedValue");
const speedBarFillEl = document.querySelector("#speedBarFill");
const soundButton = document.querySelector("#soundButton");
const soundIcon = document.querySelector("#soundIcon");
const soundLabel = document.querySelector("#soundLabel");
const fullscreenButton = document.querySelector("#fullscreenButton");
const video = document.querySelector("#webcam");
const handCanvas = document.querySelector("#handCanvas");
const handCtx = handCanvas ? handCanvas.getContext("2d") : null;
const cameraPanel = document.querySelector("#cameraPanel");
const cameraButton = document.querySelector("#cameraButton");

const isPhone = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
modeEl.textContent = isPhone ? "CARDBOARD / PHONE" : "WAY TO GO / DESKTOP";

// Web Audio Ambient Synthesizer
let audioCtx = null;
let soundEnabled = false;
let ambientGain = null;
let lastStepTime = 0;

// Three.js Core
let renderer, camera, scene, clock, stereoEffect;
let viewMode = "normal";
let deviceOrientationEnabled = false;
const normalModeButton = document.querySelector("#normalModeButton");
const cardboardModeButton = document.querySelector("#cardboardModeButton");
const motionButton = document.querySelector("#motionButton");
let cameraRig, headGroup;

// Navigation & Locomotion State
const PACE = {
  IDLE: 0,
  WALK: 3.4, // m/s (~12 km/h)
  RUN: 7.2   // m/s (~26 km/h)
};

let currentSpeed = 0;
let targetSpeed = 0;
let isRunning = false;

let lateralPosition = -8.5; // Start safely on the right sidewalk
let targetLateral = -8.5;
let lateralVelocity = 0;

// Camera Orientation (Way to Go 360 look-around)
let lookYaw = 0;
let lookPitch = 0;
let isDraggingLook = false;
let lastPointerX = 0;
let lastPointerY = 0;

// Procedural textures cache
let roadMaterial, sidewalkMaterial, buildingMaterials = [], carPaintMaterials = [], headlightBeamTexture;

// Environment Streaming System
const CHUNK_SIZE = 160;
const NUM_CHUNKS = 4;
const TOTAL_WORLD_SPAN = CHUNK_SIZE * NUM_CHUNKS;
const roadChunks = [];

// Traffic Simulation
const trafficVehicles = [];
const TRAFFIC_LANES = [
  // Southbound lanes (oncoming, left side: x in [2.5, 6.0, 9.5])
  { x: 3.2, dir: 1, speedMin: 14, speedMax: 22 },
  { x: 6.8, dir: 1, speedMin: 18, speedMax: 26 },
  // Northbound lanes (same direction, right side: x in [-3.2, -6.8])
  { x: -3.2, dir: -1, speedMin: 14, speedMax: 23 },
  { x: -6.8, dir: -1, speedMin: 19, speedMax: 28 },
];

// Animated First-Person Shoes
let leftShoe, rightShoe;

// Input Key States
const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  shift: false
};

// Initialize Application
initThree();
initInputControllers();
initViewModeChooser();

if (!isPhone) {
  setupLaptopControls();
} else {
  if (cameraPanel) cameraPanel.style.display = "none";
}

// ==========================================
// 1. PROCEDURAL PBR TEXTURES
// ==========================================

function createAsphaltTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  // Base asphalt dark gradient
  ctx.fillStyle = "#1b1e22";
  ctx.fillRect(0, 0, 1024, 1024);

  // Fine asphalt aggregate noise
  const imgData = ctx.getImageData(0, 0, 1024, 1024);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const grain = (Math.random() - 0.5) * 32;
    data[i] = Math.max(0, Math.min(255, data[i] + grain));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + grain));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + grain + 2));
  }
  ctx.putImageData(imgData, 0, 0);

  // Subtle wet puddle streaks (Way to Go wet road feel)
  ctx.fillStyle = "rgba(10, 13, 17, 0.4)";
  for (let i = 0; i < 6; i++) {
    const px = Math.random() * 900;
    const py = Math.random() * 900;
    const grad = ctx.createRadialGradient(px, py, 20, px, py, 140);
    grad.addColorStop(0, "rgba(5, 7, 10, 0.5)");
    grad.addColorStop(1, "rgba(5, 7, 10, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(px, py, 120, 60, Math.PI / 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // Road Markings:
  // Center double yellow lines
  ctx.fillStyle = "#eab308";
  ctx.fillRect(507, 0, 4, 1024);
  ctx.fillRect(513, 0, 4, 1024);

  // White dashed lane dividers (left & right lanes)
  ctx.fillStyle = "#f1f5f9";
  const dashLen = 70;
  const gapLen = 58;
  for (let y = 0; y < 1024; y += dashLen + gapLen) {
    ctx.fillRect(290, y, 6, dashLen);
    ctx.fillRect(728, y, 6, dashLen);
  }

  // Outer solid white shoulder lines
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(70, 0, 8, 1024);
  ctx.fillRect(946, 0, 8, 1024);

  // Pedestrian zebra crosswalk markings near segment edge
  ctx.fillStyle = "rgba(240, 244, 255, 0.9)";
  for (let x = 80; x < 940; x += 36) {
    ctx.fillRect(x, 930, 22, 70);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

function createSidewalkTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  // Concrete tone
  ctx.fillStyle = "#5b6068";
  ctx.fillRect(0, 0, 512, 512);

  // Noise
  const imgData = ctx.getImageData(0, 0, 512, 512);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const grain = (Math.random() - 0.5) * 24;
    data[i] = Math.max(0, Math.min(255, data[i] + grain));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + grain));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + grain));
  }
  ctx.putImageData(imgData, 0, 0);

  // Paver tile joints
  ctx.strokeStyle = "rgba(20, 22, 28, 0.6)";
  ctx.lineWidth = 3;
  for (let i = 0; i <= 512; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }

  // Curb border line
  ctx.fillStyle = "rgba(25, 28, 35, 0.7)";
  ctx.fillRect(0, 0, 16, 512);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 8);
  return texture;
}

function createBuildingFacadeTexture(styleIndex) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  const themes = [
    { base: "#1e2430", winOn: "#fef08a", winOff: "#0b101b", winCool: "#67e8f9" },
    { base: "#181a20", winOn: "#fed7aa", winOff: "#090d14", winCool: "#93c5fd" },
    { base: "#272a33", winOn: "#ffedd5", winOff: "#111622", winCool: "#a5f3fc" }
  ];
  const t = themes[styleIndex % themes.length];

  ctx.fillStyle = t.base;
  ctx.fillRect(0, 0, 512, 512);

  // Window grid
  const cols = 8;
  const rows = 12;
  const padX = 14;
  const padY = 12;
  const w = (512 - padX * (cols + 1)) / cols;
  const h = (512 - padY * (rows + 1)) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = padX + c * (w + padX);
      const y = padY + r * (h + padY);

      const roll = Math.random();
      if (roll > 0.45) {
        ctx.fillStyle = Math.random() > 0.3 ? t.winOn : t.winCool;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
      } else {
        ctx.fillStyle = t.winOff;
        ctx.shadowBlur = 0;
      }
      ctx.fillRect(x, y, w, h);
    }
  }

  // Ground level storefront / neon banner
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#0c0e14";
  ctx.fillRect(0, 440, 512, 72);

  const neons = ["#38bdf8", "#f43f5e", "#a855f7", "#10b981", "#fbbf24"];
  ctx.fillStyle = neons[styleIndex % neons.length];
  ctx.font = "bold 24px 'Plus Jakarta Sans', sans-serif";
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 12;
  ctx.fillText("METROPOLIS", 32, 485);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function createHeadlightCookieTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  const grad = ctx.createRadialGradient(128, 40, 5, 128, 128, 120);
  grad.addColorStop(0, "rgba(255, 250, 220, 0.85)");
  grad.addColorStop(0.3, "rgba(255, 235, 170, 0.5)");
  grad.addColorStop(0.7, "rgba(240, 220, 150, 0.15)");
  grad.addColorStop(1, "rgba(200, 200, 200, 0)");

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(128, 128, 110, 80, 0, 0, Math.PI * 2);
  ctx.fill();

  return new THREE.CanvasTexture(canvas);
}

// ==========================================
// 2. THREE.JS INITIALIZATION & SCENE SETUP
// ==========================================

function initThree() {
  scene = new THREE.Scene();

  // Cinematic Atmospheric Dusk Fog (Way to Go moody skyline)
  const skyColor = new THREE.Color(0x131a28);
  scene.background = skyColor;
  scene.fog = new THREE.FogExp2(0x131a28, 0.0125);

  clock = new THREE.Clock();

  // Camera & Rig Setup
  cameraRig = new THREE.Group();
  cameraRig.position.set(lateralPosition, 0, 0);
  scene.add(cameraRig);

  headGroup = new THREE.Group();
  headGroup.position.set(0, 1.68, 0); // Natural eye height
  cameraRig.add(headGroup);

  camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.1, 500);
  headGroup.add(camera);

  // Renderer Setup
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2.0));
  renderer.setSize(innerWidth, innerHeight);
  renderer.xr.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  sceneEl.appendChild(renderer.domElement);

  stereoEffect = new StereoEffect(renderer);
  stereoEffect.setEyeSeparation(0.064);
  stereoEffect.setSize(innerWidth, innerHeight);

  // Lighting
  const hemiLight = new THREE.HemisphereLight(0x738fa7, 0x1d1e22, 1.4);
  scene.add(hemiLight);

  // Golden dusk directional sunlight
  const sunLight = new THREE.DirectionalLight(0xffbe7b, 2.2);
  sunLight.position.set(-45, 60, -30);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 1024;
  sunLight.shadow.mapSize.height = 1024;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 160;
  sunLight.shadow.camera.left = -40;
  sunLight.shadow.camera.right = 40;
  sunLight.shadow.camera.top = 40;
  sunLight.shadow.camera.bottom = -40;
  scene.add(sunLight);

  // Atmospheric twilight backdrop glow
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(380, 24, 16),
    new THREE.MeshBasicMaterial({
      color: 0xff8c42,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.12
    })
  );
  skyDome.position.set(0, 40, -180);
  scene.add(skyDome);

  // Prepare Materials
  const asphaltTex = createAsphaltTexture();
  asphaltTex.repeat.set(1, CHUNK_SIZE / 24);
  roadMaterial = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: 0.35, // Wet road specular sheen
    metalness: 0.3,
    color: 0x9098a2
  });

  const sidewalkTex = createSidewalkTexture();
  sidewalkMaterial = new THREE.MeshStandardMaterial({
    map: sidewalkTex,
    roughness: 0.85,
    metalness: 0.05
  });

  buildingMaterials = [
    new THREE.MeshStandardMaterial({ map: createBuildingFacadeTexture(0), roughness: 0.4, metalness: 0.2 }),
    new THREE.MeshStandardMaterial({ map: createBuildingFacadeTexture(1), roughness: 0.4, metalness: 0.2 }),
    new THREE.MeshStandardMaterial({ map: createBuildingFacadeTexture(2), roughness: 0.4, metalness: 0.2 })
  ];

  carPaintMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x111625, metalness: 0.88, roughness: 0.18 }), // Obsidian black
    new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.92, roughness: 0.15 }), // Silver metallic
    new THREE.MeshStandardMaterial({ color: 0x991b1b, metalness: 0.85, roughness: 0.22 }), // Crimson red
    new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.86, roughness: 0.20 }), // Midnight blue
    new THREE.MeshStandardMaterial({ color: 0xeab308, metalness: 0.45, roughness: 0.30 })  // Yellow taxi
  ];

  headlightBeamTexture = createHeadlightCookieTexture();

  // Build Infinite Road System
  for (let i = 0; i < NUM_CHUNKS; i++) {
    const chunkZ = -i * CHUNK_SIZE;
    const chunk = buildRoadChunk(chunkZ);
    roadChunks.push(chunk);
    scene.add(chunk);
  }

  // Populate Dynamic Traffic Fleet
  initTrafficVehicles();

  // Add Animated 3D Sneakers
  buildAnimatedShoes();

  // Floating atmospheric dust / twilight particles
  buildAtmosphericParticles();
  buildDreamAtmosphere();

  // Event Listeners
  window.addEventListener("resize", onResize);
  renderer.setAnimationLoop(render);
}

// ==========================================
// 3. INFINITE ROAD & CITY CHUNK BUILDER
// ==========================================

function buildRoadChunk(baseZ) {
  const chunk = new THREE.Group();
  chunk.position.z = baseZ;

  // Main 4-Lane Highway (Width: 20m)
  const roadGeo = new THREE.PlaneGeometry(20, CHUNK_SIZE);
  const roadMesh = new THREE.Mesh(roadGeo, roadMaterial);
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.receiveShadow = true;
  chunk.add(roadMesh);

  // Center Landscaped Highway Median Barrier
  const medianGeo = new THREE.BoxGeometry(1.2, 0.45, CHUNK_SIZE);
  const medianMat = new THREE.MeshStandardMaterial({ color: 0x3d434a, roughness: 0.8 });
  const median = new THREE.Mesh(medianGeo, medianMat);
  median.position.set(0, 0.22, 0);
  median.receiveShadow = true;
  chunk.add(median);

  // Median reflective markers / posts
  for (let z = -CHUNK_SIZE / 2 + 10; z < CHUNK_SIZE / 2; z += 16) {
    const postGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 8);
    const postMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(0, 0.7, z);
    chunk.add(post);
  }

  // Elevated Concrete Sidewalks (Left & Right)
  const swWidth = 4.2;
  const swGeo = new THREE.BoxGeometry(swWidth, 0.35, CHUNK_SIZE);
  const leftSidewalk = new THREE.Mesh(swGeo, sidewalkMaterial);
  leftSidewalk.position.set(-12.1, 0.175, 0);
  leftSidewalk.receiveShadow = true;
  chunk.add(leftSidewalk);

  const rightSidewalk = new THREE.Mesh(swGeo, sidewalkMaterial);
  rightSidewalk.position.set(12.1, 0.175, 0);
  rightSidewalk.receiveShadow = true;
  chunk.add(rightSidewalk);

  // Street Lamps with warm glowing pools of light
  for (let z = -CHUNK_SIZE / 2 + 12; z < CHUNK_SIZE / 2; z += 32) {
    addModernStreetLamp(chunk, -13.5, z, false);
    addModernStreetLamp(chunk, 13.5, z + 16, true);
  }

  // Overhead Traffic Signal Gantry at interval
  addTrafficSignalGantry(chunk, -CHUNK_SIZE / 4);

  // Modern Skyscrapers & Storefront Architecture along sidewalks
  for (let z = -CHUNK_SIZE / 2 + 10; z < CHUNK_SIZE / 2; z += 24) {
    // West Side (Left) Towers
    addSkyscraper(chunk, -24 - Math.random() * 8, z, 14 + Math.random() * 6, 40 + Math.random() * 55, 20 + Math.random() * 6);
    // East Side (Right) Towers
    addSkyscraper(chunk, 24 + Math.random() * 8, z + 12, 14 + Math.random() * 6, 35 + Math.random() * 50, 20 + Math.random() * 6);

    // Street foliage trees
    addStreetTree(chunk, -10.8, z + 6);
    addStreetTree(chunk, 10.8, z + 18);
  }

  return chunk;
}

function addModernStreetLamp(parent, x, z, mirror) {
  const lamp = new THREE.Group();
  lamp.position.set(x, 0, z);

  // Sleek tapered metallic pole
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.14, 6.5, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1f242d, metalness: 0.8, roughness: 0.3 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = 3.25;
  lamp.add(pole);

  // Curved overhang arm
  const armGeo = new THREE.CylinderGeometry(0.06, 0.08, 2.8, 8);
  const arm = new THREE.Mesh(armGeo, poleMat);
  arm.rotation.z = mirror ? -Math.PI / 3 : Math.PI / 3;
  arm.position.set(mirror ? -1.1 : 1.1, 6.2, 0);
  lamp.add(arm);

  // Glowing lantern head
  const headGeo = new THREE.BoxGeometry(0.7, 0.14, 0.35);
  const headMat = new THREE.MeshStandardMaterial({ color: 0x11141a, roughness: 0.4 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(mirror ? -2.2 : 2.2, 6.8, 0);
  lamp.add(head);

  // Emissive glowing lens
  const lensGeo = new THREE.PlaneGeometry(0.6, 0.3);
  const lensMat = new THREE.MeshBasicMaterial({ color: 0xffeaad });
  const lens = new THREE.Mesh(lensGeo, lensMat);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(mirror ? -2.2 : 2.2, 6.72, 0);
  lamp.add(lens);

  // Downward warm light pool on asphalt
  const spotMesh = new THREE.Mesh(
    new THREE.CircleGeometry(4.5, 16),
    new THREE.MeshBasicMaterial({
      color: 0xffd27d,
      transparent: true,
      opacity: 0.15,
      blending: THREE.AdditiveBlending
    })
  );
  spotMesh.rotation.x = -Math.PI / 2;
  spotMesh.position.set(mirror ? -3.5 : 3.5, 0.02, 0);
  lamp.add(spotMesh);

  parent.add(lamp);
}

function addTrafficSignalGantry(parent, z) {
  const gantry = new THREE.Group();
  gantry.position.set(0, 0, z);

  // Steel truss arch across highway
  const trussMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 });
  const postLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7.5, 8), trussMat);
  postLeft.position.set(-10.5, 3.75, 0);
  gantry.add(postLeft);

  const postRight = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7.5, 8), trussMat);
  postRight.position.set(10.5, 3.75, 0);
  gantry.add(postRight);

  const beam = new THREE.Mesh(new THREE.BoxGeometry(22, 0.45, 0.45), trussMat);
  beam.position.set(0, 7.2, 0);
  gantry.add(beam);

  // Traffic signal heads with glowing lights for each lane
  const laneX = [-6.8, -3.2, 3.2, 6.8];
  laneX.forEach((lx, i) => {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 1.1, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x0f172a })
    );
    box.position.set(lx, 6.6, 0);

    // Green / Red lenses
    const isGreen = i < 2;
    const lensMat = new THREE.MeshBasicMaterial({ color: isGreen ? 0x22c55e : 0xef4444 });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.12, 12), lensMat);
    lens.position.set(0, isGreen ? -0.32 : 0.32, 0.18);
    box.add(lens);

    gantry.add(box);
  });

  parent.add(gantry);
}

function addSkyscraper(parent, x, z, w, h, d) {
  const bldg = new THREE.Group();
  bldg.position.set(x, 0, z);

  const mat = buildingMaterials[Math.floor(Math.random() * buildingMaterials.length)];
  const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  tower.position.y = h / 2;
  tower.castShadow = true;
  tower.receiveShadow = true;
  bldg.add(tower);

  // Rooftop beacon antenna with blinking aviation warning light
  if (h > 45) {
    const antGeo = new THREE.CylinderGeometry(0.05, 0.1, 6, 6);
    const antMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    const antenna = new THREE.Mesh(antGeo, antMat);
    antenna.position.set(0, h + 3, 0);
    bldg.add(antenna);

    const beaconGeo = new THREE.SphereGeometry(0.25, 8, 8);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, h + 6, 0);
    beacon.userData.isBlinker = true;
    bldg.add(beacon);
  }

  parent.add(bldg);
}

function addStreetTree(parent, x, z) {
  const tree = new THREE.Group();
  tree.position.set(x, 0.3, z);

  // Trunk
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 3.2, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.position.y = 1.6;
  tree.add(trunk);

  // Multi-layered lush canopy
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0x1f3d24, roughness: 0.85 });
  const crown1 = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 10), foliageMat);
  crown1.position.y = 3.6;
  tree.add(crown1);

  const crown2 = new THREE.Mesh(new THREE.SphereGeometry(1.1, 10, 8), foliageMat);
  crown2.position.set(0.3, 4.3, 0.2);
  tree.add(crown2);

  parent.add(tree);
}

// ==========================================
// 4. REALISTIC VEHICLE FLEET & TRAFFIC
// ==========================================

function initTrafficVehicles() {
  const vehicleTypes = ["SEDAN", "TAXI", "BUS", "SUV"];
  const totalVehicles = 24;

  for (let i = 0; i < totalVehicles; i++) {
    const lane = TRAFFIC_LANES[i % TRAFFIC_LANES.length];
    const type = i % 5 === 0 ? "BUS" : (i % 4 === 1 ? "TAXI" : (i % 3 === 0 ? "SUV" : "SEDAN"));
    const v = createRealisticVehicle(type, lane.dir);

    // Spread along the world highway
    const zPos = -(i * (TOTAL_WORLD_SPAN / totalVehicles)) + (Math.random() - 0.5) * 20;
    v.position.set(lane.x, 0, zPos);

    v.userData = {
      dir: lane.dir,
      speed: lane.speedMin + Math.random() * (lane.speedMax - lane.speedMin),
      laneX: lane.x,
      type: type
    };

    trafficVehicles.push(v);
    scene.add(v);
  }
}

function createRealisticVehicle(type, direction) {
  const group = new THREE.Group();

  let bodyW = 2.1, bodyH = 0.75, bodyL = 4.8;
  let cabinW = 1.8, cabinH = 0.65, cabinL = 2.4;
  let wheelR = 0.36, wheelW = 0.24;
  let isTaxi = type === "TAXI";
  let isBus = type === "BUS";

  if (isBus) {
    bodyW = 2.6; bodyH = 2.2; bodyL = 10.5;
    cabinW = 2.5; cabinH = 1.0; cabinL = 8.5;
    wheelR = 0.5; wheelW = 0.35;
  } else if (type === "SUV") {
    bodyW = 2.2; bodyH = 0.95; bodyL = 5.0;
    cabinW = 1.95; cabinH = 0.8; cabinL = 2.9;
    wheelR = 0.42; wheelW = 0.28;
  }

  // Paint Material
  let paintMat = carPaintMaterials[Math.floor(Math.random() * carPaintMaterials.length)];
  if (isTaxi) paintMat = carPaintMaterials[4]; // Yellow
  if (isBus) paintMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.4, roughness: 0.3 });

  // Main Chiseled Body
  const bodyGeo = new THREE.BoxGeometry(bodyW, bodyH, bodyL);
  const bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
  bodyMesh.position.y = wheelR + bodyH / 2;
  bodyMesh.castShadow = true;
  group.add(bodyMesh);

  // Cabin / Greenhouse Glass Roof
  if (!isBus) {
    const cabinGeo = new THREE.BoxGeometry(cabinW, cabinH, cabinL);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0b111a,
      roughness: 0.08,
      metalness: 0.95,
      envMapIntensity: 1.5
    });
    const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
    cabinMesh.position.set(0, wheelR + bodyH + cabinH / 2 - 0.05, -0.2);
    cabinMesh.castShadow = true;
    group.add(cabinMesh);
  } else {
    // Bus panoramic windows strip
    const windowStripGeo = new THREE.BoxGeometry(bodyW + 0.05, 0.9, bodyL - 1.2);
    const busWinMat = new THREE.MeshBasicMaterial({ color: 0xfef08a }); // warm lit interior
    const windowStrip = new THREE.Mesh(windowStripGeo, busWinMat);
    windowStrip.position.set(0, 1.9, 0);
    group.add(windowStrip);
  }

  // Taxi rooftop lightbox
  if (isTaxi) {
    const taxiSign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.2, 0.3),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    taxiSign.position.set(0, wheelR + bodyH + cabinH + 0.1, -0.2);
    group.add(taxiSign);
  }

  // Chrome Grille & Bumpers
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.2 });
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(bodyW + 0.05, 0.25, 0.4), chromeMat);
  frontBumper.position.set(0, wheelR + 0.2, -bodyL / 2);
  group.add(frontBumper);

  // Wheels (4 detailed alloy wheels with rubber tires)
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x121417, roughness: 0.85 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.2 });
  const wheelZOffsets = isBus ? [-bodyL / 2 + 1.8, bodyL / 2 - 2.8, bodyL / 2 - 1.4] : [-bodyL / 2 + 1.0, bodyL / 2 - 1.0];

  wheelZOffsets.forEach((wz) => {
    [-bodyW / 2 - 0.05, bodyW / 2 + 0.05].forEach((wx) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.set(wx, wheelR, wz);

      const tire = new THREE.Mesh(new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 16), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheelGroup.add(tire);

      const rim = new THREE.Mesh(new THREE.CylinderGeometry(wheelR * 0.65, wheelR * 0.65, wheelW + 0.02, 8), rimMat);
      rim.rotation.z = Math.PI / 2;
      wheelGroup.add(rim);

      group.add(wheelGroup);
    });
  });

  // Dual Headlights (Front: -Z)
  const headlightMat = new THREE.MeshBasicMaterial({ color: 0xfffae0 });
  [-bodyW / 2 + 0.35, bodyW / 2 - 0.35].forEach((hx) => {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), headlightMat);
    hl.position.set(hx, wheelR + bodyH * 0.65, -bodyL / 2 - 0.02);
    group.add(hl);
  });

  // Dual Taillights (Rear: +Z)
  const taillightMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  [-bodyW / 2 + 0.35, bodyW / 2 - 0.35].forEach((tx) => {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.1), taillightMat);
    tl.position.set(tx, wheelR + bodyH * 0.65, bodyL / 2 + 0.02);
    group.add(tl);
  });

  // Forward Headlight Beam Projected on Asphalt
  const beamGeo = new THREE.PlaneGeometry(3.6, 16);
  const beamMat = new THREE.MeshBasicMaterial({
    map: headlightBeamTexture,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const headlightBeam = new THREE.Mesh(beamGeo, beamMat);
  headlightBeam.rotation.x = -Math.PI / 2;
  headlightBeam.position.set(0, 0.04, -bodyL / 2 - 8);
  group.add(headlightBeam);

  // If vehicle moves in direction +1 (southbound / facing positive Z), rotate group 180°
  if (direction > 0) {
    group.rotation.y = Math.PI;
  }

  return group;
}

// ==========================================
// 5. ANIMATED 3D FIRST-PERSON SNEAKERS
// ==========================================

function buildAnimatedShoes() {
  const shoeGroup = new THREE.Group();
  cameraRig.add(shoeGroup);

  const soleMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3 });
  const fabricMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 }); // Navy/black runner
  const accentMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 }); // Cyan neon stripe

  function makeShoe(isRight) {
    const s = new THREE.Group();

    // Rubber sole
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.42), soleMat);
    sole.position.y = 0.04;
    s.add(sole);

    // Shoe upper fabric
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.14, 0.38), fabricMat);
    upper.position.set(0, 0.13, -0.02);
    s.add(upper);

    // Ankle cuff
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.12, 10), fabricMat);
    cuff.position.set(0, 0.22, 0.05);
    s.add(cuff);

    // Neon brand streak
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.182, 0.02, 0.24), accentMat);
    stripe.position.set(0, 0.12, -0.02);
    s.add(stripe);

    s.position.set(isRight ? 0.22 : -0.22, 0, -0.45);
    return s;
  }

  leftShoe = makeShoe(false);
  rightShoe = makeShoe(true);
  shoeGroup.add(leftShoe);
  shoeGroup.add(rightShoe);
}

// ==========================================
// 6. ATMOSPHERIC TWILIGHT DUST PARTICLES
// ==========================================

let dustParticles;
function buildAtmosphericParticles() {
  const count = 400;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 60;
    positions[i * 3 + 1] = 0.5 + Math.random() * 8;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 120;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xffeedd,
    size: 0.12,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending
  });

  dustParticles = new THREE.Points(geo, mat);
  scene.add(dustParticles);
}

function buildDreamAtmosphere(){
  // Soft suspended light orbs and overhead haze give depth without external assets.
  const glowMat=new THREE.MeshBasicMaterial({color:0xffd8bd,transparent:true,opacity:.18,blending:THREE.AdditiveBlending,depthWrite:false});
  for(let i=0;i<34;i++){ const m=new THREE.Mesh(new THREE.SphereGeometry(.12+Math.random()*.22,10,8),glowMat.clone()); m.position.set((Math.random()-.5)*38,2+Math.random()*12,-Math.random()*520); m.scale.setScalar(1+Math.random()*2.5); scene.add(m); }
  const moon=new THREE.Mesh(new THREE.CircleGeometry(7,40),new THREE.MeshBasicMaterial({color:0xffd6bd,transparent:true,opacity:.55,depthWrite:false})); moon.position.set(-55,48,-220); scene.add(moon);
}

// ==========================================
// 7. INPUT CONTROLS (WAY TO GO NAVIGATION)
// ==========================================

function initInputControllers() {
  // Looking is allowed, but locomotion is deliberately NOT mapped to mouse or keyboard.
  const onPointerDown = (e) => { isDraggingLook = true; lastPointerX = e.clientX || 0; lastPointerY = e.clientY || 0; ensureAudio(); };
  const onPointerMove = (e) => {
    if (!isDraggingLook || viewMode === "cardboard") return;
    const x=e.clientX||0, y=e.clientY||0;
    lookYaw -= (x-lastPointerX)*0.0035; lookPitch -= (y-lastPointerY)*0.0028;
    lookPitch=Math.max(-1.2,Math.min(1.2,lookPitch)); lastPointerX=x; lastPointerY=y;
  };
  window.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", ()=>isDraggingLook=false);

  soundButton?.addEventListener("click",()=>{ ensureAudio(); soundEnabled=!soundEnabled; if(ambientGain) ambientGain.gain.setTargetAtTime(soundEnabled?0.35:0,audioCtx.currentTime,0.1); soundIcon.textContent=soundEnabled?"🔊":"🔇"; soundLabel.textContent=soundEnabled?"Sound on":"Sound"; });
  fullscreenButton?.addEventListener("click",()=>{ if(!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.(); });
}

function updateTargetSpeed() { /* locomotion is gesture-controlled only */ }

function initViewModeChooser(){
  normalModeButton?.addEventListener("click",()=>startExperience("normal"));
  cardboardModeButton?.addEventListener("click",()=>startExperience("cardboard"));
  motionButton?.addEventListener("click", enableDeviceOrientation);
}

async function startExperience(mode){
  viewMode=mode; document.body.classList.add("experience-started"); document.body.classList.toggle("cardboard",mode==="cardboard");
  modeEl.textContent=mode==="cardboard"?"CARDBOARD":"NORMAL";
  if(mode==="cardboard"){
    if(screen.orientation?.lock){ try{ await screen.orientation.lock("landscape"); }catch{} }
    if(isPhone) await enableDeviceOrientation();
  }
  onResize();
}

async function enableDeviceOrientation(){
  try{
    if(typeof DeviceOrientationEvent!=="undefined" && typeof DeviceOrientationEvent.requestPermission==="function"){
      const state=await DeviceOrientationEvent.requestPermission(); if(state!=="granted") throw new Error("permission denied");
    }
    window.addEventListener("deviceorientation",onDeviceOrientation,true); deviceOrientationEnabled=true; motionButton.hidden=true;
  }catch{ motionButton.hidden=false; }
}

const zee=new THREE.Vector3(0,0,1), euler=new THREE.Euler(), q0=new THREE.Quaternion(), q1=new THREE.Quaternion(-Math.sqrt(.5),0,0,Math.sqrt(.5));
function onDeviceOrientation(ev){
  if(viewMode!=="cardboard") return;
  const alpha=THREE.MathUtils.degToRad(ev.alpha||0), beta=THREE.MathUtils.degToRad(ev.beta||0), gamma=THREE.MathUtils.degToRad(ev.gamma||0);
  const orient=THREE.MathUtils.degToRad(screen.orientation?.angle||window.orientation||0);
  euler.set(beta,alpha,-gamma,"YXZ"); camera.quaternion.setFromEuler(euler); camera.quaternion.multiply(q1); camera.quaternion.multiply(q0.setFromAxisAngle(zee,-orient));
}

// ==========================================
// 8. WEB AUDIO SOUNDSCAPE (Zero External Dependencies)
// ==========================================

function ensureAudio() {
  if (audioCtx) {
    if (audioCtx.state === "suspended") audioCtx.resume();
    return;
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  audioCtx = new AudioContext();

  // Urban city background hum (filtered pink noise generator)
  const bufferSize = audioCtx.sampleRate * 2;
  const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04;
    b6 = white * 0.115926;
  }

  const whiteNoise = audioCtx.createBufferSource();
  whiteNoise.buffer = noiseBuffer;
  whiteNoise.loop = true;

  const filter = audioCtx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 450;

  ambientGain = audioCtx.createGain();
  ambientGain.gain.value = soundEnabled ? 0.35 : 0;

  whiteNoise.connect(filter);
  filter.connect(ambientGain);
  ambientGain.connect(audioCtx.destination);
  whiteNoise.start(0);
}

function playFootstepAudio(stridePhase) {
  if (!audioCtx || !soundEnabled || Math.abs(currentSpeed) < 0.2) return;
  const now = audioCtx.currentTime;
  if (now - lastStepTime < 0.28) return;
  lastStepTime = now;

  // Soft gravel / asphalt scuff
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(80 + Math.random() * 25, now);
  osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

  gain.gain.setValueAtTime(currentSpeed > 5 ? 0.25 : 0.14, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.09);
}

// ==========================================
// 9. ANIMATION LOOP & PHYSICS UPDATE
// ==========================================

function render() {
  const dt = Math.min(clock.getDelta(), 0.05);

  // 1. Smooth Locomotion Acceleration (Way to Go momentum)
  currentSpeed = THREE.MathUtils.damp(currentSpeed, targetSpeed, 4.5, dt);

  lateralPosition = THREE.MathUtils.damp(lateralPosition, targetLateral, 5.0, dt);

  // Advance Camera Rig Forward along Z
  cameraRig.position.z -= currentSpeed * dt;
  cameraRig.position.x = lateralPosition;

  // 2. Camera 360 Look Rotation
  if (!(viewMode === "cardboard" && deviceOrientationEnabled)) { headGroup.rotation.y = lookYaw; camera.rotation.x = lookPitch; }

  // Dynamic FOV Rush when Running
  const targetFov = 72 + Math.min(Math.max(currentSpeed - 3.4, 0) / 3.8, 1) * 8;
  camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 3.0, dt);
  camera.updateProjectionMatrix();

  // 3. Rhythmic Head Bobbing & Footsteps
  const walkTime = performance.now() * 0.005;
  const stepRate = currentSpeed > 4.5 ? 9.2 : 6.8;
  const strideCycle = Math.sin(walkTime * stepRate);
  const velocityNorm = Math.min(Math.abs(currentSpeed) / 7.2, 1.0);

  // Head Bob (Lissajous figure-8 gait bob)
  const bobY = Math.abs(strideCycle) * 0.045 * velocityNorm;
  const swayX = Math.cos(walkTime * stepRate * 0.5) * 0.02 * velocityNorm;
  headGroup.position.y = 1.68 + bobY;
  headGroup.position.x = swayX;

  // 4. Animated 3D Sneakers
  if (leftShoe && rightShoe) {
    const footSwing = Math.sin(walkTime * stepRate) * 0.35 * velocityNorm;
    leftShoe.position.z = -0.45 + footSwing * 0.25;
    rightShoe.position.z = -0.45 - footSwing * 0.25;
    leftShoe.position.y = Math.max(0, footSwing * 0.12);
    rightShoe.position.y = Math.max(0, -footSwing * 0.12);
    leftShoe.rotation.x = footSwing * 0.3;
    rightShoe.rotation.x = -footSwing * 0.3;
  }

  // Trigger footstep sound at bottom of stride
  if (velocityNorm > 0.1 && strideCycle < -0.85) {
    playFootstepAudio(strideCycle);
  }

  // 5. Infinite Highway Streaming Chunks
  const playerZ = cameraRig.position.z;
  roadChunks.forEach((chunk) => {
    // If chunk falls behind player beyond half total world span, wrap it forward
    if (chunk.position.z - playerZ > CHUNK_SIZE) {
      chunk.position.z -= TOTAL_WORLD_SPAN;
    } else if (chunk.position.z - playerZ < -TOTAL_WORLD_SPAN + CHUNK_SIZE) {
      chunk.position.z += TOTAL_WORLD_SPAN;
    }
  });

  // 6. Dynamic Traffic Simulation
  trafficVehicles.forEach((v) => {
    // Move according to lane direction and vehicle speed
    v.position.z += v.userData.dir * v.userData.speed * dt;

    // Keep traffic centered within the streaming chunk radius around the player
    const relZ = v.position.z - playerZ;
    if (relZ > CHUNK_SIZE * 1.5) {
      v.position.z -= TOTAL_WORLD_SPAN * 0.75;
    } else if (relZ < -CHUNK_SIZE * 1.5) {
      v.position.z += TOTAL_WORLD_SPAN * 0.75;
    }
  });

  // 7. Update HUD Telemetry
  updateHUDTelemetry();

  // 8. Render Frame
  if (viewMode === "cardboard") stereoEffect.render(scene, camera); else renderer.render(scene, camera);
}

function updateHUDTelemetry() {
  const kmh = Math.abs(currentSpeed * 3.6).toFixed(1);
  speedValueEl.textContent = `${kmh} km/h`;
  const pct = Math.min((Math.abs(currentSpeed) / PACE.RUN) * 100, 100);
  speedBarFillEl.style.width = `${pct}%`;

  if (Math.abs(currentSpeed) < 0.2) {
    paceStatusEl.textContent = "IDLE";
    paceStatusEl.style.color = "#94a3b8";
  } else if (currentSpeed > 4.5) {
    paceStatusEl.textContent = "SPRINTING";
    paceStatusEl.style.color = "#f43f5e";
  } else {
    paceStatusEl.textContent = "WALKING";
    paceStatusEl.style.color = "#38bdf8";
  }
}

// ==========================================
// 10. LOCAL GESTURE LOCOMOTION
// ==========================================
function applyGesture(gesture) {
  if (gesture === "MOVE_FORWARD") { targetSpeed=PACE.WALK; gestureEl.textContent="👍 + 👍  FORWARD"; gestureEl.style.color="#fff"; }
  else { targetSpeed=PACE.IDLE; gestureEl.textContent="SHOW 👍 + 👍"; gestureEl.style.color="rgba(255,255,255,.7)"; }
}

// ==========================================
// 11. LAPTOP HAND GESTURE TRACKING
// ==========================================

function setupLaptopControls() {
  if (cameraButton) {
    cameraButton.addEventListener("click", startHandTracking);
  }
}

async function startHandTracking() {
  if (!Hands || !Camera) {
    cameraButton.textContent = "MediaPipe library not loaded";
    return;
  }

  cameraButton.disabled = true;
  cameraButton.textContent = "Starting camera…";

  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${file}`
  });

  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.55
  });

  hands.onResults((results) => {
    drawHands(results);

    const count = results.multiHandLandmarks?.length || 0;
    const bothThumbs = count === 2 && results.multiHandLandmarks.every(isThumbRaised);

    if (bothThumbs) {
      sendGesture("MOVE_FORWARD");
      document.querySelector("#handStatus").textContent = "Both thumbs detected — WALK";
    } else {
      sendGesture("STOP");
      document.querySelector("#handStatus").textContent = count ? `${count} hand(s) detected — show thumbs` : "Show both thumbs to walk";
    }
  });

  const mpCamera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: 640,
    height: 480
  });

  try {
    await mpCamera.start();
    cameraButton.textContent = "Camera Active";
  } catch (error) {
    console.error(error);
    cameraButton.disabled = false;
    cameraButton.textContent = "Camera permission failed — retry";
  }
}

function isThumbRaised(lm) {
  return lm[4].y < lm[3].y && lm[3].y < lm[2].y;
}

function isOpenPalm(lm) {
  // All fingertips above MCP joints
  return lm[8].y < lm[6].y && lm[12].y < lm[10].y && lm[16].y < lm[14].y && lm[20].y < lm[18].y;
}

let lastSentGesture = null;
function sendGesture(gesture) {
  if (gesture === lastSentGesture) return;
  lastSentGesture = gesture;

  applyGesture(gesture);
}

function drawHands(results) {
  if (!handCanvas || !handCtx) return;
  handCanvas.width = video.videoWidth || 640;
  handCanvas.height = video.videoHeight || 480;
  handCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);

  for (const landmarks of results.multiHandLandmarks || []) {
    handCtx.fillStyle = "#38bdf8";
    for (const p of landmarks) {
      handCtx.beginPath();
      handCtx.arc(p.x * handCanvas.width, p.y * handCanvas.height, 3.5, 0, Math.PI * 2);
      handCtx.fill();
    }
  }
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  stereoEffect?.setSize(innerWidth, innerHeight);
}