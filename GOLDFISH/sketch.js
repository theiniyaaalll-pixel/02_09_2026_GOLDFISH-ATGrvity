let handPose;
let video;
let hands = [];
let isDetecting = false;
let statusMsg = "Initializing Camera & AI Model...";

// MediaPipe Hands integration
let mpHands = null;
let mpCamera = null;
let mpHandDetected = false;
let mpTargetNormalized = null;

// Fish target position
let targetX = 0;
let targetY = 0;

// Fish constants
let numSegments = 18;
let fishScale = 0.55; 
let segmentLength = 4.5 * fishScale;

let fishes = [];
const NUM_FISHES = 11;

function setup() {
  createCanvas(windowWidth, windowHeight);
  video = createCapture(VIDEO, () => {
    console.log("Webcam video capture stream ready");
  });
  video.size(640, 480);
  video.hide();

  targetX = width / 2;
  targetY = height / 2;

  for (let i = 0; i < NUM_FISHES; i++) {
    fishes.push(new Goldfish(width / 2, height / 2, i));
  }
}

function initMediaPipe() {
  if (mpHands || typeof Hands === 'undefined') return false;

  try {
    mpHands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    mpHands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    mpHands.onResults(onMediaPipeResults);

    let vidEl = video.elt || video;
    if (typeof Camera !== 'undefined' && vidEl) {
      mpCamera = new Camera(vidEl, {
        onFrame: async () => {
          if (vidEl && vidEl.readyState >= 2) {
            await mpHands.send({ image: vidEl });
          }
        },
        width: 640,
        height: 480
      });
      mpCamera.start();
      isDetecting = true;
      statusMsg = "AI Active. Point index finger at camera!";
      return true;
    }
  } catch (e) {
    console.warn("MediaPipe init fallback:", e);
  }
  return false;
}

function onMediaPipeResults(results) {
  if (results && results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    let landmarks = results.multiHandLandmarks[0];
    let indexTip = landmarks[8]; // Landmark #8 is index finger tip
    if (indexTip) {
      mpTargetNormalized = { x: indexTip.x, y: indexTip.y };
      mpHandDetected = true;
      statusMsg = "✋ Index Finger Tracked (MediaPipe AI)";
    }
  } else {
    mpHandDetected = false;
  }
}

function initMl5() {
  if (isDetecting) return;
  if (typeof ml5 === 'undefined') return;

  let vidEl = video.elt || video;
  if (!vidEl || vidEl.readyState < 2) return;

  if (typeof ml5.handPose === 'function') {
    try {
      handPose = ml5.handPose({ maxHands: 1, flipped: false }, () => {
        statusMsg = "AI Active. Point index finger at camera!";
      });
      if (handPose && handPose.detectStart) {
        handPose.detectStart(vidEl, gotHands);
        isDetecting = true;
      }
    } catch (e) {}
  } else if (typeof ml5.handpose === 'function') {
    try {
      handPose = ml5.handpose(vidEl, () => {
        statusMsg = "AI Active. Point index finger at camera!";
      });
      if (handPose && handPose.on) {
        handPose.on('predict', gotHands);
        handPose.on('hand', gotHands);
        isDetecting = true;
      }
    } catch (e) {}
  }
}

function gotHands(results) {
  if (!results) return;
  if (Array.isArray(results)) {
    hands = results;
  } else if (results.multiHandLandmarks) {
    hands = results.multiHandLandmarks;
  } else {
    hands = [results];
  }
}

