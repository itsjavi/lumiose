// DOM clobbering (TASK-473, L9): controls named `elements`, `querySelectorAll` and
// `requestSubmit` shadow those members on their form element. The scripts read them through the
// prototypes, so Field still focuses the first invalid control, an unchecked checkbox still
// submits its unchecked value, a parent checkbox still follows a reset, and OTP Field still
// auto-submits.
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/form/clobber");
  await page.waitForLoadState("networkidle");
  // The controls really shadow the form's members.
  expect(
    await page.evaluate(() =>
      [...document.forms].map((form) => [
        form.elements instanceof HTMLInputElement,
        form.requestSubmit instanceof HTMLInputElement,
      ]),
    ),
  ).toEqual([
    [true, false],
    [false, true],
  ]);
});

test("Field focuses the first invalid control", async ({ page }) => {
  const email = page.getByRole("textbox", { name: "Email" });
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.locator("lu-field").first().locator("output")).toBeVisible();
  await expect(email).toBeFocused();
});

test("an unchecked checkbox submits its unchecked value", async ({ page }) => {
  await page.getByRole("textbox", { name: "Email" }).fill("a@example.com");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page).toHaveURL(/[?&]terms=no(&|$)/);
});

test("a parent checkbox follows a reset", async ({ page }) => {
  const parent = page.getByRole("checkbox", { name: "All extras" });
  await page.getByRole("checkbox", { name: "Cutlery" }).check();
  await expect(parent).toBeChecked();
  await page.getByRole("button", { name: "Reset" }).click();
  await expect
    .poll(() => parent.evaluate((input: HTMLInputElement) => input.indeterminate))
    .toBe(true);
});

test("OTP Field auto-submits", async ({ page }) => {
  await page.getByRole("textbox", { name: "Code" }).pressSequentially("1234");
  await expect(page).toHaveURL(/[?&]code=1234(&|$)/);
});
