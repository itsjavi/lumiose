// Number Field and OTP Field findings of the 0.1.0 release review (TASK-440): M32 the step grid,
// M33 a masked code, M34 digits of other scripts, M35 iOS focus zoom.
import { expect, test } from "@playwright/test";

test("M32: Alt's small step leaves the step grid, and the form still submits", async ({ page }) => {
  await page.goto("/number-field");
  const quantity = page.getByRole("spinbutton", { name: "Quantity" });
  await page.waitForFunction(() => customElements.get("lu-number-field") !== undefined);
  await quantity.focus();
  await page.keyboard.press("Alt+ArrowUp");
  await expect(quantity).toHaveValue("1.1");
  expect(await quantity.evaluate((el) => (el as HTMLInputElement).validity.stepMismatch)).toBe(
    false,
  );
  expect(await quantity.evaluate((el) => (el as HTMLInputElement).form!.checkValidity())).toBe(
    true,
  );
});

test("M33: a masked code is a password input, still typed and submitted", async ({ page }) => {
  await page.goto("/otp-field");
  const recovery = page.getByLabel("Recovery code");
  await expect(recovery).toHaveAttribute("type", "password");
  await expect(recovery).toHaveAttribute("autocomplete", "one-time-code");
  await recovery.click();
  await page.keyboard.type("ab12");
  await expect(recovery).toHaveValue("ab12");
});

test("M34: full-width digits type into a code and a formatted number", async ({ page }) => {
  await page.goto("/otp-field");
  const pin = page.getByLabel(/PIN/);
  await page.waitForFunction(() => customElements.get("lu-otp-field") !== undefined);
  await pin.click();
  await page.keyboard.insertText("１２");
  await expect(pin).toHaveValue("12");
  await page.goto("/number-field");
  const price = page.getByRole("spinbutton", { name: "Price" });
  await page.waitForFunction(() => customElements.get("lu-number-field") !== undefined);
  await price.fill("１２３４");
  await price.blur();
  await expect(price).toHaveValue("$1,234.00");
});

test("M35: the OTP input is 16px at least, so iOS does not zoom into it", async ({ page }) => {
  await page.goto("/otp-field");
  const code = page.getByLabel("Verification code");
  await page.waitForFunction(() => customElements.get("lu-otp-field") !== undefined);
  const size = await code.evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(16);
});

test.describe("Number Field Lows (TASK-447)", () => {
  // Before L17: in Firefox, after its wheel and Ctrl, Playwright's next click in the worker reports
  // the input intercepting the stepper.
  test("L18: a mouse press on a stepper puts focus in the input, so the arrow keys step", async ({
    page,
  }) => {
    await page.goto("/number-field");
    await page.waitForFunction(() => customElements.get("lu-number-field") !== undefined);
    const quantity = page.getByRole("spinbutton", { name: "Quantity" });
    await page.locator("lu-number-field").first().getByRole("button", { name: "Increase" }).click();
    await expect(quantity).toHaveValue("2");
    await expect(quantity).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(quantity).toHaveValue("3");
  });

  test("L17: the wheel over a focused field scrolls the page, and Ctrl or a sideways swipe never steps", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 800, height: 360 });
    await page.goto("/number-field");
    await page.waitForFunction(() => customElements.get("lu-number-field") !== undefined);
    const quantity = page.getByRole("spinbutton", { name: "Quantity" });
    await quantity.focus();
    const box = (await quantity.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const before = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 120);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
    await expect(quantity).toHaveValue("1");
    // allowWheelScrub: a sideways swipe and Ctrl with the wheel do not step.
    const zoom = page.getByRole("spinbutton", { name: "Discount" });
    await zoom.scrollIntoViewIfNeeded();
    const value = await zoom.inputValue();
    await zoom.focus();
    const at = (await zoom.boundingBox())!;
    await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
    await page.mouse.wheel(120, 10);
    await expect(zoom).toHaveValue(value);
    // Dispatched: a real Ctrl+wheel zooms Firefox, which keeps that zoom for the site in the
    // contexts of later tests, whose clicks then miss (TASK-464).
    await zoom.dispatchEvent("wheel", {
      deltaY: -100,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    await expect(zoom).toHaveValue(value);
  });

  test("L19: text that is no number goes on commit", async ({ page, browserName }) => {
    test.skip(
      browserName !== "firefox",
      "Only Firefox lets letters into a number input (TASK-447)",
    );
    await page.goto("/number-field");
    await page.waitForFunction(() => customElements.get("lu-number-field") !== undefined);
    const quantity = page.getByRole("spinbutton", { name: "Quantity" });
    // Focus puts the caret after the "1" (End would go to the maximum).
    await quantity.focus();
    await page.keyboard.type("2abc");
    await page.keyboard.press("Tab");
    await expect(quantity).toHaveValue("1");
    expect(await quantity.evaluate((el) => (el as HTMLInputElement).validity.badInput)).toBe(false);
  });
});

test("L20: typing over a slot replaces its character (TASK-448)", async ({ page }) => {
  await page.goto("/otp-field");
  const pin = page.getByLabel(/PIN/);
  await page.waitForFunction(() => customElements.get("lu-otp-field") !== undefined);
  await pin.click();
  await page.keyboard.type("123");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.type("9");
  await expect(pin).toHaveValue("193");
});
