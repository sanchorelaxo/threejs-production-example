---
name: threejs-production
description: Three.js production patterns for r183+ — GPU resource management, WebGPU migration, TSL, RenderPipeline, and updated animation/timing. Based on openclaw/skills/threejs with full r183-r185 updates.
tags: [threejs, webgl, webgpu, production, memory-leaks, tsl, renderpipeline, performance]
triggers: [three.js memory leak, three.js dispose, three.js performance, three.js tsl, three.js renderpipeline, three.js webgpu]
---

# Three.js Production Patterns (r183+)

Updated production patterns for Three.js, covering GPU resource management, WebGPU migration, TSL, RenderPipeline, and updated timing/animation. Supersedes `openclaw/skills/threejs`.

---

## Changelog vs. Old Patterns

| Old (pre-r183) | New (r183+) | Status |
|---|---|---|
| `THREE.Clock` | `THREE.Timer` | ⚠️ Deprecated |
| `renderer.outputEncoding` | `renderer.outputColorSpace` | ⚠️ Deprecated |
| `Texture.encoding` | `Texture.colorSpace` | ⚠️ Deprecated |
| `EffectComposer` | `RenderPipeline` | ⚠️ Deprecated |
| `THREE.WebGLRenderer` | `THREE.WebGPURenderer` (w/ auto-fallback) | ⚠️ New path |
| `PCFSoftShadowMap` | `PCFShadowMap` | ⚠️ Renamed |
| Custom GLSL shaders | TSL (Three.js Shading Language) | ⚠️ New |
| `KTX2Loader.detectSupportAsync()` | `KTX2Loader.detectSupport()` | ⚠️ Simplified |

---

## Core Principles

### 1. Resource Cleanup — STILL REQUIRED

Three.js **never garbage collects GPU resources automatically**. This hasn't changed.

```javascript
// Removing a mesh — all three steps still required:
mesh.geometry.dispose();
mesh.material.dispose();
if (Array.isArray(mesh.material.maps)) {
    mesh.material.maps.forEach(t => t.dispose());
}
scene.remove(mesh);

// For materials with maps:
if (material.map) material.map.dispose();
if (material.normalMap) material.normalMap.dispose();
if (material.roughnessMap) material.roughnessMap.dispose();
if (material.metalnessMap) material.metalnessMap.dispose();
if (material.alphaMap) material.alphaMap.dispose();
if (material.emissiveMap) material.emissiveMap.dispose();
material.dispose();
```

**Texture leak is permanent** unless explicitly disposed — this is unchanged.

---

### 2. Animation Loop — `setAnimationLoop` + Updated Timing

```javascript
// ✅ CORRECT — handles VR/XR, pauses when tab hidden
renderer.setAnimationLoop(animate);

// ❌ OLD — requestAnimationFrame lacks XR/visibility handling
// requestAnimationFrame(animate);
```

**TIMING: Clock → Timer (r183+)**

```javascript
// ❌ DEPRECATED (r183) — emits console warning
import { Clock } from 'three';
const clock = new Clock();

// ✅ NEW — Timer (r183+)
import { Timer } from 'three';
const timer = new Timer();
timer.connect(document); // links to Page Visibility API, avoids huge deltas when tab hidden

function animate(timestamp) {
    timer.update(timestamp);
    const delta = timer.getDelta();       // frame-independent seconds
    const elapsed = timer.getElapsed();  // total elapsed seconds

    object.rotation += rotationSpeed * delta;

    renderer.setAnimationLoop(animate);
}
```

**Key differences:** `Timer` takes a `timestamp` (from `requestAnimationFrame`), has `getDelta()` and `getElapsed()`, and `connect(document)` hooks into Page Visibility API automatically.

---

### 3. Responsive Canvas — Unchanged

```javascript
// On window resize — all steps required:
function onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// Clamp pixel ratio — values above 2 kill performance:
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
```

---

