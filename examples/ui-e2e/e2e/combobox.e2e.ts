// Combobox (TASK-358): the APG combobox contract with list autocomplete (keys, focus kept in the
// input, `aria-activedescendant`), filtering, the value and label split, multiple values with
// chips, forms (submit, required, reset), the pointer, layers (a dialog, outside presses), the
// sync with signals and async options in an island, and WCAG 2.2 AA with the default theme
// (doc-9 sections 1, 6 and 17).
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  axe,
  axProperty,
  clipped,
  focusRing,
  lastNavLink,
  SCHEMES,
  smallTargets,
  TEXT_SPACING,
} from "./a11y.ts";

/** Puts the whole page right to left. */
const rtl = (page: Page) => page.evaluate(() => (document.documentElement.dir = "rtl"));

const lumioseWarnings = (page: Page) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("LUM")) warnings.push(message.text());
  });
  return warnings;
};

/** The City combobox of /combobox, once its script has run (the input shows the label). */
async function city(page: Page) {
  const input = page.getByRole("combobox", { name: "City" });
  await expect(input).toHaveValue("Lisbon");
  const list = await listOf(input);
  return {
    input,
    list,
    option: (name: string) => list.getByRole("option", { name, exact: true, includeHidden: true }),
    root: page.locator("lu-combobox").filter({ has: input }),
  };
}

/** The listbox an input controls, open or not (a closed one has no role in the tree). */
async function listOf(input: Locator): Promise<Locator> {
  const id = await input.getAttribute("aria-controls");
  return input.page().locator(`[id="${id}"]`);
}

const value = (root: Locator) =>
  root.evaluate((el) => (el as HTMLElement & { value: unknown }).value);
const highlighted = (list: Locator) => list.locator("[data-highlighted]");

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the server HTML has the labelled field and its listbox, closed", async ({ page }) => {
    await page.goto("/combobox");
    const input = page.getByRole("combobox", { name: "City" });
    await expect(input).toHaveAttribute("aria-expanded", "false");
    await expect(input).toHaveAttribute("aria-autocomplete", "list");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    // The selection is in the markup for the script to read.
    await expect(page.locator("[role=option][aria-selected=true]")).toHaveCount(2);
  });
});

