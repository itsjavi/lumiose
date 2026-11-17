// WCAG 2.2 AA (decision-39): axe runs on every page type, in the light and the dark theme, and fails
// on any violation of the WCAG 2.0, 2.1 and 2.2 A and AA rules. Axe's "needs review" results (text
// on gradients, canvases or images) are printed for a manual check; the criteria axe cannot see are
// in the manual checklist (CONTRIBUTING.md) and, where a test can, in the checks below.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const WCAG_AA = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** The time a test that visits every page gets: it grows with the list. */
const PER_PAGE = 5_000;

/**
 * Every page of the /ui section (TASK-387), one per packages/ui/docs/*.md, so a new component's
 * page is checked without an edit here (TASK-406): the introduction, the guides (the theming page
 * shows the theme's palette) and each component's page with its live demos on the default theme.
 */
const UI_DOCS = join(import.meta.dirname, "../../../packages/ui/docs");
const UI_PAGES = readdirSync(UI_DOCS)
  .filter((file) => file.endsWith(".md"))
  .sort((a, b) => Number(b === "README.md") - Number(a === "README.md") || a.localeCompare(b))
  .map((file) => {
    const topic = file.slice(0, -".md".length);
    const title = /^# (.+)$/m.exec(readFileSync(join(UI_DOCS, file), "utf8"))?.[1] ?? topic;
    return { name: `UI ${title}`, path: topic === "README" ? "/ui" : `/ui/${topic}` };
  });

/** One URL per page type, and every UI page. */
const PAGES = [
  { name: "landing", path: "/" },
  { name: "docs page", path: "/docs/concepts/styles" },
  { name: "docs index", path: "/docs" },
  { name: "diagnostics index", path: "/docs/errors" },
  { name: "diagnostic page", path: "/docs/errors/LUM2001" },
  { name: "benchmarks", path: "/benchmarks" },
  { name: "benchmark report", path: "/benchmarks/js-framework-benchmark" },
  { name: "benchmark method", path: "/benchmarks/fullstack-comparison" },
  { name: "showcase and demos", path: "/showcase" },
  { name: "playground", path: "/playground" },
  { name: "404", path: "/docs/nope" },
  ...UI_PAGES,
];

/** Opens the first demo of a UI page: its popup, or (Tabs) another panel. */
const OPEN_DEMOS: { name: string; path: string; open: (page: Page) => Promise<void> }[] = [
  {
    name: "Dialog",
    path: "/ui/dialog",
    open: async (page) => {
      await page.locator(".hero .preview").getByRole("button").click();
      await expect(page.getByRole("alertdialog")).toBeVisible();
    },
  },
  {
    name: "Menu",
    path: "/ui/menu",
    open: async (page) => {
      await page.locator(".hero .preview").getByRole("button", { name: "Project" }).click();
      await page.keyboard.press("ArrowDown");
      await expect(page.getByRole("menu").first()).toBeVisible();
    },
  },
  {
    name: "Popover",
    path: "/ui/popover",
    open: async (page) => {
      await page.locator(".hero .preview").getByRole("button", { name: "Notifications" }).click();
      await expect(page.getByRole("dialog", { name: "Notifications" }).first()).toBeVisible();
    },
  },
  {
    name: "Tabs",
    path: "/ui/tabs",
    open: async (page) => {
      await page.locator(".hero .preview").getByRole("tab", { name: "Password" }).click();
      await expect(page.locator(".hero .preview").getByRole("tabpanel")).toHaveText(/password/);
    },
  },
  {
    name: "Combobox",
    path: "/ui/combobox",
    open: async (page) => {
      await page.locator(".hero .preview").getByRole("button", { name: "Show cities" }).click();
      await expect(page.getByRole("listbox").first()).toBeVisible();
    },
  },
  {
    name: "Collapsible",
    path: "/ui/collapsible",
    open: async (page) => {
      await page.locator(".hero .preview summary").click();
      await expect(page.locator(".hero .preview details")).toHaveAttribute("open");
    },
  },
  {
    name: "Accordion",
    path: "/ui/accordion",
    open: async (page) => {
      await page.locator(".hero .preview summary", { hasText: "Can I return it?" }).click();
      await expect(
        page.locator(".hero .preview").getByRole("region", { name: "Can I return it?" }),
      ).toBeVisible();
    },
  },
  {
    name: "Toast",
    path: "/ui/toast",
    open: async (page) => {
      await page.locator(".hero .preview").getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Saved" }).first()).toBeVisible();
    },
  },
  {
    name: "Context Menu",
    path: "/ui/context-menu",
    open: async (page) => {
      await page.locator(".hero .preview [tabindex='0']").focus();
      await page.keyboard.press("Shift+F10");
      await expect(page.getByRole("menuitem", { name: "Rename" }).first()).toBeFocused();
    },
  },
  {
    name: "Drawer",
    path: "/ui/drawer",
    open: async (page) => {
      await page.locator(".hero .preview").getByRole("button", { name: "Filters" }).click();
      await expect(page.getByRole("dialog", { name: "Filters" }).first()).toBeVisible();
    },
  },
  {
    name: "Menubar",
    path: "/ui/menubar",
    open: async (page) => {
      await page.locator(".hero .preview").getByRole("menuitem", { name: "File" }).click();
      await expect(page.getByRole("menu", { name: "File" }).first()).toBeVisible();
    },
  },
  {
    name: "Navigation Menu",
    path: "/ui/navigation-menu",
    open: async (page) => {
      await page.locator(".hero .preview").getByRole("button", { name: "Products" }).click();
      await expect(
        page
          .locator(".hero .preview [popover]:popover-open")
          .getByRole("link", { name: "Analytics" }),
      ).toBeVisible();
    },
  },
  {
    name: "Tooltip",
    path: "/ui/tooltip",
    open: async (page) => {
      await page.locator(".hero .preview").getByRole("button", { name: "Bold" }).focus();
      await expect(page.getByRole("tooltip").first()).toBeVisible();
    },
  },
];

