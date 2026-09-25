/**
 * GLPipeline - High-performance WebGL 1/2 Renderer for Quad Perspective AR Filters
 * Features:
 * - Fullscreen Camera Passthrough
 * - Bilinear Subdivided Quad Perspective Warp (artifact-free)
 * - Dual Tone & Halftone Comic Shader
 * - Cartoon Cel-Shaded Shader (Sobel Edge Inking + Color Quantization)
 * - Stylized Glowing Quad Wireframe & Anchor Dots
 */

class GLPipeline {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { antialias: true, alpha: false, preserveDrawingBuffer: true }) ||
      canvas.getContext('experimental-webgl');

    if (!this.gl) {
      throw new Error('WebGL is not supported in this browser.');
    }

    const gl = this.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Grid subdivision resolution for seamless perspective mapping
    this.gridResolution = 24;

    // Textures
    this.videoTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Build shader programs
    this.initShaders();

    // Build static quad buffer for fullscreen background
    this.initFullscreenQuad();

    // Build dynamic buffers for subdivided perspective quad and wireframe
    this.initSubdividedQuadBuffers();
    this.initOverlayBuffers();

    // Default parameters
    this.activeTheme = 'dual-tone'; // 'dual-tone' or 'cartoon'
    this.lensMode = true; // true: lens portal over face; false: stretched quad UV

    // Dual-tone settings
    this.duotone = {
      colorA: [0.08, 0.02, 0.18], // Deep midnight purple
      colorB: [0.0, 0.94, 1.0],   // Electric cyan
      dotFrequency: 55.0,
      halftoneBlend: 0.85
    };

    // Animated anime & painterly settings
    this.animated = {
      edgeThreshold: 0.22,
      edgeThickness: 1.2,
      vibrance: 1.35,
      warmth: 1.08
    };

    // Dreamy Bloom & Sunlight Long Exposure settings
    this.dreamy = {
      exposureDecay: 0.88,   // High long exposure persistence
      bloomIntensity: 2.6,   // High white light bloom
      whiteThreshold: 0.38,  // White light threshold
      sunlightTint: [1.0, 0.82, 0.52], // Golden sunlight tint
      sunIntensity: 0.95
    };

    this.showWireframe = true;
    this.isMirrored = true;

    this.initAccumulationBuffers();
  }

  /* ------------------- Shader Compilation ------------------- */

  createShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Shader compilation error: ' + info);
    }
    return shader;
  }

  createProgram(vertSrc, fragSrc) {
    const gl = this.gl;
    const vert = this.createShader(gl.VERTEX_SHADER, vertSrc);
    const frag = this.createShader(gl.FRAGMENT_SHADER, fragSrc);
    const program = gl.createProgram();
    gl.attachShader(program, vert);
    gl.attachShader(program, frag);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error('Program link error: ' + info);
    }
    return program;
  }

  initShaders() {
    const gl = this.gl;

    // 1. Fullscreen Passthrough Shader
    const passthroughVS = `
      attribute vec2 a_position;
      uniform float u_mirrored;
      varying vec2 v_uv;
      void main() {
        v_uv = (a_position + 1.0) * 0.5;
        if (u_mirrored > 0.5) {
          v_uv.x = 1.0 - v_uv.x;
        }
        v_uv.y = 1.0 - v_uv.y;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const passthroughFS = `
      precision mediump float;
      uniform sampler2D u_texture;
      varying vec2 v_uv;
      void main() {
        gl_FragColor = texture2D(u_texture, v_uv);
      }
    `;
    this.progPassthrough = this.createProgram(passthroughVS, passthroughFS);

    // 2. Perspective Quad Vertex Shader (Supports Screen-Space Lens & Quad UV)
    const quadVS = `
      attribute vec2 a_screenPos; // Position in NDC [-1, 1]
      attribute vec2 a_quadUv;    // UV across the quad [0, 1]
      varying vec2 v_screenUv;
      varying vec2 v_quadUv;

      void main() {
        v_quadUv = a_quadUv;
        // Screen UV for lens sampling
        v_screenUv = (a_screenPos + 1.0) * 0.5;
        v_screenUv.y = 1.0 - v_screenUv.y;
        gl_Position = vec4(a_screenPos, 0.0, 1.0);
      }
    `;

    // 3. Dual Tone & Halftone Fragment Shader
    const duotoneFS = `
      precision mediump float;
      uniform sampler2D u_texture;
      uniform vec2 u_resolution;
      uniform vec3 u_colorA; // Dark tone
      uniform vec3 u_colorB; // Light tone
      uniform float u_dotFrequency;
      uniform float u_halftoneBlend;
      uniform float u_lensMode;
      uniform float u_mirrored;
      varying vec2 v_screenUv;
      varying vec2 v_quadUv;

      float getLuma(vec3 col) {
        return dot(col, vec3(0.299, 0.587, 0.114));
      }

      void main() {
        vec2 sampleUv = mix(v_quadUv, v_screenUv, u_lensMode);
        if (u_mirrored > 0.5) {
          sampleUv.x = 1.0 - sampleUv.x;
        }
        sampleUv.y = clamp(sampleUv.y, 0.001, 0.999);
        sampleUv.x = clamp(sampleUv.x, 0.001, 0.999);

        vec4 src = texture2D(u_texture, sampleUv);
        float luma = getLuma(src.rgb);

        // Continuous duotone ramp
        vec3 duotoneColor = mix(u_colorA, u_colorB, smoothstep(0.12, 0.88, luma));

        // Halftone Ben-day dot raster pattern (rotated 45 degrees)
        vec2 aspectCoord = v_screenUv * vec2(u_resolution.x / u_resolution.y, 1.0);
        float angle = 0.785398; // 45 deg
        mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
        vec2 rotCoord = rot * (aspectCoord * u_dotFrequency);

        vec2 cell = fract(rotCoord) - 0.5;
        float dist = length(cell);

        // Dot radius scales with darkness/luma
        float targetRadius = (1.0 - luma) * 0.68;
        float dotMask = smoothstep(targetRadius + 0.06, targetRadius - 0.06, dist);

        // Combine Halftone with graphic duotone
        vec3 finalColor = mix(duotoneColor, u_colorA, dotMask * u_halftoneBlend);

        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;
    this.progDuotone = this.createProgram(quadVS, duotoneFS);

    // 4. Animated Anime & Painterly Fragment Shader
    // Uses Kuwahara edge-preserving painterly filter + anime skin smoothing + soft cel-shading
    const animatedFS = `
      precision mediump float;
      uniform sampler2D u_texture;
      uniform vec2 u_resolution;
      uniform float u_edgeThreshold;
      uniform float u_edgeThickness;
      uniform float u_vibrance;
      uniform float u_warmth;
      uniform float u_lensMode;
      uniform float u_mirrored;
      varying vec2 v_screenUv;
      varying vec2 v_quadUv;

      float getLuma(vec3 col) {
        return dot(col, vec3(0.299, 0.587, 0.114));
      }

      void main() {
        vec2 sampleUv = mix(v_quadUv, v_screenUv, u_lensMode);
        if (u_mirrored > 0.5) {
          sampleUv.x = 1.0 - sampleUv.x;
        }
        sampleUv.y = clamp(sampleUv.y, 0.001, 0.999);
        sampleUv.x = clamp(sampleUv.x, 0.001, 0.999);

        vec2 step = (vec2(1.0) / u_resolution) * 1.8;

        // --- 1. Fast 4-Quadrant Kuwahara Painterly Smoothing ---
        // Quadrant 0: Top-Left
        vec3 c0 = texture2D(u_texture, sampleUv + vec2(-step.x, -step.y)).rgb;
        vec3 c1 = texture2D(u_texture, sampleUv + vec2(0.0, -step.y)).rgb;
        vec3 c2 = texture2D(u_texture, sampleUv + vec2(-step.x, 0.0)).rgb;
        vec3 c3 = texture2D(u_texture, sampleUv).rgb;
        vec3 m0 = (c0 + c1 + c2 + c3) * 0.25;
        vec3 v0 = abs(c0 - m0) + abs(c1 - m0) + abs(c2 - m0) + abs(c3 - m0);
        float var0 = dot(v0, vec3(1.0));

        // Quadrant 1: Top-Right
        vec3 c4 = texture2D(u_texture, sampleUv + vec2(step.x, -step.y)).rgb;
        vec3 c5 = texture2D(u_texture, sampleUv + vec2(step.x, 0.0)).rgb;
        vec3 m1 = (c1 + c4 + c3 + c5) * 0.25;
        vec3 v1 = abs(c1 - m1) + abs(c4 - m1) + abs(c3 - m1) + abs(c5 - m1);
        float var1 = dot(v1, vec3(1.0));

        // Quadrant 2: Bottom-Left
        vec3 c6 = texture2D(u_texture, sampleUv + vec2(-step.x, step.y)).rgb;
        vec3 c7 = texture2D(u_texture, sampleUv + vec2(0.0, step.y)).rgb;
        vec3 m2 = (c2 + c3 + c6 + c7) * 0.25;
        vec3 v2 = abs(c2 - m2) + abs(c3 - m2) + abs(c6 - m2) + abs(c7 - m2);
        float var2 = dot(v2, vec3(1.0));

        // Quadrant 3: Bottom-Right
        vec3 c8 = texture2D(u_texture, sampleUv + vec2(step.x, step.y)).rgb;
        vec3 m3 = (c3 + c5 + c7 + c8) * 0.25;
        vec3 v3 = abs(c3 - m3) + abs(c5 - m3) + abs(c7 - m3) + abs(c8 - m3);
        float var3 = dot(v3, vec3(1.0));

        // Select region with lowest variance (smooth skin/hair, preserves silhouettes)
        float minVar = var0;
        vec3 smoothCol = m0;
        if (var1 < minVar) { minVar = var1; smoothCol = m1; }
        if (var2 < minVar) { minVar = var2; smoothCol = m2; }
        if (var3 < minVar) { minVar = var3; smoothCol = m3; }

        // --- 2. Anime Color Grading & Skin Tone Curve ---
        // Warm peachy highlights & cool anime shadow tones
        float luma = getLuma(smoothCol);
        
        // Soft 3-tier anime cel lighting (Shadow, Midtone, Highlight)
        float shadow = smoothstep(0.18, 0.35, luma);
        float highlight = smoothstep(0.68, 0.85, luma);
        float toneFactor = mix(0.72, 1.0, shadow) + highlight * 0.2;

        vec3 animeCol = smoothCol * toneFactor;

        // Boost vibrance naturally for anime look
        float maxC = max(max(animeCol.r, animeCol.g), animeCol.b);
        float minC = min(min(animeCol.r, animeCol.g), animeCol.b);
        float sat = (maxC > 0.0) ? (1.0 - minC / maxC) : 0.0;
        animeCol = mix(vec3(luma), animeCol, 1.0 + (1.0 - sat) * (u_vibrance - 1.0) * 1.5);

        // Warm Ghibli / anime color temperature
        animeCol.r = pow(animeCol.r, 0.92) * u_warmth;
        animeCol.g = pow(animeCol.g, 0.95);
        animeCol.b = pow(animeCol.b, 1.05) * (2.0 - u_warmth);

        // Dreamy eye & skin highlight glow
        if (luma > 0.72) {
          animeCol += vec3(0.08, 0.06, 0.04) * ((luma - 0.72) / 0.28);
        }

        // --- 3. Soft Anime Contour Inking (Clean, non-noisy silhouette lines) ---
        vec2 edgeStep = (vec2(1.0) / u_resolution) * u_edgeThickness;
        float lLeft = getLuma(texture2D(u_texture, sampleUv - vec2(edgeStep.x, 0.0)).rgb);
        float lRight = getLuma(texture2D(u_texture, sampleUv + vec2(edgeStep.x, 0.0)).rgb);
        float lUp = getLuma(texture2D(u_texture, sampleUv - vec2(0.0, edgeStep.y)).rgb);
        float lDown = getLuma(texture2D(u_texture, sampleUv + vec2(0.0, edgeStep.y)).rgb);

        float edge = abs(lLeft - lRight) + abs(lUp - lDown);
        float edgeMask = smoothstep(u_edgeThreshold - 0.04, u_edgeThreshold + 0.06, edge);

        // Traditional anime dark chocolate / deep sepia ink contour (not harsh black!)
        vec3 inkColor = vec3(0.16, 0.11, 0.15);
        vec3 finalCol = mix(animeCol, inkColor, edgeMask * 0.78);

        gl_FragColor = vec4(clamp(finalCol, 0.0, 1.0), 1.0);
      }
    `;
    this.progCartoon = this.createProgram(quadVS, animatedFS);

    // 5. Dreamy Bloom & Sunlight Long Exposure Fragment Shader
    const dreamyFS = `
      precision mediump float;
      uniform sampler2D u_texture;
      uniform sampler2D u_prevTexture;
      uniform vec2 u_resolution;
      uniform float u_exposureDecay;
      uniform float u_bloomIntensity;
      uniform float u_whiteThreshold;
      uniform vec3 u_sunlightTint;
      uniform float u_sunIntensity;
      uniform float u_lensMode;
      uniform float u_mirrored;
      uniform float u_firstFrame;
      varying vec2 v_screenUv;
      varying vec2 v_quadUv;

      float getLuma(vec3 col) {
        return dot(col, vec3(0.299, 0.587, 0.114));
      }

      void main() {
        vec2 sampleUv = mix(v_quadUv, v_screenUv, u_lensMode);
        if (u_mirrored > 0.5) {
          sampleUv.x = 1.0 - sampleUv.x;
        }
        sampleUv.y = clamp(sampleUv.y, 0.001, 0.999);
        sampleUv.x = clamp(sampleUv.x, 0.001, 0.999);

        // 1. Current frame video
        vec3 col = texture2D(u_texture, sampleUv).rgb;

        // 2. High-key white light bloom sampling
        vec2 bStep = (vec2(1.0) / u_resolution) * 3.8;
        vec3 bloom = vec3(0.0);
        
        bloom += texture2D(u_texture, sampleUv + vec2(-bStep.x, -bStep.y)).rgb;
        bloom += texture2D(u_texture, sampleUv + vec2( bStep.x, -bStep.y)).rgb;
        bloom += texture2D(u_texture, sampleUv + vec2(-bStep.x,  bStep.y)).rgb;
        bloom += texture2D(u_texture, sampleUv + vec2( bStep.x,  bStep.y)).rgb;
        bloom += texture2D(u_texture, sampleUv + vec2(-bStep.x * 2.4, 0.0)).rgb;
        bloom += texture2D(u_texture, sampleUv + vec2( bStep.x * 2.4, 0.0)).rgb;
        bloom += texture2D(u_texture, sampleUv + vec2(0.0, -bStep.y * 2.4)).rgb;
        bloom += texture2D(u_texture, sampleUv + vec2(0.0,  bStep.y * 2.4)).rgb;
        bloom *= 0.125;

        float bloomLuma = getLuma(bloom);
        float whiteFactor = smoothstep(u_whiteThreshold, 1.0, bloomLuma);
        vec3 whiteGlow = bloom * (whiteFactor * u_bloomIntensity);

        // 3. Warm Sunlight Tint and Overexposure
        vec3 sunlit = mix(col, col * u_sunlightTint * 1.32, u_sunIntensity);
        vec3 radiant = sunlit + whiteGlow * (vec3(1.0) + u_sunlightTint * 0.6);
        radiant = pow(radiant, vec3(0.88)); // dreamy lifted shadows
        radiant += vec3(0.05, 0.035, 0.015) * u_sunIntensity; // warm golden haze

        // 4. Long Exposure Temporal Blend
        vec3 prev = texture2D(u_prevTexture, v_screenUv).rgb;
        if (u_firstFrame > 0.5) {
          prev = radiant;
        }
        vec3 trail = max(prev * u_exposureDecay, radiant);
        vec3 finalColor = mix(radiant, trail, u_exposureDecay * 0.94);

        gl_FragColor = vec4(clamp(finalColor, 0.0, 1.0), 1.0);
      }
    `;
    this.progDreamy = this.createProgram(quadVS, dreamyFS);

    // 6. Wireframe & Anchor Marker Shader
    const lineVS = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, -0.1, 1.0);
      }
    `;
    const lineFS = `
      precision mediump float;
      uniform vec4 u_lineColor;
      void main() {
        gl_FragColor = u_lineColor;
      }
    `;
    this.progLine = this.createProgram(lineVS, lineFS);
  }

  /* ------------------- Buffers Initialization ------------------- */

  initFullscreenQuad() {
    const gl = this.gl;
    const vertices = new Float32Array([
      -1.0, -1.0,
      1.0, -1.0,
      -1.0, 1.0,
      -1.0, 1.0,
      1.0, -1.0,
      1.0, 1.0,
    ]);
    this.bufFullscreen = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufFullscreen);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
  }

  initSubdividedQuadBuffers() {
    const gl = this.gl;
    const N = this.gridResolution;

    // Index buffer for grid mesh (2 * N * N triangles = 6 * N * N indices)
    const indices = [];
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const row1 = j * (N + 1);
        const row2 = (j + 1) * (N + 1);
        indices.push(row1 + i, row2 + i, row1 + i + 1);
        indices.push(row1 + i + 1, row2 + i, row2 + i + 1);
      }
    }

    this.bufSubdividedIndex = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufSubdividedIndex);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
    this.indexCount = indices.length;

    // Position & UV buffers (dynamically updated per frame)
    this.bufSubdividedPos = gl.createBuffer();
    this.bufSubdividedUv = gl.createBuffer();
  }

  initOverlayBuffers() {
    const gl = this.gl;
    this.bufWireframe = gl.createBuffer();
    this.bufAnchorDots = gl.createBuffer();
  }

  initAccumulationBuffers() {
    const gl = this.gl;
    this.accumTextures = [gl.createTexture(), gl.createTexture()];
    this.accumIndex = 0;
    this.firstAccumFrame = true;

    for (let i = 0; i < 2; i++) {
      gl.bindTexture(gl.TEXTURE_2D, this.accumTextures[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 512, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
  }

  /* ------------------- Dynamic Geometry Generation ------------------- */

  updateSubdividedQuad(p0, p1, p2, p3) {
    // p0: top-left, p1: top-right, p2: bottom-right, p3: bottom-left in screen coords [0, 1]
    const N = this.gridResolution;
    const numVerts = (N + 1) * (N + 1);
    const posData = new Float32Array(numVerts * 2);
    const uvData = new Float32Array(numVerts * 2);

    let idx = 0;
    for (let j = 0; j <= N; j++) {
      const v = j / N;
      for (let i = 0; i <= N; i++) {
        const u = i / N;

        // Bilinear interpolation
        const px = (1 - u) * (1 - v) * p0.x +
          u * (1 - v) * p1.x +
          u * v * p2.x +
          (1 - u) * v * p3.x;

        const py = (1 - u) * (1 - v) * p0.y +
          u * (1 - v) * p1.y +
          u * v * p2.y +
          (1 - u) * v * p3.y;

        // Convert [0, 1] screen space to NDC [-1, 1]
        posData[idx * 2] = px * 2.0 - 1.0;
        posData[idx * 2 + 1] = (1.0 - py) * 2.0 - 1.0; // Invert Y for WebGL NDC

        uvData[idx * 2] = u;
        uvData[idx * 2 + 1] = 1.0 - v;

        idx++;
      }
    }

    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufSubdividedPos);
    gl.bufferData(gl.ARRAY_BUFFER, posData, gl.DYNAMIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufSubdividedUv);
    gl.bufferData(gl.ARRAY_BUFFER, uvData, gl.DYNAMIC_DRAW);
  }

  updateWireframeAndDots(p0, p1, p2, p3) {
    const gl = this.gl;

    // Convert corners to NDC
    const toNdc = (p) => [p.x * 2.0 - 1.0, (1.0 - p.y) * 2.0 - 1.0];
    const n0 = toNdc(p0);
    const n1 = toNdc(p1);
    const n2 = toNdc(p2);
    const n3 = toNdc(p3);

    // Quad boundary line loop (5 points to close loop)
    const lineVerts = new Float32Array([
      n0[0], n0[1],
      n1[0], n1[1],
      n2[0], n2[1],
      n3[0], n3[1],
      n0[0], n0[1],
    ]);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufWireframe);
    gl.bufferData(gl.ARRAY_BUFFER, lineVerts, gl.DYNAMIC_DRAW);

    // Anchor corner circle markers (tessellated circles)
    const circleVerts = [];
    const corners = [n0, n1, n2, n3];
    const segments = 16;
    const aspect = this.canvas.width / this.canvas.height;
    const radiusY = 0.024;
    const radiusX = radiusY / aspect;

    corners.forEach((c) => {
      for (let s = 0; s < segments; s++) {
        const theta1 = (s / segments) * Math.PI * 2;
        const theta2 = ((s + 1) / segments) * Math.PI * 2;
        // Triangle fan from center
        circleVerts.push(c[0], c[1]);
        circleVerts.push(c[0] + Math.cos(theta1) * radiusX, c[1] + Math.sin(theta1) * radiusY);
        circleVerts.push(c[0] + Math.cos(theta2) * radiusX, c[1] + Math.sin(theta2) * radiusY);
      }
    });

    this.dotVertCount = circleVerts.length / 2;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufAnchorDots);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(circleVerts), gl.DYNAMIC_DRAW);
  }

  /* ------------------- Main Render Loop ------------------- */

  uploadVideoTexture(videoElement) {
    if (!videoElement || videoElement.readyState < 2) return false;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoElement);
    return true;
  }

  render(videoElement, quadCorners) {
    const gl = this.gl;

    // Viewport adjustment
    if (this.canvas.width !== this.canvas.clientWidth || this.canvas.height !== this.canvas.clientHeight) {
      this.canvas.width = this.canvas.clientWidth;
      this.canvas.height = this.canvas.clientHeight;
    }
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    // Upload video
    const hasVideo = this.uploadVideoTexture(videoElement);
    if (!hasVideo) return;

    gl.clearColor(0.05, 0.05, 0.08, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 1. Render Fullscreen Background Camera Feed
    gl.useProgram(this.progPassthrough);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
    gl.uniform1i(gl.getUniformLocation(this.progPassthrough, 'u_texture'), 0);
    gl.uniform1f(gl.getUniformLocation(this.progPassthrough, 'u_mirrored'), this.isMirrored ? 1.0 : 0.0);

    const aPos = gl.getAttribLocation(this.progPassthrough, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufFullscreen);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // 2. Render Quad with Active Theme (if detected)
    if (quadCorners && quadCorners.p0 && quadCorners.p1 && quadCorners.p2 && quadCorners.p3) {
      const { p0, p1, p2, p3 } = quadCorners;

      // Update subdivided mesh
      this.updateSubdividedQuad(p0, p1, p2, p3);

      let prog;
      if (this.activeTheme === 'dreamy') {
        prog = this.progDreamy;
      } else if (this.activeTheme === 'animated' || this.activeTheme === 'cartoon') {
        prog = this.progCartoon;
      } else {
        prog = this.progDuotone;
      }
      gl.useProgram(prog);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
      gl.uniform1i(gl.getUniformLocation(prog, 'u_texture'), 0);
      gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), this.canvas.width, this.canvas.height);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_lensMode'), this.lensMode ? 1.0 : 0.0);
      gl.uniform1f(gl.getUniformLocation(prog, 'u_mirrored'), this.isMirrored ? 1.0 : 0.0);

      if (this.activeTheme === 'dreamy') {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.accumTextures[this.accumIndex]);
        gl.uniform1i(gl.getUniformLocation(prog, 'u_prevTexture'), 1);

        gl.uniform1f(gl.getUniformLocation(prog, 'u_exposureDecay'), this.dreamy.exposureDecay);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_bloomIntensity'), this.dreamy.bloomIntensity);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_whiteThreshold'), this.dreamy.whiteThreshold);
        gl.uniform3fv(gl.getUniformLocation(prog, 'u_sunlightTint'), this.dreamy.sunlightTint);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_sunIntensity'), this.dreamy.sunIntensity);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_firstFrame'), this.firstAccumFrame ? 1.0 : 0.0);
      } else if (this.activeTheme === 'animated' || this.activeTheme === 'cartoon') {
        gl.uniform1f(gl.getUniformLocation(prog, 'u_edgeThreshold'), this.animated.edgeThreshold);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_edgeThickness'), this.animated.edgeThickness);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_vibrance'), this.animated.vibrance);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_warmth'), this.animated.warmth);
      } else {
        gl.uniform3fv(gl.getUniformLocation(prog, 'u_colorA'), this.duotone.colorA);
        gl.uniform3fv(gl.getUniformLocation(prog, 'u_colorB'), this.duotone.colorB);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_dotFrequency'), this.duotone.dotFrequency);
        gl.uniform1f(gl.getUniformLocation(prog, 'u_halftoneBlend'), this.duotone.halftoneBlend);
      }

      // Bind attributes
      const aScreenPos = gl.getAttribLocation(prog, 'a_screenPos');
      const aQuadUv = gl.getAttribLocation(prog, 'a_quadUv');

      gl.enableVertexAttribArray(aScreenPos);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufSubdividedPos);
      gl.vertexAttribPointer(aScreenPos, 2, gl.FLOAT, false, 0, 0);

      gl.enableVertexAttribArray(aQuadUv);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.bufSubdividedUv);
      gl.vertexAttribPointer(aQuadUv, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufSubdividedIndex);
      gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);

      // Save rendered quad to ping-pong accumulation texture for long exposure light trails
      if (this.activeTheme === 'dreamy') {
        const nextIdx = 1 - this.accumIndex;
        gl.bindTexture(gl.TEXTURE_2D, this.accumTextures[nextIdx]);
        gl.copyTexSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 0, 0, 512, 512);
        this.accumIndex = nextIdx;
        this.firstAccumFrame = false;
      }

      // 3. Render Stylized Wireframe Border
      if (this.showWireframe) {
        this.updateWireframeAndDots(p0, p1, p2, p3);

        gl.useProgram(this.progLine);
        const aLinePos = gl.getAttribLocation(this.progLine, 'a_position');
        gl.enableVertexAttribArray(aLinePos);

        // Draw boundary line loop (glow cyan / white)
        gl.bindBuffer(gl.ARRAY_BUFFER, this.bufWireframe);
        gl.vertexAttribPointer(aLinePos, 2, gl.FLOAT, false, 0, 0);
        gl.lineWidth(3.0);
        gl.uniform4f(gl.getUniformLocation(this.progLine, ''), 0.0, 0.94, 1.0, 0.95);
        gl.drawArrays(gl.LINE_STRIP, 0, 5);
      }
    }
  }
}

window.GLPipeline = GLPipeline;
