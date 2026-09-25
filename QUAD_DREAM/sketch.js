/*
 * Dreamscape Long-Exposure Camera - Light Streak & Light Painting Edition
 * Recreates the exact incandescent golden light ribbons, fiber-optic trails, and sunlight glow.
 *
 * Features:
 * - When still: Crystal-clear face bathed in natural golden sunlight and warm yellow tint.
 * - When moving: Illuminates the scene with blazing golden-white light streaks, flowing silk ribbons,
 *   and glowing light trails matching the reference photograph.
 */

let video;
let videoLoaded = false;
let isMirrored = true;

// High-Definition Processing Buffer Resolution (1280x720 HD)
let procW = 1280;
let procH = 720;

// Offscreen Graphics Buffers
let rawGfx;           // Raw mirrored video frame
let liveGfx;          // Current frame with golden sunlight & clarity grading
let brightMaskGfx;    // High-pass specular highlight & bright contour mask
let prevBrightGfx;    // Previous highlight mask for smooth stroke interpolation
let streakGfx;        // Persistent light painting / light ribbon accumulation buffer
let bloomGfx;         // Optical bloom buffer for light radiance
let finalGfx;         // Final composited output
let prevSmallGfx;     // Motion detection buffer

// Motion Tracking State
let motionLevel = 0;
let smoothedMotion = 0;
let motionCenter = { x: 0, y: 0, prevX: 0, prevY: 0, vx: 0, vy: 0 };

// Settings
let settings = {
  exposureMode: 'lightStreak', // 'lightStreak' (Light Painting from reference photo) or 'strobeEcho'
  streakPersistence: 0.94,     // How long light streaks linger (0.80 = short, 0.98 = long glowing ribbons)
  streakSensitivity: 0.55,     // Sensitivity to bright highlights / reflections (0.2 to 0.9)
  streakIntensity: 1.2,        // Brightness of the light streaks
  sunlightWarmth: 0.85,        // Golden sunlight & yellow tint intensity
  dreamGlow: 0.40,             // Optical bloom around light ribbons & face
  trailClarity: 1.25,          // Edge definition and micro-contrast
  displayMode: 'full',         // 'full' (Fullscreen cover) or 'lens' (Vintage oval)
  filmGrain: 0.04,             // Subtle analog 35mm grain
  brightness: 1.02,
  contrast: 1.15
};

// Ghost Echo Ring Buffer for Strobe Mode
const MAX_HISTORY = 60;
let frameHistory = [];
let historyIndex = 0;

// UI State
let isUiVisible = true;

function setup() {
  pixelDensity(1);
  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.parent('canvas-container');

  // Create crisp HD offscreen buffers
  rawGfx = createGraphics(procW, procH);
  liveGfx = createGraphics(procW, procH);
  brightMaskGfx = createGraphics(procW, procH);
  prevBrightGfx = createGraphics(procW, procH);
  streakGfx = createGraphics(procW, procH);
  bloomGfx = createGraphics(Math.floor(procW / 4), Math.floor(procH / 4));
  finalGfx = createGraphics(procW, procH);
  prevSmallGfx = createGraphics(120, 68);

  // Pre-clear light streak buffer to pure transparent black
  streakGfx.background(0);

  // Initialize history ring buffer
  for (let i = 0; i < MAX_HISTORY; i++) {
    frameHistory.push(createGraphics(procW, procH));
  }

  // Start webcam
  startWebcam();

  // Setup UI controls
  setupUI();
}

function startWebcam() {
  let constraints = {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: "user"
    },
    audio: false
  };

  video = createCapture(constraints, () => {
    videoLoaded = true;
    hideLoader();
  });

  video.size(procW, procH);
  video.hide();
}

function hideLoader() {
  let loader = document.getElementById('camera-loader');
  if (loader) loader.classList.add('hidden');
}

