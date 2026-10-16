// Select (TASK-358): a native `<select>`, customizable in Chromium (`appearance: base-select`). The
// platform owns the keyboard, the picker and forms, so the suite checks that the parts render what
// customizable select expects, that it works without JavaScript, the sync with a signal in an
// island, layers (a dialog), and WCAG 2.2 AA with the default theme (doc-9 sections 7 and 17).
import { expect, test, type Locator, type Page } from "@playwright/test";
import { axe, focusRing, lastNavLink, SCHEMES, smallTargets } from "./a11y.ts";
import { skipIn } from "./browsers.ts";

/** Puts the whole page right to left. */
const rtl = (page: Page) => page.evaluate(() => (document.documentElement.dir = "rtl"));

const isOpen = (select: Locator) => select.evaluate((el) => el.matches(":open"));

/** Whether the browser has customizable select; elsewhere Select is the classic one (its docs). */
const customizable = (page: Page) => page.evaluate(() => CSS.supports("appearance", "base-select"));

const CLASSIC =
  "no customizable select (appearance: base-select): the classic select and its native picker, as the docs say";

function fruit(page: Page) {
  const select = page.getByRole("combobox", { name: "Fruit" });
  return { select, option: (name: string) => page.getByRole("option", { name, exact: true }) };
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the select works and submits with its form", async ({ page }) => {
    await page.goto("/select");
    const { select } = fruit(page);
    await expect(select).toHaveValue("pear");
    await select.selectOption("banana");
    await page.getByLabel("Size").selectOption("m");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/select\?fruit=banana&size=m$/);
  });
});

