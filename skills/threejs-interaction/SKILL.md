---
name: threejs-interaction
description: Debug and fix mobile touch/tap interaction issues in three.js applications, especially when using OrbitControls. Includes systematic Playwright headless testing patterns and event-handler fixes. For r183+ animation/timing patterns, see skills/threejs-production/SKILL.md.
tags: [threejs, webgl, touch, mobile, debugging, orbitcontrols, raycasting]
triggers: [three.js, orbitcontrols, touch, mobile tap, tap not working, drag but not click, touchstart preventdefault]
---

# Three.js Mobile Touch Interaction Debugging

> **r183+ note:** The animation loop should use `renderer.setAnimationLoop(fn)` (handles XR, tab visibility). OrbitControls touch-fix below is version-agnostic. For Timer-based animation and GPU disposal patterns, see `skills/threejs-production/SKILL.md`.

When users can drag/rotate a three.js scene on mobile but taps/clicks don't select objects, OrbitControls is consuming touch events with `preventDefault()`, blocking the `click` event. This skill provides a systematic approach to diagnose, reproduce, and fix the issue.

## When to Use

- Nodes respond to drag/rotate but not to tap/click on mobile
- Desktop mouse clicks also fail (indicating selection logic is broken or event handlers not firing)
- You need to reproduce mobile touch behavior in headless tests
- OrbitControls or similar controllers are used in the scene

## Trigger Condition

Any three.js application that:
1. Uses `OrbitControls` (or `TrackballControls`, `FlyControls`, etc.)
2. Has interactive clickable/tappable objects in the scene (via raycasting)
3. Exhibits "drag works but tap doesn't" behavior on touch devices

## Systematic Approach

### Phase 1 — Reproduction (Headless Playwright)

Before touching code, reproduce the issue in headless Chrome with mobile emulation:

```python
from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={'width': 360, 'height': 640, 'isMobile': True},
        has_touch=True,
        user_agent='Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    )
    page = context.new_page()
    page.goto('http://localhost:8000', wait_until='networkidle')
    time.sleep(2)
    # Verify scene loaded
    page.wait_for_function('typeof THREE !== "undefined" && document.querySelector("#canvas-container canvas")')
    # Capture console errors
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda exc: errors.append(str(exc)))

    # Locate a node and tap it
    canvas = page.locator('#canvas-container canvas')
    box = canvas.bounding_box()
    page.touchscreen.tap(box['x'] + box['width']/2, box['y'] + box['height']/2)
    time.sleep(1)

    # Check if selection occurred
    selected = page.evaluate('window.selectedNode ? window.selectedNode.userData.name : null')
    print(f"Selected: {selected}, Errors: {errors}")

    browser.close()
```

**Expected failure before fix:** `window.selectedNode` remains `null` after tap; no console errors (the failure is silent).

### Phase 2 — Diagnosis

If neither mouse `click` nor touch `touchend` triggers selection, verify:

1. **Raycaster actually hits nodes:**
   ```javascript
   const intersects = raycaster.intersectObjects(scene.children.filter(obj => obj.userData.name));
   console.log('Hits:', intersects.length);
   ```
   If zero, the node is not at the tapped screen position — check that node positions and camera are correct.

2. **Event handler is attached and fires:**
   ```javascript
   window.addEventListener('click', () => console.log('click fired'));
   window.addEventListener('touchend', () => console.log('touchend fired'));
   ```
   On mobile, you'll see *neither* if OrbitControls called `preventDefault()` during `touchstart`/`touchmove`.

3. **OrbitControls settings:**
   OrbitControls calls `event.preventDefault()` on touch events when `enableDamping` or `rotate` is enabled. This stops the synthetic `click` event from ever being generated.

### Phase 3 — Fix: Add `touchend` Handler

Mirror the existing `click` handler with a `touchend` listener that uses `event.changedTouches[0]` for coordinates. This fires independently of OrbitControls' touch handling.

