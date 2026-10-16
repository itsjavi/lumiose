// A disabled fieldset around a range Slider and a Number Field (TASK-439, M30): the scripts check
// `:disabled`, so a track press, a scrub drag or a held step button moves nothing.
import { expect, test } from "@playwright/test";

test("a disabled fieldset stops Slider track presses and Number Field scrubbing and buttons", async ({
  page,
}) => {
  await page.goto("/form/disabled");
  const min = page.getByRole("slider", { name: "Minimum" });
  const max = page.getByRole("slider", { name: "Maximum" });
  const seats = page.getByRole("spinbutton", { name: "Seats" });
  await expect(min).toBeDisabled();
  await expect(seats).toBeDisabled();
  await page.waitForFunction(
    () => customElements.get("lu-slider") !== undefined && customElements.get("lu-number-field"),
  );
  // A press near the start of the track would move the minimum thumb there.
  const group = (await page.getByRole("group", { name: "Price" }).boundingBox())!;
  await page.mouse.click(group.x + 3, group.y + group.height / 2);
  await expect(min).toHaveValue("20");
  await expect(max).toHaveValue("80");
  // A held step button, then a drag across the scrub area.
  const plus = (await page.locator("lu-number-field button[data-action=increment]").boundingBox())!;
  await page.mouse.move(plus.x + plus.width / 2, plus.y + plus.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  await page.mouse.up();
  const scrub = (await page.locator("lu-number-field [data-scrub]").boundingBox())!;
  await page.mouse.move(scrub.x + 5, scrub.y + scrub.height / 2);
  await page.mouse.down();
  await page.mouse.move(scrub.x + 90, scrub.y + scrub.height / 2, { steps: 10 });
  await page.mouse.up();
  await expect(seats).toHaveValue("2");
});
