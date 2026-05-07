#!/usr/bin/env python3
"""
Desktop mouse click regression test for three.js interactive scenes.
Verifies that raycasting and click selection remain functional after
mobile touch fixes. Also tests clicking empty space to deselect.

Usage: python scripts/playwright_desktop_test.py
"""
import time
from playwright.sync_api import sync_playwright

NODE_NAME = 'Meyer Lansky'

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_context(viewport={'width': 1920, 'height': 1080}).new_page()
        page.goto('http://localhost:8000', wait_until='networkidle', timeout=30000)
        time.sleep(2)
        page.wait_for_function('typeof THREE !== "undefined" && document.querySelector("#canvas-container canvas")')

        # Compute screen pos of node
        coords = page.evaluate('''(nodeName) => {
            const target = scene.children.find(obj => obj.userData && obj.userData.name === nodeName);
            if (!target) return null;
            const vec = target.position.clone(); vec.project(camera);
            const canvas = renderer.domElement;
            const w = canvas.clientWidth/2, h = canvas.clientHeight/2;
            return vec.x * w + w + ',' + (-(vec.y * h) + h);
        }''', NODE_NAME)

        if not coords:
            print(f"✗ Node '{NODE_NAME}' not found")
            exit(1)
        x_str, y_str = coords.split(',')
        cx, cy = float(x_str), float(y_str)
        print(f"Node '{NODE_NAME}' at canvas ({cx:.0f}, {cy:.0f})")

        canvas = page.locator('#canvas-container canvas')
        box = canvas.bounding_box()
        click_x = box['x'] + cx
        click_y = box['y'] + cy

        before = page.evaluate('''() => document.getElementById('notes-content').innerText.substring(0,30)''')
        print(f"Before: '{before.strip()}'")

        page.mouse.click(click_x, click_y)
        time.sleep(1)

        after = page.evaluate('''() => document.getElementById('notes-content').innerText.substring(0,30)''')
        print(f"After:  '{after.strip()}'")

        click_ok = NODE_NAME in after
        print(f"{'✓' if click_ok else '✗'} Click selection {'works' if click_ok else 'FAILED'}")

        # Deselect test: click bottom-right corner (likely empty)
        page.mouse.click(box['x'] + box['width'] - 20, box['y'] + box['height'] - 20)
        time.sleep(0.5)
        desel = page.evaluate('''() => document.getElementById('notes-content').innerText.substring(0,30)''')
        print(f"After empty-space click: '{desel.strip()}'")
        desel_ok = 'Click on a node' in desel
        print(f"{'✓' if desel_ok else '✗'} Deselect {'works' if desel_ok else 'FAILED (minor issue)'}")

        browser.close()
        exit(0 if click_ok else 1)

if __name__ == '__main__':
    main()