test.describe("customizable select (Chromium)", () => {
  skipIn(["firefox", "webkit"], CLASSIC);
  test("the trigger shows the selected option's content; the picker opens anchored", async ({
    page,
  }) => {
    await page.goto("/select");
    const { select, option } = fruit(page);
    expect(await select.evaluate((el) => getComputedStyle(el).appearance)).toBe("base-select");
    await expect(select.locator("selectedcontent")).toHaveText("🍐 Pear");
    await select.click();
    expect(await isOpen(select)).toBe(true);
    await expect(option("Pear")).toBeVisible();
    const [control, picked] = [await select.boundingBox(), await option("Apple").boundingBox()];
    expect(picked!.y).toBeGreaterThan(control!.y + control!.height - 1);
    await option("Lemon").click();
    expect(await isOpen(select)).toBe(false);
    await expect(select).toHaveValue("lemon");
    await expect(select.locator("selectedcontent")).toHaveText("🍋 Lemon");
    await expect(select).toBeFocused();
  });

  test("keyboard: Space opens on the selected option, arrows skip disabled ones, Escape closes", async ({
    page,
  }) => {
    await page.goto("/select");
    const { select, option } = fruit(page);
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    await expect(select).toBeFocused();
    await page.keyboard.press(" ");
    expect(await isOpen(select)).toBe(true);
    await expect(option("Pear")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(option("Lemon")).toBeFocused();
    // Lime is disabled.
    await page.keyboard.press("ArrowDown");
    await expect(option("Lemon")).toBeFocused();
    await page.keyboard.press("Escape");
    expect(await isOpen(select)).toBe(false);
    await expect(select).toHaveValue("pear");
    await expect(select).toBeFocused();
    await page.keyboard.press(" ");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect(select).toHaveValue("banana");

    // Home, End and typeahead in the picker; Tab closes it and moves on.
    await page.keyboard.press(" ");
    await page.keyboard.press("End");
    await expect(option("Lemon")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(option("Apple")).toBeFocused();
    // Tab closes the picker; Chromium leaves focus on the control.
    await page.keyboard.press("Tab");
    expect(await isOpen(select)).toBe(false);
    await expect(select).toBeFocused();

    // Typeahead matches the options' text (the fruits' starts with an emoji).
    const size = page.getByLabel("Size");
    await size.focus();
    await page.keyboard.press(" ");
    await page.keyboard.press("l");
    await expect(option("Large")).toBeFocused();
  });

  test("a click on the label focuses the select without opening it", async ({ page }) => {
    await page.goto("/select");
    const { select } = fruit(page);
    await page.getByText("Fruit", { exact: true }).click();
    await expect(select).toBeFocused();
    expect(await isOpen(select)).toBe(false);
  });

  test("required: the empty choice blocks the submit; reset restores", async ({ page }) => {
    await page.goto("/select");
    const size = page.getByLabel("Size");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/select$/);
    expect(await size.evaluate((el) => (el as HTMLSelectElement).validity.valueMissing)).toBe(true);
    await size.selectOption("l");
    await fruit(page).select.selectOption("apple");
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(fruit(page).select).toHaveValue("pear");
    await expect(size).toHaveValue("");
  });

  test("in a dialog, Escape closes the picker first, then the dialog", async ({ page }) => {
    await page.goto("/select");
    await page.getByRole("button", { name: "Choose a theme" }).click();
    const dialog = page.getByRole("dialog", { name: "Theme" });
    const select = dialog.getByRole("combobox", { name: "Theme" });
    await select.click();
    expect(await isOpen(select)).toBe(true);
    await page.keyboard.press("Escape");
    expect(await isOpen(select)).toBe(false);
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});

test.describe("in an island", () => {
  test("bind:value keeps a signal in sync both ways", async ({ page }) => {
    const warnings: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("LUM")) warnings.push(message.text());
    });
    await page.goto("/select/island");
    const select = page.getByRole("combobox", { name: "Plan" });
    const state = page.getByTestId("select-state");
    await expect(select).toHaveValue("pro");
    await expect(state).toHaveText("plan: pro");
    await page.getByTestId("pick-team").click();
    await expect(select).toHaveValue("team");
    if (await customizable(page)) {
      await expect(select.locator("selectedcontent")).toHaveText("Team");
      await select.click();
      await page.getByRole("option", { name: "Free" }).click();
    } else {
      // The classic select's picker is the system's: pick the way a user's choice arrives.
      await select.selectOption("free");
    }
    await expect(state).toHaveText("plan: free");
    expect(warnings).toEqual([]);
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes closed and open (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/select");
      expect(await axe(page)).toEqual([]);
      if (await customizable(page)) {
        const { select } = fruit(page);
        await select.click();
        expect(await isOpen(select)).toBe(true);
        expect(await axe(page)).toEqual([]);
        await page.keyboard.press("Escape");
      }
      await page.goto("/select/island");
      expect(await axe(page)).toEqual([]);
    });
  }

  test("focus is visible on the control and on the options (2.4.7)", async ({ page }) => {
    await page.goto("/select");
    test.skip(!(await customizable(page)), CLASSIC);
    const { select, option } = fruit(page);
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    expect(await focusRing(page)).toBe("2px solid");
    await page.keyboard.press(" ");
    await expect(option("Pear")).toBeFocused();
    expect(await focusRing(page)).toBe("2px solid");
    await page.keyboard.press("Escape");
    await expect(select).toBeFocused();
  });

  test("the control and the options are at least 24 by 24 CSS pixels (2.5.8)", async ({ page }) => {
    await page.goto("/select");
    const { select } = fruit(page);
    expect(await smallTargets(page.locator("form"))).toEqual([]);
    const box = await select.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(24);
    // The classic select's options are the system's picker, not the page's.
    if (!(await customizable(page))) return;
    await select.click();
    const small = await select
      .locator("option")
      .evaluateAll((all) =>
        all.map((el) => el.getBoundingClientRect()).filter((b) => b.height < 24 || b.width < 24),
      );
    expect(small).toEqual([]);
  });
});

test.describe("right to left (TASK-385)", () => {
  test("the picker lines up with the select's inline start: its right edge", async ({ page }) => {
    await page.goto("/select");
    // The classic select's picker is the browser's own, outside the page (TASK-424).
    test.skip(!(await customizable(page)), CLASSIC);
    await rtl(page);
    const { select, option } = fruit(page);
    await select.click();
    await expect(option("Pear")).toBeVisible();
    const [control, picked] = [await select.boundingBox(), await option("Apple").boundingBox()];
    expect(Math.abs(control!.x + control!.width - (picked!.x + picked!.width))).toBeLessThan(24);
  });
});