test.describe("keyboard contract (APG combobox, list autocomplete)", () => {
  test("Arrow Down opens on the selected option; arrows skip disabled ones; Escape restores", async ({
    page,
  }) => {
    await page.goto("/combobox");
    const { input, list, option } = await city(page);
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    await expect(input).toBeFocused();
    await expect(input).toHaveAttribute("aria-controls", (await list.getAttribute("id"))!);

    await page.keyboard.press("ArrowDown");
    await expect(list).toBeVisible();
    await expect(input).toHaveAttribute("aria-expanded", "true");
    await expect(option("Lisbon")).toHaveAttribute("data-highlighted");
    await expect(option("Lisbon")).toHaveAttribute("aria-selected", "true");
    const id = await option("Lisbon").getAttribute("id");
    await expect(input).toHaveAttribute("aria-activedescendant", id!);
    // Every option shows: the label is not a search.
    await expect(option("Berlin")).toBeVisible();

    await page.keyboard.press("ArrowDown");
    await expect(option("Porto")).toHaveAttribute("data-highlighted");
    // Faro is disabled: the arrows skip it.
    await page.keyboard.press("ArrowDown");
    await expect(option("Madrid")).toHaveAttribute("data-highlighted");
    await expect(option("Faro")).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("ArrowUp");
    await expect(option("Porto")).toHaveAttribute("data-highlighted");
    await expect(highlighted(list)).toHaveCount(1);
    // Focus never leaves the input.
    await expect(input).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(list).toBeHidden();
    await expect(input).toHaveAttribute("aria-expanded", "false");
    await expect(input).not.toHaveAttribute("aria-activedescendant");
    await expect(input).toHaveValue("Lisbon");
    expect(await value(page.locator("lu-combobox").first())).toBe("lis");
  });

  test("past the last option the highlight goes back to the input, then around", async ({
    page,
  }) => {
    await page.goto("/combobox");
    await city(page);
    // Nothing is selected: Arrow Up opens on the last option.
    const input = page.getByRole("combobox", { name: "Country" });
    const list = await listOf(input);
    const option = (name: string) => list.getByRole("option", { name, includeHidden: true });
    await input.focus();
    await page.keyboard.press("ArrowUp");
    await expect(option("Spain")).toHaveAttribute("data-highlighted");
    await page.keyboard.press("ArrowDown");
    await expect(highlighted(list)).toHaveCount(0);
    await expect(input).not.toHaveAttribute("aria-activedescendant");
    await page.keyboard.press("ArrowDown");
    await expect(option("Germany")).toHaveAttribute("data-highlighted");
    // Alt+Arrow Up closes, Alt+Arrow Down opens without a highlight.
    await page.keyboard.press("Alt+ArrowUp");
    await expect(list).toBeHidden();
    await page.keyboard.press("Alt+ArrowDown");
    await expect(list).toBeVisible();
    await expect(highlighted(list)).toHaveCount(0);
  });

  test("typing filters by label, ignoring case and accents; Enter chooses", async ({ page }) => {
    await page.goto("/combobox");
    const { input, list, option, root } = await city(page);
    await root.evaluate((el) => {
      el.dataset.changes = "0";
      el.addEventListener("change", () => (el.dataset.changes = String(+el.dataset.changes! + 1)));
    });
    await input.fill("");
    await input.pressSequentially("mun");
    await expect(list).toBeVisible();
    await expect(list.getByRole("option", { includeHidden: true })).toHaveCount(10);
    await expect(option("München")).toBeVisible();
    await expect(option("Berlin")).toBeHidden();
    await expect(list.getByRole("group", { name: "Germany" })).toBeVisible();
    await expect(list.getByRole("group", { name: "Portugal" })).toBeHidden();
    // Typing never commits; no option is highlighted until the arrows move.
    await expect(highlighted(list)).toHaveCount(0);
    await page.keyboard.press("ArrowDown");
    await expect(option("München")).toHaveAttribute("data-highlighted");
    await page.keyboard.press("Enter");
    await expect(list).toBeHidden();
    await expect(input).toHaveValue("München");
    expect(await value(root)).toBe("muc");
    await expect(option("München")).toHaveAttribute("aria-selected", "true");
    await expect(option("Lisbon")).toHaveAttribute("aria-selected", "false");
    // Emptying the text cleared the choice once, choosing München set it once.
    await expect(root).toHaveAttribute("data-changes", "2");
  });

  test("no match shows the empty state; closing puts the label back", async ({ page }) => {
    await page.goto("/combobox");
    const { input, list } = await city(page);
    await input.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("xyz");
    const empty = page.getByRole("status").filter({ hasText: "No city matches." });
    await expect(empty).toBeVisible();
    await expect(list.getByRole("option", { includeHidden: true })).toHaveCount(10);
    for (const option of await list.getByRole("option", { includeHidden: true }).all())
      await expect(option).toBeHidden();
    await page.keyboard.press("Escape");
    await expect(empty).toBeHidden();
    // The selection is unchanged: typing never commits.
    await expect(input).toHaveValue("Lisbon");
  });

  test("clearing the text clears the selection; the Clear button follows", async ({ page }) => {
    await page.goto("/combobox");
    const { input, root } = await city(page);
    const clear = page.getByRole("button", { name: "Clear city" });
    await expect(clear).toBeVisible();
    await input.fill("");
    expect(await value(root)).toBe("");
    await page.keyboard.press("Escape");
    await expect(clear).toBeHidden();
    await expect(input).toHaveValue("");
  });

  test("Tab closes the popup and moves on without choosing", async ({ page }) => {
    await page.goto("/combobox");
    const { input, list } = await city(page);
    await input.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab");
    await expect(list).toBeHidden();
    await expect(page.getByRole("combobox", { name: "Tags" })).toBeFocused();
    await expect(input).toHaveValue("Lisbon");
  });

  test('filter="startsWith" matches the start of the label', async ({ page }) => {
    await page.goto("/combobox");
    await city(page);
    const input = page.getByRole("combobox", { name: "Country" });
    const list = page.getByRole("listbox", { name: "Country" });
    await input.pressSequentially("p");
    await expect(list.getByRole("option", { name: "Portugal" })).toBeVisible();
    await expect(list.getByRole("option", { name: "Spain" })).toBeHidden();
  });
});

