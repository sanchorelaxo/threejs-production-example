# epstein-map Mobile Touch Fix — Session Record

**Date:** 2026-05-01  
**Project:** `~/Documents/git/epstein-map` — Jeffrey Epstein network three.js visualization  
**Issue:** On Android Chrome, users can drag/rotate the scene but tapping nodes does nothing.  
**Fix:** Added `touchend` event listener mirroring the existing `click` selection logic.

---

## Bug Timeline

1. **Initial deployment** — HTTP server started on port 8000 serving existing three.js app.
2. **User report** — Android Chrome: "I can drag but not click."
3. **Initial hypothesis** — Maybe nodes are too small? Or OrbitControls blocking events?
4. **Playwright reproduction** — Headless Chromium with mobile emulation confirmed: neither `click` nor `touch` tap selected nodes.
5. **Root cause** — OrbitControls calls `preventDefault()` on touch events → synthetic `click` never fires.
6. **Fix** — Added explicit `touchend` listener that uses `event.changedTouches[0]` to raycast and select nodes.
7. **Verification** — Playwright mobile test passes; desktop click still works; zero console errors.

---

## Key Debugging Scripts

### 1. `scripts/playwright_touch_test.py` — Initial reproduction
Tests both desktop mouse click and mobile touch tap. Shows that neither event selects nodes.

**Results before fix:**
```
Clicked at (960, 378) → Selected node after click: None
Tapped at (180, 224) → Selected node after tap: None
```

### 2. `scripts/playwright_debug.py` — Raycast verification
Manually computes raycast hits at a specific screen position to confirm scene/hit-test is working.

**Findings:**
- `sceneChildren: 521` (scene has many line/mesh objects)
- `nodesExist: 72` (72 node spheres exist)
- `nodeObjectsKeys: []` (nodeObjects dictionary was empty — not actually used globally)
- Manual raycast at center returned `[]` (no nodes at exact center — expected)

### 3. `scripts/playwright_touch_fixed.py` — Post-fix validation
Computes screen coordinates of a known node (`Jeffrey Epstein`) using:
```javascript
const target = scene.children.find(obj => obj.userData.name === 'Jeffrey Epstein');
const vec = target.position.clone(); vec.project(camera);
// Convert NDC to canvas pixels
```
Then taps at that exact location. Successfully selects node.

**Output after fix:**
```
Notes before tap: 'Node Information\n\nClick on a n...'
Notes after tap:  'Jeffrey Epstein\n\nHub - Sex Trafficker...'
✓ Touch selection succeeded!
```

### 4. `scripts/playwright_desktop_test.py` — Desktop click regression test
Confirms mouse click still works post-fix and that clicking empty space deselects (deselect currently fails, but that's a separate minor issue).

---

## Code Change Summary

**File modified:** `/home/rjodouin/Documents/git/epstein-map/index.html`

**Change:** Inserted a new `window.addEventListener('touchend', ...)` block immediately after the existing `click` handler (after line 1755). Total added: ~60 lines of JavaScript.

**Why `touchend` and not `touchstart`?**
- OrbitControls consumes and prevents default on `touchstart`/`touchmove`.
- `touchend` fires after touch release and is not blocked by OrbitControls' earlier prevention.

**Touch coordinate extraction:**
```javascript
const touch = event.changedTouches[0];
mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
```

**Multi-touch guard:**
```javascript
if (event.touches && event.touches.length > 0) return;
```
Prevents spurious selection during pinch-zoom gestures.

---

## Console Error Check

No JavaScript errors appeared during any test run — the bug was purely an event flow issue, not an exception. After fix, Playwright reports: `ERRORS: []`.

---

## Why Desktop Click Initially Appeared Broken Too

In the initial test, we clicked at `(960, 378)` (center of canvas) and got no hit. That is correct — the five main hubs are positioned at:
```javascript
const mainHubs = [
  { name: 'Meyer Lansky', type: 'crime', x: -60, y: 0, z: 0 },
  { name: 'James Angleton', type: 'intelligence', x: 60, y: 0, z: 0 },
  { name: 'Leslie Wexner', type: 'modern', x: 0, y: 40, z: 40 },
  { name: 'Jeffrey Epstein', type: 'modern', x: 0, y: -40, z: 40 },  // positioned forward and down
  { name: 'Mossad', type: 'intelligence', x: 0, y: 0, z: -60 }
];
```
At camera position `[0, 50, 150]` looking at origin, the exact center 2D screen pixel contains no sphere — Jeffrey Epstein is projected *lower* on screen due to his negative y position and positive z. The second desktop test clicked on computed coordinates for "Meyer Lansky" and succeeded. So desktop click was always fine; the first test clicked empty space.

---

## Mobile Touch Interaction Model

**Touch event flow in OrbitControls:**
1. `touchstart` — OrbitControls calls `preventDefault()` if `controls.enabled` is true (stops scrolling, enables rotation)
2. `touchmove` — OrbitControls processes gesture, still calls `preventDefault()`
3. `touchend` — **NOT prevented**; click event is never synthesized

The synthetic `click` event that browsers normally fire ~300ms after a tap is suppressed because `preventDefault()` was called earlier in the touch sequence. This is standard browser behavior to avoid double-firing on elements with touch handlers.

**Solution:** Register an explicit `touchend` handler that does selection directly, bypassing the need for the synthetic `click`.

---

## Reproduction Recipe (Any three.js + OrbitControls App)

To reproduce this bug in any three.js project:
1. Use OrbitControls with default settings (`enableDamping`, `rotate` enabled)
2. Attach a `click` handler on `window` that raycasts and selects objects
3. Open on mobile or emulated mobile Chrome (DevTools → Device Mode)
4. Try to tap a 3D object → nothing happens; drag works.

To fix:
1. Add the `touchend` handler from this skill (copy the full block)
2. Ensure it uses `event.changedTouches[0]` for coordinates
3. Keep the multi-touch guard if your app uses pinch-zoom.

---

## Related Documentation

- Three.js OrbitControls source: https://github.com/mrdoob/three.js/blob/dev/examples/js/controls/OrbitControls.js
  - Line ~345: `touchstart` listener calls `this.dispatchEvent(startEvent)` then `preventDefault()`
  - This prevention blocks the synthetic click generation
- MDN on Touch Events and click suppression: https://developer.mozilla.org/en-US/docs/Web/API/Touch_events/Supporting_both_touch_and_click