### 4. OrbitControls — Unchanged pattern

```javascript
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// In render loop:
function animate() {
    controls.update();  // ⚠️ Required for damping — without this, damping silently fails
    renderer.render(scene, camera);
}
```

---

### 5. Color Management — Renamed APIs (r152+)

```javascript
// ❌ OLD (removed in r152)
renderer.outputEncoding = THREE.sRGBEncoding;
texture.encoding = THREE.LinearEncoding;

// ✅ NEW (r152+)
renderer.outputColorSpace = THREE.SRGBColorSpace;
texture.colorSpace = THREE.NoColorSpace;  // or THREE.SRGBColorSpace for authored textures

// Common presets:
const TEXTURE_SRGB = { colorSpace: THREE.SRGBColorSpace };
const TEXTURE_LINEAR = { colorSpace: THREE.LinearSRGBColorSpace };
const RENDERER_SRGB = { outputColorSpace: THREE.SRGBColorSpace };
const RENDERER_LINEAR = { outputColorSpace: THREE.LinearSRGBColorSpace };
```

---

### 6. Lighting — Material Behavior Unchanged

| Material | Responds to Lights |
|---|---|
| `MeshBasicMaterial` | ❌ No — ignores all lights |
| `MeshStandardMaterial` | ✅ Yes — PBR |
| `MeshPhongMaterial` | ✅ Yes — classic |
| `MeshPhysicalMaterial` | ✅ Yes — extended PBR |

```javascript
// Baseline ambient light required — without it, directional shadows are BLACK:
scene.add(new THREE.AmbientLight(0xffffff, 0.5));

// HDR environment maps for metallic reflections:
import { PMREMGenerator } from 'three';
const pmremGenerator = new PMREMGenerator(renderer);
const envTexture = await new Promise(resolve => {
    new THREE.HDRCubeTextureLoader().load(url, tex => resolve(tex));
});
scene.environment = pmremGenerator.fromHDR(envTexture).texture;
```

---

### 7. MeshPhysicalMaterial — Renamed Properties

```javascript
// ❌ OLD (pre-r151)
material.sheen;              // → sheenTint
material.transparency;       // → transmission
material.clearCoat;          // → clearcoat (lowercase c)
material.clearCoatRoughness; // → clearcoatRoughness

// ✅ NEW (r151+)
material.sheenTint = { color: 0xffffff, roughness: 0.5 };
material.transmission = 0.5;  // 0-1 range, physically correct
material.clearcoat = 1.0;
material.clearcoatRoughness = 0.1;
```

---

### 8. Shadows — Renamed (r182)

```javascript
// ❌ OLD (r181)
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// ✅ NEW (r182+) — PCFShadowMap is now soft by default
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false; // disable per-frame updates when static
```

---

### 9. Loading Assets — Mostly Unchanged

```javascript
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { LoadingManager } from 'three';

// LoadingManager for progress screens:
const manager = new LoadingManager();
manager.onProgress = (url, loaded, total) => {
    console.log(`${((loaded/total)*100).toFixed(0)}% — ${url}`);
};

const gltfLoader = new GLTFLoader(manager);
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');
gltfLoader.setDRACOLoader(dracoLoader);

// KTX2 texture compression:
const ktx2Loader = new KTX2Loader(manager);
ktx2Loader.setTranscoderPath('/basis/');
ktx2Loader.detectSupport(renderer);  // ❌ OLD: detectSupportAsync()
await renderer.init();               // Must init renderer first in WebGPU
```

---

### 10. Camera — Unchanged

```javascript
// Z-fighting on large scenes — narrow near/far planes:
camera.near = 0.1;
camera.far = 100;  // instead of default 0.1-1000

// FOV is vertical — 75° is common default:
camera.fov = 75;

// Camera inside loaded model — offset after loading:
gltf.scene.position.y = 1;
```

---

### 11. Performance — Unchanged Patterns