```javascript
// Touch event - mobile tap selection
window.addEventListener('touchend', (event) => {
    // Prevent handling if multi-touch
    if (event.touches && event.touches.length > 0) return;

    const canvas = renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const touch = event.changedTouches[0];

    mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children.filter(obj => obj.userData.name));

    if (intersects.length > 0) {
        const obj = intersects[0].object;
        selectedNode = obj;
        const nodeName = obj.userData.name;

        // Reset all highlights
        nodes.forEach(node => {
            node.mesh.material.emissiveIntensity = node.mesh.userData.isHub ? 0.3 : 0.2;
        });

        // Reset colors & hide labels
        scene.traverse((child) => {
            if (child.userData.fromNode || child.userData.toNode) {
                if (child.material) {
                    child.material.color.setHex(child.userData.defaultColor);
                    child.material.opacity = child instanceof THREE.Line ? 0.4 : 0.6;
                }
            }
            if (child instanceof THREE.CSS2DObject) {
                child.element.style.display = 'none';
            }
        });

        // Highlight selection and connections
        obj.material.emissiveIntensity = 1.0;
        if (connectionArrows[nodeName]) {
            connectionArrows[nodeName].forEach(({ line, label }) => {
                line.material.color.setHex(0xFFD700);
                line.material.opacity = 0.9;
                if (label && label.element) label.element.style.display = 'block';
            });
        }

        updateNotesPanel(nodeName, obj);
    } else {
        // Deselect on empty space tap
        selectedNode = null;
        nodes.forEach(node => {
            node.mesh.material.emissiveIntensity = node.mesh.userData.isHub ? 0.3 : 0.2;
        });
        scene.traverse((child) => {
            if (child.userData.fromNode || child.userData.toNode) {
                if (child.material) {
                    child.material.color.setHex(child.userData.defaultColor);
                    child.material.opacity = child instanceof THREE.Line ? 0.4 : 0.6;
                }
            }
            if (child instanceof THREE.CSS2DObject) {
                child.element.style.display = 'none';
            }
        });
        document.getElementById('headshot-container').style.display = 'none';
        document.getElementById('notes-content').innerHTML = '<h2>Node Information</h2><p>Click on a node to see detailed information and connections...</p>';
    }
});
```

**Why it works:** `touchend` fires after the touch is released, regardless of OrbitControls' intermediate `preventDefault()` calls.

### Phase 4 — Verification

Re-run the Playwright script. Expected results:

```
Selected: Jeffrey Epstein (or the node you tapped)
✓ Touch selection succeeded!
```

Also verify desktop click still works with `page.mouse.click()`.

## Common Pitfalls

| Pitfall | Why it happens | Fix |
|---|---|---|
| Using `touchstart` instead of `touchend` | Touchstart fires before OrbitControls processes the event | Use `touchend` — it fires after all touch handling is done |
| Using `event.clientX` on touch event | Touch events store coordinates in `changedTouches` array, not directly on the event | Use `event.changedTouches[0].clientX` |
| Checking `event.touches` instead of `event.changedTouches` | `touches` is the set of currently-active touches (may be empty on `touchend`) | Always read from `changedTouches` for `touchend` |
| Forgetting multi-touch guard | Multi-finger gestures shouldn't select nodes | `if (event.touches && event.touches.length > 0) return;` |

## Playwright Mobile Emulation Reference

Key context flags for reliable mobile touch testing:

```python
context = browser.new_context(
    viewport={'width': 360, 'height': 640, 'isMobile': True},
    user_agent='Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    has_touch=True
)
```

To tap at coordinates:
```python
page.touchscreen.tap(x, y)  # Absolute page coordinates
```

To compute	node screen position in three.js (for precise tap targets):
```javascript
const vec = node.position.clone();
vec.project(camera);
const canvas = renderer.domElement;
const w = canvas.clientWidth/2, h = canvas.clientHeight/2;
const screenX = vec.x * w + w;
const screenY = -(vec.y * h) + h;
```

## References

See `references/mobile-touch-fix.md` for the full epstein-map bug report, Playwright reproduction scripts, and step-by-step debugging traces that led to this fix.
