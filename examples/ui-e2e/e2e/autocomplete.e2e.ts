// Autocomplete (TASK-377): the APG combobox with list autocomplete in free mode. The text is the
// value: typing filters the suggestions and opens them, nothing has to be chosen, choosing fills the
// text in, Escape and Tab keep what is typed, inline completion (`mode="both"`) shows the
// highlighted suggestion and Escape takes it back; the form submits the text, without JavaScript
// too. Combobox and Autocomplete inside a Field (TASK-404): labelled, described and marked invalid
// by the field. The sync with a signal in an island, and WCAG 2.2 AA with the default theme
// (doc-9 sections 1, 6, 15 and 17).
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  axDescription,
  axe,
  clipped,
  focusRing,
  lastNavLink,
  SCHEMES,
  smallTargets,
  TEXT_SPACING,
} from "./a11y.ts";

/** Puts the whole page right to left. */
const rtl = (page: Page) => page.evaluate(() => (document.documentElement.dir = "rtl"));

/** Lumiose's console warnings (LUM codes), such as a hydration that fell back to rendering. */
const lumioseWarnings = (page: Page) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("LUM")) warnings.push(message.text());
  });
  return warnings;
};

/** An autocomplete's input and its listbox, open or not (a closed one has no role in the tree). */
async function parts(page: Page, name: string) {
  const input = page.getByRole("combobox", { name, exact: true });
  const id = await input.getAttribute("aria-controls");
  const list = page.locator(`[id="${id}"]`);
  return {
    input,
    list,
    shown: () =>
      list
        .locator("[role=option]:not([hidden])")
        .evaluateAll((options) => options.map((option) => option.textContent?.trim())),
    highlighted: list.locator("[data-highlighted]"),
  };
}

/** Moves the mouse onto `target` in steps: the element ignores moves that do not move. */
async function pointTo(page: Page, target: Locator) {
  const box = (await target.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
}

/** /autocomplete with its script running: the free element is defined. */
async function ready(page: Page) {
  await page.goto("/autocomplete");
  await page.waitForFunction(() => customElements.get("lu-combobox") !== undefined);
}

/** Waits for /autocomplete/island to hydrate: "Set the signal" answers. */
async function hydrated(page: Page) {
  const input = page.getByRole("combobox", { name: "Fruit" });
  await expect(async () => {
    await page.getByTestId("set-signals").click({ timeout: 250 });
    await expect(input).toHaveValue("man", { timeout: 250 });
  }).toPass();
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the inputs are text fields that submit what is typed", async ({ page }) => {
    await page.goto("/autocomplete");
    await page.getByRole("combobox", { name: "Tag" }).fill("my own tag");
    await page.getByRole("combobox", { name: "Topic" }).fill("ui");
    await page.getByRole("button", { name: "Save" }).click();
    // The Combobox needs its script to have a value (and to require one): it submits nothing.
    await expect(page).toHaveURL(/\/autocomplete\?tag=my\+own\+tag&country=&topic=ui$/);
  });
});