test.describe("pointer", () => {
  test("a click on the input opens it; hovering highlights; a click chooses, focus stays", async ({
    page,
  }) => {
    await page.goto("/combobox");
    const { input, list, option, root } = await city(page);
    await input.click();
    await expect(list).toBeVisible();
    await option("Hamburg").hover();
    await expect(option("Hamburg")).toHaveAttribute("data-highlighted");
    await option("Hamburg").click();
    await expect(list).toBeHidden();
    await expect(input).toBeFocused();
    await expect(input).toHaveValue("Hamburg");
    expect(await value(root)).toBe("ham");
  });

  test("the trigger toggles the popup and focuses the input; Clear empties it", async ({
    page,
  }) => {
    await page.goto("/combobox");
    const { input, list, root } = await city(page);
    const trigger = page.getByRole("button", { name: "Show cities" });
    await expect(trigger).toHaveAttribute("tabindex", "-1");
    await trigger.click();
    await expect(list).toBeVisible();
    await expect(input).toBeFocused();
    await trigger.click();
    await expect(list).toBeHidden();
    await page.getByRole("button", { name: "Clear city" }).click();
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    expect(await value(root)).toBe("");
  });

  test("a click outside closes it; a right-click outside does not (doc-9 section 1)", async ({
    page,
  }) => {
    await page.goto("/combobox");
    const { input, list } = await city(page);
    await input.click();
    await expect(list).toBeVisible();
    const heading = page.getByRole("heading", { name: "Combobox", exact: true });
    await heading.click({ button: "right" });
    await expect(list).toBeVisible();
    await heading.click();
    await expect(list).toBeHidden();
    await expect(input).toHaveValue("Lisbon");
  });
});

