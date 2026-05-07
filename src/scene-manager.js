/**
 * SceneManager — Three.js r183+ Production Patterns
 *
 * Implements:
 *  - Timer-based animation loop (r183+: Clock → Timer)
 *  - GPU resource disposal (geometry, material, texture maps)
 *  - Responsive canvas (resize handling)
 *  - OrbitControls damping (enableDamping + update)
 *  - Modern color management (outputColorSpace, not outputEncoding)
 *  - Frame-independent animation via delta time
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneManager {
    /**
     * @param {{ canvas?: HTMLCanvasElement, dpr?: number }} options
     */
    constructor({ canvas, dpr = 2 } = {}) {
        // Create a canvas if none provided (Node.js / test environment)
        const actualCanvas = canvas ?? document.createElement('canvas');
        actualCanvas.width = actualCanvas.width || 800;
        actualCanvas.height = actualCanvas.height || 600;

        // ── Renderer ────────────────────────────────────────────
        this.renderer = new THREE.WebGLRenderer({
            canvas: actualCanvas,
            antialias: true,
            alpha: false,
        });
        // Clamp DPR to max 2 for performance
        this.renderer.setPixelRatio(Math.min(dpr, 2));
        this.dpr = this.renderer.getPixelRatio();

        // ── Modern color management (r152+) ─────────────────────
        // ❌ OLD (removed): renderer.outputEncoding = THREE.sRGBEncoding;
        // ✅ NEW (r152+):
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        // ── Scene ───────────────────────────────────────────────
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111111);

        // ── Camera ──────────────────────────────────────────────
        this.camera = new THREE.PerspectiveCamera(
            75,
            (canvas?.clientWidth || 800) / (canvas?.clientHeight || 600),
            0.1,
            100
        );
        this.camera.position.set(0, 0, 3);

        // ── Timer (r183+) — replaces deprecated Clock ───────────
        this.timer = new THREE.Timer();
        this.timer.connect(document); // Page Visibility API — avoids huge deltas when tab hidden

        // ── OrbitControls with damping ──────────────────────────
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // ── Demo mesh ───────────────────────────────────────────
        this.mesh = this._createDemoMesh();
        this.scene.add(this.mesh);

        // ── Lighting ─────────────────────────────────────────────
        this._setupLighting();

        // ── Resize ──────────────────────────────────────────────
        this._boundResize = this.onResize.bind(this);
        window.addEventListener('resize', this._boundResize);

        // ── State ──────────────────────────────────────────────
        this._running = false;
        this.lastDelta = 0;
        this.lastElapsed = 0;

        // Initial size
        const w = canvas?.clientWidth || 800;
        const h = canvas?.clientHeight || 600;
        this.renderer.setSize(w, h);
    }

    // ─── Demo mesh ───────────────────────────────────────────────────────────
    _createDemoMesh() {
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({
            color: 0x4488ff,
            roughness: 0.4,
            metalness: 0.6,
        });
        return new THREE.Mesh(geometry, material);
    }

    _setupLighting() {
        // Baseline ambient — required or directional shadows are BLACK
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));

        const dirLight = new THREE.DirectionalLight(0xffffff, 2);
        dirLight.position.set(5, 5, 5);
        this.scene.add(dirLight);
    }

    // ─── Responsive canvas ──────────────────────────────────────────────────
    /**
     * Handle window resize — all three steps required.
     * @param {number} width
     * @param {number} height
     */
    onResize(width = window.innerWidth, height = window.innerHeight) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    // ─── Animation loop ─────────────────────────────────────────────────────
    /**
     * @param {number} timestamp  — from requestAnimationFrame
     */
    onAnimate(timestamp) {
        if (!this._running) return;

        // Update timer with the rAF timestamp (r183+ pattern)
        this.timer.update(timestamp);

        this.lastDelta = this.timer.getDelta();
        this.lastElapsed = this.timer.getElapsed();

        // Controls damping must be updated every frame
        this.controls.update();

        // Frame-independent rotation: 2 rad/s regardless of frame rate
        this.mesh.rotation.y += 2 * this.lastDelta;
        this.mesh.rotation.x += 0.5 * this.lastDelta;

        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Start the animation loop using setAnimationLoop (handles XR, tab visibility)
     */
    start() {
        this._running = true;
        // ✅ setAnimationLoop — NOT raw requestAnimationFrame
        // It handles XR session management and pauses when tab is hidden
        this.renderer.setAnimationLoop(this.onAnimate.bind(this));
    }

    stop() {
        this._running = false;
        this.renderer.setAnimationLoop(null);
    }

    // ─── GPU resource disposal ──────────────────────────────────────────────
    /**
     * Remove a mesh and fully dispose its GPU resources.
     * All three steps required — Three.js never auto-collects GPU memory.
     *
     * @param {THREE.Mesh} mesh
     */
    removeMesh(mesh) {
        // 1. Dispose geometry
        mesh.geometry.dispose();

        // 2. Dispose all texture maps before disposing material
        const { material } = mesh;
        if (material.map) material.map.dispose();
        if (material.normalMap) material.normalMap.dispose();
        if (material.roughnessMap) material.roughnessMap.dispose();
        if (material.metalnessMap) material.metalnessMap.dispose();
        if (material.alphaMap) material.alphaMap.dispose();
        if (material.emissiveMap) material.emissiveMap.dispose();
        if (material.aoMap) material.aoMap.dispose();
        if (material.lightMap) material.lightMap.dispose();
        if (material.bumpMap) material.bumpMap.dispose();
        if (material.displacementMap) material.displacementMap.dispose();

        // 3. Dispose material
        material.dispose();

        // 4. Remove from scene
        this.scene.remove(mesh);
    }

    /**
     * Fully dispose renderer and all GPU resources.
     */
    dispose() {
        this.stop();

        // Disconnect timer (Page Visibility API hook)
        this.timer.disconnect();
        this.timer.dispose();

        // Remove resize listener
        window.removeEventListener('resize', this._boundResize);

        // Dispose all meshes currently in scene
        const meshes = [];
        this.scene.traverse(obj => {
            if (obj.isMesh) meshes.push(obj);
        });
        meshes.forEach(m => this.removeMesh(m));

        // Dispose renderer (frees WebGL context + GPU resources)
        this.renderer.dispose();

        // Dispose controls
        this.controls.dispose();
    }
}
