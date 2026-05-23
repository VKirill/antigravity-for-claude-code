# Production GLSL Shader Recipe Library (WebGL 2.0 / GLSL ES 3.00)

This document contains a curated, performance-optimized library of GLSL shader recipes for production use. Every recipe includes complete, compilable GLSL code, exact uniforms, performance metrics, mobile GPU details, and minimal library boilerplate.

---

## 1. Fullscreen Quad Boilerplate (OGL Optimized)

*RU Gloss: Оптимизация полноэкранного полигона (Fullscreen triangle optimization).* Rather than using a two-triangle quad, we use a single large triangle spanning coordinates `[-1, -1]` to `[3, -1]` and `[-1, 3]`. This removes the diagonal seam, preventing the GPU's 2x2 helper pixel threads from executing duplicate fragment calculations along the diagonal boundary.

```javascript
// Minimal OGL v1.0.11 Fullscreen Setup
import { Renderer, Geometry, Program, Mesh } from 'ogl';

const renderer = new Renderer({ canvas: document.querySelector('canvas'), antialias: false });
const gl = renderer.gl;

// Single triangle covering screen + clip space
const geometry = new Geometry(gl, {
  position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
  uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) },
});

const program = new Program(gl, {
  vertex: `#version 300 es
    in vec2 position;
    in vec2 uv;
    out vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `,
  fragment: `#version 300 es
    precision highp float;
    in vec2 vUv;
    out vec4 fragColor;
    uniform vec2 uResolution;
    void main() {
      fragColor = vec4(vUv, 0.5, 1.0);
    }
  `,
  uniforms: {
    uResolution: { value: [window.innerWidth, window.innerHeight] }
  }
});

const mesh = new Mesh(gl, { geometry, program });

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  program.uniforms.uResolution.value = [window.innerWidth, window.innerHeight];
}
window.addEventListener('resize', resize, false);
resize();

requestAnimationFrame(function tick() {
  requestAnimationFrame(tick);
  renderer.render({ scene: mesh });
});
```

---

## 2. Production Shader Recipes

### Recipe 1: Animated Flow/Mesh Gradient with Screen-Space Dithering
*RU Gloss: Избавление от бандинга градиентов (Gradient banding mitigation).* Generates an organic mesh gradient using simplex noise, applying high-frequency dither noise to prevent color banding on 8-bit displays.

* **Uniforms**:
  * `uniform float uTime;` (seconds)
  * `uniform vec2 uResolution;` (pixels)
  * `uniform vec3 uColorA;` (RGB color 1)
  * `uniform vec3 uColorB;` (RGB color 2)
  * `uniform vec3 uColorC;` (RGB color 3)
* **Vertex Shader (GLSL ES 3.00)**:
  ```glsl
  #version 300 es
  in vec2 position;
  in vec2 uv;
  out vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
  ```
* **Fragment Shader (GLSL ES 3.00)**:
  ```glsl
  #version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 fragColor;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;

  // 2D Simplex Noise helper
  vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  float snoise(vec2 v){
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
             -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx) ;
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0) )
    + i.x + vec3(0.0, i1.x, 1.0) );
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
      dot(x12.zw,x12.zw)), 0.0);
    m = m*m ;
    m = m*m ;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 a0 = x - floor(x + 0.5);
    vec3 o5 = m * ( a0*x0.x + h*x0.y );
    vec3 o6 = m * ( a0*x12.x + h*x12.y );
    vec3 o7 = m * ( a0*x12.z + h*x12.w );
    return 130.0 * (o5.x + o6.y + o7.z);
  }

  // Triangular PDF screen-space dither
  float triDither(vec2 uv) {
    float noiseVal = fract(sin(dot(uv.xy, vec2(12.9898, 78.233))) * 43758.5453123);
    float noiseVal2 = fract(sin(dot(uv.xy + vec2(1.0), vec2(12.9898, 78.233))) * 43758.5453123);
    return (noiseVal + noiseVal2 - 1.0) / 255.0;
  }

  void main() {
    vec2 noiseUv = vUv * 1.5;
    float n1 = snoise(noiseUv + uTime * 0.1) * 0.5 + 0.5;
    float n2 = snoise(noiseUv - uTime * 0.15 + vec2(2.3, 1.1)) * 0.5 + 0.5;

    // Mix base colors using noise coefficients
    vec3 col = mix(uColorA, uColorB, n1);
    col = mix(col, uColorC, n2);

    // Apply high-frequency dither to kill 8-bit banding
    col += triDither(gl_FragCoord.xy);

    fragColor = vec4(col, 1.0);
  }
  ```
