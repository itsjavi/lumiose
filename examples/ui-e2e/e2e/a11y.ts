// WCAG 2.2 AA helpers for the component suites (decision-62, doc-9 section 17): axe with the WCAG
// 2.0, 2.1 and 2.2 A and AA rules, as apps/web/e2e/a11y.e2e.ts runs it, and the measurements of the
// criteria axe cannot make (target size, reflow, text spacing, focus visible).
import AxeBuilder from "@axe-core/playwright";
import { test, type Locator, type Page } from "@playwright/test";

export const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
export const SCHEMES = ["light", "dark"] as const;

interface AxeNode {
  target: unknown[];
  any: { message: string }[];
  failureSummary?: string;
}

const why = (node: AxeNode) =>
  (node.any.map((check) => check.message).join(" ") || node.failureSummary || "").replaceAll(
    "\n",
    " ",
  );

/**
 * The page's WCAG A and AA violations, `rule: target: why` per node: a test expects `[]`. Axe's
 * "needs review" results are printed and added to the test's annotations, for a check by hand.
 */
export async function axe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
  const review = results.incomplete.flatMap((result) =>
    result.nodes.map((node) => `${result.id}: ${node.target.join(" ")}: ${why(node)}`),
  );
  if (review.length > 0) {
    console.log(`[axe needs review] ${page.url()}:\n  ${review.join("\n  ")}`);
    test.info().annotations.push({ type: "axe needs review", description: review.join("; ") });
  }
  return results.violations.flatMap((result) =>
    result.nodes.map((node) => `${result.id}: ${node.target.join(" ")}: ${why(node)}`),
  );
}

/**
 * WCAG 1.4.12 Text Spacing: the overrides a user style sheet may apply, which content must survive
 * (https://www.w3.org/WAI/WCAG22/Understanding/text-spacing).
 */
export const TEXT_SPACING = `* {
  line-height: 1.5 !important;
  letter-spacing: 0.12em !important;
  word-spacing: 0.16em !important;
}
p { margin-block-end: 2em !important; }`;

/**
 * Elements under `scope` whose content no longer fits their box (text cut off or overflowing),
 * as `tag "text"`; a test expects `[]`. Scrollable boxes are fine: their content stays reachable,
 * and so are hidden ones (`visibility: hidden`, such as an avatar's failed image), which show nothing.
 */
export function clipped(scope: Locator): Promise<string[]> {
  return scope.evaluate((root) => {
    const found: string[] = [];
    for (const element of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") continue;
      if (/auto|scroll/.test(style.overflow)) continue;
      // Decoration hidden from assistive technology holds no content to clip (a scroll thumb's
      // larger pointer target, TASK-444).
      if (element.closest("[aria-hidden='true']")) continue;
      const over =
        element.scrollWidth > element.clientWidth + 1 ||
        element.scrollHeight > element.clientHeight + 1;
      if (over && element.clientWidth > 0 && style.display !== "inline") {
        found.push(`${element.localName} "${element.textContent?.trim().slice(0, 30)}"`);
      }
    }
    return found;
  });
}

/**
 * WCAG 2.5.8 Target Size (Minimum): the controls under `scope` smaller than 24 by 24: buttons,
 * links, tabs, inputs, `summary`, options, menu items and scroll thumbs. A link inside a sentence
 * (inline, with text of its own line around it) is the criterion's inline exception; a link that
 * stands alone is a target like any other (TASK-462).
 */
export function smallTargets(scope: Locator): Promise<string[]> {
  return scope.evaluate((root) => {
    const inSentence = (element: HTMLElement) => {
      if (getComputedStyle(element).display !== "inline") return false;
      const block = element.parentElement;
      const own = (block?.textContent ?? "").replace(element.textContent ?? "", "");
      return /\S/.test(own);
    };
    return [
      ...root.querySelectorAll<HTMLElement>(
        "button, a[href], [role=tab], input, summary, [role=option], [role^=menuitem], [data-thumb]",
      ),
    ]
      .filter((element) => element.getClientRects().length > 0)
      .filter((element) => getComputedStyle(element).visibility !== "hidden")
      .filter((element) => !(element.localName === "a" && inSentence(element)))
      .map((element) => ({ element, box: element.getBoundingClientRect() }))
      .filter(({ box }) => box.width < 24 || box.height < 24)
      .map(
        ({ element, box }) =>
          `${element.textContent?.trim() || element.localName}: ${box.width}x${box.height}`,
      );
  });
}

/**
 * WCAG 2.4.7 Focus Visible and 1.4.11 Non-text Contrast: the focused element's outline,
 * `"<width> <style>"`, or "none"; a ring under 3:1 against what is behind it adds
 * `", contrast <ratio>:1"`, so a test that expects `"2px solid"` checks its contrast too (TASK-462).
 */
