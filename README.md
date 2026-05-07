# Three.js Production Example

TDD-validated Three.js r183+ production patterns with 21 passing tests. This repo also contains the `threejs-production` and `threejs-interaction` Hermes skills as subdirectories.

## Repository Structure

```
threejs-production-example/
├── skills/
│   ├── threejs-production/      # Hermes skill: r183+ production patterns
│   │   └── SKILL.md
│   └── threejs-interaction/     # Hermes skill: mobile touch debugging
│       ├── SKILL.md
│       ├── references/
│       └── scripts/
├── src/
│   ├── scene-manager.js          # Implementation (r183+ patterns)
│   ├── scene-manager.test.js     # 21 TDD tests
│   └── vitest-setup.mjs          # Legacy WebGL mock
├── vitest.config.js
└── package.json
```

## Skills

### `skills/threejs-production/` — r183+ Production Patterns

Timer-based animation, GPU disposal, responsive canvas, OrbitControls damping, SRGBColorSpace, WebGPU, TSL, RenderPipeline, and **TDD testing patterns** (Vitest `vi.mock('three')`).

### `skills/threejs-interaction/` — Mobile Touch Debugging

Playwright headless testing for mobile touch, OrbitControls event-fix, `touchstart preventDefault` debugging.

> **r183+ note:** For Timer/`setAnimationLoop` patterns, see `skills/threejs-production/SKILL.md`.

## Run Tests

```bash
npm install
npm test
```

## Patterns Implemented

- **Timer-based animation** — `THREE.Timer` replaces deprecated `THREE.Clock`
- **GPU resource disposal** — proper `geometry.dispose()` → textures → material → scene removal order
- **Responsive canvas** — DPR clamping to 2, aspect ratio + `updateProjectionMatrix` on resize
- **OrbitControls damping** — `enableDamping: true` + `update()` called every frame
- **SRGBColorSpace** — `renderer.outputColorSpace = THREE.SRGBColorSpace` (r152+)
- **Frame-independent animation** — delta-time based rotation for consistent speed
- **Animation loop** — `renderer.setAnimationLoop()` (handles tab visibility, XR)

## Three.js r183+ Key Changes

| Deprecated | Replacement | Since |
|-----------|-------------|-------|
| `THREE.Clock` | `THREE.Timer` | r183 |
| `renderer.outputEncoding` | `renderer.outputColorSpace` | r152 |
| `renderer.info.memory` | removed (program cache gone) | r183 |
| raw `requestAnimationFrame` | `renderer.setAnimationLoop()` | r183 |
| `EffectComposer` | `RenderPipeline` | r183 |

## Tech Stack

- **three.js** r184
- **Vitest** v3.2.4 (jsdom environment, `vi.mock('three')`)
- **Node.js** 22 / ESM modules
