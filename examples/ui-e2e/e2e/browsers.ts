// Per-browser skips (TASK-361). examples/ui-e2e runs in Chromium (dev and build) and, with
// UI_E2E_BROWSERS=firefox,webkit, in Firefox and WebKit against the build. A test that one of
// them cannot pass skips it here, with the reason: a platform feature the browser lacks (the
// component degrades as its docs say), or a test tool that only Chromium has.
import { test, type Page } from "@playwright/test";

type Engine = "chromium" | "firefox" | "webkit";

/** Skips the tests declared after it in this file or describe block in `engines`, with why. */
export function skipIn(engines: readonly Engine[], reason: string): void {
  test.skip(({ browserName }) => engines.includes(browserName), reason);
}

/**
 * A pointer drag of (`dx`, `dy`) from the point `at` of `box`, its end kept inside the window as a
 * real pointer's is: past the window's edge, Firefox reports moves at 0 and WebKit stalls, while
 * Chromium reports any coordinate. Returns the start and the movement, shortened at the edge.
 */
export function dragPath(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
  dx: number,
  dy: number,
  at = { x: 0.5, y: 0.5 },
): { x: number; y: number; dx: number; dy: number } {
  const viewport = page.viewportSize()!;
  const x = box.x + box.width * at.x;
  const y = box.y + box.height * at.y;
  const clamp = (value: number, size: number) => Math.min(Math.max(value, 2), size - 2);
  return {
    x,
    y,
    dx: clamp(x + dx, viewport.width) - x,
    dy: clamp(y + dy, viewport.height) - y,
  };
}