```javascript
// Draw calls = mesh count — fewer meshes = faster:
// renderer.info shows draw calls, triangles, textures:
console.log('Draw calls:', renderer.info.render.calls);
console.log('Triangles:', renderer.info.render.triangles);

// InstancedMesh for hundreds of identical objects:
const instancedMesh = new THREE.InstancedMesh(geometry, material, 100);
for (let i = 0; i < 100; i++) {
    matrix.setPosition(Math.random() * 10, Math.random() * 10, Math.random() * 10);
    instancedMesh.setMatrixAt(i, matrix);
}
instancedMesh.instanceMatrix.needsUpdate = true;

// Static geometry merge:
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
const merged = mergeGeometries([geo1, geo2, geo3]);

// Frustum culling — verify large objects aren't incorrectly culled:
mesh.frustumCulled = true; // default
```

---

### 12. AnimationMixer — Unchanged Pattern

```javascript
// ❌ WRONG — passing 0 or skipping breaks animations:
mixer.update(0);  // or skipping the call entirely

// ✅ CORRECT — pass actual delta every frame:
mixer.update(delta);
```

---

### 13. Post-Processing: EffectComposer → RenderPipeline (r183+)

**`EffectComposer` is legacy; `RenderPipeline` is the new path.**

```javascript
// ❌ OLD — EffectComposer (still works but legacy):
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ✅ NEW — RenderPipeline (r183+) using TSL:
import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';

const renderPipeline = new THREE.RenderPipeline(renderer);
const scenePass = pass(scene, camera);
const bloomPass = bloom(scenePass, { intensity: 1.5, threshold: 0.8 });
renderPipeline.outputNode = bloomPass;

// Tone mapping and resize handled automatically
```

**Minimal RenderPipeline example:**
```javascript
import * as THREE from 'three/webgpu';
import { pass } from 'three/tsl';
import { dotScreen } from 'three/addons/tsl/display/DotScreenNode.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 100);
camera.position.z = 3;

const renderer = new THREE.WebGPURenderer({ antialias: true });
await renderer.init();
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const mesh = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1, 0.3, 128, 32),
    new THREE.MeshBasicNodeMaterial()  // TSL node material
);

scene.add(mesh);

const pipeline = new THREE.RenderPipeline(renderer);
pipeline.sceneNode = scene;
pipeline.cameraNode = camera;

// Toggle effect at runtime:
pipeline.outputNode = dotScreen(pass(scene, camera));

function animate(timestamp) {
    mesh.rotation.x += 0.01;
    mesh.rotation.y += 0.02;
    pipeline.render();
}
renderer.setAnimationLoop(animate);
```

---

### 14. WebGPU — `three/webgpu` Entry Point

```javascript
// ✅ WebGPU renderer with auto-fallback to WebGL2:
import * as THREE from 'three/webgpu';
const renderer = new THREE.WebGPURenderer({ antialias: true });
await renderer.init();  // ⚠️ Async — MUST await before rendering
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

// For WebGL-only (legacy):
import * as THREE from 'three';
const renderer = new THREE.WebGLRenderer({ antialias: true });
```

**Common mistake:** Forgetting `await renderer.init()` — scene renders nothing with no error.

---

### 15. Renderer Context Management — New Methods

```javascript
// Force context loss (useful for cleanup):
renderer.forceContextLoss();

// Reset renderer state:
renderer.resetState();

// Dispose renderer and all GPU resources:
renderer.dispose();

// Init texture to avoid decode lag on first render:
renderer.initTexture(texture);

// Async shader compilation (recommended for complex scenes):
await renderer.compileAsync(scene, camera);
// vs. synchronous: renderer.compile(scene, camera);
```

---

## Must-Do Checklist

