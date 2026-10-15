// Accordion (TASK-370): native <details> items in one exclusive group (or several open), headings
// and labelled regions, the APG Accordion keys of <lu-accordion> (arrows, Home, End, looping,
// orientation, right-to-left, disabled triggers skipped), find-in-page, the sync with a signal in
// an island, and WCAG 2.2 AA with the default theme.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { axe, clipped, focusRing, SCHEMES, smallTargets, TEXT_SPACING } from "./a11y.ts";

const root = (page: Page, id: string) => page.getByTestId(id);
const trigger = (scope: Locator, name: string) =>
  scope.locator(":scope > details > summary", { hasText: name });

/** The values of the open items, by trigger text. */
const opened = (scope: Locator) =>
  scope.evaluate((element) =>
    [...element.querySelectorAll<HTMLDetailsElement>(":scope > details")]
      .filter((details) => details.open)
      .map((details) => details.querySelector("summary")!.textContent),
  );

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("one item opens at a time; several when multiple", async ({ page }) => {
    await page.goto("/accordion");
    const single = root(page, "single");
    expect(await opened(single)).toEqual(["Returns"]);
    await trigger(single, "Shipping").click();
    expect(await opened(single)).toEqual(["Shipping"]);
    await trigger(single, "Contact").click();
    expect(await opened(single)).toEqual(["Contact"]);
    const multiple = root(page, "multiple");
    expect(await opened(multiple)).toEqual(["First", "Second"]);
    await trigger(multiple, "Third").click();
    expect(await opened(multiple)).toEqual(["First", "Second", "Third"]);
    // The disabled item ignores the pointer.
    await trigger(single, "Gift cards").click({ force: true });
    expect(await opened(single)).toEqual(["Contact"]);
  });

  test("a link to content inside a closed item opens it, closing the open one", async ({
    page,
  }) => {
    await page.goto("/accordion#find-me");
    expect(await opened(root(page, "single"))).toEqual(["Contact"]);
  });
});

test("triggers hold headings; panels are regions labelled by their trigger", async ({ page }) => {
  await page.goto("/accordion");
  const single = root(page, "single");
  await expect(single.getByRole("heading", { level: 3, name: "Shipping" })).toBeAttached();
  const returns = single.getByRole("region", { name: "Returns" });
  await expect(returns).toBeVisible();
  await expect(trigger(single, "Returns")).toHaveAttribute(
    "aria-controls",
    (await returns.getAttribute("id"))!,
  );
  await expect(trigger(single, "Gift cards")).toHaveAttribute("aria-disabled", "true");
  await expect(trigger(single, "Gift cards")).toHaveAttribute("tabindex", "-1");
});

test.describe("keyboard contract (APG Accordion)", () => {
  test("Down, Up, Home and End move between triggers, skip disabled ones and loop", async ({
    page,
  }) => {
    await page.goto("/accordion");
    const single = root(page, "single");
    await trigger(single, "Shipping").focus();
    await page.keyboard.press("ArrowDown");
    await expect(trigger(single, "Returns")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(trigger(single, "Contact")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(trigger(single, "Shipping")).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(trigger(single, "Contact")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(trigger(single, "Shipping")).toBeFocused();
    await page.keyboard.press("End");
    await expect(trigger(single, "Contact")).toBeFocused();
    // Enter and Space toggle the focused item.
    await page.keyboard.press("Enter");
    expect(await opened(single)).toEqual(["Contact"]);
    await page.keyboard.press(" ");
    expect(await opened(single)).toEqual([]);
    // Tab goes from trigger to trigger, and into an open panel's content.
    await page.keyboard.press("Home");
    await page.keyboard.press("Tab");
    await expect(trigger(single, "Returns")).toBeFocused();
  });

  test("without looping, the arrows stop at the ends", async ({ page }) => {
    await page.goto("/accordion");
    const multiple = root(page, "multiple");
    await trigger(multiple, "Third").focus();
    await page.keyboard.press("ArrowDown");
    await expect(trigger(multiple, "Third")).toBeFocused();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowUp");
    await expect(trigger(multiple, "First")).toBeFocused();
  });

  test("horizontal: Right and Left move, swapped in right-to-left; Down does not", async ({
    page,
  }) => {
    await page.goto("/accordion");
    const horizontal = root(page, "horizontal");
    await trigger(horizontal, "Left").focus();
    await page.keyboard.press("ArrowDown");
    await expect(trigger(horizontal, "Left")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(trigger(horizontal, "Right")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(trigger(horizontal, "Left")).toBeFocused();
    await horizontal.evaluate((element) => element.setAttribute("dir", "rtl"));
    await page.keyboard.press("ArrowLeft");
    await expect(trigger(horizontal, "Right")).toBeFocused();
  });
});

test.describe("in an island", () => {
  test("bind:value keeps a signal in sync both ways", async ({ page }) => {
    await page.goto("/accordion/island");
    const state = page.getByTestId("value-state");
    const accordion = page.locator("lu-accordion");
    await expect(state).toHaveText("value: one");
    await page.getByTestId("open-two").click();
    await expect(state).toHaveText("value: two");
    expect(await opened(accordion)).toEqual(["Two"]);
    await trigger(accordion, "One").click();
    await expect(state).toHaveText("value: one");
    expect(await opened(accordion)).toEqual(["One"]);
    await trigger(accordion, "One").click();
    await expect(state).toHaveText("value: none");
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes closed and open (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/accordion");
      expect(await axe(page)).toEqual([]);
      await trigger(root(page, "single"), "Shipping").click();
      await trigger(root(page, "multiple"), "Third").click();
      expect(await axe(page)).toEqual([]);
    });
  }

  test("focus is visible and the triggers are large enough targets (2.4.7, 2.5.8)", async ({
    page,
  }) => {
    await page.goto("/accordion");
    await trigger(root(page, "single"), "Shipping").focus();
    await page.keyboard.press("ArrowDown");
    expect(await focusRing(page)).toBe("2px solid");
    expect(await smallTargets(page.locator("main"))).toEqual([]);
  });

  test("it reflows at 320 CSS pixels and survives text spacing (1.4.10, 1.4.12)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/accordion");
    await page.addStyleTag({ content: TEXT_SPACING });
    expect(await clipped(page.locator("main"))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
  });
});