function extractIndexFinger(hand) {
  if (!hand) return null;
  if (Array.isArray(hand) && hand.length >= 9) {
    let pt = hand[8] || hand[3];
    if (pt && pt.x !== undefined) return { x: pt.x, y: pt.y };
    if (Array.isArray(pt)) return { x: pt[0], y: pt[1] };
  }
  if (hand.keypoints && Array.isArray(hand.keypoints)) {
    let kp = hand.keypoints[8] || hand.keypoints.find(k => k && (k.name === 'index_finger_tip' || k.label === 'index_finger_tip'));
    if (kp && kp.x !== undefined) return { x: kp.x, y: kp.y };
  }
  if (hand.index_finger_tip) {
    let pt = hand.index_finger_tip;
    if (pt.x !== undefined) return { x: pt.x, y: pt.y };
    if (Array.isArray(pt)) return { x: pt[0], y: pt[1] };
  }
  if (hand.landmarks && Array.isArray(hand.landmarks) && hand.landmarks[8]) {
    let pt = hand.landmarks[8];
    if (pt.x !== undefined) return { x: pt.x, y: pt.y };
    if (Array.isArray(pt)) return { x: pt[0], y: pt[1] };
  }
  if (hand.annotations && hand.annotations.indexFinger) {
    let pts = hand.annotations.indexFinger;
    let pt = pts[pts.length - 1] || pts[3];
    if (pt && pt.x !== undefined) return { x: pt.x, y: pt.y };
    if (Array.isArray(pt)) return { x: pt[0], y: pt[1] };
  }
  return null;
}

function draw() {
  background(8, 12, 20);

  // Initialize MediaPipe or ml5 when camera stream is ready
  if (!isDetecting) {
    let ok = initMediaPipe();
    if (!ok) initMl5();
  }

  // 1. Draw camera view (zoomed out at 85% scale)
  let zoomFactor = 0.85; 
  let videoAspect = video.width / video.height;
  let windowAspect = width / height;
  let drawW, drawH;
  
  if (videoAspect > windowAspect) {
    drawW = width * zoomFactor;
    drawH = drawW / videoAspect;
  } else {
    drawH = height * zoomFactor;
    drawW = drawH * videoAspect;
  }
  
  let drawX = (width - drawW) / 2;
  let drawY = (height - drawH) / 2;

  // Frame around camera
  fill(18, 25, 40);
  noStroke();
  rect(drawX - 8, drawY - 8, drawW + 16, drawH + 16, 16);
  
  image(video, drawX, drawY, drawW, drawH);

  // Dark translucent overlay over video to enhance glowing fish contrast
  fill(8, 12, 20, 100);
  rect(drawX, drawY, drawW, drawH);

  // 2. Track finger position
  let handDetected = false;

  // Method 1: MediaPipe tracking (primary high precision)
  if (mpHandDetected && mpTargetNormalized) {
    let rawX = mpTargetNormalized.x * (video.width || 640);
    let rawY = mpTargetNormalized.y * (video.height || 480);
    targetX = drawX + (rawX / (video.width || 640)) * drawW;
    targetY = drawY + (rawY / (video.height || 480)) * drawH;
    handDetected = true;
  }

  // Method 2: ml5 tracking fallback
  if (!handDetected && hands && hands.length > 0) {
    for (let i = 0; i < hands.length; i++) {
      let pt = extractIndexFinger(hands[i]);
      if (pt) {
        let rawX = pt.x;
        let rawY = pt.y;
        let vW = video.width || 640;
        let vH = video.height || 480;

        if (rawX <= 1.0) rawX *= vW;
        if (rawY <= 1.0) rawY *= vH;

        targetX = drawX + (rawX / vW) * drawW;
        targetY = drawY + (rawY / vH) * drawH;
        handDetected = true;
        statusMsg = "✋ Index Finger Tracked (ml5 AI)";
        break;
      }
    }
  }

  if (!handDetected && isDetecting) {
    statusMsg = "Point your index finger at the camera!";
  }

  // Visual target dot removed as requested


  // Status Banner at bottom
  drawStatusBanner(statusMsg, handDetected);

  // 3. Update & Draw Swarm of Fishes
  for (let f of fishes) {
    f.update(targetX, targetY);
  }
}

function drawStatusBanner(msg, isHand) {
  push();
  translate(width / 2, height - 30);
  scale(-1, 1);

  fill(18, 25, 40, 220);
  stroke(isHand ? color(0, 255, 200, 150) : color(255, 180, 0, 150));
  strokeWeight(1.5);
  rectMode(CENTER);
  rect(0, 0, 480, 36, 18);

  fill(isHand ? color(0, 255, 200) : color(255, 200, 100));
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(14);
  textFont('sans-serif');
  text(msg, 0, 0);
  pop();
}