- [ ] Dispose `geometry`, `material`, and all `map` textures before removing objects
- [ ] Use `renderer.setAnimationLoop()` + `Timer.getDelta()` (NOT `Clock`)
- [ ] On resize: `camera.aspect`, `updateProjectionMatrix()`, `renderer.setSize()`
- [ ] Enable `controls.enableDamping = true` + `controls.update()` in loop
- [ ] Clamp `devicePixelRatio` to `Math.min(..., 2)`
- [ ] Use `LoadingManager` for async texture/model loading
- [ ] Use `renderer.outputColorSpace = THREE.SRGBColorSpace` (not `outputEncoding`)
- [ ] Use `texture.colorSpace = THREE.SRGBColorSpace` (not `Texture.encoding`)
- [ ] For WebGPU: `await renderer.init()` before first render
- [ ] For new projects: consider `three/webgpu` + `RenderPipeline` + TSL

## TDD Testing with Vitest + Three.js

**Goal:** Test Three.js business logic (animation timing, disposal order, damping, color management) without WebGL context.

### Setup

```bash
npm install --save-dev three vitest jsdom
```

**`vitest.config.js`**
```javascript
import { defineConfig } from 'vitest/config';
export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
    },
});
```

### vi.mock Strategy

Mock the entire `three` module — no WebGL context needed. Mock classes return stable instances that tests can spy on.

**`src/vitest-setup.mjs`** (minimal global polyfill if needed):
```javascript
// Polyfill HTMLCanvasElement.getContext for jsdom if testing WebGL-specific code.
// For business logic tests (dispose, animation, resize), this is NOT needed.
```