/** Waits for the islands a page hydrates on load, so axe sees their final markup. */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  const path = new URL(page.url()).pathname;
  if (path.startsWith("/playground")) {
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
      const response = await page.goto(path);
      // A docs page the site does not render (one missing from llms.txt) is not checked as a 404.
      if (path.startsWith("/ui")) expect(response?.status(), path).toBe(200);
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
  for (const { name, path, open } of OPEN_DEMOS) {
    test(`axe: UI ${name} demo open (${scheme}) has no WCAG 2.2 AA violations`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(path);
      await settle(page);
      await open(page);
      // The popups fade in: axe checks their final colours.
      await page.waitForTimeout(400);
      const results = await new AxeBuilder({ page }).withTags(WCAG_AA).analyze();
      expect(describe(results.violations)).toEqual([]);
    });
  }
}

/**
 * The decorative layers axe cannot see through ("needs review"), each replaced by a solid color at
 * its strongest: the glows composited at their peak, and the sticky header's translucent background
 * (85% of the page's, site-kit's SiteHeader) over the page's darkest (light theme) or lightest (dark
 * theme) content. The primary button is a solid fill, which axe sees as it is. The site's own
 * selectors: keep in sync.
 */
const FLATTENED = [
  // The beams behind the page are thin lines, which no solid color stands for: "text over the
  // beams keeps AA contrast" below measures them.
  `tr.self > * { background: color-mix(in srgb, var(--lm-accent) 10%, var(--lm-surface)) !important; }
   .top { background: color-mix(in srgb, var(--lm-glow-a) 22%, var(--lm-bg)) !important; }
   .footer { background: color-mix(in srgb, var(--lm-glow-a) 8%, var(--lm-bg)) !important; }
   .card::before { display: none !important; }
   .card.linked { background: color-mix(in srgb, var(--lm-glow-a) 22%, var(--lm-surface)) !important; }
   header.header { backdrop-filter: none !important;
     background: color-mix(in srgb, var(--lm-bg) 85%, var(--lm-text)) !important; }`,
];