function getFishWidth(i) {
  let widths = [8, 13, 16, 17, 16, 14, 12, 10, 8, 6, 5, 4, 3, 2, 1.5, 1, 0.5, 0.2];
  if (i < widths.length) return widths[i] * fishScale;
  return 0.2 * fishScale;
}

class Goldfish {
  constructor(x, y, index) {
    this.spine = [];
    for (let i = 0; i < numSegments; i++) {
      this.spine.push({ x: x, y: y });
    }
    this.lightParticles = [];
    this.index = index;
    
    // Swarm dynamics offsets
    this.offsetX = random(-80, 80);
    this.offsetY = random(-80, 80);
    this.followSpeed = random(0.04, 0.09);
    
    // Perlin noise for organic wandering around the target
    this.noiseOffsetX = random(1000);
    this.noiseOffsetY = random(1000);
  }

  update(tx, ty) {
    this.noiseOffsetX += 0.01;
    this.noiseOffsetY += 0.01;
    
    // Organic target position relative to the main target
    let myTargetX = tx + this.offsetX + (noise(this.noiseOffsetX) - 0.5) * 120;
    let myTargetY = ty + this.offsetY + (noise(this.noiseOffsetY) - 0.5) * 120;

    this.spine[0].x = lerp(this.spine[0].x, myTargetX, this.followSpeed);
    this.spine[0].y = lerp(this.spine[0].y, myTargetY, this.followSpeed);

    for (let i = 1; i < numSegments; i++) {
      let dx = this.spine[i - 1].x - this.spine[i].x;
      let dy = this.spine[i - 1].y - this.spine[i].y;
      let angle = atan2(dy, dx);
      this.spine[i].x = this.spine[i - 1].x - cos(angle) * segmentLength;
      this.spine[i].y = this.spine[i - 1].y - sin(angle) * segmentLength;
    }

    let headSpeed = dist(this.spine[0].x, this.spine[0].y, myTargetX, myTargetY);

    this.updateParticles(this.spine[numSegments - 1].x, this.spine[numSegments - 1].y, headSpeed);
    this.draw(headSpeed);
  }

  updateParticles(tailX, tailY, speed) {
    if (random(1) < 0.35 + speed * 0.03) {
      this.lightParticles.push({
        x: tailX + random(-5, 5),
        y: tailY + random(-5, 5),
        vx: random(-0.4, 0.4),
        vy: random(-0.4, 0.4),
        size: random(2, 6),
        alpha: 230
      });
    }

    drawingContext.shadowBlur = 10;
    drawingContext.shadowColor = 'rgba(255, 150, 30, 0.8)';

    for (let i = this.lightParticles.length - 1; i >= 0; i--) {
      let p = this.lightParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 5;
      p.size *= 0.95;

      if (p.alpha <= 0 || p.size < 0.4) {
        this.lightParticles.splice(i, 1);
      } else {
        fill(255, 200, 100, p.alpha);
        noStroke();
        ellipse(p.x, p.y, p.size);
      }
    }
    drawingContext.shadowBlur = 0;
  }

