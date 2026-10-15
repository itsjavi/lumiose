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
  { name: "benchmark method", path: "/benchmarks/fullstack-comparison" },
  { name: "showcase and demos", path: "/showcase" },
  { name: "playground", path: "/playground" },
  { name: "404", path: "/docs/nope" },
  // The /ui section (TASK-387): the introduction, the theming page with the theme's palette, and
  // each component's page with its live demos on @lumiose/ui's default theme.
  { name: "UI introduction", path: "/ui" },
  { name: "UI theming", path: "/ui/theming" },
  { name: "UI Dialog", path: "/ui/dialog" },
  { name: "UI Menu", path: "/ui/menu" },
  { name: "UI Popover", path: "/ui/popover" },
  { name: "UI Tabs", path: "/ui/tabs" },
  { name: "UI Tooltip", path: "/ui/tooltip" },
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
  if (path === "/") {
    // The light field (client:idle) draws once WebGL is up; the CSS light stays without it.
    await page
      .locator(".stage canvas.on")
      .waitFor({ state: "attached", timeout: 10_000 })
      .catch(() => {});
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
 * The brightest color behind the hero's copy over the light field's frames, scrim included, from
 * "text over the light field keeps AA contrast" below (it prints the measured peak).
 */
const STAGE_PEAK = "#302e40";

/**
 * The decorative layers axe cannot see through ("needs review"), each replaced by a solid color at
 * its strongest: the glows composited at their peak, the sticky header's translucent background
 * over the page's darkest (light theme) or lightest (dark theme) content, and the two ends of the
 * primary buttons' and the gradient text's gradients. The site's own selectors: keep in sync.
 */
const FLATTENED = [
  // The landing's night stage: the light field, its CSS fallback and the scrim become one solid
  // color, the brightest the field gets behind the copy (measured by the test below, rounded up).
  `.stage { background: ${STAGE_PEAK} !important; }
   .stage canvas, .stage .scrim { display: none !important; }
   .box { background: color-mix(in srgb, var(--lm-glow-b) 14%, var(--lm-surface)) !important; }
   tr.self > * { background: color-mix(in srgb, var(--lm-accent) 10%, var(--lm-surface)) !important; }
   .closing { background: color-mix(in srgb, var(--lm-glow-b) 12%, var(--lm-bg)) !important; }
   .install { background: color-mix(in srgb, var(--lm-bg) 75%, ${STAGE_PEAK}) !important; }
   .top { background: color-mix(in srgb, var(--lm-glow-a) 22%, var(--lm-bg)) !important; }
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

/** An sRGB channel (0–255) in linear light. */
function linear(channel: number) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of an sRGB color (0–255 channels). */
function luminance([r, g, b]: number[]) {
  return 0.2126 * linear(r!) + 0.7152 * linear(g!) + 0.0722 * linear(b!);
}

for (const [width, height] of [
  [1440, 900],
  [820, 1180],
  [390, 844],
] as const) {
  test(`text over the light field keeps AA contrast at every sampled frame (${width} px)`, async ({
    page,
  }) => {
    // decision-39: text over a moving background sits on a backdrop that keeps 4.5:1 (3:1 for
    // large text) at every frame. Axe cannot see into the canvas, so this test does: it hides the
    // copy, captures the stage over several seconds of light, and compares each text color with
    // the brightest pixel behind it.
    await page.setViewportSize({ width, height });
    await page.goto("/");
    const lit = page.locator(".stage canvas.on");
    await lit.waitFor({ state: "attached", timeout: 10_000 }).catch(() => {});
    test.skip((await lit.count()) === 0, "No WebGL here: the CSS light is checked by axe.");
    await page.waitForTimeout(2500);

    const texts = await page.evaluate(() => {
      const stage = document.querySelector(".stage")!.getBoundingClientRect();
      const selectors = [".eyebrow", "h1 .line", ".lead", ".badge", ".proof strong", ".proof span"];
      return selectors.flatMap((selector) =>
        Array.from(document.querySelectorAll<HTMLElement>(`.hero ${selector}`)).map((element) => {
          const box = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const size = Number.parseFloat(style.fontSize);
          const bold = Number(style.fontWeight) >= 700;
          // The gradient headline: its darkest stop, the indigo end.
          const color = element.classList.contains("lit") ? "rgb(184, 176, 255)" : style.color;
          return {
            label: `${selector} "${element.textContent!.trim().slice(0, 24)}"`,
            box: [box.left - stage.left, box.top - stage.top, box.width, box.height],
            rgb: color.match(/\d+/g)!.slice(0, 3).map(Number),
            large: size >= 24 || (bold && size >= 18.66),
          };
        }),
      );
    });
    await page.addStyleTag({ content: ".hero { visibility: hidden !important; }" });

    const failures = new Set<string>();
    let peak = [0, 0, 0];
    for (let frame = 0; frame < 4; frame++) {
      const shot = (await page.locator(".stage").screenshot()).toString("base64");
      const brightest = await page.evaluate(
        async ({ png, boxes }) => {
          const image = new Image();
          image.src = `data:image/png;base64,${png}`;
          await image.decode();
          const canvas = new OffscreenCanvas(image.width, image.height);
          const context = canvas.getContext("2d")!;
          context.drawImage(image, 0, 0);
          return boxes.map(([x, y, w, h]) => {
            const data = context.getImageData(
              Math.max(0, Math.floor(x!)),
              Math.max(0, Math.floor(y!)),
              Math.max(1, Math.ceil(w!)),
              Math.max(1, Math.ceil(h!)),
            ).data;
            let best = [0, 0, 0];
            let bestSum = -1;
            for (let i = 0; i < data.length; i += 4) {
              // Rec. 709 weights: the brightest pixel by luminance, close enough to rank them.
              const sum = 0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!;
              if (sum > bestSum) {
                bestSum = sum;
                best = [data[i]!, data[i + 1]!, data[i + 2]!];
              }
            }
            return best;
          });
        },
        { png: shot, boxes: texts.map((text) => text.box) },
      );
      texts.forEach((text, index) => {
        const background = brightest[index]!;
        if (luminance(background) > luminance(peak)) peak = background;
        const ratio = (luminance(text.rgb) + 0.05) / (luminance(background) + 0.05);
        if (ratio < (text.large ? 3 : 4.5)) {
          failures.add(`${text.label}: ${ratio.toFixed(2)} on rgb(${background.join(", ")})`);
        }
      });
      await page.waitForTimeout(1500);
    }
    console.log(`[light field peak behind text] ${width} px: rgb(${peak.join(", ")})`);
    expect([...failures]).toEqual([]);
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