for (const scheme of ["light", "dark"] as const) {
  test(`axe: text keeps AA contrast over decorative layers at their strongest (${scheme})`, async ({
    page,
  }) => {
    test.setTimeout(PAGES.length * PER_PAGE);
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

/** Every beam at the top of its pulse at once: brighter than the page ever is. */
const BEAMS_AT_PEAK = `*, *::before, *::after { transition: none !important; }
  .lm-beams line { animation: none !important; opacity: var(--lm-beam) !important; }`;

/** The page types whose text starts nearest the beams' corner, and the landing's brighter beams. */
const BEAM_PAGES = [
  "/",
  "/docs/getting-started",
  "/docs/concepts/styles",
  "/ui",
  "/benchmarks",
  "/playground",
];

for (const scheme of ["light", "dark"] as const) {
  for (const [width, height] of [
    [1440, 900],
    [820, 1180],
    [390, 844],
  ] as const) {
    test(`text over the beams keeps AA contrast at their brightest (${scheme}, ${width} px)`, async ({
      page,
    }) => {
      // decision-90: text keeps 4.5:1 against what is behind it, a beam at its brightest included.
      // Axe cannot see the beams behind the text, so this test does: with every beam at its peak
      // and the text hidden, it captures the page with and without the beams. The pixels that
      // differ inside a text's box are the beams (and arcs) behind that text, and each is compared
      // with the text's color. Large text gets no lower bar.
      test.setTimeout(BEAM_PAGES.length * PER_PAGE);
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ colorScheme: scheme });
      const failures: string[] = [];
      let lowest = 21;
      for (const path of BEAM_PAGES) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await page.addStyleTag({ content: BEAMS_AT_PEAK });
        const texts = await page.evaluate(() => {
          const area = document.querySelector(".lm-beams")!.getBoundingClientRect();
          const bottom = Math.min(area.bottom, innerHeight);
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          const found: { label: string; box: number[]; rgb: number[] }[] = [];
          for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
            const parent = node.parentElement!;
            const text = node.textContent!.trim();
            if (text === "" || parent.closest(".sr-only") !== null) continue;
            if (!parent.checkVisibility({ visibilityProperty: true, opacityProperty: true }))
              continue;
            const range = document.createRange();
            range.selectNodeContents(node);
            const rgb = getComputedStyle(parent)
              .color.match(/[\d.]+/g)!
              .slice(0, 3)
              .map(Number);
            for (const box of range.getClientRects()) {
              const outside =
                box.width < 1 ||
                box.left >= area.right ||
                box.right <= 0 ||
                box.top >= bottom ||
                box.bottom <= 0;
              if (outside) continue;
              found.push({
                label: `${parent.tagName.toLowerCase()} "${text.slice(0, 24)}"`,
                box: [box.left, box.top, box.width, box.height],
                rgb,
              });
            }
          }
          return found;
        });
        expect(texts.length, `${path}: text over the beams' area`).toBeGreaterThan(0);
        await page.addStyleTag({
          content: "* { color: transparent !important; text-shadow: none !important; }",
        });
        const lit = (await page.screenshot()).toString("base64");
        await page.addStyleTag({ content: ".lm-beams { visibility: hidden !important; }" });
        const plain = (await page.screenshot()).toString("base64");
        const worst = await page.evaluate(
          async ({ litPng, plainPng, boxes }) => {
            // oxlint-disable-next-line unicorn/consistent-function-scoping -- runs in the page
            const pixels = async (png: string) => {
              const image = new Image();
              image.src = `data:image/png;base64,${png}`;
              await image.decode();
              const canvas = new OffscreenCanvas(image.width, image.height);
              const context = canvas.getContext("2d")!;
              context.drawImage(image, 0, 0);
              return context.getImageData(0, 0, image.width, image.height);
            };
            // WCAG relative luminance of an sRGB color (0–255 channels).
            // oxlint-disable-next-line unicorn/consistent-function-scoping -- runs in the page
            const linear = (channel: number) => {
              const c = channel / 255;
              return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
            };
            // oxlint-disable-next-line unicorn/consistent-function-scoping -- runs in the page
            const luminance = (r: number, g: number, b: number) =>
              0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
            const [a, b] = [await pixels(litPng), await pixels(plainPng)];
            let low = { ratio: 21, label: "", on: [0, 0, 0], pixels: 0 };
            for (const text of boxes) {
              const color = luminance(text.rgb[0]!, text.rgb[1]!, text.rgb[2]!);
              const [left, top, w, h] = text.box as [number, number, number, number];
              for (
                let y = Math.max(0, Math.floor(top));
                y < Math.min(a.height, Math.ceil(top + h));
                y++
              ) {
                for (
                  let x = Math.max(0, Math.floor(left));
                  x < Math.min(a.width, Math.ceil(left + w));
                  x++
                ) {
                  const i = (y * a.width + x) * 4;
                  const [r, g, bl] = [a.data[i]!, a.data[i + 1]!, a.data[i + 2]!];
                  if (r === b.data[i] && g === b.data[i + 1] && bl === b.data[i + 2]) continue;
                  low.pixels++;
                  const behind = luminance(r, g, bl);
                  const ratio = (Math.max(color, behind) + 0.05) / (Math.min(color, behind) + 0.05);
                  if (ratio < low.ratio) low = { ...low, ratio, label: text.label, on: [r, g, bl] };
                }
              }
            }
            return low;
          },
          { litPng: lit, plainPng: plain, boxes: texts },
        );
        lowest = Math.min(lowest, worst.ratio);
        if (worst.ratio < 4.5) {
          failures.push(
            `${path}: ${worst.label}: ${worst.ratio.toFixed(2)} on rgb(${worst.on.join(", ")})`,
          );
        }
      }
      console.log(`[lowest contrast over a beam] ${scheme}, ${width} px: ${lowest.toFixed(2)}:1`);
      expect(failures).toEqual([]);
    });
  }
}