* **Performance Cost**: Medium ALU intensity due to Simplex evaluation. O(1) texture operations.
* **Mobile Notes**: Simplex noise can show precision artifacts on `mediump` floats. Keep `precision highp float` for coordinate evaluation. Clamp DPR to `1.2` or `1.5` on mobile.

---

### Recipe 2: Film Grain/Noise Overlay
Add high-frequency cinematic noise over an active texture mapping.

* **Uniforms**:
  * `uniform sampler2D uTexture;` (background/scene texture)
  * `uniform float uTime;` (seconds)
  * `uniform float uGrainIntensity;` (0.0 to 0.15)
* **Vertex Shader (GLSL ES 3.00)**:
  Same as Boilerplate.
* **Fragment Shader (GLSL ES 3.00)**:
  ```glsl
  #version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 fragColor;

  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uGrainIntensity;

  float pseudoRandom(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec4 sceneColor = texture(uTexture, vUv);
    
    // Create animated grain coordinate base
    vec2 grainCoord = vUv * vec2(2.5) + uTime * 8.0;
    float noiseVal = pseudoRandom(floor(grainCoord * uGrainIntensity * 2000.0) / 2000.0);
    
    // Scale and apply noise
    vec3 grain = vec3(noiseVal - 0.5) * uGrainIntensity;
    
    fragColor = vec4(sceneColor.rgb + grain, sceneColor.a);
  }
  ```
* **Performance Cost**: Low. 1 texture fetch, 1 simple pseudo-random call.
* **Mobile Notes**: Safe for `mediump` precision on mobile GPUs.

---

### Recipe 3: Aurora/Plasma
Dynamic sine-based mathematical waves representing plasma flows.

* **Uniforms**:
  * `uniform float uTime;` (seconds)
  * `uniform vec2 uResolution;` (pixels)
* **Vertex Shader**: Same as Boilerplate.
* **Fragment Shader (GLSL ES 3.00)**:
  ```glsl
  #version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 fragColor;

  uniform float uTime;
  uniform vec2 uResolution;

  void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / uResolution.y;
    
    float t = uTime * 0.8;
    float wave1 = sin(uv.x * 3.0 + t) * 0.5;
    float wave2 = sin(uv.y * 2.0 - t * 1.3) * 0.5;
    float wave3 = cos((uv.x + uv.y) * 4.0 + t * 0.7) * 0.5;
    
    float factor = wave1 + wave2 + wave3;
    
    vec3 colorA = vec3(0.01, 0.05, 0.2); // Dark Night
    vec3 colorB = vec3(0.0, 0.9, 0.45);  // Aurora Green
    vec3 colorC = vec3(0.6, 0.0, 0.7);   // Aurora Purple

    vec3 finalColor = mix(colorA, colorB, clamp(factor + 0.5, 0.0, 1.0));
    finalColor = mix(finalColor, colorC, clamp(wave3 * 0.8, 0.0, 1.0));

    fragColor = vec4(finalColor, 1.0);
  }
  ```
* **Performance Cost**: Extremely low. Uses basic sine and cosine operations.
* **Mobile Notes**: Completely safe on low-end mobile devices at native resolutions.

---

### Recipe 4: Voronoi/Cells
Cellular partition noise for caustics or technical UI backdrops.

* **Uniforms**:
  * `uniform float uTime;` (seconds)
  * `uniform float uCellScale;` (density, e.g. 8.0)
* **Vertex Shader**: Same as Boilerplate.
* **Fragment Shader (GLSL ES 3.00)**:
  ```glsl
  #version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 fragColor;

  uniform float uTime;
  uniform float uCellScale;

  vec2 hash22(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(443.897, 441.423, 437.195));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.xx + p3.yz) * p3.zy);
  }

  void main() {
    vec2 p = vUv * uCellScale;
    vec2 ip = floor(p);
    vec2 fp = fract(p);

    float minDist = 8.0;

    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 cellOffset = vec2(float(x), float(y));
        vec2 cellCenter = hash22(ip + cellOffset);
        
        // Animate cell position
        cellCenter = 0.5 + 0.5 * sin(uTime + cellCenter * 6.2831);
        
        vec2 diff = cellOffset + cellCenter - fp;
        float dist = length(diff);
        minDist = min(minDist, dist);
      }
    }

    vec3 col = vec3(minDist);
    // Draw grid border highlights
    col += vec3(1.0 - smoothstep(0.0, 0.05, abs(minDist - 0.1)));

    fragColor = vec4(col * vec3(0.1, 0.45, 0.9), 1.0);
  }
  ```
