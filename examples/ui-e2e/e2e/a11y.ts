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
 * as `tag "text"`; a test expects `[]`. Scrollable boxes are fine: their content stays reachable.
 */
export function clipped(scope: Locator): Promise<string[]> {
  return scope.evaluate((root) => {
    const found: string[] = [];
    for (const element of [root, ...root.querySelectorAll<HTMLElement>("*")]) {
      const style = getComputedStyle(element);
      if (style.display === "none" || /auto|scroll/.test(style.overflow)) continue;
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

/** The last link of the layout's nav, right before `<main>`: Tab from it enters the page. */
export function lastNavLink(page: Page): Locator {
  return page.getByRole("navigation", { name: "Components" }).getByRole("link").last();
}