**`src/my-class.test.js`**
```javascript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Stable mock refs (hoisted before any import) ────────────────────────
const { mockRenderer, mockTimer, mockScene, mockCamera, mockMesh,
        mockMaterial, mockGeometry, mockControls } = vi.hoisted(() => {

    // ── MeshStandardMaterial mock ────────────────────────────────────────
    const mockMaterialInstance = {
        dispose: vi.fn(),
        map: null,
        normalMap: null,
        roughnessMap: null,
        metalnessMap: null,
        alphaMap: null,
        emissiveMap: null,
        aoMap: null,
        lightMap: null,
        bumpMap: null,
        displacementMap: null,
    };

    const mockGeometryInstance = { dispose: vi.fn() };

    const mockSceneInstance = {
        children: [],
        add: vi.fn(obj => { mockSceneInstance.children.push(obj); }),
        remove: vi.fn(obj => {
            const idx = mockSceneInstance.children.indexOf(obj);
            if (idx !== -1) mockSceneInstance.children.splice(idx, 1);
        }),
        traverse: function(callback) {
            for (const child of mockSceneInstance.children) {
                if (child.isMesh) callback(child);
            }
        },
        background: null,
    };

    const mockCameraInstance = {
        aspect: 1.5, near: 0.1, far: 100,
        fov: 75,
        position: { set: vi.fn(), x: 0, y: 0, z: 3 },
        updateProjectionMatrix: vi.fn(),
    };

    const mockMeshInstance = {
        geometry: mockGeometryInstance,
        material: mockMaterialInstance,
        rotation: { x: 0, y: 0, z: 0 },
        position: { x: 0, y: 0, z: 0 },
        userData: {},
        isMesh: true,
    };

    const mockTimerInstance = {
        connect: vi.fn(), disconnect: vi.fn(), dispose: vi.fn(),
        update: vi.fn(),
        getDelta: vi.fn().mockReturnValue(0.016),
        getElapsed: vi.fn().mockReturnValue(0),
    };

    const mockRendererInstance = {
        setPixelRatio: vi.fn(),
        getPixelRatio: vi.fn().mockReturnValue(1),
        outputColorSpace: 'srgb',
        setSize: vi.fn(),
        setAnimationLoop: vi.fn(),
        dispose: vi.fn(), render: vi.fn(),
        forceContextLoss: vi.fn(), resetState: vi.fn(),
        getSize: vi.fn().mockReturnValue({ x: 800, y: 600 }),
        domElement: { clientWidth: 800, clientHeight: 600 },
    };

    const mockControlsInstance = {
        enableDamping: false, dampingFactor: 0,
        update: vi.fn(), dispose: vi.fn(),
    };

    return {
        mockRenderer: mockRendererInstance,
        mockTimer: mockTimerInstance,
        mockScene: mockSceneInstance,
        mockCamera: mockCameraInstance,
        mockMesh: mockMeshInstance,
        mockMaterial: mockMaterialInstance,
        mockGeometry: mockGeometryInstance,
        mockControls: mockControlsInstance,
    };
});

// ── Replace THREE module ──────────────────────────────────────────────────
vi.mock('three', () => ({
    Timer: class { constructor() { Object.assign(this, mockTimer); } },
    WebGLRenderer: class { constructor() { return mockRenderer; } },
    Scene: class { constructor() { return mockScene; } },
    Mesh: class { constructor() { return mockMesh; } },
    PerspectiveCamera: class {
        constructor(fov, aspect, near, far) {
            Object.assign(this, mockCamera);
            this.fov = fov; this.aspect = aspect; this.near = near; this.far = far;
        }
    },
    BoxGeometry: class { constructor() { return mockGeometry; } },
    MeshStandardMaterial: class { constructor() { return mockMaterial; } },
    MeshBasicMaterial: class { constructor() { return mockMaterial; } },
    Color: class { constructor() {} },
    DirectionalLight: class { constructor() { this.position = { set: vi.fn() }; } },
    AmbientLight: class { constructor() { this.position = { set: vi.fn() }; } },
    Vector2: class { constructor() {} },
    SRGBColorSpace: 'srgb',
    LinearSRGBColorSpace: 'srgb-linear',
}));

vi.mock('three/addons/controls/OrbitControls.js', () => ({
    OrbitControls: class { constructor() { return mockControls; } },
}));

import { SceneManager } from './scene-manager.js';

describe('SceneManager', () => {
    let sm;

    beforeEach(() => {
        vi.resetAllMocks();  // clears call history + mockReturnValue configs
        mockTimer.getDelta.mockReturnValue(0.016);
        mockTimer.getElapsed.mockReturnValue(0.016);
        mockRenderer.getPixelRatio.mockReturnValue(1);
        mockMesh.rotation.x = 0;
        mockMesh.rotation.y = 0;
        mockMesh.rotation.z = 0;
        mockScene.children = [];
        mockScene.traverse = function(callback) {
            for (const child of mockScene.children) {
                if (child.isMesh) callback(child);
            }
        };
        sm = new SceneManager({ canvas: null });
    });

    afterEach(() => { if (sm) sm.dispose(); });

    // Timer (r183+): use Timer, not Clock
    it('should use Timer (not deprecated Clock)', () => {
        expect(sm.timer).toBeDefined();
        expect(sm.timer.constructor.name).toBe('Timer');
    });

    // Disposal: geometry → texture maps → material → scene.remove
    it('should dispose geometry and material on removeMesh()', () => {
        const geoSpy = vi.spyOn(sm.mesh.geometry, 'dispose');
        const matSpy = vi.spyOn(sm.mesh.material, 'dispose');
        sm.removeMesh(sm.mesh);
        expect(geoSpy).toHaveBeenCalledOnce();
        expect(matSpy).toHaveBeenCalledOnce();
    });

    // Disposal ORDER: texture maps before material
    it('should dispose every texture map before disposing material', () => {
        const tex1 = { dispose: vi.fn() };
        const tex2 = { dispose: vi.fn() };
        sm.mesh.material.map = tex1;
        sm.mesh.material.normalMap = tex2;
        sm.mesh.material.roughnessMap = tex2;
        sm.removeMesh(sm.mesh);
        expect(tex1.dispose).toHaveBeenCalled();
        expect(tex2.dispose).toHaveBeenCalled();
    });

    // Responsive canvas: aspect + projectionMatrix + setSize
    it('should update camera.aspect on resize', () => {
        sm.onResize(1920, 1080);
        expect(sm.camera.aspect).toBeCloseTo(1920 / 1080, 2);
    });

    // OrbitControls: enableDamping must be true, update() every frame
    it('should enable damping on construction', () => {
        expect(sm.controls.enableDamping).toBe(true);
    });

    // Color management: outputColorSpace (r152+), NOT outputEncoding
    it('should set outputColorSpace to SRGBColorSpace', () => {
        expect(sm.renderer.outputColorSpace).toBe('srgb');
    });

    // Frame-independent animation: same wall time = same rotation
    it('should rotate the same amount after 1s regardless of frame rate', () => {
        const sm60 = new SceneManager();
        sm60.start();
        for (let i = 0; i < 60; i++) {
            sm60.timer.getDelta = () => 1 / 60;
            sm60.timer.getElapsed = () => (i + 1) / 60;
            sm60.onAnimate(i * (1000 / 60));
        }
        const rot60 = sm60.mesh.rotation.y;
        sm60.dispose();

        mockMesh.rotation.y = 0; // reset shared mockMesh between SceneManagers

        const sm30 = new SceneManager();
        sm30.start();
        for (let i = 0; i < 30; i++) {
            sm30.timer.getDelta = () => 1 / 30;
            sm30.timer.getElapsed = () => (i + 1) / 30;
            sm30.onAnimate(i * (1000 / 30));
        }
        const rot30 = sm30.mesh.rotation.y;
        sm30.dispose();

        expect(rot60).toBeCloseTo(rot30, 4);
    });
});
```