test.describe("Autocomplete", () => {
  test("typing filters and opens the suggestions; any text stays, and an empty one closes them", async ({
    page,
  }) => {
    await ready(page);
    const tag = await parts(page, "Tag");
    await tag.input.click();
    // A click does not open them (no openOnInputClick).
    await expect(tag.input).toHaveAttribute("aria-expanded", "false");
    await tag.input.pressSequentially("an");
    await expect(tag.input).toHaveAttribute("aria-expanded", "true");
    expect(await tag.shown()).toEqual(["animation", "performance"]);
    await expect(tag.highlighted).toHaveCount(0);
    await tag.input.pressSequentially("xyz");
    await expect(page.getByText("No suggestions: any tag works.")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tag.input).toHaveAttribute("aria-expanded", "false");
    await expect(tag.input).toHaveValue("anxyz");
    await tag.input.fill("");
    await expect(tag.input).toHaveAttribute("aria-expanded", "false");
  });

  test("the arrows highlight suggestions and Enter fills one in; the text is what submits", async ({
    page,
  }) => {
    await ready(page);
    const tag = await parts(page, "Tag");
    await tag.input.focus();
    await page.keyboard.press("ArrowDown");
    await expect(tag.input).toHaveAttribute("aria-expanded", "true");
    expect(await tag.shown()).toHaveLength(7);
    await expect(tag.highlighted).toHaveText("accessibility");
    await page.keyboard.press("ArrowDown");
    await expect(tag.highlighted).toHaveText("animation");
    // List autocomplete: the input keeps the typed text while the highlight moves.
    await expect(tag.input).toHaveValue("");
    await page.keyboard.press("Enter");
    await expect(tag.input).toHaveValue("animation");
    await expect(tag.input).toHaveAttribute("aria-expanded", "false");
    await expect(tag.input).toBeFocused();
    // A click on a suggestion fills it in too.
    await tag.input.fill("do");
    await tag.list.getByRole("option", { name: "docs" }).click();
    await expect(tag.input).toHaveValue("docs");
    // The clear button empties it.
    await page.getByRole("button", { name: "Clear tag" }).click();
    await expect(tag.input).toHaveValue("");
    await expect(page.getByRole("button", { name: "Clear tag" })).toBeHidden();
  });

  test("inline completion shows the highlighted suggestion; Escape takes it back, Tab keeps it", async ({
    page,
  }) => {
    await ready(page);
    const country = await parts(page, "Country");
    await expect(country.input).toHaveAttribute("aria-autocomplete", "both");
    await country.input.pressSequentially("s");
    expect(await country.shown()).toEqual(["Spain", "Sweden", "Switzerland"]);
    await page.keyboard.press("ArrowDown");
    await expect(country.input).toHaveValue("Spain");
    // The completed part is selected: typing replaces it.
    expect(
      await country.input.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd]),
    ).toEqual([1, 5]);
    await page.keyboard.press("ArrowDown");
    await expect(country.input).toHaveValue("Sweden");
    await page.keyboard.press("Escape");
    await expect(country.input).toHaveValue("s");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(country.input).toHaveValue("Switzerland");
    await page.keyboard.press("Tab");
    await expect(country.input).toHaveValue("Switzerland");
  });
});

test.describe("autoHighlight, limit, submitOnItemClick and keepHighlight (TASK-410)", () => {
  test("the first match is highlighted as one types, at most three show, Enter fills it in", async ({
    page,
  }) => {
    await ready(page);
    const search = await parts(page, "Search");
    await search.input.fill("a");
    await expect(search.list).toBeVisible();
    expect(await search.shown()).toEqual(["accessibility", "animation", "api"]);
    await expect(search.highlighted).toHaveText("accessibility");
    await expect(search.input).toHaveAttribute(
      "aria-activedescendant",
      (await search.highlighted.getAttribute("id"))!,
    );
    await search.input.press("ArrowDown");
    await expect(search.highlighted).toHaveText("animation");
    await search.input.press("Enter");
    await expect(search.input).toHaveValue("animation");
    await expect(page).toHaveURL(/\/autocomplete$/);
    // A narrower text shows the matches past the limit.
    await search.input.fill("perf");
    expect(await search.shown()).toEqual(["performance"]);
  });

  test("a click on a suggestion submits the search", async ({ page }) => {
    await ready(page);
    const search = await parts(page, "Search");
    await search.input.fill("do");
    await search.list.getByRole("option", { name: "docs" }).click();
    await expect(page).toHaveURL(/\/autocomplete\?q=docs$/);
  });

  test("the pointer's highlight goes when it leaves the list, unless keepHighlight", async ({
    page,
  }) => {
    await ready(page);
    const tag = await parts(page, "Tag");
    await tag.input.fill("a");
    await pointTo(page, tag.list.getByRole("option", { name: "api" }));
    await expect(tag.highlighted).toHaveText("api");
    await page.mouse.move(5, 5);
    await expect(tag.highlighted).toHaveCount(0);
    await expect(tag.input).not.toHaveAttribute("aria-activedescendant");
    await tag.input.press("Escape");
    const country = await parts(page, "Country");
    await country.input.fill("s");
    await pointTo(page, country.list.getByRole("option", { name: "Sweden" }));
    await expect(country.highlighted).toHaveText("Sweden");
    await page.mouse.move(5, 5);
    await expect(country.highlighted).toHaveText("Sweden");
  });
});

