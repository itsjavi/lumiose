// WCAG 2.2 AA (decision-39): axe runs on every page type, in the light and the dark theme, and fails
// on any violation of the WCAG 2.0, 2.1 and 2.2 A and AA rules. Axe's "needs review" results (text
// on gradients, canvases or images) are printed for a manual check; the criteria axe cannot see are
// in the manual checklist (CONTRIBUTING.md) and, where a test can, in the checks below.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** One URL per page type. */
const PAGES = [
  { name: "landing", path: "/" },
  { name: "docs page", path: "/docs/concepts/styles" },
  { name: "docs index", path: "/docs" },
  { name: "diagnostics index", path: "/docs/errors" },
  { name: "diagnostic page", path: "/docs/errors/LUM2001" },
  { name: "benchmarks", path: "/benchmarks" },
  { name: "benchmark report", path: "/benchmarks/js-framework-benchmark" },
  { name: "showcase and demos", path: "/showcase" },
  { name: "playground", path: "/playground" },
  { name: "404", path: "/docs/nope" },
];

/** Waits for the islands a page hydrates on load, so axe sees their final markup. */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  const path = new URL(page.url()).pathname;
  if (path === "/") {
    // The live demo hydrates when visible: check it live (the static stand-in is checked below).
    await page.locator(".live-demo").scrollIntoViewIfNeeded();
  }
  if (path === "/" || path.startsWith("/playground")) {
    await expect(page.locator(".playground .status")).toContainText("Compiled with lumiose_wasm", {
      timeout: 20_000,
    });
  }
}

interface AxeResult {
  id: string;
  impact?: string | null;
  nodes: {
    target: unknown[];
    any: { data?: unknown; message: string }[];
    failureSummary?: string;
  }[];
}

/** `rule (impact): target: why`, one line per node. */
function describe(results: AxeResult[]) {
  return results.flatMap((result) =>
    result.nodes.map(
      (node) => `${result.id} (${result.impact ?? "n/a"}): ${node.target.join(" ")}: ${why(node)}`,
    ),
  );
}

/** The needs-review nodes grouped by rule and reason: `rule: reason (count)` and their targets. */
function needsReview(results: AxeResult[]) {
  const groups = new Map<string, string[]>();
  for (const result of results) {
    for (const node of result.nodes) {
      const key = `${result.id}: ${why(node)}`;
      groups.set(key, [...(groups.get(key) ?? []), node.target.join(" ")]);
    }
  }
  return [...groups].map(
    ([key, targets]) => `${key} (${targets.length})\n    ${targets.join("\n    ")}`,
  );
}

function why(node: AxeResult["nodes"][number]) {
  return (node.any.map((check) => check.message).join(" ") || node.failureSummary || "").replaceAll(
    "\n",
    " ",
  );
}

for (const scheme of ["light", "dark"] as const) {
  for (const { name, path } of PAGES) {
    test(`axe: ${name} (${scheme}) has no WCAG 2.2 AA violations`, async ({ page }, testInfo) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await settle(page);
      const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
      const review = needsReview(results.incomplete);
      if (review.length > 0) {
        // Needs review: checked by hand (CONTRIBUTING.md, TASK-219 notes); listed so new ones
        // are noticed.
        console.log(`[axe needs review] ${name} (${scheme}):\n  ${review.join("\n  ")}`);
        testInfo.annotations.push({ type: "axe needs review", description: review.join("; ") });
      }
      expect(describe(results.violations)).toEqual([]);
    });
  }
}

for (const scheme of ["light", "dark"] as const) {
  test(`axe: landing with the demo's static stand-in (${scheme}) has no WCAG 2.2 AA violations`, async ({
    page,
  }) => {
    // Before the live demo scrolls into view it shows what a visitor without JavaScript gets.
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator(".live-demo").getByText("You write")).toBeAttached();
    const results = await new AxeBuilder({ page })
      .include(".live-demo")
      .withTags(WCAG_AA)
      .analyze();
    expect(describe(results.violations)).toEqual([]);
  });
}

