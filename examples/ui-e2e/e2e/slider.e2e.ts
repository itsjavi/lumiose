// Slider (TASK-372): native range inputs as thumbs, which drag, take the arrows, Home and End,
// follow the direction and submit without JavaScript; `<lu-slider>` adds Page Up and Page Down
// (and Shift with an arrow) by the large step, keeps a range's thumbs in order and apart (push or
// none), moves the nearest thumb on a press on the track, and keeps the value text current. With
// the sync with signals in an island and WCAG 2.2 AA with the default theme (doc-9 sections 1, 14
// and 17; 2.5.7: every drag has a keyboard alternative).
import { expect, test, type Locator, type Page } from "@playwright/test";
import { axe, clipped, lastNavLink, SCHEMES, smallTargets, TEXT_SPACING } from "./a11y.ts";

/** Lumiose's console warnings (LUM codes), such as a hydration that fell back to rendering. */
const lumioseWarnings = (page: Page) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("LUM")) warnings.push(message.text());
  });
  return warnings;
};

const thumb = (page: Page, name: string) => page.getByRole("slider", { name, exact: true });
const valueOf = async (locator: Locator) => Number(await locator.inputValue());

/** The point of `value` on a thumb's input, from `min` to `max`, where the native thumb sits. */
async function pointAt(input: Locator, value: number, min = 0, max = 100) {
  const box = (await input.boundingBox())!;
  const radius = box.height / 2;
  const x = box.x + radius + ((box.width - 2 * radius) * (value - min)) / (max - min);
  return { x, y: box.y + box.height / 2 };
}

/** Waits for /slider/island to hydrate: "Set the signals" answers. */
async function hydrated(page: Page) {
  await expect(async () => {
    await page.getByTestId("set-signals").click({ timeout: 250 });
    await expect(page.getByTestId("slider-state")).toContainText("volume: 75", { timeout: 250 });
  }).toPass();
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the thumbs take the arrows, Home and End, and submit with their form", async ({ page }) => {
    await page.goto("/slider");
    const volume = thumb(page, "Volume");
    await expect(volume).toHaveValue("40");
    await volume.focus();
    await page.keyboard.press("ArrowRight");
    await expect(volume).toHaveValue("41");
    await page.keyboard.press("End");
    await expect(volume).toHaveValue("100");
    await page.keyboard.press("Home");
    await expect(volume).toHaveValue("0");
    await page.keyboard.press("ArrowUp");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(
      /\/slider\?volume=1&price=20&price=80&hours=9&hours=17&level=3&balance=30$/,
    );
  });
});

