// Number Field (TASK-375): a native number input that works and submits without JavaScript, and a
// formatted spinbutton whose hidden input submits the number. The script's keys (arrows, Shift,
// Page Up and Page Down, Home and End), press-and-hold buttons, scrubbing, the wheel only while
// focused, commit-time clamping and formatting, a reset, the sync with a signal in an island, and
// WCAG 2.2 AA with the default theme (doc-9 sections 1 and 17; 2.5.7: the drag has keys).
import { expect, test, type Page } from "@playwright/test";
import { axe, clipped, lastNavLink, SCHEMES, smallTargets, TEXT_SPACING } from "./a11y.ts";

/** Puts the whole page right to left. */
const rtl = (page: Page) => page.evaluate(() => (document.documentElement.dir = "rtl"));

/** Lumiose's console warnings (LUM codes), such as a hydration that fell back to rendering. */
const lumioseWarnings = (page: Page) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("LUM")) warnings.push(message.text());
  });
  return warnings;
};

const field = (page: Page, name: string) => page.getByRole("spinbutton", { name, exact: true });
const group = (page: Page, name: string) => field(page, name).locator("..");
const button = (page: Page, name: string, action: "Increase" | "Decrease") =>
  group(page, name).getByRole("button", { name: action });

/** Waits for the page's script: the formatted fields' names move to their hidden inputs. */
async function ready(page: Page) {
  await page.goto("/number-field");
  await expect(field(page, "Price")).not.toHaveAttribute("name");
}

/** Waits for /number-field/island to hydrate: "Set to 42" answers. */
async function hydrated(page: Page) {
  await expect(async () => {
    await page.getByTestId("set-signals").click({ timeout: 250 });
    await expect(field(page, "Weight")).toHaveValue("42 kg", { timeout: 250 });
  }).toPass();
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the native input steps and submits; formatted fields submit their text", async ({
    page,
  }) => {
    await page.goto("/number-field");
    const quantity = field(page, "Quantity");
    await expect(quantity).toHaveAttribute("type", "number");
    // The buttons need the script: they stay hidden, the native spinners work.
    await expect(button(page, "Quantity", "Increase")).toBeHidden();
    await quantity.focus();
    await page.keyboard.press("ArrowUp");
    await expect(quantity).toHaveValue("2");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/\/number-field\?quantity=2&price=%241%2C234\.50&discount=25%25$/);
  });
});

test.describe("Number Field", () => {
  test("keyboard: arrows by step, Shift and Page keys by the large step, Home and End to the ends", async ({
    page,
  }) => {
    await ready(page);
    const quantity = field(page, "Quantity");
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    await expect(quantity).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(quantity).toHaveValue("2");
    await page.keyboard.press("Shift+ArrowUp");
    await expect(quantity).toHaveValue("12");
    await page.keyboard.press("PageUp");
    await expect(quantity).toHaveValue("22");
    await page.keyboard.press("PageDown");
    await page.keyboard.press("ArrowDown");
    await expect(quantity).toHaveValue("11");
    await page.keyboard.press("End");
    await expect(quantity).toHaveValue("99");
    await expect(button(page, "Quantity", "Increase")).toBeDisabled();
    await page.keyboard.press("Home");
    await expect(quantity).toHaveValue("1");
    await expect(button(page, "Quantity", "Decrease")).toBeDisabled();
    // The buttons are out of the tab order: Tab goes to the next field.
    await page.keyboard.press("Tab");
    await expect(field(page, "Price")).toBeFocused();
  });

  test("a typed number is kept in range when committed", async ({ page }) => {
    await ready(page);
    const quantity = field(page, "Quantity");
    await quantity.fill("150");
    await page.keyboard.press("Tab");
    await expect(quantity).toHaveValue("99");
    await quantity.fill("0");
    await page.keyboard.press("Enter");
    await expect(quantity).toHaveValue("1");
  });

  test("the buttons step once per click, keep the input's focus, and repeat while held", async ({
    page,
  }) => {
    await ready(page);
    const quantity = field(page, "Quantity");
    await quantity.focus();
    await button(page, "Quantity", "Increase").click();
    await expect(quantity).toHaveValue("2");
    await expect(quantity).toBeFocused();
    const box = (await button(page, "Quantity", "Increase").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(800);
    await page.mouse.up();
    expect(Number(await quantity.inputValue())).toBeGreaterThan(5);
    // A disabled field's buttons do nothing.
    await expect(button(page, "Seats", "Increase")).toBeDisabled();
  });

  test("formatted: shows the format, reads what is typed back, and submits the number", async ({
    page,
  }) => {
    await ready(page);
    const price = field(page, "Price");
    await expect(price).toHaveValue("$1,234.50");
    await expect(price).toHaveAttribute("aria-valuenow", "1234.5");
    await price.focus();
    await page.keyboard.press("ArrowUp");
    await expect(price).toHaveValue("$1,235.00");
    await page.keyboard.press("Shift+ArrowUp");
    await expect(price).toHaveValue("$1,335.00");
    await price.fill("2,000.257");
    await page.keyboard.press("Tab");
    await expect(price).toHaveValue("$2,000.26");
    await expect(price).toHaveAttribute("aria-valuetext", "$2,000.26");
    await price.fill("not a price");
    await page.keyboard.press("Tab");
    await expect(price).toHaveValue("$2,000.26");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/\/number-field\?quantity=1&price=2000\.26&discount=0\.25$/);
  });

  test("the wheel steps a field only while it has focus, with allowWheelScrub", async ({
    page,
  }) => {
    await ready(page);
    const discount = field(page, "Discount");
    const box = (await discount.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -100);
    await expect(discount).toHaveValue("25%");
    await discount.focus();
    await page.mouse.wheel(0, -100);
    await expect(discount).toHaveValue("30%");
    await page.mouse.wheel(0, 100);
    await page.mouse.wheel(0, 100);
    await expect(discount).toHaveValue("20%");
    // Without allowWheelScrub, the wheel leaves a focused field alone.
    const quantity = field(page, "Quantity");
    await quantity.focus();
    const at = (await quantity.boundingBox())!;
    await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
    await page.mouse.wheel(0, -100);
    await expect(quantity).toHaveValue("1");
  });

  test("dragging across the scrub area steps the value; the keys are its alternative", async ({
    page,
  }) => {
    await ready(page);
    const label = page.locator("label[for=price]");
    const box = (await label.boundingBox())!;
    await page.mouse.move(box.x + 5, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 25, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    // 20px at 2px a step, 0.5 each.
    await expect(field(page, "Price")).toHaveValue("$1,239.50");
  });

  test("a reset puts the numbers and the hidden inputs back", async ({ page }) => {
    await ready(page);
    const price = field(page, "Price");
    await price.focus();
    await page.keyboard.press("PageUp");
    await expect(price).toHaveValue("$1,334.50");
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(price).toHaveValue("$1,234.50");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/price=1234\.5&/);
  });
});