  draw(speed) {
    let waveFreq = frameCount * (0.15 + speed * 0.012) + this.index;

    drawingContext.shadowBlur = 15;
    drawingContext.shadowColor = 'rgba(255, 100, 0, 0.9)';
    noStroke();

    // A. Pectoral Fins
    if (this.spine.length > 3) {
      let p = this.spine[3];
      let angle = atan2(this.spine[2].y - p.y, this.spine[2].x - p.x);
      let flap = sin(waveFreq) * map(speed, 0, 30, 8, 25);

      push();
      translate(p.x, p.y);
      rotate(angle);
      scale(fishScale);

      fill(255, 90, 0, 160);
      push();
      translate(0, 9);
      rotate(radians(35 + flap));
      ellipse(-6, 0, 24, 12);
      stroke(255, 200, 100, 200);
      strokeWeight(1);
      line(-5, 0, 8, 0);
      pop();

      push();
      translate(0, -9);
      rotate(radians(-35 - flap));
      fill(255, 90, 0, 160);
      ellipse(-6, 0, 24, 12);
      stroke(255, 200, 100, 200);
      strokeWeight(1);
      line(-5, 0, 8, 0);
      pop();

      pop();
    }

    // B. Flowing Tail Fin
    let lastIdx = numSegments - 1;
    if (this.spine.length > lastIdx) {
      let tailP = this.spine[lastIdx];
      let tailAngle = atan2(this.spine[lastIdx - 1].y - tailP.y, this.spine[lastIdx - 1].x - tailP.x);
      let tailWiggle = sin(waveFreq * 1.2) * map(speed, 0, 30, 12, 35);

      push();
      translate(tailP.x, tailP.y);
      rotate(tailAngle + radians(tailWiggle));
      scale(fishScale);

      fill(255, 60, 0, 140);
      ellipse(-16, 0, 38, 22);

      fill(255, 130, 0, 160);
      push();
      rotate(radians(28));
      ellipse(-14, -6, 32, 16);
      pop();

      push();
      rotate(radians(-28));
      ellipse(-14, 6, 32, 16);
      pop();

      stroke(255, 220, 120, 220);
      strokeWeight(1);
      line(0, 0, -30, 0);
      line(0, 0, -25, -10);
      line(0, 0, -25, 10);
      line(0, 0, -18, -15);
      line(0, 0, -18, 15);
      noStroke();

      pop();
    }

    // C. Glowing Body Segments
    for (let i = numSegments - 1; i >= 0; i--) {
      let w = getFishWidth(i);
      let p = this.spine[i];

      let angle = 0;
      if (i === 0) angle = atan2(this.spine[0].y - this.spine[1].y, this.spine[0].x - this.spine[1].x);
      else angle = atan2(this.spine[i - 1].y - p.y, this.spine[i - 1].x - p.x);

      push();
      translate(p.x, p.y);
      rotate(angle);

      let bodyColor = lerpColor(color(255, 40, 0), color(255, 190, 20), i / numSegments);
      fill(bodyColor);
      ellipse(0, 0, segmentLength * 2.0, w * 2.2);

      if (i > 1 && i < numSegments - 3 && i % 2 === 0) {
        stroke(255, 230, 150, 180);
        strokeWeight(1);
        noFill();
        arc(0, 0, w * 1.5, w * 1.5, -HALF_PI, HALF_PI);
        noStroke();
      }

      fill(255, 255, 220, 120);
      ellipse(segmentLength * 0.2, -w * 0.3, segmentLength * 0.8, w * 0.7);

      pop();
    }

    // D. Dorsal Fin
    for (let i = 4; i < 12; i++) {
      let p = this.spine[i];
      let angle = atan2(this.spine[i - 1].y - p.y, this.spine[i - 1].x - p.x);
      push();
      translate(p.x, p.y);
      rotate(angle);
      fill(255, 140, 0, 150);
      ellipse(0, 0, segmentLength * 2.2, 3 * fishScale);
      pop();
    }

    // E. Head & Eyes
    if (this.spine.length > 0) {
      let p = this.spine[0];
      let angle = atan2(p.y - this.spine[1].y, p.x - this.spine[1].x);

      push();
      translate(p.x, p.y);
      rotate(angle);
      scale(fishScale);

      fill(255, 160, 0, 230);
      ellipse(2, 0, 14, 15);

      fill(255, 200, 0);
      ellipse(3, 7, 6, 6);
      ellipse(3, -7, 6, 6);

      fill(10, 10, 20);
      ellipse(4, 7, 3.5, 3.5);
      ellipse(4, -7, 3.5, 3.5);

      fill(255);
      ellipse(5, 6, 2, 2);
      ellipse(5, -8, 2, 2);

      pop();
    }

    drawingContext.shadowBlur = 0;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