test.describe("Slider", () => {
  test("keyboard: arrows by step, Page Up and Page Down and Shift by the large step, Home, End", async ({
    page,
  }) => {
    await page.goto("/slider");
    const volume = thumb(page, "Volume");
    const text = page.locator("output").first();
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    await expect(volume).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(volume).toHaveValue("41");
    await page.keyboard.press("PageUp");
    await expect(volume).toHaveValue("51");
    await page.keyboard.press("Shift+ArrowLeft");
    await expect(volume).toHaveValue("41");
    await page.keyboard.press("Shift+ArrowUp");
    await expect(volume).toHaveValue("51");
    await page.keyboard.press("PageDown");
    await page.keyboard.press("ArrowDown");
    await expect(volume).toHaveValue("40");
    await expect(text).toHaveText("40");
    await page.keyboard.press("End");
    await expect(text).toHaveText("100");
    const start = await page
      .locator("lu-slider")
      .first()
      .evaluate((el) => el.style.cssText);
    expect(start).toContain("--lu-slider-end: 100%");
    // The disabled slider is out of the tab order.
    await page.keyboard.press("Tab");
    await expect(thumb(page, "Minimum price")).toBeFocused();
  });

  test("a range keeps its thumbs in order, five steps apart, pushing the other one", async ({
    page,
  }) => {
    await page.goto("/slider");
    const low = thumb(page, "Minimum price");
    const high = thumb(page, "Maximum price");
    await expect(low).toHaveAttribute("aria-valuetext", "€20");
    await low.focus();
    await page.keyboard.press("End");
    await expect(low).toHaveValue("95");
    await expect(high).toHaveValue("100");
    await expect(high).toHaveAttribute("aria-valuetext", "€100");
    await expect(page.getByText("€95 – €100")).toBeVisible();
    await high.focus();
    await page.keyboard.press("Home");
    await expect(low).toHaveValue("0");
    await expect(high).toHaveValue("5");
  });

  test('thumbCollisionBehavior="none": a thumb stops at the other', async ({ page }) => {
    await page.goto("/slider");
    const opens = thumb(page, "Opening hours, start");
    await opens.focus();
    await page.keyboard.press("End");
    await expect(opens).toHaveValue("17");
    await expect(thumb(page, "Opening hours, end")).toHaveValue("17");
    await page.keyboard.press("PageDown");
    await expect(opens).toHaveValue("7");
  });

  test("a press on a range's track moves the nearest thumb there, and focuses it", async ({
    page,
  }) => {
    await page.goto("/slider");
    const opens = thumb(page, "Opening hours, start");
    const closes = thumb(page, "Opening hours, end");
    const at20 = await pointAt(closes, 20, 0, 24);
    await page.mouse.click(at20.x, at20.y);
    await expect(closes).toHaveValue("20");
    await expect(closes).toBeFocused();
    const at4 = await pointAt(opens, 4, 0, 24);
    await page.mouse.click(at4.x, at4.y);
    await expect(opens).toHaveValue("4");
    await expect(opens).toBeFocused();
    await expect(page.getByText("4 – 20")).toBeVisible();
  });

  test("dragging a thumb moves it; a range's thumb pushes the other one along", async ({
    page,
  }) => {
    await page.goto("/slider");
    const volume = thumb(page, "Volume");
    const from = await pointAt(volume, 40);
    const to = await pointAt(volume, 80);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 5 });
    await page.mouse.up();
    expect(Math.abs((await valueOf(volume)) - 80)).toBeLessThanOrEqual(2);

    const low = thumb(page, "Minimum price");
    const high = thumb(page, "Maximum price");
    const start = await pointAt(high, 80);
    const end = await pointAt(high, 10);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up();
    expect(await valueOf(high)).toBeLessThanOrEqual(12);
    expect(await valueOf(low)).toBe((await valueOf(high)) - 5);
  });

  test("vertical: up raises it; right to left: left raises it", async ({ page, browserName }) => {
    test.skip(
      browserName === "webkit",
      "TASK-418: WebKit's native range does not mirror the arrow keys right to left",
    );
    await page.goto("/slider");
    const level = thumb(page, "Level");
    await expect(level).toHaveAttribute("aria-orientation", "vertical");
    await level.focus();
    await page.keyboard.press("ArrowUp");
    await expect(level).toHaveValue("4");
    await page.keyboard.press("PageUp");
    await expect(level).toHaveValue("10");
    await page.keyboard.press("PageDown");
    await expect(level).toHaveValue("0");
    // The thumb sits at the bottom at 0.
    const [box, track] = [await level.boundingBox(), await level.locator("..").boundingBox()];
    expect(box!.height).toBeGreaterThan(100);
    expect(track!.height).toBeGreaterThan(100);

    const balance = thumb(page, "Balance");
    await balance.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(balance).toHaveValue("31");
    await page.keyboard.press("Shift+ArrowLeft");
    await expect(balance).toHaveValue("41");
    await page.keyboard.press("ArrowRight");
    await expect(balance).toHaveValue("40");
    const right = await pointAt(balance, 0);
    expect(right.x).toBeGreaterThan(0);
  });

  test("a reset puts the thumbs, the track and the text back", async ({ page }) => {
    await page.goto("/slider");
    const volume = thumb(page, "Volume");
    await volume.focus();
    await page.keyboard.press("End");
    await expect(page.locator("output").first()).toHaveText("100");
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(volume).toHaveValue("40");
    await expect(page.locator("output").first()).toHaveText("40");
  });
});

test.describe("in an island", () => {
  test("bind:value keeps signals in sync both ways; onValueCommitted reports each move", async ({
    page,
  }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/slider/island");
    await hydrated(page);
    const state = page.getByTestId("slider-state");
    await expect(state).toHaveText("volume: 75, range: 10–30, commits: 0");
    await expect(thumb(page, "Volume")).toHaveValue("75");
    await expect(thumb(page, "Range start")).toHaveValue("10");
    await thumb(page, "Volume").focus();
    await page.keyboard.press("ArrowRight");
    await expect(state).toContainText("volume: 76");
    await thumb(page, "Range start").focus();
    await page.keyboard.press("PageUp");
    await expect(state).toHaveText("volume: 76, range: 20–30, commits: 1");
    const end = await pointAt(thumb(page, "Range end"), 90);
    await page.mouse.click(end.x, end.y);
    await expect(state).toHaveText("volume: 76, range: 20–90, commits: 2");
    expect(warnings).toEqual([]);
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes on the page and the island (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/slider");
      expect(await axe(page)).toEqual([]);
      await page.goto("/slider/island");
      await hydrated(page);
      expect(await axe(page)).toEqual([]);
    });
  }

  test("focus shows on the thumb (2.4.7), and the thumbs are 24px (2.5.8)", async ({ page }) => {
    await page.goto("/slider");
    const control = page.locator("lu-slider").first().locator("div").first();
    const before = await control.screenshot();
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    await expect(thumb(page, "Volume")).toBeFocused();
    expect(await control.screenshot()).not.toEqual(before);
    expect(await smallTargets(page.locator("form"))).toEqual([]);
  });

  test("the sliders reflow at 320 CSS pixels with text spacing (1.4.10, 1.4.12)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/slider");
    await page.addStyleTag({ content: TEXT_SPACING });
    const form = page.locator("form");
    const box = (await form.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(await clipped(form)).toEqual([]);
  });

  test("a server-rendered page loads Slider's script only", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
    });
    await page.goto("/slider");
    await page.waitForLoadState("networkidle");
    expect(scripts).toEqual([expect.stringMatching(/\/slider\.script-[\w-]+\.js$/)]);
    await expect(page.locator("script[data-l-islands]")).toHaveCount(0);
  });
});
