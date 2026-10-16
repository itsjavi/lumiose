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
 * WCAG 2.5.8 Target Size (Minimum): the buttons and links under `scope` smaller than 24 by 24.
 * Links inside a sentence (`display: inline`) are the criterion's inline exception.
 */
export function smallTargets(scope: Locator): Promise<string[]> {
  return scope.evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>("button, a[href], [role=tab], input")]
      .filter((element) => element.getClientRects().length > 0)
      .filter(
        (element) => !(element.localName === "a" && getComputedStyle(element).display === "inline"),
      )
      .map((element) => ({ element, box: element.getBoundingClientRect() }))
      .filter(({ box }) => box.width < 24 || box.height < 24)
      .map(({ element, box }) => `${element.textContent?.trim()}: ${box.width}x${box.height}`),
  );
}

/** WCAG 2.4.7 Focus Visible: the focused element's outline, `"<width> <style>"`, or "none". */
export function focusRing(page: Page): Promise<string> {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (!active) return "none";
    const style = getComputedStyle(active);
    return style.outlineStyle === "none" ? "none" : `${style.outlineWidth} ${style.outlineStyle}`;
  });
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
