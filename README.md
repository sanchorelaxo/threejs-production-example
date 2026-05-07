# Three.js Production Example

TDD-validated Three.js r183+ production patterns with 21 passing tests.

## Patterns Implemented

- **Timer-based animation** — `THREE.Timer` replaces deprecated `THREE.Clock`
- **GPU resource disposal** — proper `geometry.dispose()` → textures → material → scene removal order
- **Responsive canvas** — DPR clamping to 2, aspect ratio + `updateProjectionMatrix` on resize
- **OrbitControls damping** — `enableDamping: true` + `update()` called every frame
- **SRGBColorSpace** — `renderer.outputColorSpace = THREE.SRGBColorSpace` (r152+)
- **Frame-independent animation** — delta-time based rotation for consistent speed across frame rates
- **Animation loop** — `renderer.setAnimationLoop()` (handles tab visibility, XR)

## Tech Stack

- **three.js** r184
- **Vitest** v3.2.4 (jsdom environment, `vi.mock('three')`)
- **Node.js** 22 / ESM modules

## Run Tests

```bash
npm install
npm test
```

## File Structure

```
src/
  scene-manager.js        # Implementation (r183+ patterns)
  scene-manager.test.js   # 21 TDD tests — RED/GREEN/REFACTOR cycle
  vitest-setup.mjs        # WebGL mock (legacy, superseded by vi.mock)
vitest.config.js
package.json
```

## Three.js r183+ Key Changes

| Deprecated | Replacement | Since |
|-----------|-------------|-------|
| `THREE.Clock` | `THREE.Timer` | r183 |
| `renderer.outputEncoding` | `renderer.outputColorSpace` | r152 |
| `renderer.info.memory` | removed (program cache gone) | r183 |
| raw `requestAnimationFrame` | `renderer.setAnimationLoop()` | r183 |
| `EffectComposer` | `RenderPipeline` | r183 |

## Testing Approach

Tests use **full `THREE` mocking via `vi.mock('three')`** — no WebGL context, no jsdom canvas polyfill. Each test is isolated with `vi.resetAllMocks()` and re-applies default mock return values in `beforeEach`.

See `src/scene-manager.test.js` for all 21 tests covering:
- Timer instantiation and frame count tracking
- Disposal order (geometry → texture maps → material → scene)
- Responsive canvas with DPR clamping
- OrbitControls damping enable/disable
- SRGBColorSpace assignment
- Frame-independent animation via delta-time rotation