test("reduced motion stops non-essential motion", async ({ page }) => {
  test.setTimeout(PAGES.length * PER_PAGE);
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
  test.setTimeout(PAGES.length * PER_PAGE);
  for (const { path } of PAGES) {
    await page.goto(path);
    await settle(page);
    const long = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) => {
          const end = Number(animation.effect?.getComputedTiming().endTime ?? 0);
          // An indeterminate progress bar (the UI Progress page) is an activity indicator: its
          // motion tells that work goes on, as 2.2.2 allows, and it stops under reduced motion.
          const target = (animation.effect as KeyframeEffect | null)?.target;
          if (target?.matches("progress:indeterminate")) return false;
          // The beams behind the page have a pause control, checked below.
          if (target?.matches(".lm-beams line")) return false;
          return animation.playState === "running" && end > 5000;
        })
        .map((animation) => (animation as CSSAnimation).animationName ?? animation.id),
    );
    // Adding one? Give it a visible pause button and stop it under prefers-reduced-motion, then
    // check here that the button pauses it.
    expect(long, path).toEqual([]);

    // The beams: their control is on every page, and it pauses every beam.
    await page.getByRole("checkbox", { name: "Pause background animation" }).check();
    const beams = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((animation) =>
          (animation.effect as KeyframeEffect | null)?.target?.matches(".lm-beams line"),
        )
        .map((animation) => animation.playState),
    );
    expect(beams.length, path).toBeGreaterThan(0);
    expect(new Set(beams), path).toEqual(new Set(["paused"]));
  }
});

test("docs and UI pages reflow at 320 px, also with WCAG's text spacing (1.4.10, 1.4.12)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const paths = [
    "/docs/concepts/styles",
    ...PAGES.map((p) => p.path).filter((p) => p.startsWith("/ui")),
  ];
  for (const path of paths) {
    await page.goto(path);
    await settle(page);
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
    expect(await overflow(), path).toBeLessThanOrEqual(0);
    await page.addStyleTag({
      content:
        "* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }",
    });
    expect(await overflow(), `${path} with text spacing`).toBeLessThanOrEqual(0);
  }
});

test("keyboard focus is visible and not hidden by the sticky header", async ({ page }) => {
  for (const path of ["/", "/docs/concepts/styles", "/showcase", "/benchmarks", "/ui/tabs"]) {
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
          range: element.matches('input[type="range"]'),
          box: { x: box.x - 6, y: box.y - 6, width: box.width + 12, height: box.height + 12 },
          bottom: box.bottom,
          // The skip link and the header's own controls sit above the content on purpose.
          aboveContent: element.closest("header") !== null || element.classList.contains("skip"),
        };
      });
      if (focus === null) continue;
      if (!focus.indicator && focus.range) {
        // A range input draws its ring on the thumb, a pseudo-element computed styles do not
        // expose: compare how it is painted, focused and blurred.
        const focused = await page.screenshot({ clip: focus.box });
        await page.evaluate(() => (document.activeElement as HTMLElement).blur());
        const blurred = await page.screenshot({ clip: focus.box });
        await page.locator('input[type="range"]').first().focus();
        focus.indicator = !focused.equals(blurred);
      }
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
  test.setTimeout(PAGES.length * PER_PAGE);
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