test.describe("Combobox and Autocomplete in a Field (TASK-404)", () => {
  test("the field labels and describes them, and marks them invalid on a submit attempt", async ({
    page,
  }) => {
    await ready(page);
    const city = page.getByRole("combobox", { name: "City" });
    const topic = page.getByRole("combobox", { name: "Topic" });
    await expect(city).toHaveAccessibleDescription("One of the cities we ship to.");
    await expect(topic).toHaveAccessibleDescription("Anything, or a suggestion.");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(city).toHaveAttribute("aria-invalid", "true");
    await expect(topic).toHaveAttribute("aria-invalid", "true");
    await expect(city).toBeFocused();
    await expect.poll(() => axDescription(city)).toMatch(/One of the cities we ship to\. .+/);
    // Choosing a city and typing a topic make them valid; the form submits both, with the rest.
    await city.fill("lis");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(city).toHaveValue("Lisbon");
    await expect(city).not.toHaveAttribute("aria-invalid");
    await topic.fill("my topic");
    await expect(topic).not.toHaveAttribute("aria-invalid");
    await page.getByRole("combobox", { name: "Tag" }).fill("ui");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/autocomplete\?tag=ui&country=&city=lis&topic=my\+topic$/);
  });
});

test.describe("in an island", () => {
  test("bind:value keeps a signal in sync both ways; the island filters the suggestions", async ({
    page,
  }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/autocomplete/island");
    await hydrated(page);
    const fruit = await parts(page, "Fruit");
    const state = page.getByTestId("query-state");
    await expect(state).toHaveText("query: man");
    await fruit.input.fill("ap");
    await expect(state).toHaveText("query: ap");
    await expect(fruit.input).toHaveAttribute("aria-expanded", "true");
    expect(await fruit.shown()).toEqual(["apple", "apricot"]);
    await expect(fruit.list.locator("..").getByRole("status")).toHaveText("2 matches");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect(fruit.input).toHaveValue("apricot");
    await expect(state).toHaveText("query: apricot");
    expect(warnings).toEqual([]);
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes, closed and open, on the page and the island (${scheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await ready(page);
      expect(await axe(page)).toEqual([]);
      const tag = await parts(page, "Tag");
      await tag.input.pressSequentially("a");
      await page.keyboard.press("ArrowDown");
      await expect(tag.highlighted).toHaveCount(1);
      expect(await axe(page)).toEqual([]);
      await page.goto("/autocomplete/island");
      await hydrated(page);
      expect(await axe(page)).toEqual([]);
    });
  }

  test("focus is visible (2.4.7) and targets are 24px (2.5.8)", async ({ page }) => {
    await ready(page);
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("combobox", { name: "Tag" })).toBeFocused();
    expect(await focusRing(page)).toBe("2px solid");
    const tag = await parts(page, "Tag");
    await tag.input.pressSequentially("a");
    expect(await smallTargets(page.locator("main"))).toEqual([]);
  });

  test("the form reflows at 320 CSS pixels with text spacing (1.4.10, 1.4.12)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await ready(page);
    await page.addStyleTag({ content: TEXT_SPACING });
    const main = page.locator("main");
    const box = (await main.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(await clipped(main)).toEqual([]);
  });

  test("a server-rendered page loads Combobox's and Field's scripts only", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
    });
    await ready(page);
    await page.waitForLoadState("networkidle");
    // With the modules the scripts share with others (the layer model, the fallback placement).
    expect(scripts.toSorted()).toEqual([
      expect.stringMatching(/\/combobox\.script-[\w-]+\.js$/),
      expect.stringMatching(/\/field\.script-[\w-]+\.js$/),
      expect.stringMatching(/\/layer-[\w-]+\.js$/),
      expect.stringMatching(/\/place-[\w-]+\.js$/),
    ]);
  });
});

test.describe("right to left (TASK-385)", () => {
  test("the suggestions line up with the input's inline start: its right edge", async ({
    page,
  }) => {
    await ready(page);
    await rtl(page);
    const tag = await parts(page, "Tag");
    await tag.input.pressSequentially("a");
    await expect(tag.input).toHaveAttribute("aria-expanded", "true");
    const popup = tag.list.locator("xpath=ancestor-or-self::*[@popover][1]");
    const [field, box] = [await tag.input.boundingBox(), await popup.boundingBox()];
    expect(Math.abs(field!.x + field!.width - (box!.x + box!.width))).toBeLessThan(2);
  });
});