test.describe("multiple values", () => {
  test("choosing toggles a value and keeps the popup open; chips and Backspace remove", async ({
    page,
  }) => {
    // Room below the field under the fixture's long nav, so the popup does not flip over the chips
    // (Firefox's and WebKit's fonts on Linux make the page taller).
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("/combobox");
    await city(page);
    const input = page.getByRole("combobox", { name: "Tags" });
    const list = page.getByRole("listbox", { name: "Tags" });
    const chips = page.locator("lu-combobox[name=tags] [role=list]");
    await expect(chips.getByRole("listitem")).toHaveText([/^ui/]);
    await expect(list).not.toBeVisible();
    await input.click();
    await expect(list).toHaveAttribute("aria-multiselectable", "true");
    await list.getByRole("option", { name: "docs" }).click();
    await expect(list).toBeVisible();
    await expect(chips.getByRole("listitem")).toHaveText([/^ui/, /^docs/]);
    await expect(list.getByRole("option", { name: "docs" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // Typing then choosing clears the search.
    await input.pressSequentially("perf");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(input).toHaveValue("");
    await expect(chips.getByRole("listitem")).toHaveText([/^ui/, /^docs/, /^performance/]);
    // Choosing again removes it.
    await list.getByRole("option", { name: "docs" }).click();
    await expect(chips.getByRole("listitem")).toHaveText([/^ui/, /^performance/]);

    await page.keyboard.press("Backspace");
    await expect(chips.getByRole("listitem")).toHaveText([/^ui/]);
    await page.getByRole("button", { name: "Remove ui" }).click();
    await expect(chips.getByRole("listitem")).toHaveCount(0);
    await expect(input).toBeFocused();
  });

  test("the arrows reach the chips from the input; Backspace and Delete remove one (TASK-461)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("/combobox");
    await city(page);
    const input = page.getByRole("combobox", { name: "Tags" });
    const list = page.getByRole("listbox", { name: "Tags" });
    const chips = page.locator("lu-combobox[name=tags] [role=list]");
    const chip = (name: string) => chips.getByRole("listitem").filter({ hasText: name });
    await input.click();
    for (const tag of ["bug", "docs", "performance"]) {
      await list.getByRole("option", { name: tag }).click();
    }
    await expect(chips.getByRole("listitem")).toHaveText([/^ui/, /^bug/, /^docs/, /^performance/]);
    await page.keyboard.press("Escape");
    // Text in the input: Left moves its caret until its start, then into the last chip.
    await input.pressSequentially("ab");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(input).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(chip("performance")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(chip("docs")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(input).toBeFocused();
    // Backspace on a chip removes it; the chip before it takes focus.
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await expect(chip("docs")).toBeFocused();
    await page.keyboard.press("Backspace");
    await expect(chips.getByRole("listitem")).toHaveText([/^ui/, /^bug/, /^performance/]);
    await expect(chip("bug")).toBeFocused();
    // Delete on the first chip: the one in its place takes focus.
    await page.keyboard.press("ArrowLeft");
    await expect(chip("ui")).toBeFocused();
    await page.keyboard.press("Delete");
    await expect(chips.getByRole("listitem")).toHaveText([/^bug/, /^performance/]);
    await expect(chip("bug")).toBeFocused();
  });
});

// A page restored from the back-forward cache keeps its scripts' state as it was; none of the
// engines restores one under Playwright, so this is the reloaded page, whose form state the browser
// restores through `formStateRestoreCallback`.
test.describe("back navigation (TASK-460)", () => {
  test("the user's choice comes back, and a reset goes to the server's", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.goto("/combobox");
    const { input, list } = await city(page);
    await input.click();
    await list.getByRole("option", { name: "Berlin" }).click();
    await expect(input).toHaveValue("Berlin");
    const tags = page.getByRole("combobox", { name: "Tags" });
    const chips = page.locator("lu-combobox[name=tags] [role=list]");
    await tags.click();
    await page.getByRole("listbox", { name: "Tags" }).getByRole("option", { name: "docs" }).click();
    await expect(chips.getByRole("listitem")).toHaveText([/^ui/, /^docs/]);
    await page.goto("/button");
    await page.goBack();
    const value = (name: string) =>
      page.locator(`lu-combobox[name=${name}]`).evaluate((el) => (el as any).value);
    await expect.poll(() => value("city")).toBe("ber");
    await expect(input).toHaveValue("Berlin");
    await expect.poll(() => value("tags")).toEqual(["ui", "docs"]);
    await expect(chips.getByRole("listitem")).toHaveText([/^ui/, /^docs/]);
    // A reset goes back to the server's default, not to what the browser restored.
    await page.getByRole("button", { name: "Reset" }).click();
    await expect.poll(() => value("city")).toBe("lis");
    await expect(input).toHaveValue("Lisbon");
    await expect.poll(() => value("tags")).toEqual(["ui"]);
  });
});

test.describe("forms", () => {
  test("the values submit under their names, each tag its own entry", async ({ page }) => {
    await page.goto("/combobox");
    const { input } = await city(page);
    await input.click();
    await page.getByRole("option", { name: "Porto" }).click();
    const tags = page.getByRole("combobox", { name: "Tags" });
    await tags.click();
    await page.getByRole("option", { name: "bug" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/combobox\?city=opo&tags=ui&tags=bug$/);
  });

  test("required: an empty combobox blocks the submit and is reported at its input", async ({
    page,
  }) => {
    await page.goto("/combobox");
    const { input, root } = await city(page);
    await input.fill("");
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/combobox$/);
    await expect(input).toHaveAttribute("aria-invalid", "true");
    expect(await root.evaluate((el) => (el as HTMLInputElement).validity.valueMissing)).toBe(true);
    expect(await root.evaluate((el) => (el as HTMLInputElement).validationMessage)).not.toBe("");
    // Choosing a value makes it valid again. By the keys: Firefox's validation bubble, under the
    // input, covers the first option and takes a click there (TASK-424).
    await input.focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(input).toHaveValue("Berlin");
    await expect(input).not.toHaveAttribute("aria-invalid");
  });

  test("required shows on the input, which has the role (TASK-431)", async ({ page }) => {
    await page.goto("/combobox");
    const { input, root } = await city(page);
    await expect(input).toHaveAttribute("aria-required", "true");
    // What assistive technology reads: the combobox role is required.
    expect(await axProperty(input, "required")).toBe(true);
    // The input follows the element's attribute.
    await root.evaluate((el) => el.removeAttribute("required"));
    await expect(input).not.toHaveAttribute("aria-required");
    await root.evaluate((el) => el.setAttribute("required", ""));
    await expect(input).toHaveAttribute("aria-required", "true");
  });

  test("reset restores the initial values", async ({ page }) => {
    await page.goto("/combobox");
    const { input, root } = await city(page);
    await input.click();
    await page.getByRole("option", { name: "Madrid" }).click();
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(input).toHaveValue("Lisbon");
    expect(await value(root)).toBe("lis");
  });
});

test.describe("in a dialog (doc-9 section 1)", () => {
  test("Escape closes the list first, then the dialog", async ({ page }) => {
    await page.goto("/combobox");
    await city(page);
    await page.getByRole("button", { name: "Choose a language" }).click();
    const dialog = page.getByRole("dialog", { name: "Language" });
    const input = dialog.getByRole("combobox", { name: "Language" });
    await input.focus();
    await page.keyboard.press("ArrowDown");
    const list = page.getByRole("listbox", { name: "Language" });
    await expect(list).toBeVisible();
    expect(await axe(page)).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(list).toBeHidden();
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});

test.describe("in an island", () => {
  test("bind:value and bind:open keep signals in sync both ways", async ({ page }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/combobox/island");
    const state = page.getByTestId("combobox-state");
    const input = page.getByRole("combobox", { name: "Fruit" });
    const list = page.getByRole("listbox", { name: "Fruit" });
    await expect(input).toHaveValue("Pear");
    await expect(state).toHaveText("fruit: pear, open: false, colours: red");

    await page.getByTestId("pick-plum").click();
    await expect(input).toHaveValue("Plum");
    await expect(page.locator("[role=option][data-value=plum]")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByTestId("open-by-signal").click();
    await expect(list).toBeVisible();
    await expect(state).toContainText("open: true");
    await list.getByRole("option", { name: "Cherry" }).click();
    await expect(list).toBeHidden();
    await expect(state).toHaveText("fruit: cherry, open: false, colours: red");

    const colours = page.getByRole("combobox", { name: "Colours" });
    await colours.click();
    await page.getByRole("option", { name: "Blue" }).click();
    await expect(state).toContainText("colours: red blue");
    await page.keyboard.press("Backspace");
    await expect(state).toContainText("colours: red");
    expect(warnings).toEqual([]);
  });

  test("async options: the popup opens when results arrive; a status says it is searching", async ({
    page,
  }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/combobox/island");
    await expect(page.getByRole("combobox", { name: "Fruit" })).toHaveValue("Pear");
    const input = page.getByRole("combobox", { name: "Country" });
    const list = page.getByRole("listbox", { name: "Country" });
    await input.pressSequentially("an");
    await expect(page.getByRole("status").filter({ hasText: "Searching…" })).toBeVisible();
    await expect(list).toBeVisible();
    await expect(list.getByRole("option")).toHaveText(["France", "Germany"]);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(input).toHaveValue("France");
    // New results keep the choice's label for the input, though the option is gone.
    await input.fill("spa");
    await expect(list.getByRole("option")).toHaveText(["Spain"]);
    await page.keyboard.press("Escape");
    await expect(input).toHaveValue("France");
    expect(warnings).toEqual([]);
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  test("in a short viewport the list fits beside its input, and the highlight shows (1.4.10, TASK-428)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 640, height: 400 });
    await page.goto("/combobox");
    const { input, list } = await city(page);
    await input.focus();
    await page.keyboard.press("ArrowUp");
    await expect(list).toBeVisible();
    const current = list.locator("[data-highlighted]");
    await expect(current).toHaveCount(1);
    const { height } = page.viewportSize()!;
    const box = (await list.boundingBox())!;
    const shown = (await current.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
    expect(shown.y + shown.height).toBeLessThanOrEqual(height + 1);
  });

  for (const scheme of SCHEMES) {
    test(`axe passes closed and open (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/combobox");
      const { input, list } = await city(page);
      expect(await axe(page)).toEqual([]);
      await input.focus();
      await page.keyboard.press("ArrowDown");
      await expect(list).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await page.keyboard.press("ControlOrMeta+a");
      await page.keyboard.type("zz");
      await expect(page.getByRole("status").filter({ hasText: "No city matches." })).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await page.keyboard.press("Escape");
      await page.getByRole("combobox", { name: "Tags" }).click();
      await expect(page.getByRole("listbox", { name: "Tags" })).toBeVisible();
      expect(await axe(page)).toEqual([]);

      await page.goto("/combobox/island");
      await expect(page.getByRole("combobox", { name: "Fruit" })).toHaveValue("Pear");
      expect(await axe(page)).toEqual([]);
      await page.getByTestId("open-by-signal").click();
      await expect(page.getByRole("listbox", { name: "Fruit" })).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });
  }

  test("focus is visible on the input, and the highlighted option shows the ring (2.4.7)", async ({
    page,
  }) => {
    await page.goto("/combobox");
    const { input, option } = await city(page);
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    await expect(input).toBeFocused();
    expect(await focusRing(page)).toBe("2px solid");
    await page.keyboard.press("ArrowDown");
    const outline = await option("Lisbon").evaluate((el) => {
      const style = getComputedStyle(el);
      return `${style.outlineWidth} ${style.outlineStyle}`;
    });
    expect(outline).toBe("2px solid");
  });

  test("the buttons, chips and options are at least 24 by 24 CSS pixels (2.5.8)", async ({
    page,
  }) => {
    await page.goto("/combobox");
    const { input, list } = await city(page);
    expect(await smallTargets(page.locator("form"))).toEqual([]);
    await input.click();
    expect(await smallTargets(list)).toEqual([]);
    const options = await list.getByRole("option").evaluateAll((all) =>
      all
        .filter((el) => el.getClientRects().length > 0)
        .map((el) => el.getBoundingClientRect())
        .filter((box) => box.height < 24),
    );
    expect(options).toEqual([]);
  });

  test("the field and the popup reflow at 320 CSS pixels with text spacing (1.4.10, 1.4.12)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/combobox");
    await page.addStyleTag({ content: TEXT_SPACING });
    const { input, list } = await city(page);
    await input.click();
    await expect(list).toBeVisible();
    for (const box of [await input.boundingBox(), await list.boundingBox()]) {
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    }
    expect(await clipped(list)).toEqual([]);
  });

  test("a server-rendered page with comboboxes loads Combobox's client script", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
    });
    await page.goto("/combobox");
    await city(page);
    expect(scripts).toContainEqual(expect.stringMatching(/\/combobox\.script-[\w-]+\.js$/));
    await expect(page.locator("script[data-l-islands]")).toHaveCount(0);
  });
});

test.describe("right to left (TASK-385)", () => {
  test("the popup lines up with the input's inline start: its right edge", async ({ page }) => {
    await page.goto("/combobox");
    await rtl(page);
    const { input, list } = await city(page);
    await input.click();
    await expect(input).toHaveAttribute("aria-expanded", "true");
    const popup = list.locator("xpath=ancestor-or-self::*[@popover][1]");
    const [field, box] = [await input.boundingBox(), await popup.boundingBox()];
    expect(Math.abs(field!.x + field!.width - (box!.x + box!.width))).toBeLessThan(2);
  });
});