* **Performance Cost**: High. Requiring 9 iteration loops per fragment.
* **Mobile Notes**: Limit `uCellScale` values. Avoid loops larger than 3x3. Run with `mediump` coordinates to save cycles if precision loss is acceptable.

---

### Recipe 5: Metaballs
Implicit 2D shapes merging together organically.

* **Uniforms**:
  * `uniform float uTime;`
  * `uniform vec2 uResolution;`
* **Vertex Shader**: Same as Boilerplate.
* **Fragment Shader (GLSL ES 3.00)**:
  ```glsl
  #version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 fragColor;

  uniform float uTime;
  uniform vec2 uResolution;

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 aspectUv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / uResolution.y;

    // Define positions of 4 independent charges
    vec2 ball1 = vec2(sin(uTime * 1.1) * 0.5, cos(uTime * 0.9) * 0.3);
    vec2 ball2 = vec2(cos(uTime * 0.8) * 0.6, sin(uTime * 1.3) * 0.4);
    vec2 ball3 = vec2(sin(uTime * 1.5 + 1.0) * 0.4, cos(uTime * 1.1 + 0.5) * 0.3);
    vec2 ball4 = vec2(cos(uTime * 0.7) * 0.3, sin(uTime * 1.6) * 0.2);

    float sum = 0.0;
    sum += 0.035 / (dot(aspectUv - ball1, aspectUv - ball1) + 0.001);
    sum += 0.035 / (dot(aspectUv - ball2, aspectUv - ball2) + 0.001);
    sum += 0.035 / (dot(aspectUv - ball3, aspectUv - ball3) + 0.001);
    sum += 0.035 / (dot(aspectUv - ball4, aspectUv - ball4) + 0.001);

    // Strict threshold step for fluid metaball effect
    float edge = smoothstep(0.9, 1.0, sum);
    
    vec3 col = mix(vec3(0.01), vec3(0.9, 0.1, 0.4), edge);
    fragColor = vec4(col, 1.0);
  }
  ```
* **Performance Cost**: Very low. Optimized by using squared Euclidean distance (dot product) to avoid costly `sqrt()` calls.
* **Mobile Notes**: Avoid square roots in distance logic. The formula above uses `dot()` which compiles to a single MAD (Multiply-Add) instruction.

---

### Recipe 6: FBM Clouds/Smoke
Fractional Brownian Motion (FBM) for realistic gaseous clouds or organic smoke.

* **Uniforms**:
  * `uniform float uTime;`
  * `uniform vec2 uResolution;`
  * `uniform float uDensity;` (0.0 to 1.0)
* **Vertex Shader**: Same as Boilerplate.
* **Fragment Shader (GLSL ES 3.00)**:
  ```glsl
  #version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 fragColor;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uDensity;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
               mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
  }

  // 4 Octaves of Value Noise FBM
  float fbm(vec2 p) {
    float val = 0.0;
    float amp = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      val += amp * valueNoise(p);
      p = rot * p * 2.0 + vec2(0.0, uTime * 0.2);
      amp *= 0.5;
    }
    return val;
  }

  void main() {
    vec2 aspectUv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / uResolution.y;
    float n = fbm(aspectUv * 2.5);
    
    // Scale output color based on density parameters
    vec3 cloudColor = mix(vec3(0.02), vec3(0.8, 0.85, 0.9), smoothstep(0.3, 0.7, n * uDensity));
    fragColor = vec4(cloudColor, 1.0);
  }
  ```
* **Performance Cost**: High. 4 octaves require 4 value noise checks, meaning 16 random calculations per fragment.
* **Mobile Notes**: Restrict octaves to `3` on mobile GPUs if frame rates drop below 60fps.

---

### Recipe 7: Image Displacement on Hover
Texture warping based on a grayscale displacement map to transition images.

* **Uniforms**:
  * `uniform sampler2D uImage;` (source texture)
  * `uniform sampler2D uDispMap;` (displacement texture)
  * `uniform float uProgress;` (0.0 to 1.0 transition)