function draw() {
  background(8, 6, 4);

  // Check camera status
  if (!videoLoaded) {
    if (video && video.elt && video.elt.videoWidth > 0 && video.elt.readyState >= 2) {
      videoLoaded = true;
      hideLoader();
    } else {
      drawLoadingScreen();
      return;
    }
  }

  // 1. Capture and mirror raw video
  rawGfx.push();
  if (isMirrored) {
    rawGfx.translate(procW, 0);
    rawGfx.scale(-1, 1);
  }
  rawGfx.image(video, 0, 0, procW, procH);
  rawGfx.pop();

  // 2. Measure Motion Level & Motion Centroid
  detectMotion();

  // 3. Render Live Frame with Natural Sunlight, Yellow Tint & Crisp Clarity
  renderSunlightFrame();

  // 4. Extract Bright Highlight Mask (Specular reflections, fingertips, illuminated contours)
  extractBrightHighlights();

  // 5. Update Light Painting / Light Streak Accumulation Buffer
  renderLightStreaks();

  // 6. Composite Scene (Live Face + Glowing Light Ribbons + Bloom)
  compositeScene();

  // 7. Present to Screen (Full Screen Cover)
  presentToScreen();

  // 8. Subtle 35mm film grain
  if (settings.filmGrain > 0) {
    applyFilmGrain();
  }
}

/* --- MOTION DETECTION --- */
function detectMotion() {
  let dw = prevSmallGfx.width;
  let dh = prevSmallGfx.height;

  let currSmall = createGraphics(dw, dh);
  currSmall.image(rawGfx, 0, 0, dw, dh);

  currSmall.loadPixels();
  prevSmallGfx.loadPixels();

  let diff = 0;
  let count = dw * dh;
  let step = 4 * 2;
  let motionPixelsX = 0;
  let motionPixelsY = 0;
  let motionPixelsCount = 0;

  if (prevSmallGfx.pixels.length === currSmall.pixels.length && prevSmallGfx.pixels.length > 0) {
    for (let i = 0; i < currSmall.pixels.length; i += step) {
      let rDiff = Math.abs(currSmall.pixels[i] - prevSmallGfx.pixels[i]);
      let gDiff = Math.abs(currSmall.pixels[i + 1] - prevSmallGfx.pixels[i + 1]);
      let bDiff = Math.abs(currSmall.pixels[i + 2] - prevSmallGfx.pixels[i + 2]);
      let pixelDiff = rDiff + gDiff + bDiff;
      diff += pixelDiff;

      if (pixelDiff > 40) {
        let pxIndex = Math.floor(i / 4);
        let px = pxIndex % dw;
        let py = Math.floor(pxIndex / dw);
        motionPixelsX += px;
        motionPixelsY += py;
        motionPixelsCount++;
      }
    }
    let avgDiff = diff / (count * 1.5);
    motionLevel = constrain(map(avgDiff, 2.0, 28, 0, 1), 0, 1);

    if (motionPixelsCount > 10) {
      motionCenter.prevX = motionCenter.x;
      motionCenter.prevY = motionCenter.y;
      motionCenter.x = (motionPixelsX / motionPixelsCount) * (procW / dw);
      motionCenter.y = (motionPixelsY / motionPixelsCount) * (procH / dh);
      motionCenter.vx = motionCenter.x - motionCenter.prevX;
      motionCenter.vy = motionCenter.y - motionCenter.prevY;
    }
  }

  // Smooth the motion response
  if (motionLevel > smoothedMotion) {
    smoothedMotion = lerp(smoothedMotion, motionLevel, 0.45);
  } else {
    smoothedMotion = lerp(smoothedMotion, motionLevel, 0.08);
  }

  prevSmallGfx.image(currSmall, 0, 0);
  currSmall.remove();
}

