import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const ASSETS = resolve(import.meta.dirname, "../../../../backlog/assets");

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

/** The background color of `<body>`, as the browser computed it. */
const bodyBackground = (page: Page) =>
  page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test("renders every component without errors", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  for (const name of [
    "Tokens",
    "Logo",
    "Button and LinkButton",
    "Callout",
    "Card",
    "CodeBlock",
    "Tabs",
  ]) {
    await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("note")).toHaveCount(5);
  await expect(page.getByRole("contentinfo")).toBeVisible();
  // SVG children of a conditional branch are created in the SVG namespace (they render).
  const namespaces = await page
    .locator(".callout svg path")
    .evaluateAll((paths) => paths.map((path) => path.namespaceURI));
  expect(new Set(namespaces)).toEqual(new Set(["http://www.w3.org/2000/svg"]));
  const box = await page.locator(".callout svg path").first().boundingBox();
  expect(box?.width).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test("the active link is marked as the current page", async ({ page }) => {
  await page.goto("/");
  const docs = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Docs" });
  await expect(docs).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Playground" }),
  ).not.toHaveAttribute("aria-current");
});

// The identity of decision-90, measured on the rendered page in each theme.
for (const theme of ["light", "dark"] as const) {
  test.describe(`the identity, ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto("/");
    });

    test("square corners, no shadows and no gradients", async ({ page }) => {
      const offenders = await page.evaluate(() => {
        const found: string[] = [];
        for (const element of document.querySelectorAll("body, body *")) {
          for (const pseudo of [null, "::before", "::after"]) {
            const style = getComputedStyle(element, pseudo);
            if (pseudo !== null && style.content === "none") continue;
            const name = `${element.tagName.toLowerCase()}.${element.getAttribute("class")}${pseudo ?? ""}`;
            // The one round shape: the dot of the active navigation link.
            const dot = pseudo === "::before" && element.matches("nav a[aria-current]");
            if (!dot && style.borderRadius.split(" ").some((r) => Number.parseFloat(r) !== 0)) {
              found.push(`${name}: border-radius ${style.borderRadius}`);
            }
            if (style.boxShadow !== "none") found.push(`${name}: box-shadow ${style.boxShadow}`);
            if (style.backgroundImage.includes("gradient")) found.push(`${name}: gradient`);
          }
        }
        return found;
      });
      expect(offenders).toEqual([]);
    });

    test("amber is the logo's quarter, the active link's dot and emphasis in code", async ({
      page,
    }) => {
      const colors = await page.evaluate(() => {
        const probe = document.createElement("span");
        // Without this, each new colour would start a (very short) transition from the last one.
        probe.style.transitionProperty = "none";
        document.body.append(probe);
        const computed = (property: string) => {
          probe.style.color = `var(${property})`;
          return getComputedStyle(probe).color;
        };
        const result = {
          accent: computed("--lm-accent"),
          text: computed("--lm-text"),
          bg: computed("--lm-bg"),
          muted: computed("--lm-muted"),
        };
        probe.remove();
        return result;
      });
      const style = (selector: string, property: string, pseudo?: string) =>
        page
          .locator(selector)
          .first()
          .evaluate(
            (element, [name, pseudoElement]) =>
              getComputedStyle(element, pseudoElement ?? null).getPropertyValue(name!),
            [property, pseudo] as const,
          );

      // The logo: the L in the text colour, the quarter in the accent, the wordmark in uppercase.
      expect(await style("header .logo .wall", "fill")).toBe(colors.text);
      expect(await style("header .logo .light", "fill")).toBe(colors.accent);
      expect(await style("header .logo", "text-transform")).toBe("uppercase");
      expect(await style("header .logo", "font-family")).toContain("monospace");

      // The active link: a dot (a shape) as well as the text colour. Other links have neither.
      const active = "nav[aria-label=Main] a[aria-current=page]";
      const idle = "nav[aria-label=Main] a:not([aria-current])";
      expect(await style(active, "color")).toBe(colors.text);
      expect(await style(active, "background-color", "::before")).toBe(colors.accent);
      expect(Number.parseFloat(await style(active, "width", "::before"))).toBeGreaterThan(4);
      expect(await style(idle, "color")).toBe(colors.muted);
      expect(await style(idle, "content", "::before")).toBe("none");

      // Buttons are the page inverted, never amber.
      expect(await style(".btn.primary", "background-color")).toBe(colors.text);
      expect(await style(".btn.primary", "color")).toBe(colors.bg);

      // Code keeps syntax colours (the only hues besides amber), with an amber underline for
      // emphasis.
      const keyword = await style("pre .tok-keyword", "color");
      const string = await style("pre .tok-string", "color");
      expect(keyword).not.toBe(colors.text);
      expect(string).not.toBe(colors.text);
      expect(string).not.toBe(keyword);
      expect(await style("pre .tok-ref", "text-decoration-line")).toBe("underline");
      expect(await style("pre .tok-ref", "text-decoration-color")).toBe(colors.accent);
      expect(await style("pre .tok-ref", "color")).toBe(colors.text);

      // The selected tab: the text colour and a line in it.
      expect(await style("[role=tab][aria-selected=true]", "border-bottom-color")).toBe(
        colors.text,
      );

      // Focus rings use the text colour.
      await page.keyboard.press("Tab");
      const ring = await page.evaluate(() => {
        const focused = getComputedStyle(document.activeElement!);
        return [focused.outlineStyle, focused.outlineColor];
      });
      expect(ring).toEqual(["solid", colors.text]);
    });
  });
}

test("the theme toggle switches, persists and follows the system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");
  const toggle = page.getByRole("banner").getByRole("button", { name: "Dark theme" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(html).not.toHaveAttribute("data-theme");
  const light = await bodyBackground(page);

  await toggle.click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await bodyBackground(page)).not.toBe(light);
  expect(await page.evaluate(() => localStorage.getItem("lumiose-theme"))).toBe("dark");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await toggle.click();
  await expect(html).toHaveAttribute("data-theme", "light");
  expect(await bodyBackground(page)).toBe(light);

  // Without a stored choice, the system preference applies.
  await page.evaluate(() => localStorage.removeItem("lumiose-theme"));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await expect(html).not.toHaveAttribute("data-theme");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await bodyBackground(page)).not.toBe(light);
});

test("a data-theme subtree has its own theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const background = (theme: string) =>
    page
      .locator(`[data-theme="${theme}"] .card`)
      .first()
      .evaluate((card) => getComputedStyle(card).backgroundColor);
  expect(await background("light")).toBe("rgb(255, 255, 255)");
  expect(await background("dark")).toBe("rgb(0, 0, 0)");
});

test("tabs follow the WAI-ARIA keyboard pattern", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByRole("tablist", { name: "Package manager" }).getByRole("tab");
  // Every panel stays in the page, hidden unless its tab is selected.
  const panels = page.locator("[role=tabpanel]").filter({ hasText: /lumiose/ });
  await expect(tabs).toHaveText(["pnpm", "npm", "yarn", "bun"]);
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(panels).toHaveCount(4);
  await expect(panels.nth(0)).toBeVisible();
  await expect(panels.nth(1)).toBeHidden();
  await expect(page.getByRole("tabpanel", { name: "pnpm" })).toBeVisible();

  await tabs.nth(0).focus();
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(tabs.nth(1)).toHaveAttribute("tabindex", "0");
  await expect(tabs.nth(0)).toHaveAttribute("tabindex", "-1");
  await expect(page.getByRole("tabpanel", { name: "npm" })).toBeVisible();
  await expect(panels.nth(0)).toBeHidden();

  await page.keyboard.press("End");
  await expect(tabs.nth(3)).toBeFocused();
  await expect(page.getByRole("tabpanel", { name: "bun" })).toContainText("bunx lumiose dev");
  await page.keyboard.press("ArrowRight");
  await expect(tabs.nth(0)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(tabs.nth(3)).toBeFocused();
  await page.keyboard.press("Home");
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");

  await tabs.nth(2).click();
  await expect(page.getByRole("tabpanel", { name: "yarn" })).toBeVisible();
});

test("the copy button copies the code", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  const block = page.locator("figure").filter({ hasText: "Counter.stsx" });
  await block.getByRole("button", { name: "Copy code" }).click();
  await expect(block.getByRole("status")).toHaveText("Copied to the clipboard");
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('import { signal } from "lumiose";');
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the menu opens, closes with Escape and returns focus", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    const menu = nav.getByRole("button", { name: "Menu" });
    const docs = nav.getByRole("link", { name: "Docs" });
    await expect(menu).toBeVisible();
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(docs).toBeHidden();

    await menu.click();
    await expect(menu).toHaveAttribute("aria-expanded", "true");
    await expect(docs).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(docs).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(menu).toHaveAttribute("aria-expanded", "false");
    await expect(docs).toBeHidden();
    await expect(menu).toBeFocused();

    // A click outside the panel closes it.
    await menu.click();
    await expect(docs).toBeVisible();
    await page.mouse.click(195, 800);
    await expect(menu).toHaveAttribute("aria-expanded", "false");
  });
});

// `pnpm --filter @lumiose/site-kit screenshots`: the showcase in both themes (production build).
test.describe("screenshots", () => {
  test.beforeEach(() => {
    test.skip(!process.env.SCREENSHOTS || test.info().project.name !== "preview");
  });

  for (const theme of ["light", "dark"] as const) {
    test(`full page, ${theme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto("/");
      await page.screenshot({
        path: `${ASSETS}/redesign/task-604-site-kit-${theme}.jpg`,
        quality: 80,
        fullPage: true,
      });
    });

    test(`phone with the menu open, ${theme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/");
      await page.getByRole("button", { name: "Menu" }).click();
      // The bars turn into a cross through a transition.
      await page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished)));
      await page.screenshot({ path: test.info().outputPath(`phone-${theme}.png`) });
    });
  }
});