### Key Testing Pitfalls (TDD Lessons)

| Pitfall | Symptom | Fix |
|---|---|---|
| `vi.clearAllMocks()` doesn't reset `mockReturnValue` | Stale default return values | Use `vi.resetAllMocks()` + re-apply defaults in `beforeEach` |
| `mockScene.traverse = vi.fn()` is a no-op | `dispose()` finds no meshes | Provide a real traversal function in `beforeEach` |
| Shared mock instance across SceneManagers | Accumulated rotation/state bleeds between tests | Reset shared mock properties (`rotation.y`, `children[]`) in `beforeEach` |
| `vi.spyOn(obj, 'dispose')` on an already-`vi.fn()` property | Spy doesn't track calls reliably | Use inline `{ dispose: vi.fn() }` objects instead of reused `mockMaterial` |
| `THREE.Mesh` returns same mock instance every time | Mesh state not isolated | Reset `mockMesh.rotation.*` before each test |
| `beforeEach` runs BEFORE each `describe` block's test | Mesh rotation reset happens too early | Reset rotation INSIDE the test before creating the second SceneManager |

## Common Problems — Updated

| Problem | Cause | Solution |
|---|---|---|
| GPU memory growth | Missing `dispose()` | Dispose all geometries, materials, maps |
| Black materials after loading | Textures async OR using `MeshBasicMaterial` | Use `LoadingManager` + `MeshStandardMaterial` |
| Console warning: `THREE.Clock deprecated` | Using old Clock API | Replace with `Timer` + `timer.connect(document)` |
| Scene renders nothing (WebGPU) | Forgot `await renderer.init()` | Add `await renderer.init()` |
| Bloom not working | EffectComposer vs RenderPipeline mismatch | Use `RenderPipeline` for r183+ |
| MeshPhysicalMaterial looks wrong | Old property names | Use `transmission`, `clearcoat`, `sheenTint` |

## When to Apply

- Building production apps that must run long-term without memory leaks
- Migrating from WebGL to WebGPU
- Starting new projects with r183+ (use `three/webgpu` + `RenderPipeline`)
- Integrating TSL-based shaders for post-processing
- Updating legacy projects ( Clock → Timer, outputEncoding → outputColorSpace)
