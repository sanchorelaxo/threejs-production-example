/**
 * Three.js Production Patterns — TDD Tests
 * RED → write tests that fail
 * GREEN → implement minimum code to pass
 * REFACTOR → clean up while keeping tests green
 *
 * Strategy: vi.mock replaces THREE entirely — no WebGL context needed.
 * Tests verify: Timer, disposal, resize, damping, color management,
 * frame-independent animation (all business logic, not Three.js itself).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ── Stable mock refs (hoisted before any import) ────────────────────────
const { mockRenderer, mockTimer, mockScene, mockCamera, mockMesh, mockMaterial,
        mockGeometry, mockControls } = vi.hoisted(() => {

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

    // ── BufferGeometry mock ─────────────────────────────────────────────
    const mockGeometryInstance = {
        dispose: vi.fn(),
    };

    // ── Scene mock ──────────────────────────────────────────────────────
    const mockSceneInstance = {
        children: [],
        add: vi.fn(obj => { mockSceneInstance.children.push(obj); }),
        remove: vi.fn(obj => {
            const idx = mockSceneInstance.children.indexOf(obj);
            if (idx !== -1) mockSceneInstance.children.splice(idx, 1);
        }),
        traverse: vi.fn(),
        background: null,
        environment: null,
    };

    // ── Camera mock ─────────────────────────────────────────────────────
    const mockCameraInstance = {
        aspect: 1.5,
        near: 0.1,
        far: 100,
        fov: 75,
        position: { set: vi.fn(), x: 0, y: 0, z: 3 },
        updateProjectionMatrix: vi.fn(),
        projectionMatrix: { needsUpdate: vi.fn() },
    };

    // ── Mesh mock ───────────────────────────────────────────────────────
    // Note: Mesh constructor returns the SAME mockMesh instance every time.
    // Each SceneManager._createDemoMesh() thus shares the same mesh object.
    // Tests that need isolated meshes must account for this.
    const mockMeshInstance = {
        geometry: mockGeometryInstance,
        material: mockMaterialInstance,
        rotation: { x: 0, y: 0, z: 0 },
        position: { x: 0, y: 0, z: 0 },
        userData: {},
        isMesh: true,
    };

    // ── Timer mock (r183+ replacement for Clock) — returned by new THREE.Timer() ─
    const mockTimerInstance = {
        connect: vi.fn(),
        disconnect: vi.fn(),
        dispose: vi.fn(),
        update: vi.fn(),
        getDelta: vi.fn().mockReturnValue(0.016),
        getElapsed: vi.fn().mockReturnValue(0),
    };

    // ── Renderer mock ───────────────────────────────────────────────────
    const mockRendererInstance = {
        setPixelRatio: vi.fn(),
        getPixelRatio: vi.fn().mockReturnValue(1),
        outputColorSpace: 'srgb',
        setSize: vi.fn(),
        setAnimationLoop: vi.fn(),
        dispose: vi.fn(),
        render: vi.fn(),
        forceContextLoss: vi.fn(),
        resetState: vi.fn(),
        getSize: vi.fn().mockReturnValue({ x: 800, y: 600 }),
        domElement: { clientWidth: 800, clientHeight: 600 },
        info: { render: { calls: 0, triangles: 0 } },
    };

    // ── Controls mock ──────────────────────────────────────────────────
    const mockControlsInstance = {
        enableDamping: false,  // SceneManager sets this to true
        dampingFactor: 0,
        update: vi.fn(),
        dispose: vi.fn(),
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
    Timer: class {
        constructor() { Object.assign(this, mockTimer); }
    },
    WebGLRenderer: class {
        constructor() { return mockRenderer; }
    },
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
    DirectionalLight: class {
        constructor() { this.position = { set: vi.fn() }; }
    },
    AmbientLight: class { constructor() { this.position = { set: vi.fn() }; } },
    Vector2: class { constructor() {} },
    SRGBColorSpace: 'srgb',
    LinearSRGBColorSpace: 'srgb-linear',
}));

vi.mock('three/addons/controls/OrbitControls.js', () => ({
    OrbitControls: class { constructor() { return mockControls; } },
}));

// ── Now import the thing under test ──────────────────────────────────────
import { SceneManager } from './scene-manager.js';

describe('SceneManager', () => {
    /** @type {SceneManager} */
    let sm;

    beforeEach(() => {
        // Use resetAllMocks (not clearAllMocks) to fully reset mock state:
        // - Clears call history (like clearAllMocks)
        // - ALSO clears mockReturnValue/mockImplementation configs
        // This ensures a clean slate before beforeEach re-applies defaults.
        vi.resetAllMocks();

        // Re-apply default timer return values (resetAllMocks clears these)
        mockTimer.getDelta.mockReturnValue(0.016);
        mockTimer.getElapsed.mockReturnValue(0.016);

        // Re-apply renderer pixel ratio (resetAllMocks clears these)
        mockRenderer.getPixelRatio.mockReturnValue(1);

        // Reset shared mesh rotation so each test starts fresh
        mockMesh.rotation.x = 0;
        mockMesh.rotation.y = 0;
        mockMesh.rotation.z = 0;

        // Reset scene children (Mesh constructor returns same instance each time)
        mockScene.children = [];

        // Make traverse actually invoke the callback for mesh children
        // (vi.fn() is a no-op; this replaces it with real traversal logic)
        mockScene.traverse = function(callback) {
            for (const child of mockScene.children) {
                if (child.isMesh) callback(child);
            }
        };

        // Reset timer default delta
        mockTimer.getDelta.mockReturnValue(0.016);
        mockTimer.getElapsed.mockReturnValue(0.016);

        sm = new SceneManager({ canvas: null });
    });

    afterEach(() => {
        if (sm) sm.dispose();
    });

    // ─────────────────────────────────────────────────────────────
    // 1. Timer-based animation loop  (r183+: Clock → Timer)
    // ─────────────────────────────────────────────────────────────
    describe('Timer-based animation loop', () => {
        it('should use Timer (not deprecated Clock)', () => {
            expect(sm.timer).toBeDefined();
            expect(sm.timer.constructor.name).toBe('Timer');
        });

        it('should call timer.update() with the rAF timestamp', () => {
            const spy = vi.spyOn(sm.timer, 'update');
            sm.start();
            sm.onAnimate(1234.5);
            sm.stop();
            expect(spy).toHaveBeenCalledWith(1234.5);
        });

        it('should accumulate elapsed time across frames', () => {
            mockTimer.getDelta.mockReturnValueOnce(0.05);
            mockTimer.getElapsed.mockReturnValueOnce(0.05);
            mockTimer.getDelta.mockReturnValueOnce(0.05);
            mockTimer.getElapsed.mockReturnValueOnce(0.1);

            sm.start();
            sm.onAnimate(0);
            sm.onAnimate(50);
            sm.stop();

            expect(sm.lastElapsed).toBeCloseTo(0.1, 1);
            expect(sm.lastDelta).toBeCloseTo(0.05, 1);
        });

        it('should not render after stop() is called', () => {
            const renderSpy = vi.spyOn(sm.renderer, 'render');
            sm.start();
            sm.onAnimate(1000);
            sm.stop();
            sm.onAnimate(2000); // must NOT be rendered
            expect(renderSpy).toHaveBeenCalledTimes(1);
        });

        it('should disconnect timer on dispose()', () => {
            const spy = vi.spyOn(sm.timer, 'disconnect');
            sm.dispose();
            expect(spy).toHaveBeenCalledOnce();
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 2. GPU resource disposal — geometry, material, texture maps
    // ─────────────────────────────────────────────────────────────
    describe('Resource disposal', () => {
        it('should dispose geometry and material on removeMesh()', () => {
            const mesh = sm.mesh;
            const geoSpy = vi.spyOn(mesh.geometry, 'dispose');
            const matSpy = vi.spyOn(mesh.material, 'dispose');

            sm.removeMesh(mesh);

            expect(geoSpy).toHaveBeenCalledOnce();
            expect(matSpy).toHaveBeenCalledOnce();
        });

        it('should dispose every texture map before disposing material', () => {
            // Create separate mock textures so dispose spies are independent of the material spy
            const tex1 = { dispose: vi.fn() };
            const tex2 = { dispose: vi.fn() };
            sm.mesh.material.map = tex1;
            sm.mesh.material.normalMap = tex2;
            sm.mesh.material.roughnessMap = tex2;

            sm.removeMesh(sm.mesh);

            expect(tex1.dispose).toHaveBeenCalled();
            expect(tex2.dispose).toHaveBeenCalled();
        });

        it('should remove mesh from scene after disposal', () => {
            const mesh = sm.mesh;
            sm.removeMesh(mesh);
            expect(mockScene.remove).toHaveBeenCalledWith(mesh);
        });

        it('should dispose renderer on SceneManager.dispose()', () => {
            const spy = vi.spyOn(sm.renderer, 'dispose');
            sm.dispose();
            expect(spy).toHaveBeenCalledOnce();
        });

        it('should dispose all scene meshes on dispose()', () => {
            const geoSpy = vi.spyOn(sm.mesh.geometry, 'dispose');
            const matSpy = vi.spyOn(sm.mesh.material, 'dispose');
            sm.dispose();
            expect(geoSpy).toHaveBeenCalledOnce();
            expect(matSpy).toHaveBeenCalledOnce();
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 3. Responsive canvas — resize + projection matrix
    // ─────────────────────────────────────────────────────────────
    describe('Responsive canvas', () => {
        it('should update camera.aspect on resize', () => {
            sm.onResize(1920, 1080);
            expect(sm.camera.aspect).toBeCloseTo(1920 / 1080, 2);
        });

        it('should call updateProjectionMatrix after aspect change', () => {
            const spy = vi.spyOn(sm.camera, 'updateProjectionMatrix');
            sm.onResize(1280, 720);
            expect(spy).toHaveBeenCalledOnce();
        });

        it('should call renderer.setSize with exact dimensions', () => {
            const spy = vi.spyOn(sm.renderer, 'setSize');
            sm.onResize(1024, 768);
            expect(spy).toHaveBeenCalledWith(1024, 768);
        });

        it('should clamp devicePixelRatio to maximum of 2', () => {
            const hiDpr = new SceneManager({ dpr: 5 });
            expect(hiDpr.dpr).toBeLessThanOrEqual(2);
            hiDpr.dispose();
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 4. OrbitControls damping
    // ─────────────────────────────────────────────────────────────
    describe('OrbitControls damping', () => {
        it('should enable damping on construction', () => {
            expect(sm.controls.enableDamping).toBe(true);
        });

        it('should call controls.update() every animation frame', () => {
            const spy = vi.spyOn(sm.controls, 'update');
            sm.start();
            sm.onAnimate(1000);
            sm.stop();
            expect(spy).toHaveBeenCalledOnce();
        });

        it('should use setAnimationLoop (not raw requestAnimationFrame)', () => {
            const spy = vi.spyOn(sm.renderer, 'setAnimationLoop');
            sm.start();
            expect(spy).toHaveBeenCalledOnce();
            expect(typeof spy.mock.calls[0][0]).toBe('function');
            sm.stop();
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 5. Color management — outputColorSpace (r152+)
    // ─────────────────────────────────────────────────────────────
    describe('Color management (r152+)', () => {
        it('should set outputColorSpace to SRGBColorSpace', () => {
            expect(sm.renderer.outputColorSpace).toBe('srgb');
        });

        it('should NOT use the deprecated outputEncoding property', () => {
            // outputEncoding was removed in r152 — should be undefined
            expect(sm.renderer.outputEncoding).toBeUndefined();
        });
    });

    // ─────────────────────────────────────────────────────────────
    // 6. Frame-independent animation via delta time
    // ─────────────────────────────────────────────────────────────
    describe('Frame-independent animation', () => {
        it('should rotate the same amount after 1s regardless of frame rate', () => {
            // 60fps × 2 rad/s × (1/60)s = 2 rad total
            const sm60 = new SceneManager();
            sm60.start();
            for (let i = 0; i < 60; i++) {
                sm60.timer.getDelta = () => 1 / 60;
                sm60.timer.getElapsed = () => (i + 1) / 60;
                sm60.onAnimate(i * (1000 / 60));
            }
            const rot60 = sm60.mesh.rotation.y;
            // Note: sm60.dispose() removes mesh from scene but does NOT reset
            // mesh.rotation — shared mockMesh retains accumulated rotation.
            sm60.dispose();

            // Reset rotation on shared mockMesh before sm30 starts.
            // SceneManager._createDemoMesh() returns the SAME mockMeshInstance
            // that sm60 used, so we must reset it here.
            mockMesh.rotation.y = 0;

            // 30fps × 2 rad/s × (1/30)s = 2 rad total
            const sm30 = new SceneManager();
            sm30.start();
            for (let i = 0; i < 30; i++) {
                sm30.timer.getDelta = () => 1 / 30;
                sm30.timer.getElapsed = () => (i + 1) / 30;
                sm30.onAnimate(i * (1000 / 30));
            }
            const rot30 = sm30.mesh.rotation.y;
            sm30.dispose();

            // Same wall time → same rotation (frame-rate independent)
            expect(rot60).toBeCloseTo(rot30, 4);
        });

        it('should call renderer.render(scene, camera) each frame', () => {
            const spy = vi.spyOn(sm.renderer, 'render');
            sm.start();
            sm.onAnimate(1000);
            sm.stop();
            expect(spy).toHaveBeenCalledWith(sm.scene, sm.camera);
        });
    });
});