/* --- NATURAL SUNLIGHT, YELLOW TINT & CRISP CLARITY --- */
function renderSunlightFrame() {
  let ctx = liveGfx.drawingContext;
  ctx.save();
  ctx.clearRect(0, 0, procW, procH);

  let totalContrast = settings.contrast * settings.trailClarity;
  let sep = 0.22 * settings.sunlightWarmth;
  let sat = 1.0 + 0.22 * settings.sunlightWarmth;
  let hue = -5 * settings.sunlightWarmth;
  let bri = settings.brightness;

  ctx.filter = `brightness(${bri}) contrast(${totalContrast}) saturate(${sat}) sepia(${sep}) hue-rotate(${hue}deg)`;
  ctx.drawImage(rawGfx.canvas, 0, 0);

  // Soft natural golden sunlight glaze over skin & highlights
  if (settings.sunlightWarmth > 0.05) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = `rgba(255, 205, 95, ${settings.sunlightWarmth * 0.25})`;
    ctx.fillRect(0, 0, procW, procH);

    // Directional sunlight streaming from top right
    let sunGrad = ctx.createLinearGradient(procW * 0.9, 0, 0, procH);
    sunGrad.addColorStop(0, `rgba(255, 230, 140, ${settings.sunlightWarmth * 0.22})`);
    sunGrad.addColorStop(0.6, `rgba(240, 180, 80, ${settings.sunlightWarmth * 0.10})`);
    sunGrad.addColorStop(1, `rgba(180, 110, 40, 0.03)`);
    ctx.fillStyle = sunGrad;
    ctx.fillRect(0, 0, procW, procH);
  }

  ctx.restore();

  // Save into history ring buffer
  let slot = frameHistory[historyIndex % MAX_HISTORY];
  slot.image(liveGfx, 0, 0, procW, procH);
  historyIndex++;
}

/* --- EXTRACT BRIGHT HIGHLIGHTS & ILLUMINATED CONTOURS --- */
function extractBrightHighlights() {
  let ctx = brightMaskGfx.drawingContext;
  ctx.save();
  ctx.clearRect(0, 0, procW, procH);

  // High-pass threshold filter:
  // Isolate specular skin highlights, fingernails, knuckles, bright reflections, light sources
  let thresholdContrast = map(settings.streakSensitivity, 0.1, 1.0, 3.8, 1.9);
  let thresholdBrightness = map(settings.streakSensitivity, 0.1, 1.0, 0.85, 1.35);

  ctx.filter = `contrast(${thresholdContrast}) brightness(${thresholdBrightness}) grayscale(0.5)`;
  ctx.drawImage(rawGfx.canvas, 0, 0);

  // Tint highlights with radiant golden sunlight warmth
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = '#FFE6A0';
  ctx.fillRect(0, 0, procW, procH);

  ctx.restore();
}

/* --- LIGHT PAINTING & INCANDESCENT LIGHT STREAK ENGINE --- */
function renderLightStreaks() {
  let ctx = streakGfx.drawingContext;
  ctx.save();

  // 1. Organic Light Decay:
  // Fades previous streaks gently so trails linger as glowing silk ribbons
  let decayRate = map(settings.streakPersistence, 0.70, 0.99, 0.08, 0.012);
  ctx.globalCompositeOperation = 'source-over';
  // Fade to deep rich warm black
  ctx.fillStyle = `rgba(8, 6, 4, ${decayRate})`;
  ctx.fillRect(0, 0, procW, procH);

  // Only paint new light streaks when there is movement!
  // When stationary, no new streaks are drawn and existing streaks gracefully dissolve away,
  // keeping the still face 100% sharp, clean, and clear!
  let motionIntensity = map(smoothedMotion, 0.03, 0.5, 0.0, 1.0);
  motionIntensity = constrain(motionIntensity, 0.0, 1.0);

  if (motionIntensity > 0.01) {
    let streakAlpha = motionIntensity * settings.streakIntensity;

    // PASS 1: Volumetric Golden-Amber Outer Aura
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = streakAlpha * 0.45;
    ctx.filter = 'blur(6px)';
    ctx.drawImage(brightMaskGfx.canvas, 0, 0);

    // PASS 2: Flowing Golden Silk Ribbon Threads (Directional Sub-Frame Interpolation)
    // Between previous frame and current frame, we draw interpolated strokes to guarantee
    // continuous, unbroken fiber-optic light ribbons even during rapid hand movement!
    ctx.globalCompositeOperation = 'lighter';
    ctx.filter = 'none';

    let steps = 4;
    let dx = motionCenter.vx * 0.15;
    let dy = motionCenter.vy * 0.15;

    for (let s = 1; s <= steps; s++) {
      let t = s / steps;
      let interX = dx * t;
      let interY = dy * t;
      let subAlpha = (streakAlpha * 0.35) / steps;

      ctx.globalAlpha = subAlpha;
      ctx.drawImage(brightMaskGfx.canvas, interX, interY);
    }

    // PASS 3: Razor-Sharp Golden Threads (The fine individual light strands from the photo)
    ctx.globalAlpha = streakAlpha * 0.65;
    ctx.drawImage(brightMaskGfx.canvas, 0, 0);

    // PASS 4: Blazing Incandescent White-Gold Core
    ctx.globalAlpha = streakAlpha * 0.50;
    ctx.filter = 'contrast(2.0) brightness(1.3)';
    ctx.drawImage(brightMaskGfx.canvas, 0, 0);
  }

  ctx.restore();

  // Save current bright mask for next frame interpolation
  prevBrightGfx.image(brightMaskGfx, 0, 0);
}

