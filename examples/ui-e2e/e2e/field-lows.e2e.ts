// Field and Checkbox findings of the 0.1.0 release review (TASK-446): L9 edits, L10 a control
// that becomes disabled, L11 indeterminate after a reset, L13 Shift+Tab into a radio group, L14 two
// parts of a kind.
import { expect, test } from "@playwright/test";

test("L9: an edit erased back shows its error on blur; a select Tabbed through does not", async ({
  page,
}) => {
  await page.goto("/form");
  const email = page.getByRole("textbox", { name: "Email" });
  await expect(page.getByRole("textbox", { name: "Username" })).toHaveAccessibleDescription(/3/);
  await email.fill("a");
  await email.fill("");
  await page.keyboard.press("Tab");
  await expect(page.getByText("Enter your email.")).toBeVisible();
  await page.goto("/form/attempt");
  const plan = page.getByRole("combobox", { name: "Plan" });
  await plan.focus();
  await page.keyboard.press("Tab");
  await expect(page.getByText("Choose a plan.")).toBeHidden();
  await expect(plan).not.toHaveAttribute("aria-invalid");
});

test("L10: a field whose control becomes disabled shows no error", async ({ page }) => {
  await page.goto("/form/attempt");
  const email = page.getByRole("textbox", { name: "Email" });
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await email.evaluate((el) => ((el as HTMLInputElement).disabled = true));
  await expect(email).not.toHaveAttribute("aria-invalid");
  await expect(page.locator("lu-field").first().locator("output")).toBeHidden();
});

test("L11: a reset makes a toggled indeterminate checkbox indeterminate again", async ({
  page,
}) => {
  await page.goto("/form");
  const beta = page.getByRole("checkbox", { name: "Beta features" });
  await expect(beta).toHaveJSProperty("indeterminate", true);
  await beta.click();
  await expect(beta).toHaveJSProperty("indeterminate", false);
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(beta).toHaveJSProperty("indeterminate", true);
  await expect(beta).not.toBeChecked();
});

test("L13: Shift+Tab into a radio group with nothing checked focuses its first radio", async ({
  page,
}) => {
  await page.goto("/form");
  await expect(page.getByRole("textbox", { name: "Username" })).toHaveAccessibleDescription(/3/);
  await page.getByRole("switch", { name: "Newsletter" }).focus();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("radio", { name: "Small" })).toBeFocused();
});

test("L14: two descriptions and two errors of a kind have ids of their own", async ({ page }) => {
  await page.goto("/form/attempt");
  const plan = page.getByRole("combobox", { name: "Plan" });
  const ids = (await plan.getAttribute("aria-describedby"))!.split(" ");
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids).toHaveLength(2);
  await page.getByRole("textbox", { name: "Email" }).fill("ada@example.com");
  await page.getByRole("textbox", { name: "Nickname" }).fill("ada");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Choose a plan.")).toBeVisible();
  await expect(page.getByText("A plan is required.")).toBeVisible();
  const shown = (await plan.getAttribute("aria-describedby"))!.split(" ");
  expect(new Set(shown).size).toBe(4);
});
