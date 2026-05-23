# 3D & Media Asset Pipeline: Budgets & Optimizations (May 2026)

This document outlines the optimization workflows, file format selections, and performance budgets for web assets (3D GLB/glTF files, images, video, and vector animations) as of May 2026.

---

## 1. glTF/GLB Optimization Workflow

To prevent network and GPU memory bottlenecks, every 3D mesh must be optimized via the **glTF-Transform CLI** (v4.0.0, NPM: [npmjs.com/package/@gltf-transform/cli](https://www.npmjs.com/package/@gltf-transform/cli)) before publication.

### Phase 1: Mesh & Geometry Compression
*   **Draco Geometry Compression**: Best for heavy meshes with high vertex counts. Reduces file size but requires CPU decoding overhead on load.
*   **Meshopt**: Best for models with complex morph targets or skeletal animations. Pairs with HTTP gzip/Brotli compression.

```bash
# Install CLI globally
npm install --global @gltf-transform/cli

# Draco Compression (Method: Edgebreaker)
gltf-transform draco input.glb output_draco.glb --method edgebreaker

# Meshopt Compression (High Compression)
gltf-transform meshopt input.glb output_meshopt.glb
```

### Phase 2: KTX2 / Basis texture compression
Basis Universal converts standard PNG/JPEG textures inside a GLB into **KTX2 (`.ktx2`)** container formats on the GPU. It bypasses CPU VRAM unpacking, uploading compressed blocks directly to VRAM.

*   *Prerequisite: Install `toktx` from the [KTX-Software Repository](https://github.com/KhronosGroup/KTX-Software).*

```bash
# UASTC: High-fidelity (Best for normal maps, metallic/roughness maps, text)
gltf-transform uastc input.glb output_uastc.glb \
  --slots "{normalTexture,occlusionTexture,metallicRoughnessTexture}" \
  --level 4 --rdo --rdo-lambda 4 --zstd 18 --verbose

# ETC1S: Smallest footprint (Best for diffuse/albedo maps, simple textures)
gltf-transform etc1s input.glb output_etc1s.glb --quality 255 --verbose
```

---

## 2. Blender Baking (Lightmaps & AO)

*RU Gloss: Запекание текстур освещения (Baking lighting details).* WebGL rendering engines struggle with real-time shadow computation on mobile devices. Baking shadows into textures allows you to achieve high-quality visuals on low-end hardware.

### Blender Cycle Baking Workflow
1.  **UV Mapping Setup**: Allocate two UV maps for the mesh:
    *   `UVMap` (Channel 0): Used for tiling base color and roughness textures.
    *   `LightmapUV` (Channel 1): Must be non-overlapping. Set UV Island margin to a minimum of `2px` to prevent light bleed.
2.  **Baking Options**:
    *   Switch Render Engine to **Cycles**.
    *   Create a new image texture in the Shader Editor named `Lightmap_Bake` (set resolution to `1024x1024` or `2048x2048` based on budget).
    *   Ensure this new texture node is selected (active) but not connected to the BSDF node.
    *   In the Render properties pane, expand the **Bake** section. Set Bake Type to **Diffuse** (enable *Direct* and *Indirect* lighting contributions, disable *Color*) or select **Ambient Occlusion**.
    *   Click **Bake**. Export this image map as a `.png`.

### Loading baked maps in Three.js
WebGL materials read lightmaps through the second UV channel coordinates.

```javascript
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();

// Load the baked lightmap texture
const lightmap = textureLoader.load('/assets/lightmap_baked.webp');
lightmap.flipY = false;
lightmap.channel = 1; // Assign to second UV channel

loader.load('/assets/scene.glb', (gltf) => {
  gltf.scene.traverse((node) => {
    if (node.isMesh) {
      node.material.lightMap = lightmap;
      node.material.lightMapIntensity = 1.2;
      // Disable real-time shadows to save draw calls
      node.castShadow = false;
      node.receiveShadow = false;
    }
  });
  scene.add(gltf.scene);
});
```

---

## 3. Performance Budgets (WebGL/3D)

Mobile device capabilities (specifically, fill-rate limits and thermal throttling) require distinct asset budget guidelines compared to desktop systems:

| Constraint | Mobile Budget (Target: 60fps) | Desktop Budget (Target: 120fps) |
| :--- | :--- | :--- |
| **Max GLB File Size** | < 2.5 MB | < 8.0 MB |
| **Max Scene Polygons** | < 60,000 Triangles | < 250,000 Triangles |
| **Max Draw Calls** | < 35 calls | < 120 calls |
| **Max Texture Size** | 1024px (Never 2048px unless critical) | 2048px |
| **Texture Formats** | KTX2 (ETC1S) | KTX2 (UASTC) or WebP |
| **Shadow Pipeline** | Baked lightmaps only | 1 Directional Shadow Map + Lightmaps |

---

## 4. Modern Image Delivery (AVIF vs WebP)

In May 2026, **AVIF** is the industry standard for compressed web imagery, offering up to **30% better compression** than WebP at identical visual fidelity.

### Responsive Image Template
Leverages AVIF formats with responsive viewport sizing and priority hint optimizations.

```html
<picture>
  <!-- AVIF Sources -->
  <source 
    srcset="/images/hero-320.avif 320w, /images/hero-640.avif 640w, /images/hero-1280.avif 1280w" 
    sizes="(max-width: 640px) 100vw, 50vw"
    type="image/avif" />
  
  <!-- WebP Fallback Sources -->
  <source 
    srcset="/images/hero-320.webp 320w, /images/hero-640.webp 640w, /images/hero-1280.webp 1280w" 
    sizes="(max-width: 640px) 100vw, 50vw"
    type="image/webp" />

  <!-- Base JPEG Fallback (with Fetch Priority set to high for LCP elements) -->
  <img 
    src="/images/hero-640.jpg" 
    alt="Corporate dashboard visual interface" 
    width="640" 
    height="480"
    fetchpriority="high"
    decoding="async"
    loading="eager" />
</picture>
```

---

## 5. Web Video Integration

Autoplay backgrounds should only be used when static layouts cannot achieve the desired visual experience.

### Formatting Requirements
*   **Video Formats**: Serve **AV1** (`.mp4`) as the primary source, **HEVC** for Apple/Safari devices, and **H.264** as a general fallback.
*   **File Size Caps**: Background video loops must remain under **1.5MB** on mobile networks and under **3.5MB** on desktop.
*   **Autoplay Restrictions**: Videos must be muted, configured to play inline, and loop.

```html
<video 
  autoplay 
  muted 
  loop 
  playsinline 
  preload="auto"
  poster="/videos/background-poster.webp"
  class="bg-video">
  <!-- AV1 (Preferred for modern browsers) -->
  <source src="/videos/background-av1.mp4" type="video/mp4; codecs=av01.0.00M.08" />
  <!-- HEVC (Preferred for Safari/iOS) -->
  <source src="/videos/background-hevc.mp4" type="video/mp4; codecs=hvc1" />
  <!-- H.264 (Universal fallback) -->
  <source src="/videos/background-h264.mp4" type="video/mp4" />
</video>
```

---

## 6. dotLottie & ThorVG Vector Migration

*RU Gloss: Нодальная рендер-система ThorVG (ThorVG vector rendering).* In 2026, legacy JSON-based `lottie-web` players (~280KB) are deprecated. Projects should use **`.lottie`** zip containers powered by the **ThorVG rendering engine** (`dotlottie-web` runtime: **~14KB gzipped**), which delivers up to **80% faster rendering** and **70% lower memory usage**.

### Implementation Setup
```html
<!-- Import dotLottie web component player -->
<script type="module" src="https://unpkg.com/@dotlottie/player-component@2.7.12/dist/dotlottie-player.mjs"></script>

<dotlottie-player
  src="/assets/animation.lottie"
  background="transparent"
  speed="1"
  style="width: 300px; height: 300px;"
  loop
  autoplay>
</dotlottie-player>
```

---

## 7. Automated CI Budget Verification

This script (`scripts/assert-asset-budgets.js`) validates GLB, image, and animation files during build cycles, failing the CI/CD pipeline if any asset exceeds size thresholds.

```javascript
// scripts/assert-asset-budgets.js
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

// Define asset budget limits (sizes in Bytes)
const BUDGETS = {
  '.glb': 2.5 * 1024 * 1024,  // 2.5 MB
  '.gltf': 2.5 * 1024 * 1024, // 2.5 MB
  '.avif': 350 * 1024,        // 350 KB
  '.webp': 500 * 1024,        // 500 KB
  '.mp4': 3.5 * 1024 * 1024,  // 3.5 MB
  '.lottie': 80 * 1024        // 80 KB
};

async function checkAssets() {
  const files = await glob('public/assets/**/*{*.glb,*.gltf,*.avif,*.webp,*.mp4,*.lottie}');
  let failed = false;

  console.info(`[Asset Auditor] Analyzing ${files.length} production assets...`);

  files.forEach((file) => {
    const stats = fs.statSync(file);
    const ext = path.extname(file).toLowerCase();
    const limit = BUDGETS[ext];

    if (limit && stats.size > limit) {
      console.error(
        `\x1b[31m[LIMIT EXCEEDED]\x1b[0m ${file}: Size is ${(stats.size / 1024 / 1024).toFixed(2)}MB. Limit is ${(limit / 1024 / 1024).toFixed(2)}MB.`
      );
      failed = true;
    }
  });

  if (failed) {
    console.error('\x1b[31m[FAIL]\x1b[0m One or more assets exceeded size budgets.');
    process.exit(1);
  } else {
    console.info('\x1b[32m[PASS]\x1b[0m All assets are within target performance budgets.');
    process.exit(0);
  }
}

checkAssets().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

---

## 8. Asset Antipatterns

* **Loading Uncompressed GLBs (>15MB)**: Deploying raw meshes directly from Blender/CAD models without applying Draco or Meshopt compression. This results in slow load times and high network costs.
* **4K Texture Maps on Mobile Viewports**: Using `4096px` albedo or normal maps in mobile builds. This consumes valuable GPU memory and can lead to device crashes.
* **Raw JSON Lottie Files**: Storing animations as large, uncompressed `.json` Lottie files alongside older, heavy JS player libraries.
* **Dynamic Shadows for Multi-Mesh Scenes**: Configuring real-time dynamic shadows for multiple meshes on mobile viewports. Use baked lightmaps instead.
* **Serving Non-Responsive LCP Images**: Serving a single large desktop image to mobile screens. Use responsive `srcset` and `<picture>` tags instead.