/* --- COMPOSITE SCENE --- */
function compositeScene() {
  let ctx = finalGfx.drawingContext;
  ctx.save();
  ctx.clearRect(0, 0, procW, procH);

  // 1. BASE: Live Camera Frame (YOUR FACE IS ALWAYS CRYSTAL CLEAR & STILL!)
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1.0;
  ctx.drawImage(liveGfx.canvas, 0, 0);

  // 2. LIGHT STREAKS / LIGHT PAINTING OVERLAY
  if (settings.exposureMode === 'lightStreak') {
    // Add the glowing light ribbons on top of the live scene
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.95;
    ctx.drawImage(streakGfx.canvas, 0, 0);

    // Extra highlight radiance for the incandescent white core
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.40 * settings.streakIntensity;
    ctx.drawImage(streakGfx.canvas, 0, 0);

  } else {
    // Stroboscopic Echo Mode (Multi-Exposure Step-Printing)
    renderStrobeGhosts(ctx);
  }

  // 3. OPTICAL BLOOM: Ethereal glow around lights and sunlight
  if (settings.dreamGlow > 0.05) {
    let bCtx = bloomGfx.drawingContext;
    bCtx.save();
    bCtx.clearRect(0, 0, bloomGfx.width, bloomGfx.height);
    bCtx.filter = 'brightness(1.15) contrast(1.25) blur(3px)';
    bCtx.drawImage(finalGfx.canvas, 0, 0, bloomGfx.width, bloomGfx.height);
    bCtx.restore();

    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = settings.dreamGlow * 0.40;
    ctx.filter = 'blur(12px)';
    ctx.drawImage(bloomGfx.canvas, 0, 0, procW, procH);
  }

  // 4. NATURAL SUNBEAM in top corner
  if (settings.sunbeamLight > 0.05) {
    ctx.globalCompositeOperation = 'screen';
    let flareAlpha = settings.sunbeamLight * 0.32;
    let sunRadial = ctx.createRadialGradient(procW * 0.92, procH * 0.08, 10, procW * 0.92, procH * 0.08, procW * 0.7);
    sunRadial.addColorStop(0, `rgba(255, 245, 210, ${flareAlpha * 1.2})`);
    sunRadial.addColorStop(0.25, `rgba(255, 215, 130, ${flareAlpha * 0.6})`);
    sunRadial.addColorStop(0.7, `rgba(235, 175, 75, ${flareAlpha * 0.15})`);
    sunRadial.addColorStop(1, 'rgba(200, 140, 50, 0)');
    ctx.fillStyle = sunRadial;
    ctx.fillRect(0, 0, procW, procH);
  }

  ctx.restore();
}

