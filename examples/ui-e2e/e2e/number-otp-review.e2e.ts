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
