#!/usr/bin/env python3
"""
Post-fix validation: Verify that tapping a known node position
selects the correct node. This script computes screen coordinates
for 'Jeffrey Epstein' using three.js world-to-screen projection,
then performs a Playwright touch tap at those coordinates.

Expected: Notes panel updates to show 'Jeffrey Epstein' details.

Usage: python scripts/playwright_touch_fixed.py
"""
import time
from playwright.sync_api import sync_playwright

NODE_NAME = 'Jeffrey Epstein'

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = p.chromium.new_context(
            viewport={'width': 360, 'height': 640, 'isMobile': True},
            user_agent='Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            has_touch=True
        )
        page = context.new_page()
        page.goto('http://localhost:8000', wait_until='networkidle', timeout=30000)
        time.sleep(2)
        page.wait_for_function('typeof THREE !== "undefined" && document.querySelector("#canvas-container canvas")')

        # Compute screen position of target node via scene traversal
        coords = page.evaluate('''(nodeName) => {
            const target = scene.children.find(obj => obj.userData && obj.userData.name === nodeName);
            if (!target) return null;
            const vec = target.position.clone();
            vec.project(camera);
            const canvas = renderer.domElement;
            const w = canvas.clientWidth/2, h = canvas.clientHeight/2;
            return {
                x: vec.x * w + w,
                y: -(vec.y * h) + h,
                raw: { x: vec.x, y: vec.y, z: vec.z }
            };
        }''', NODE_NAME)

        if not coords:
            print(f"✗ Could not locate node '{NODE_NAME}' in scene")
            exit(1)

        canvas = page.locator('#canvas-container canvas')
        box = canvas.bounding_box()
        tap_x = box['x'] + coords['x']
        tap_y = box['y'] + coords['y']
        print(f"Tapping '{NODE_NAME}' at canvas coords ({coords['x']:.0f}, {coords['y']:.0f}) → page ({tap_x:.0f}, {tap_y:.0f})")

        # Check notes before
        before = page.evaluate('''() => {
            return document.getElementById('notes-content').innerText.substring(0, 50);
        }''')
        print(f"Notes before: '{before.strip()}'")

        # Tap
        page.touchscreen.tap(tap_x, tap_y)
        time.sleep(1)

        # Check notes after
        after = page.evaluate('''() => {
            return document.getElementById('notes-content').innerText.substring(0, 50);
        }''')
        print(f"Notes after:  '{after.strip()}'")

        success = NODE_NAME in after
        print(f"\n{'✓ SUCCESS: Touch selection works!' if success else '✗ FAILED: Node not selected'}")
        exit(0 if success else 1)

        browser.close()

if __name__ == '__main__':
    main()
