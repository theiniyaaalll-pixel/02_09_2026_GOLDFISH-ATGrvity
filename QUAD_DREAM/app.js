/**
 * AR Quad Perspective Filter Application
 * Powered by MediaPipe Hands & WebGL Shaders
 */

(function () {
  // DOM Elements
  const videoElement = document.getElementById('webcam-video');
  const canvasElement = document.getElementById('gl-canvas');
  const statusHands = document.getElementById('status-hands');
  const fpsDisplay = document.getElementById('fps-counter');
  const centerPrompt = document.getElementById('center-prompt');
  const toastElement = document.getElementById('toast');
  const currentThemeTag = document.getElementById('current-theme-tag');
  const colorSwatchA = document.getElementById('swatch-a');
  const colorSwatchB = document.getElementById('swatch-b');

  const btnDualTone = document.getElementById('btn-duotone');
  const btnCartoon = document.getElementById('btn-cartoon');
  const btnDreamy = document.getElementById('btn-dreamy');
  const btnShuffle = document.getElementById('btn-shuffle');
  const btnRandomize = document.getElementById('btn-randomize');
  const btnSnapshot = document.getElementById('btn-snapshot');
  const btnMirror = document.getElementById('btn-mirror');

  // App State
  let pipeline = null;
  let isMirrored = true;
  let activeMode = 'shuffle'; // 'dual-tone', 'cartoon', or 'shuffle'
  let currentTheme = 'dual-tone';
  let quadDetected = false;
  let wasQuadDetected = false;

  // Smoothed quad coordinates
  let smoothedCorners = null;
  const SMOOTH_ALPHA = 0.35; // Lower = smoother, Higher = snappier

  // FPS tracking
  let frameCount = 0;
  let lastFpsTime = performance.now();
  let currentFps = 0;

  // Curated Color Palettes for Dual-Tone & Halftone
  const PALETTES = [
    //{ name: 'Cyberpunk Neon', dark: [0.05, 0.01, 0.13], light: [0.0, 0.94, 1.0], hexA: '#0d0221', hexB: '#00f0ff' },
    { name: 'Crimson Noir', dark: [0.04, 0.0, 0.02], light: [1.0, 0.08, 0.28], hexA: '#0a0005', hexB: '#ff1447' },
    { name: 'Pop-Art Risograph', dark: [0.09, 0.0, 0.68], light: [1.0, 0.9, 0.0], hexA: '#1800ad', hexB: '#ffe600' },
    { name: 'Acid Matrix', dark: [0.02, 0.08, 0.04], light: [0.06, 1.0, 0.55], hexA: '#05140a', hexB: '#10ff8c' },
    { name: 'Sunset Tangerine', dark: [0.04, 0.07, 0.17], light: [1.0, 0.42, 0.2], hexA: '#0b132b', hexB: '#ff6b35' },
    { name: 'Vapor Bubblegum', dark: [0.1, 0.02, 0.16], light: [1.0, 0.44, 0.81], hexA: '#1a0528', hexB: '#ff71ce' },
    { name: 'Electric Gold', dark: [0.05, 0.05, 0.07], light: [1.0, 0.82, 0.1], hexA: '#0d0d12', hexB: '#ffd01a' },
    //{ name: 'Vintage Comic Monochrome', dark: [0.02, 0.02, 0.03], light: [0.96, 0.96, 0.94], hexA: '#050508', hexB: '#f5f5f0' }
  ];

  const ANIMATED_PRESETS = [
    { name: 'Studio Ghibli Sunlight', edgeThresh: 0.24, edgeThick: 1.1, vibrance: 1.35, warmth: 1.12, swatchA: '#ffeaa7', swatchB: '#55efc4' },
    //{ name: 'Makoto Shinkai Twilight', edgeThresh: 0.20, edgeThick: 1.25, vibrance: 1.5, warmth: 0.96, swatchA: '#a29bfe', swatchB: '#fd79a8' },
    //{ name: 'Kyoto Pastel Cel', edgeThresh: 0.26, edgeThick: 1.0, vibrance: 1.28, warmth: 1.05, swatchA: '#fab1a0', swatchB: '#ffeaa7' },
    //{ name: 'Cyber Anime Neon', edgeThresh: 0.18, edgeThick: 1.4, vibrance: 1.65, warmth: 1.0, swatchA: '#00cec9', swatchB: '#d11470ff' },
    //{ name: 'Watercolor Canvas Anime', edgeThresh: 0.28, edgeThick: 0.9, vibrance: 1.4, warmth: 1.15, swatchA: '#e17055', swatchB: '#fdcb6e' }
  ];

  // Dreamy Bloom & Sunlight Long Exposure Presets
  const DREAMY_PRESETS = [
    {
      name: 'Golden Sunlight Exposure',
      decay: 0.90,                     // High long exposure persistence
      bloom: 2.8,                      // High bloom radiance
      whiteThresh: 0.35,               // High white light sensitivity
      sunlightTint: [1.0, 0.82, 0.48], // Warm golden sunlight tint
      sunIntensity: 0.98,
      swatchA: '#ffb703',
      swatchB: '#fff3b0'
    },
    {
      name: 'Celestial White Overexposure',
      decay: 0.88,                     // High long exposure persistence
      bloom: 3.4,                      // Very high white light glow
      whiteThresh: 0.28,               // Ultra luminous white highlights
      sunlightTint: [1.0, 0.96, 0.88], // Brilliant solar white glow
      sunIntensity: 0.85,
      swatchA: '#ffffff',
      swatchB: '#ffd166'
    }
  ];

  /* ------------------- Notification Helper ------------------- */
  let toastTimer = null;
  function showToast(message) {
    if (!toastElement) return;
    toastElement.textContent = message;
    toastElement.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastElement.classList.remove('show');
    }, 2400);
  }

  /* ------------------- Filter Randomizer Engine ------------------- */
  function rollRandomTheme(forcedType = null) {
    let type = forcedType;
    if (!type) {
      if (activeMode === 'shuffle') {
        const r = Math.random();
        type = r < 0.33 ? 'dual-tone' : (r < 0.66 ? 'animated' : 'dreamy');
      } else {
        type = activeMode;
      }
    }

    if (type === 'dual-tone') {
      const palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
      pipeline.activeTheme = 'dual-tone';
      pipeline.duotone.colorA = [...palette.dark];
      pipeline.duotone.colorB = [...palette.light];
      pipeline.duotone.dotFrequency = 85.0 + Math.random() * 140.0;
      pipeline.duotone.halftoneBlend = 0.85;

      currentThemeTag.textContent = `Dual-Tone • ${palette.name}`;
      colorSwatchA.style.background = palette.hexA;
      colorSwatchB.style.background = palette.hexB;
      colorSwatchB.style.display = 'inline-block';

      showToast(`🎲 Rolled: Dual-Tone • ${palette.name}`);
    } else if (type === 'animated' || type === 'cartoon') {
      const preset = ANIMATED_PRESETS[Math.floor(Math.random() * ANIMATED_PRESETS.length)];
      pipeline.activeTheme = 'animated';
      pipeline.animated.edgeThreshold = preset.edgeThresh;
      pipeline.animated.edgeThickness = preset.edgeThick;
      pipeline.animated.vibrance = preset.vibrance;
      pipeline.animated.warmth = preset.warmth;

      currentThemeTag.textContent = `Animated • ${preset.name}`;
      colorSwatchA.style.background = preset.swatchA;
      colorSwatchB.style.background = preset.swatchB;
      colorSwatchB.style.display = 'inline-block';

      showToast(`✨ Rolled: Animated • ${preset.name}`);
    } else if (type === 'dreamy') {
      const preset = DREAMY_PRESETS[Math.floor(Math.random() * DREAMY_PRESETS.length)];
      pipeline.activeTheme = 'dreamy';
      pipeline.firstAccumFrame = true;
      pipeline.dreamy.exposureDecay = preset.decay;
      pipeline.dreamy.bloomIntensity = preset.bloom;
      pipeline.dreamy.whiteThreshold = preset.whiteThresh;
      pipeline.dreamy.sunlightTint = [...preset.sunlightTint];
      pipeline.dreamy.sunIntensity = preset.sunIntensity;

      currentThemeTag.textContent = `Dreamy Bloom • ${preset.name}`;
      colorSwatchA.style.background = preset.swatchA;
      colorSwatchB.style.background = preset.swatchB;
      colorSwatchB.style.display = 'inline-block';

      showToast(`☀️ Rolled: Dreamy Bloom • ${preset.name}`);
    }
  }

  /* ------------------- Quad Coordinate Smoothing ------------------- */
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpPoint(pPrev, pCurr, t) {
    return {
      x: lerp(pPrev.x, pCurr.x, t),
      y: lerp(pPrev.y, pCurr.y, t)
    };
  }

  function smoothQuad(target) {
    if (!smoothedCorners) {
      smoothedCorners = {
        p0: { ...target.p0 },
        p1: { ...target.p1 },
        p2: { ...target.p2 },
        p3: { ...target.p3 }
      };
      return smoothedCorners;
    }

    smoothedCorners.p0 = lerpPoint(smoothedCorners.p0, target.p0, SMOOTH_ALPHA);
    smoothedCorners.p1 = lerpPoint(smoothedCorners.p1, target.p1, SMOOTH_ALPHA);
    smoothedCorners.p2 = lerpPoint(smoothedCorners.p2, target.p2, SMOOTH_ALPHA);
    smoothedCorners.p3 = lerpPoint(smoothedCorners.p3, target.p3, SMOOTH_ALPHA);

    return smoothedCorners;
  }

  /* ------------------- MediaPipe Hand Processing ------------------- */
  function toScreen(lm) {
    return {
      x: isMirrored ? (1.0 - lm.x) : lm.x,
      y: lm.y
    };
  }

  function onResults(results) {
    const multiHandLandmarks = results.multiHandLandmarks;

    if (multiHandLandmarks && multiHandLandmarks.length >= 2) {
      // Two hands detected! Sort hands horizontally in screen space
      const handA = multiHandLandmarks[0];
      const handB = multiHandLandmarks[1];

      // Hand screen centers (wrist + middle mcp)
      const hAScreenX = (toScreen(handA[0]).x + toScreen(handA[9]).x) * 0.5;
      const hBScreenX = (toScreen(handB[0]).x + toScreen(handB[9]).x) * 0.5;

      let leftHandOnScreen, rightHandOnScreen;
      if (hAScreenX < hBScreenX) {
        leftHandOnScreen = handA;
        rightHandOnScreen = handB;
      } else {
        leftHandOnScreen = handB;
        rightHandOnScreen = handA;
      }

      // Corners mapped directly in Screen Space:
      // Left Hand on screen: Index Tip (8) -> Top-Left (P0), Thumb Tip (4) -> Bottom-Left (P3)
      // Right Hand on screen: Index Tip (8) -> Top-Right (P1), Thumb Tip (4) -> Bottom-Right (P2)
      const rawQuad = {
        p0: toScreen(leftHandOnScreen[8]),
        p1: toScreen(rightHandOnScreen[8]),
        p2: toScreen(rightHandOnScreen[4]),
        p3: toScreen(leftHandOnScreen[4])
      };

      smoothQuad(rawQuad);
      quadDetected = true;

      // When quad newly emerges, trigger automatic roll if in shuffle mode
      if (!wasQuadDetected) {
        if (activeMode === 'shuffle') {
          rollRandomTheme();
        }
      }
    } else if (multiHandLandmarks && multiHandLandmarks.length === 1) {
      // Single hand gesture fallback (thumb, index, ring, pinky span)
      const hand = multiHandLandmarks[0];
      const pIndex = toScreen(hand[8]);
      const pMiddle = toScreen(hand[12]);
      const pPinky = toScreen(hand[20]);
      const pThumb = toScreen(hand[4]);

      const rawQuad = {
        p0: pIndex,
        p1: pMiddle,
        p2: pPinky,
        p3: pThumb
      };

      // Check spread distance to avoid accidental quad
      const span = Math.hypot(rawQuad.p0.x - rawQuad.p2.x, rawQuad.p0.y - rawQuad.p2.y);
      if (span > 0.18) {
        smoothQuad(rawQuad);
        quadDetected = true;
      } else {
        quadDetected = false;
        smoothedCorners = null;
      }
    } else {
      quadDetected = false;
      smoothedCorners = null;
    }

    wasQuadDetected = quadDetected;

    // Update UI status
    if (statusHands) {
      if (quadDetected) {
        statusHands.classList.add('active');
        statusHands.querySelector('.text').textContent = 'Quad Locked';
      } else {
        statusHands.classList.remove('active');
        statusHands.querySelector('.text').textContent = 'Raise 2 Hands';
      }
    }

    if (centerPrompt) {
      if (quadDetected) {
        centerPrompt.classList.add('hidden');
      } else {
        centerPrompt.classList.remove('hidden');
      }
    }
  }

  /* ------------------- Render & Processing Loop ------------------- */
  async function renderLoop() {
    // WebGL frame render
    if (pipeline && videoElement.readyState >= 2) {
      pipeline.render(videoElement, quadDetected ? smoothedCorners : null);
    }

    // FPS calculation
    frameCount++;
    const now = performance.now();
    if (now - lastFpsTime >= 1000) {
      currentFps = Math.round((frameCount * 1000) / (now - lastFpsTime));
      fpsDisplay.textContent = `${currentFps} FPS`;
      frameCount = 0;
      lastFpsTime = now;
    }

    requestAnimationFrame(renderLoop);
  }

  /* ------------------- Camera & MediaPipe Initialization ------------------- */
  async function initCameraAndHands() {
    try {
      // 1. Initialize WebGL Pipeline
      pipeline = new GLPipeline(canvasElement);

      // 2. Initialize MediaPipe Hands
      const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
      });

      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55
      });

      hands.onResults(onResults);

      // 3. Request User Webcam
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      });

      videoElement.srcObject = stream;
      await videoElement.play();

      // Mirror setting synced to WebGL pipeline
      if (pipeline) pipeline.isMirrored = isMirrored;

      // 4. Start detection loop with CameraUtils
      const camera = new Camera(videoElement, {
        onFrame: async () => {
          await hands.send({ image: videoElement });
        },
        width: 1280,
        height: 720
      });
      camera.start();

      // Start render loop
      requestAnimationFrame(renderLoop);

      // Initial roll
      rollRandomTheme();

    } catch (err) {
      console.error('Initialization error:', err);
      alert('Camera access or WebGL initialization failed. Please allow camera permissions and reload: ' + err.message);
    }
  }

  /* ------------------- UI Controls & Hotkeys ------------------- */
  function setActiveMode(mode) {
    activeMode = mode;
    btnDualTone.classList.toggle('active', mode === 'dual-tone');
    if (btnCartoon) btnCartoon.classList.toggle('active', mode === 'animated');
    if (btnDreamy) btnDreamy.classList.toggle('active', mode === 'dreamy');
    btnShuffle.classList.toggle('active', mode === 'shuffle');

    if (mode === 'dual-tone') {
      rollRandomTheme('dual-tone');
    } else if (mode === 'animated') {
      rollRandomTheme('animated');
    } else if (mode === 'dreamy') {
      rollRandomTheme('dreamy');
    } else {
      rollRandomTheme();
    }
  }

  // Button Listeners
  btnDualTone.addEventListener('click', () => setActiveMode('dual-tone'));
  if (btnCartoon) btnCartoon.addEventListener('click', () => setActiveMode('animated'));
  if (btnDreamy) btnDreamy.addEventListener('click', () => setActiveMode('dreamy'));
  btnShuffle.addEventListener('click', () => setActiveMode('shuffle'));
  btnRandomize.addEventListener('click', () => rollRandomTheme());

  // Mirror toggle
  btnMirror.addEventListener('click', () => {
    isMirrored = !isMirrored;
    if (pipeline) pipeline.isMirrored = isMirrored;
    showToast(isMirrored ? 'Camera Mirrored' : 'Camera Normal');
  });

  // Snapshot capture
  btnSnapshot.addEventListener('click', () => {
    try {
      const dataUrl = canvasElement.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `ar-quad-filter-${Date.now()}.png`;
      a.click();
      showToast('📸 Snapshot Saved to Downloads!');
    } catch (err) {
      showToast('Error saving snapshot');
    }
  });

  // Hotkeys: 1: Dual-Tone, 2: Animated, 3: Dreamy Bloom, 4: Auto-Roll, Space: Randomize
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      rollRandomTheme();
    } else if (e.key === '1') {
      setActiveMode('dual-tone');
    } else if (e.key === '2') {
      setActiveMode('animated');
    } else if (e.key === '3') {
      setActiveMode('dreamy');
    } else if (e.key === '4') {
      setActiveMode('shuffle');
    }
  });

  // Window resize handler
  window.addEventListener('resize', () => {
    if (pipeline) {
      canvasElement.width = window.innerWidth;
      canvasElement.height = window.innerHeight;
    }
  });

  // Start app
  window.addEventListener('DOMContentLoaded', initCameraAndHands);
})();