* **Vertex Shader**: Same as Boilerplate.
* **Fragment Shader (GLSL ES 3.00)**:
  ```glsl
  #version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 fragColor;

  uniform sampler2D uImage;
  uniform sampler2D uDispMap;
  uniform float uProgress;

  void main() {
    vec4 displacement = texture(uDispMap, vUv);
    
    // Displace UVs horizontally/vertically using red/green displacement channels
    vec2 displacedUv = vec2(
      vUv.x + displacement.r * uProgress * 0.15,
      vUv.y + displacement.g * uProgress * 0.15
    );

    // Keep UVs clamped within [0, 1] range to avoid edge artifacts
    displacedUv = clamp(displacedUv, vec2(0.0), vec2(1.0));

    fragColor = texture(uImage, displacedUv);
  }
  ```
* **Performance Cost**: Very low. 2 texture lookups, basic arithmetic operations.
* **Mobile Notes**: Safe. Ensure the displacement texture is mapped with mipmaps/filters set to `LINEAR` for optimal scaling quality.

---

### Recipe 8: Liquid/Ripple Cursor Distortion
Deforms pixels dynamically relative to a normalized cursor position.

* **Uniforms**:
  * `uniform sampler2D uTexture;` (Scene frame buffer)
  * `uniform vec2 uMouse;` (normalized cursor coordinates)
  * `uniform float uTime;`
  * `uniform float uRadius;` (e.g. 0.25)
  * `uniform float uStrength;` (e.g. 0.08)
* **Vertex Shader**: Same as Boilerplate.
* **Fragment Shader (GLSL ES 3.00)**:
  ```glsl
  #version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 fragColor;

  uniform sampler2D uTexture;
  uniform vec2 uMouse;
  uniform float uTime;
  uniform float uRadius;
  uniform float uStrength;

  void main() {
    vec2 dir = vUv - uMouse;
    float dist = length(dir);
    
    vec2 offsetUv = vUv;

    // Apply distortion if pixel falls within cursor influence radius
    if (dist < uRadius) {
      float falloff = (uRadius - dist) / uRadius;
      
      // Calculate dynamic wave amplitude
      float ripple = sin(dist * 60.0 - uTime * 8.0) * falloff * uStrength;
      offsetUv += normalize(dir) * ripple;
    }

    fragColor = texture(uTexture, clamp(offsetUv, 0.0, 1.0));
  }
  ```
* **Performance Cost**: Low. Branching (`if`) is minimal and evaluates uniformly across blocks of pixels.
* **Mobile Notes**: Safe. To avoid pixelation along edges, apply dynamic clamp or screen-space interpolation filters to the input texture.

---

### Recipe 9: Chromatic Aberration
Splits red, green, and blue color channels away from the screen's center.

* **Uniforms**:
  * `uniform sampler2D uTexture;`
  * `uniform float uAmount;` (aberration magnitude, e.g. 0.015)
* **Vertex Shader**: Same as Boilerplate.
* **Fragment Shader (GLSL ES 3.00)**:
  ```glsl
  #version 300 es
  precision highp float;
  in vec2 vUv;
  out vec4 fragColor;

  uniform sampler2D uTexture;
  uniform float uAmount;

  void main() {
    // Vector pointing from screen center to current UV coordinate
    vec2 centerVector = vUv - 0.5;
    float dist = length(centerVector);

    // Displace UVs radially to isolate red and blue channels
    vec2 redUv = vUv + centerVector * (uAmount * dist);
    vec2 greenUv = vUv;
    vec2 blueUv = vUv - centerVector * (uAmount * dist);

    float r = texture(uTexture, clamp(redUv, 0.0, 1.0)).r;
    float g = texture(uTexture, clamp(greenUv, 0.0, 1.0)).g;
    float b = texture(uTexture, clamp(blueUv, 0.0, 1.0)).b;

    fragColor = vec4(r, g, b, 1.0);
  }
  ```
* **Performance Cost**: Medium. Requires 3 texture sampling operations instead of 1.
* **Mobile Notes**: Use `mediump` coordinates. Three texture lookups can cause cache misses; optimize by using a lower-resolution texture buffer for post-processing if necessary.

---

### Recipe 10: GPU Particle Field
Simulates a grid of floating particles entirely inside the vertex shader to avoid CPU overhead.

* **Uniforms**:
  * `uniform mat4 modelViewMatrix;`
  * `uniform mat4 projectionMatrix;`
  * `uniform float uTime;`
  * `uniform float uSize;` (particle base scale)