function renderStrobeGhosts(ctx) {
  let motionAmount = map(smoothedMotion, 0.02, 0.65, 0.0, 1.0);
  motionAmount = constrain(motionAmount, 0.0, 1.0) * settings.shutterTrail;

  if (motionAmount > 0.02) {
    let k = settings.ghostCount || 6;
    let step = settings.ghostSpread || 5;

    let layers = [];
    for (let g = k; g >= 1; g--) {
      let pastIdx = (historyIndex - 1 - (g * step) + MAX_HISTORY * 10) % MAX_HISTORY;
      layers.push({ gfx: frameHistory[pastIdx], age: g });
    }
    layers.push({ gfx: liveGfx, age: 0 });

    for (let i = 0; i < layers.length; i++) {
      let layer = layers[i];
      let alpha;
      if (i === 0) {
        alpha = 1.0;
      } else if (layer.age === 0) {
        alpha = map(motionAmount, 0, 1, 0.95, 0.72);
      } else {
        let rank = layers.length - 1 - i;
        alpha = map(rank, 1, k, 0.62, 0.28) * motionAmount;
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = alpha;
      ctx.drawImage(layer.gfx.canvas, 0, 0);
    }
  }
}

/* --- PRESENTATION TO FULL SCREEN --- */
function presentToScreen() {
  if (settings.displayMode === 'full') {
    // Fullscreen Cover: Fills entire window seamlessly
    let scale = Math.max(width / procW, height / procH);
    let dw = procW * scale;
    let dh = procH * scale;
    let dx = (width - dw) / 2;
    let dy = (height - dh) / 2;

    image(finalGfx, dx, dy, dw, dh);

    // Gentle edge vignette
    let edgeGrad = drawingContext.createRadialGradient(
      width / 2, height / 2, Math.min(width, height) * 0.45,
      width / 2, height / 2, Math.max(width, height) * 0.78
    );
    edgeGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    edgeGrad.addColorStop(1, 'rgba(10, 8, 5, 0.45)');
    drawingContext.fillStyle = edgeGrad;
    drawingContext.fillRect(0, 0, width, height);

  } else {
    // Vintage Oval Lens Mode
    let targetH = height * 0.94;
    let targetW = targetH * 0.75;
    if (targetW > width * 0.92) {
      targetW = width * 0.92;
      targetH = targetW / 0.75;
    }
    let dx = (width - targetW) / 2;
    let dy = (height - targetH) / 2;

    drawingContext.save();
    drawingContext.beginPath();
    drawingContext.ellipse(dx + targetW / 2, dy + targetH / 2, targetW / 2, targetH / 2, 0, 0, TWO_PI);
    drawingContext.clip();

    image(finalGfx, dx, dy, targetW, targetH);

    drawingContext.restore();

    // Golden rim border
    drawingContext.save();
    drawingContext.lineWidth = 8;
    drawingContext.strokeStyle = 'rgba(246, 208, 111, 0.35)';
    drawingContext.beginPath();
    drawingContext.ellipse(dx + targetW / 2, dy + targetH / 2, targetW / 2, targetH / 2, 0, 0, TWO_PI);
    drawingContext.stroke();
    drawingContext.restore();
  }
}

/* --- 35MM FILM GRAIN --- */
function applyFilmGrain() {
  loadPixels();
  let amount = settings.filmGrain * 30;
  let d = pixelDensity();
  let total = 4 * (width * d) * (height * d);
  let step = 4 * 4;

  for (let i = 0; i < total; i += step) {
    let noiseVal = (Math.random() - 0.5) * amount;
    pixels[i]     = constrain(pixels[i] + noiseVal * 1.1, 0, 255);
    pixels[i + 1] = constrain(pixels[i + 1] + noiseVal * 0.95, 0, 255);
    pixels[i + 2] = constrain(pixels[i + 2] + noiseVal * 0.75, 0, 255);
  }
  updatePixels();
}

function drawLoadingScreen() {
  fill(246, 208, 111);
  textAlign(CENTER, CENTER);
  textSize(22);
  textFont('Cinzel, serif');
  text("CONNECTING HD CAMERA...", width / 2, height / 2 - 15);
  textSize(13);
  fill(180, 150, 110);
  text("Click anywhere or allow camera access in your browser", width / 2, height / 2 + 25);
}

function clearStreaks() {
  streakGfx.background(0);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

/* --- UI CONTROLS & BINDINGS --- */
function setupUI() {
  // Streak Persistence / Duration Slider
  bindSlider('persistence-slider', (v) => settings.streakPersistence = v);
  // Streak Sensitivity Slider
  bindSlider('sensitivity-slider', (v) => settings.streakSensitivity = v);
  // Streak Intensity Slider
  bindSlider('intensity-slider', (v) => settings.streakIntensity = v);
  // Sunlight Warmth Slider
  bindSlider('warmth-slider', (v) => settings.sunlightWarmth = v);
  // Dream Glow Slider
  bindSlider('glow-slider', (v) => settings.dreamGlow = v);
  // Clarity & Definition Slider
  bindSlider('clarity-slider', (v) => settings.trailClarity = v);

  // Exposure Mode Toggle (Light Streak vs Strobe Echo)
  const expModeBtn = document.getElementById('mode-streak-btn');
  if (expModeBtn) {
    expModeBtn.addEventListener('click', () => {
      settings.exposureMode = settings.exposureMode === 'lightStreak' ? 'strobeEcho' : 'lightStreak';
      expModeBtn.innerText = settings.exposureMode === 'lightStreak' ? 'Mode: Light Streaks' : 'Mode: Strobe Echo';
      expModeBtn.classList.toggle('active', settings.exposureMode === 'lightStreak');
      clearStreaks();
    });
  }

  // Display Mode Toggle (Fullscreen vs Oval Lens)
  const modeBtn = document.getElementById('mode-toggle-btn');
  if (modeBtn) {
    modeBtn.addEventListener('click', () => {
      settings.displayMode = settings.displayMode === 'full' ? 'lens' : 'full';
      modeBtn.innerText = settings.displayMode === 'full' ? 'Fullscreen' : 'Oval Lens';
    });
  }

  // Clear Streaks Button
  const clearBtn = document.getElementById('clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearStreaks);
  }

  // Mirror Button
  const mirrorBtn = document.getElementById('mirror-btn');
  if (mirrorBtn) {
    mirrorBtn.addEventListener('click', () => {
      isMirrored = !isMirrored;
      mirrorBtn.classList.toggle('active', isMirrored);
    });
  }

  // Sound Button
  const soundBtn = document.getElementById('sound-btn');
  if (soundBtn) {
    soundBtn.addEventListener('click', async () => {
      if (typeof toggleDreamAudio === 'function') {
        let active = await toggleDreamAudio();
        soundBtn.innerText = active ? 'Sound: On' : 'Sound: Off';
        soundBtn.classList.toggle('active', active);
      }
    });
  }

  // Fullscreen Browser Button
  const fullBtn = document.getElementById('fullscreen-btn');
  if (fullBtn) {
    fullBtn.addEventListener('click', toggleBrowserFullscreen);
  }

  // Shutter Button
  const shutterBtn = document.getElementById('shutter-btn');
  if (shutterBtn) {
    shutterBtn.addEventListener('click', takeDreamSnapshot);
  }

  // Hide UI Button
  const hideUiBtn = document.getElementById('hide-ui-btn');
  if (hideUiBtn) {
    hideUiBtn.addEventListener('click', toggleUIVisibility);
  }

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.code === 'Space') {
      takeDreamSnapshot();
    } else if (e.key === 'c' || e.key === 'C') {
      clearStreaks();
    } else if (e.key === 'h' || e.key === 'H') {
      toggleUIVisibility();
    } else if (e.key === 'f' || e.key === 'F') {
      toggleBrowserFullscreen();
    }
  });

  window.addEventListener('click', () => {
    if (!videoLoaded && video && video.elt) {
      video.elt.play().catch(() => {});
    }
  });
}