/**
 * The decorative layers axe cannot see through ("needs review"), each replaced by a solid color at
 * its strongest: the glows composited at their peak, the sticky header's translucent background
 * over the page's darkest (light theme) or lightest (dark theme) content, and the two ends of the
 * primary buttons' and the gradient text's gradients. The site's own selectors: keep in sync.
 */
const FLATTENED = [
  `.top { background: color-mix(in srgb, var(--lm-glow-a) 22%, var(--lm-bg)) !important; }
   .footer { background: color-mix(in srgb, var(--lm-glow-a) 8%, var(--lm-bg)) !important; }
   .card::before { display: none !important; }
   .card.linked { background: color-mix(in srgb, var(--lm-glow-a) 22%, var(--lm-surface)) !important; }
   header.header { backdrop-filter: none !important;
     background: color-mix(in srgb, var(--lm-bg) 80%, var(--lm-text)) !important; }
   .btn.primary { background: color-mix(in oklab, var(--lm-accent) 92%, white) !important; }
   .lit { color: var(--lm-accent-text) !important; background: none !important; }`,
  `.btn.primary { background: var(--lm-accent) !important; }
   .lit { color: var(--lm-glow-text) !important; background: none !important; }`,
];

for (const scheme of ["light", "dark"] as const) {
  test(`axe: text keeps AA contrast over decorative layers at their strongest (${scheme})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const failures: string[] = [];
    for (const { name, path } of PAGES) {
      await page.goto(path);
      await settle(page);
      // No transitions: the flattened colors apply at once, not mid-fade.
      await page.addStyleTag({ content: "*, ::before, ::after { transition: none !important; }" });
      for (const css of FLATTENED) {
        await page.addStyleTag({ content: css });
        const results = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
        failures.push(...describe(results.violations).map((line) => `${name}: ${line}`));
        const left = needsReview(results.incomplete);
        if (left.length > 0)
          console.log(`[flattened needs review] ${name} (${scheme}):\n  ${left.join("\n  ")}`);
      }
    }
    expect(failures).toEqual([]);
  });
}

test("reduced motion stops non-essential motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const { path } of PAGES) {
    await page.goto(path);
    await settle(page);
    const moving = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => {
          const timing = animation.effect?.getComputedTiming();
          return animation.playState === "running" && Number(timing?.endTime ?? 0) > 1000;
        })
        .map((animation) => (animation as CSSAnimation).animationName ?? animation.id),
    );
    expect(moving, path).toEqual([]);
  }
});

test("no ambient motion runs longer than 5 seconds (2.2.2 needs a pause control for it)", async ({
  page,
}) => {
  for (const { path } of PAGES) {
    await page.goto(path);
    await settle(page);
    const long = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => {
          const end = Number(animation.effect?.getComputedTiming().endTime ?? 0);
          return animation.playState === "running" && end > 5000;
        })
        .map((animation) => (animation as CSSAnimation).animationName ?? animation.id),
    );
    // Adding one? Give it a visible pause button and stop it under prefers-reduced-motion, then
    // check here that the button pauses it.
    expect(long, path).toEqual([]);
  }
});

test("keyboard focus is visible and not hidden by the sticky header", async ({ page }) => {
  for (const path of ["/", "/docs/concepts/styles", "/showcase", "/benchmarks"]) {
    await page.goto(path);
    await settle(page);
    const header = await page.locator("header").first().boundingBox();
    for (let index = 0; index < 40; index++) {
      await page.keyboard.press("Tab");
      // 2.4.7: focusing changes how the element or a near ancestor looks (outline, ring, border,
      // background), e.g. a card around a stretched link. Compared with the element blurred.
      const focus = await page.evaluate(async () => {
        // Some widgets (CodeMirror) restyle on focus a frame later.
        // oxlint-disable-next-line unicorn/consistent-function-scoping -- runs in the page
        const frames = () =>
          new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const element = document.activeElement as HTMLElement | null;
        if (element === null || element === document.body) return null;
        const chain = [element];
        for (let parent = element.parentElement; parent && chain.length < 4;) {
          chain.push(parent);
          parent = parent.parentElement;
        }
        const look = () =>
          chain
            .map((node) => {
              const style = getComputedStyle(node);
              return [
                style.outlineStyle,
                style.outlineWidth,
                style.outlineColor,
                style.boxShadow,
                style.borderColor,
                style.backgroundColor,
                style.textDecorationLine,
              ].join("|");
            })
            .join("\n");
        await frames();
        const focused = look();
        element.blur();
        await frames();
        const blurred = look();
        element.focus();
        await frames();
        const box = element.getBoundingClientRect();
        return {
          label: `${element.tagName.toLowerCase()} "${element.textContent?.trim().slice(0, 30)}"`,
          indicator: focused !== blurred,
          bottom: box.bottom,
          // The skip link and the header's own controls sit above the content on purpose.
          aboveContent: element.closest("header") !== null || element.classList.contains("skip"),
        };
      });
      if (focus === null) continue;
      expect(focus.indicator, `${path}: ${focus.label} has no focus indicator`).toBe(true);
      // 2.4.11: a focused element below the sticky header is not entirely covered by it.
      if (!focus.aboveContent && header !== null) {
        expect(focus.bottom, `${path}: ${focus.label} is hidden by the header`).toBeGreaterThan(
          header.y + header.height,
        );
      }
    }
  }
});

test("pointer targets are at least 24 by 24 px, or spaced as 2.5.8 allows", async ({ page }) => {
  for (const { path } of PAGES) {
    await page.goto(path);
    await settle(page);
    const small = await page.evaluate(() => {
      const targets = Array.from(
        document.querySelectorAll<HTMLElement>(
          'a[href], button, input, select, textarea, summary, [role="tab"], [tabindex="0"]',
        ),
      ).filter((element) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== "hidden";
      });
      // Links inside a sentence are exempt (2.5.8 "inline"): an inline link whose block has
      // other text. A list of bare links is not.
      // oxlint-disable-next-line unicorn/consistent-function-scoping -- runs in the page, not here
      const inline = (element: HTMLElement) => {
        if (element.tagName !== "A" || getComputedStyle(element).display !== "inline") return false;
        const block = element.closest("p, li, td, th, dd, figcaption, blockquote");
        return block !== null && block.textContent!.trim() !== element.textContent!.trim();
      };
      const boxes = targets.map((element) => element.getBoundingClientRect());
      return targets
        .map((element, index) => ({ element, box: boxes[index]! }))
        .filter(({ element, box }) => {
          if (inline(element) || (box.width >= 24 && box.height >= 24)) return false;
          // Spacing exception: a 24 px circle on the target's center overlaps no other target,
          // and no other undersized target's circle.
          const cx = box.left + box.width / 2;
          const cy = box.top + box.height / 2;
          return boxes.some((other, index) => {
            const target = targets[index]!;
            if (target === element || target.contains(element) || element.contains(target)) {
              return false;
            }
            const dx = Math.max(other.left - cx, 0, cx - other.right);
            const dy = Math.max(other.top - cy, 0, cy - other.bottom);
            if (Math.hypot(dx, dy) < 12) return true;
            const undersized = other.width < 24 || other.height < 24;
            const centers = Math.hypot(
              other.left + other.width / 2 - cx,
              other.top + other.height / 2 - cy,
            );
            return undersized && !inline(target) && centers < 24;
          });
        })
        .map(
          ({ element, box }) =>
            `${element.tagName.toLowerCase()} "${element.textContent?.trim().slice(0, 30)}" ${Math.round(box.width)}x${Math.round(box.height)}`,
        );
    });
    expect(small, path).toEqual([]);
  }
});
