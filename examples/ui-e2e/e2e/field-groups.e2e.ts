// Group controls in fields with a Field.Label (TASK-439, M25 and M26).
import { expect, test } from "@playwright/test";
import { axDescription } from "./a11y.ts";

test("the Label names a checkbox or radio group, which takes the field's wiring", async ({
  page,
}) => {
  await page.goto("/form/groups");
  const toppings = page.getByRole("group", { name: "Toppings" });
  const size = page.getByRole("radiogroup", { name: "Size" });
  await expect(toppings).toBeVisible();
  await expect(size).toBeVisible();
  // The Label points at no single checkbox: a click on it toggles nothing (not "All toppings").
  await page.getByText("Toppings", { exact: true }).click();
  await expect(page.getByRole("checkbox", { name: "All toppings" })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Cheese" })).not.toHaveAttribute("id", /control/);
  // A submit attempt: the radio group is marked and described as one.
  await page.getByRole("button", { name: "Order" }).click();
  await expect(page.getByText("Choose a size.")).toBeVisible();
  await expect(size).toHaveAttribute("aria-invalid", "true");
  // Playwright's description leaves `<output>` out: Chromium's tree (the wiring elsewhere).
  await expect.poll(() => axDescription(size)).toMatch(/Choose a size\./);
  await expect(page.getByRole("radio", { name: "Small" })).not.toHaveAttribute("aria-invalid");
});
