// Combobox findings of the 0.1.0 release review (TASK-438): M19 blur after unmatched text, M20
// autofill, M21 Safari's IME Enter and filtering, M22 a Status in the Popup, M24 the buttons and
// text typed before the element's script runs.
import { expect, test, type Locator, type Page } from "@playwright/test";

async function city(page: Page) {
  await page.goto("/combobox");
  const input = page.getByRole("combobox", { name: "City" });
  await expect(input).toHaveValue("Lisbon");
  return { input, root: page.locator("lu-combobox").filter({ has: input }) };
}

const value = (root: Locator) =>
  root.evaluate((el) => (el as HTMLElement & { value: unknown }).value);

test("M19: text typed after the popup closed itself gives way to the label on blur", async ({
  page,
}) => {
  await page.goto("/combobox/island");
  const fruit = page.getByRole("combobox", { name: "Fruit" });
  await expect(page.getByTestId("combobox-state")).toContainText("fruit: pear");
  await expect(fruit).toHaveValue("Pear");
  await fruit.click();
  await fruit.fill("zz");
  await expect(fruit).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("heading", { level: 1 }).click();
  await expect(fruit).toHaveValue("Pear");
  await expect(page.getByTestId("combobox-state")).toContainText("fruit: pear");
});

test("M20: autofill never opens the popup, and an exact label chooses its option", async ({
  page,
}) => {
  const { input, root } = await city(page);
  await page.getByRole("heading", { level: 1 }).click();
  const autofill = (text: string, inputType?: string) =>
    input.evaluate(
      (el, [filled, kind]) => {
        (el as HTMLInputElement).value = filled!;
        el.dispatchEvent(
          kind
            ? new InputEvent("input", { bubbles: true, inputType: kind })
            : new Event("input", { bubbles: true }),
        );
      },
      [text, inputType],
    );
  await autofill("madrid");
  await expect(input).toHaveAttribute("aria-expanded", "false");
  expect(await value(root)).toBe("mad");
  await expect(input).toHaveValue("Madrid");
  // Focused, a replacement (an autofill suggestion picked) is no search either.
  await input.focus();
  await autofill("Porto", "insertReplacementText");
  await expect(input).toHaveAttribute("aria-expanded", "false");
  expect(await value(root)).toBe("opo");
});

test("M21: Safari's IME Enter chooses nothing, and only committed text filters", async ({
  page,
}) => {
  const { input, root } = await city(page);
  await input.click();
  await input.fill("M");
  await expect(input).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("ArrowDown");
  const list = page.locator(`[id="${await input.getAttribute("aria-controls")}"]`);
  await expect(list.locator("[data-highlighted]")).toHaveCount(1);
  // WebKit's sequence: composing input (not filtered), compositionend, then Enter as key 229.
  await input.evaluate((el) => {
    const field = el as HTMLInputElement;
    field.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
    field.value = "Mzz";
    field.dispatchEvent(new InputEvent("input", { bubbles: true, isComposing: true }));
  });
  await expect(list.getByRole("option", { name: "München" })).toBeVisible();
  await input.evaluate((el) => {
    el.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true, data: "zz" }));
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    Object.defineProperty(enter, "keyCode", { get: () => 229 });
    el.dispatchEvent(enter);
  });
  // The commit filtered (nothing matches "Mzz"), and Enter chose nothing.
  await expect(list.getByRole("option", { name: "München" })).toBeHidden();
  expect(await value(root)).toBe("lis");
});

test("M22: a Status in the Popup shows while the async options load", async ({ page }) => {
  await page.goto("/combobox/status");
  const input = page.getByRole("combobox", { name: "Country" });
  await expect(async () => {
    await input.fill("");
    await input.pressSequentially("an");
    await expect(page.getByText("Searching…")).toBeVisible({ timeout: 300 });
  }).toPass();
  await expect(page.getByRole("option", { name: "France" })).toBeVisible();
});

test.describe("M24: before the script runs", () => {
  test("without JavaScript, the Trigger and Clear buttons stay hidden", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/combobox");
    await expect(page.getByRole("combobox", { name: "City" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Show cities" })).toBeHidden();
    await context.close();
  });

  test("text typed before the upgrade is kept", async ({ page }) => {
    const { promise: held, resolve: release } = Promise.withResolvers<void>();
    await page.route(/combobox\.script/, async (route) => {
      await held;
      await route.continue();
    });
    await page.goto("/combobox", { waitUntil: "domcontentloaded" });
    const input = page.getByRole("combobox", { name: "City" });
    await input.fill("Ber");
    release();
    await page.waitForFunction(() => customElements.get("lu-combobox") !== undefined);
    await page.waitForTimeout(100);
    await expect(input).toHaveValue("Ber");
  });
});