test.describe("in an island", () => {
  test("bind:value keeps a signal in sync both ways; onValueCommitted reports each commit", async ({
    page,
  }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/number-field/island");
    await hydrated(page);
    const state = page.getByTestId("number-state");
    const weight = field(page, "Weight");
    await expect(state).toHaveText("amount: 42, commits: 0");
    await weight.focus();
    await page.keyboard.press("ArrowUp");
    await expect(state).toHaveText("amount: 43, commits: 1");
    await weight.fill("7");
    await expect(state).toHaveText("amount: 7, commits: 1");
    await page.keyboard.press("Tab");
    await expect(weight).toHaveValue("7 kg");
    await expect(state).toHaveText("amount: 7, commits: 2");
    await weight.fill("");
    await page.keyboard.press("Tab");
    await expect(state).toHaveText("amount: none, commits: 3");
    expect(warnings).toEqual([]);
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes on the page and the island (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await ready(page);
      expect(await axe(page)).toEqual([]);
      await page.goto("/number-field/island");
      await hydrated(page);
      expect(await axe(page)).toEqual([]);
    });
  }

  test("focus rings the group (2.4.7), and the targets are 24px (2.5.8)", async ({ page }) => {
    await ready(page);
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    const ring = await group(page, "Quantity").evaluate((element) => {
      const style = getComputedStyle(element);
      return `${style.outlineWidth} ${style.outlineStyle}`;
    });
    expect(ring).toBe("2px solid");
    expect(await smallTargets(page.locator("form"))).toEqual([]);
  });

  test("the fields reflow at 320 CSS pixels with text spacing (1.4.10, 1.4.12)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await ready(page);
    await page.addStyleTag({ content: TEXT_SPACING });
    const form = page.locator("form");
    const box = (await form.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(await clipped(form)).toEqual([]);
  });

  test("a server-rendered page loads Number Field's and Field's scripts only", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
    });
    await ready(page);
    await page.waitForLoadState("networkidle");
    expect(scripts.toSorted()).toEqual([
      expect.stringMatching(/\/field\.script-[\w-]+\.js$/),
      expect.stringMatching(/\/number-field\.script-[\w-]+\.js$/),
    ]);
    await expect(page.locator("script[data-l-islands]")).toHaveCount(0);
  });
});

test.describe("right to left (TASK-385)", () => {
  test("dragging the scrub area toward the left steps up", async ({ page }) => {
    await ready(page);
    await rtl(page);
    const label = page.locator("label[for=price]");
    const box = (await label.boundingBox())!;
    await page.mouse.move(box.x + box.width - 5, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width - 25, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    await expect(field(page, "Price")).toHaveValue("$1,239.50");
  });
});