export function focusRing(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (!active) return "none";
    const style = getComputedStyle(active);
    if (style.outlineStyle === "none") return "none";
    const ring = `${style.outlineWidth} ${style.outlineStyle}`;
    // Any CSS colour as sRGB, through a canvas.
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true })!;
    const rgba = (color: string): [number, number, number, number] => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = "#000";
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return [r!, g!, b!, a! / 255];
    };
    // What the ring is drawn on: the element's box when the outline is inside it, else its parent's.
    let node: Element | null =
      Number.parseFloat(style.outlineOffset) < 0 ? active : active.parentElement;
    const layers: [number, number, number, number][] = [];
    while (node) {
      const layer = rgba(getComputedStyle(node).backgroundColor);
      if (layer[3] > 0) layers.push(layer);
      if (layer[3] >= 1) break;
      node = node.parentElement;
    }
    let behind: [number, number, number] = matchMedia("(prefers-color-scheme: dark)").matches
      ? [0, 0, 0]
      : [255, 255, 255];
    for (const [r, g, b, a] of layers.reverse()) {
      behind = [
        r * a + behind[0] * (1 - a),
        g * a + behind[1] * (1 - a),
        b * a + behind[2] * (1 - a),
      ];
    }
    const [r, g, b, a] = rgba(style.outlineColor);
    const front = [
      r * a + behind[0] * (1 - a),
      g * a + behind[1] * (1 - a),
      b * a + behind[2] * (1 - a),
    ];
    const luminance = (channels: number[]) => {
      const [x, y, z] = channels.map((value) => {
        const c = value / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * x! + 0.7152 * y! + 0.0722 * z!;
    };
    const [light, dark] = [luminance(front), luminance(behind)].sort((p, q) => q - p);
    const contrast = (light! + 0.05) / (dark! + 0.05);
    return contrast >= 3 ? ring : `${ring}, contrast ${contrast.toFixed(2)}:1`;
  });
}

/**
 * Forced colors (Windows High Contrast): the controls under `scope` whose boundary disappears,
 * as `tag "text"` (TASK-462). The browser paints every background as Canvas there, keeping its
 * alpha, and keeps borders and outlines in system colours: a control drawn by its background alone
 * loses its edge. A transparent control (a ghost button in a bordered frame, a range input under
 * its track) had no edge of its own to lose.
 */
export function forcedColorsIssues(scope: Locator): Promise<string[]> {
  return scope.evaluate((root) =>
    [
      ...root.querySelectorAll<HTMLElement>(
        "button, input:not([type=hidden]), select, textarea, [role=tab], [role=switch]",
      ),
    ]
      .filter((element) => element.getClientRects().length > 0)
      .filter((element) => getComputedStyle(element).visibility !== "hidden")
      .filter((element) => {
        const style = getComputedStyle(element);
        const borders = ["Top", "Right", "Bottom", "Left"].some(
          (side) =>
            style.getPropertyValue(`border-${side.toLowerCase()}-style`) !== "none" &&
            Number.parseFloat(style.getPropertyValue(`border-${side.toLowerCase()}-width`)) > 0,
        );
        // A native control draws its own boundary in forced colors.
        const native =
          style.appearance !== "none" && /^(input|select|textarea)$/.test(element.localName);
        const background = !/rgba\(.*,\s*0\)$|transparent/.test(style.backgroundColor);
        return background && !borders && !native && style.forcedColorAdjust !== "none";
      })
      .map((element) => `${element.localName} "${element.textContent?.trim().slice(0, 30)}"`),
  );
}

/**
 * The accessible description Chromium computes for `locator`, through the DevTools protocol.
 * Playwright's own `toHaveAccessibleDescription` leaves out the text of an `<output>` (a
 * `Field.Error`), which Chromium and screen readers include. Firefox and WebKit have no such
 * protocol in Playwright: there it is the text of the `aria-describedby` targets, in order, which
 * checks the wiring rather than their own computation (TASK-361).
 */
export async function axDescription(locator: Locator): Promise<string> {
  const page = locator.page();
  if (page.context().browser()?.browserType().name() !== "chromium") {
    return locator.evaluate((element) =>
      (element.getAttribute("aria-describedby") ?? "")
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" "),
    );
  }
  const cdp = await page.context().newCDPSession(page);
  try {
    await locator.evaluate((element) => element.setAttribute("data-ax-probe", ""));
    const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
    const { nodeId } = await cdp.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: "[data-ax-probe]",
    });
    const { nodes } = await cdp.send("Accessibility.getPartialAXTree", {
      nodeId,
      fetchRelatives: false,
    });
    return String(nodes[0]?.description?.value ?? "");
  } finally {
    await locator.evaluate((element) => element.removeAttribute("data-ax-probe"));
    await cdp.detach();
  }
}

/**
 * A property of `locator`'s node in Chromium's accessibility tree (`required`, `invalid`, …),
 * through the DevTools protocol; `undefined` when the node does not have it. Firefox and WebKit:
 * the `aria-*` attribute of that name, as a boolean (TASK-431).
 */
export async function axProperty(locator: Locator, name: string): Promise<unknown> {
  const page = locator.page();
  if (page.context().browser()?.browserType().name() !== "chromium") {
    const value = await locator.getAttribute(`aria-${name}`);
    return value === null ? undefined : value === "true";
  }
  const cdp = await page.context().newCDPSession(page);
  try {
    await locator.evaluate((element) => element.setAttribute("data-ax-probe", ""));
    const { root } = await cdp.send("DOM.getDocument", { depth: 0 });
    const { nodeId } = await cdp.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: "[data-ax-probe]",
    });
    const { nodes } = await cdp.send("Accessibility.getPartialAXTree", {
      nodeId,
      fetchRelatives: false,
    });
    return nodes[0]?.properties?.find((property) => property.name === name)?.value.value;
  } finally {
    await locator.evaluate((element) => element.removeAttribute("data-ax-probe"));
    await cdp.detach();
  }
}

/** The last link of the layout's nav, right before `<main>`: Tab from it enters the page. */
export function lastNavLink(page: Page): Locator {
  return page.getByRole("navigation", { name: "Components" }).getByRole("link").last();
}