function bindSlider(id, callback) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', (e) => callback(parseFloat(e.target.value)));
  }
}

function toggleBrowserFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

function toggleUIVisibility() {
  isUiVisible = !isUiVisible;
  const panel = document.getElementById('controls-panel');
  const shutter = document.getElementById('shutter-container');
  const header = document.getElementById('header-bar');
  if (panel) panel.classList.toggle('minimized', !isUiVisible);
  if (shutter) shutter.classList.toggle('minimized', !isUiVisible);
  if (header) header.classList.toggle('minimized', !isUiVisible);
}

function takeDreamSnapshot() {
  const flash = document.getElementById('camera-flash');
  if (flash) {
    flash.style.opacity = '1';
    setTimeout(() => { flash.style.opacity = '0'; }, 150);
  }

  let dataUrl = canvas.toDataURL('image/jpeg', 0.95);
  const modal = document.getElementById('polaroid-modal');
  const previewImg = document.getElementById('polaroid-img');
  const downloadLink = document.getElementById('download-polaroid-btn');

  if (modal && previewImg && downloadLink) {
    previewImg.src = dataUrl;
    let timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadLink.href = dataUrl;
    downloadLink.download = `sunlight_light_painting_${timestamp}.jpg`;
    modal.classList.add('visible');
  }
}

function closePolaroidModal() {
  const modal = document.getElementById('polaroid-modal');
  if (modal) modal.classList.remove('visible');
}