* **Vertex Attributes**:
  * `in vec3 position;` (original particle coordinate)
  * `in float aRandomId;` (random identification factor)
* **Vertex Shader (GLSL ES 3.00)**:
  ```glsl
  #version 300 es
  in vec3 position;
  in float aRandomId;

  uniform mat4 modelViewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uSize;

  out float vLife;

  void main() {
    vec3 pos = position;
    
    // Wave motion using sine transformations and seed value
    pos.x += sin(uTime * 0.5 + aRandomId * 10.0) * 0.5;
    pos.y += cos(uTime * 0.7 + aRandomId * 15.0) * 0.8;
    pos.z += sin(uTime * 0.3 + aRandomId * 5.0) * 0.5;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // Attenuate point size by distance to camera (distance attenuation)
    gl_PointSize = uSize * (300.0 / -mvPosition.z);
    
    // Varying variable to simulate lifecycle fading
    vLife = sin(uTime * 0.4 + aRandomId * 6.28);
  }
  ```
* **Fragment Shader (GLSL ES 3.00)**:
  ```glsl
  #version 300 es
  precision highp float;
  in float vLife;
  out vec4 fragColor;

  void main() {
    // Generate circular shape for individual points
    vec2 coord = gl_PointCoord - vec2(0.5);
    if (dot(coord, coord) > 0.25) {
      discard; // Discard pixels falling outside of the radius circle
    }
    
    // Dynamic transparency based on life cycle
    float alpha = smoothstep(-1.0, 1.0, vLife);
    fragColor = vec4(0.0, 0.95, 0.8, alpha * 0.8);
  }
  ```
* **Performance Cost**: Low. Extremely performant relative to CPU coordinate transformations.
* **Mobile Notes**: `discard` calls inside fragment shaders can terminate early z-testing on older mobile GPUs (Mali). For low-end devices, replace `discard` with an alpha mask texture or geometry-based sprites.

---

## 3. High-Performance 2D Alternative: `@paper-design/shaders`

When three.js features (such as cameras, lighting, materials, and loaders) are not required, importing `three` creates unnecessary payload overhead (~600KB+ minified).

For 2D fullscreen backgrounds, hover-distorted elements, or basic UI effects, use **`@paper-design/shaders`** (v1.0.0, NPM: [npmjs.com/package/@paper-design/shaders](https://www.npmjs.com/package/@paper-design/shaders)). It abstracts raw WebGL boilerplate into light setups, reducing application size by up to 90%.

### React Implementation (React 19)
```tsx
import React from 'react';
// MeshGradient component handles underlying WebGL setup automatically
import { MeshGradient } from '@paper-design/shaders-react';

export function FullscreenBackground() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: -1 }}>
      <MeshGradient
        colors={['#0a1128', '#001f54', '#00b4d8', '#90e0ef']}
        speed={0.15}
        dither={true} // Embedded screen-space dithering
        density={1.2}
      />
    </div>
  );
}
```

---

## 4. Modern Performance Antipatterns

### A. CSS `filter: blur(100px)` on Fullscreen Elements
* **The Antipattern**: Using large HTML elements styled with CSS `filter: blur(120px) mix-blend-mode: color` to simulate soft gradient backdrops.
* **The Cost**: Forces the browser's painting engine into software rendering or demands huge memory allocations on the GPU's compost stage. This causes severe frame drops during scrolling and navigation, raising INP to >500ms.
* **The Fix**: Render these effects on the GPU using a single canvas with a dithered GLSL fragment shader.

### B. High-Resolution HTML5 Video Backgrounds
* **The Antipattern**: Implementing fullscreen autoplaying `.mp4` video backgrounds (often >25MB) to represent complex fluid motion.
* **The Cost**: Causes main thread latency due to software/hardware decoding pipelines, stalls frame cycles, blocks page load speeds, and burns mobile battery.
* **The Fix**: Use a mathematical GLSL shader or compute particles. The payload is reduced from megabytes to a few lines of GLSL code.

### C. Creating/Destroying WebGL Contexts
* **The Antipattern**: Allocating individual WebGL canvases for separate cards or elements, causing frequent recreation during router transitions.
* **The Cost**: Triggers browser memory allocation errors (`"WebGL: context lost"`), leading to page crashes.
* **The Fix**: Share a single global canvas. Bind and swap viewport transforms or apply framebuffers for individual elements.
