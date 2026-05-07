#!/usr/bin/env python3
"""
Playwright test to reproduce mobile touch selection failure
in three.js apps using OrbitControls.

Fails before fix: selectedNode stays null after tap.
Passes after fix: selectedNode updates with tapped object.

Usage: python scripts/playwright_touch_test.py
Requires: pip install playwright && playwright install chromium
"""
import subprocess
import time
import json
from playwright.sync_api import sync_playwright

def ensure_server():
    try:
        result = subprocess.run(['curl', '-s', '-o', '/dev/null', '-w', '%{http_code}', 'http://localhost:8000'],
                              capture_output=True, text=True, timeout=2)
        if result.stdout.strip() != '200':
            raise Exception()
    except:
        print("Starting HTTP server on port 8000...")
        subprocess.Popen(['python3', '-m', 'http.server', '8000', '--bind', '0.0.0.0'],
                        cwd='/home/rjodouin/Documents/git/epstein-map',
                        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        time.sleep(2)

def test_desktop():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_context(viewport={'width': 1920, 'height': 1080}).new_page()
        page.goto('http://localhost:8000', wait_until='networkidle')
        time.sleep(2)
        page.wait_for_function('typeof THREE !== "undefined" && document.querySelector("#canvas-container canvas")')

        canvas = page.locator('#canvas-container canvas')
        box = canvas.bounding_box()
        cx, cy = box['x'] + box['width']/2, box['y'] + box['height']/2

        page.mouse.click(cx, cy)
        time.sleep(0.5)
        selected = page.evaluate('window.selectedNode ? window.selectedNode.userData.name : null')
        print(f"Desktop click at center -> selected: {selected}")

        browser.close()
        return selected is not None

def test_mobile():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={'width': 360, 'height': 640, 'isMobile': True},
            user_agent='Mozilla/5.0 (Linux; Android 13; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            has_touch=True
        )
        page = context.new_page()
        page.goto('http://localhost:8000', wait_until='networkidle', timeout=30000)
        time.sleep(2)
        page.wait_for_function('typeof THREE !== "undefined" && document.querySelector("#canvas-container canvas")')

        canvas = page.locator('#canvas-container canvas')
        box = canvas.bounding_box()
        cx, cy = box['x'] + box['width']/2, box['y'] + box['height']/2

        page.touchscreen.tap(cx, cy)
        time.sleep(1)
        selected = page.evaluate('window.selectedNode ? window.selectedNode.userData.name : null')
        print(f"Mobile tap at center -> selected: {selected}")

        # Also check console errors
        errors = []
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        page.on('pageerror', lambda exc: errors.append(str(exc)))
        # Wait brief to catch any late errors
        time.sleep(0.5)

        browser.close()
        return selected is not None, errors

if __name__ == '__main__':
    ensure_server()
    print("=== Three.js Touch Interaction Test ===\n")

    print("--- Desktop mouse click test ---")
    desktop_ok = test_desktop()
    print(f"{'✓ PASS' if desktop_ok else '✗ FAIL'}: Desktop click {'selects nodes' if desktop_ok else 'does NOT select nodes'}\n")

    print("--- Mobile touch tap test ---")
    mobile_ok, errors = test_mobile()
    print(f"{'✓ PASS' if mobile_ok else '✗ FAIL'}: Mobile tap {'selects nodes' if mobile_ok else 'does NOT select nodes'}")
    if errors:
        print(f"  Console errors: {errors}")

    print("\n=== Summary ===")
    if desktop_ok and mobile_ok:
        print("✓ All interaction modes work correctly.")
        exit(0)
    else:
        print("✗ Some interactions failing. Expected failure before fix; success after adding touchend handler.")
        exit(1)
