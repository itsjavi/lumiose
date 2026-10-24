// Virtualizer (TASK-565): the server renders the first rows, which the islands take
// over without a hydration warning, a lost row or a layout jump; scrolling renders the rows near the
// viewport, for the window and for an element; the focused row stays rendered; scrollToIndex; a
// table keeps its row count and indexes; measured grid rows never overlap. WCAG 2.2 AA with the
// default theme.
import { expect, test, type Page } from "@playwright/test";
import { axe, SCHEMES } from "./a11y.ts";

/** Lumiose's console warnings (LUM codes), such as a hydration that fell back to rendering. */
const lumioseWarnings = (page: Page) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("LUM")) warnings.push(message.text());
  });
  return warnings;
};

const people = (page: Page) => page.getByRole("list", { name: "People" });
const releases = (page: Page) => page.getByRole("region", { name: "Releases" });
/** The `aria-posinset` of the people rendered, in DOM order. */
const positions = (page: Page) =>
  people(page)
    .locator("li")
    .evaluateAll((items) => items.map((li) => Number(li.getAttribute("aria-posinset"))));
const rowIndexes = (page: Page) =>
  releases(page)
    .locator("tbody tr:not([aria-hidden])")
    .evaluateAll((rows) => rows.map((tr) => Number(tr.getAttribute("aria-rowindex"))));
const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);

async function ready(page: Page) {
  await page.goto("/virtualizer");
  await expect(people(page)).toHaveAttribute("data-mounted", "");
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the server renders the first rows, in the lists' and the table's whole height", async ({
    page,
  }) => {
    await page.goto("/virtualizer");
    expect(await positions(page)).toEqual(range(1, 21));
    await expect(people(page).locator("li").first()).toHaveAttribute("aria-setsize", "1000");
    expect(await people(page).evaluate((ul) => ul.getBoundingClientRect().height)).toBe(40_000);
    await expect(releases(page).locator("table")).toHaveAttribute("aria-rowcount", "2001");
    expect(await rowIndexes(page)).toEqual(range(2, 17));
    expect(await releases(page).evaluate((el) => el.scrollHeight)).toBe(32 * 2001);
  });
});

test("the islands take the server's rows over: no warning, no row rebuilt, no jump", async ({
  page,
}) => {
  const warnings = lumioseWarnings(page);
  // The rows that leave the list, from the first parse on.
  await page.addInitScript(() => {
    const removed: number[] = [];
    (window as unknown as { removed: number[] }).removed = removed;
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.removedNodes) {
          if (node instanceof HTMLLIElement && node.hasAttribute("aria-posinset")) {
            removed.push(Number(node.getAttribute("aria-posinset")));
          }
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });
  await ready(page);
  const after = page.getByRole("button", { name: "After the people" });
  expect(await people(page).evaluate((ul) => ul.getBoundingClientRect().height)).toBe(40_000);
  const shown = await positions(page);
  // The rows in view stayed; only rows past the window may have left.
  const removed = await page.evaluate(() => (window as unknown as { removed: number[] }).removed);
  expect(removed.filter((position) => shown.includes(position))).toEqual([]);
  expect(shown[0]).toBe(1);
  await expect(after).toBeAttached();
  expect(warnings).toEqual([]);
});

test("scrolling the window renders the rows near the viewport, and only those", async ({
  page,
}) => {
  await ready(page);
  const top = await people(page).evaluate((ul) => ul.getBoundingClientRect().top + scrollY);
  // The middle of row 500 (0-based) at the viewport's top, clear of sub-pixel offsets; 4 rows of
  // overscan above it.
  await page.evaluate((y) => scrollTo(0, y), top + 20_020);
  await expect.poll(() => positions(page).then((all) => all[0])).toBe(497);
  const shown = await positions(page);
  expect(shown).toEqual(range(497, 497 + shown.length));
  expect(shown.length).toBeLessThan(40);
  await expect(
    people(page).getByRole("button", { name: "Person 501", exact: true }),
  ).toBeInViewport();
});

test("scrollToIndex shows the row at the viewport's top", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Scroll to person 500" }).click();
  const person = people(page).getByRole("button", { name: "Person 500", exact: true });
  await expect(person).toBeInViewport();
  expect(await person.evaluate((el) => Math.abs(el.getBoundingClientRect().top))).toBeLessThan(1);
});

test("the focused row stays rendered while the window scrolls away from it", async ({ page }) => {
  await ready(page);
  const first = people(page).getByRole("button", { name: "Person 1", exact: true });
  await first.focus();
  await page.evaluate(() => scrollBy(0, 10_000));
  await expect
    .poll(() => positions(page).then((all) => all.length > 1 && all[1]! > 100))
    .toBe(true);
  expect((await positions(page))[0]).toBe(1);
  await expect(first).toBeFocused();
  // Once focus leaves the list, the row goes.
  await page
    .getByRole("button", { name: "Reverse" })
    .evaluate((el) => (el as HTMLElement).focus({ preventScroll: true }));
  await expect.poll(() => positions(page).then((all) => all[0])).not.toBe(1);
});

test("reversed, the rows follow their records (keyed by id)", async ({ page }) => {
  await ready(page);
  await page.getByRole("button", { name: "Reverse" }).click();
  await expect(people(page).locator("li").first()).toHaveText("Person 1000");
  await page.getByRole("button", { name: "Scroll to person 500" }).click();
  await expect(
    people(page).getByRole("button", { name: "Person 501", exact: true }),
  ).toBeInViewport();
});

test("a table in its own scroller keeps its row count and each row's index", async ({ page }) => {
  await ready(page);
  const region = releases(page);
  await region.evaluate((el) => (el.scrollTop = 32 * 1000));
  await expect.poll(async () => (await rowIndexes(page))[0]).toBe(997);
  const indexes = await rowIndexes(page);
  expect(indexes).toEqual(range(997, 997 + indexes.length));
  await expect(region.locator("table")).toHaveAttribute("aria-rowcount", "2001");
  expect(await region.evaluate((el) => el.scrollHeight)).toBe(32 * 2001);
  // The keyboard scrolls it, and the rows follow.
  await region.focus();
  await page.keyboard.press("End");
  await expect.poll(async () => (await rowIndexes(page)).at(-1)).toBe(2001);
  await expect(region.getByRole("cell", { name: "1.199.9", exact: true })).toBeInViewport();
});

/** Each rendered row's top and bottom, in order. */
const rows = (page: Page) =>
  page
    .getByRole("list", { name: "Cards" })
    .locator("[data-row]")
    .evaluateAll((all) =>
      all.map((row) => {
        const box = row.getBoundingClientRect();
        return { top: box.top, bottom: box.bottom, cards: row.children.length };
      }),
    );
const noOverlap = async (page: Page) => {
  await expect
    .poll(async () => {
      const all = await rows(page);
      return all.slice(1).every((row, i) => Math.abs(row.top - all[i]!.bottom - 16) < 1);
    })
    .toBe(true);
};

test.describe("a measured grid", () => {
  test("rows sit one gap apart once measured, at any width, scrolled or not", async ({ page }) => {
    const warnings = lumioseWarnings(page);
    await page.setViewportSize({ width: 1024, height: 720 });
    await page.goto("/virtualizer/grid");
    await expect(page.getByRole("listitem").first()).toBeVisible();
    await noOverlap(page);
    const wide = (await rows(page))[0]!.cards;
    await page.evaluate(() => scrollTo(0, 8_000));
    await noOverlap(page);
    await page.setViewportSize({ width: 480, height: 720 });
    await expect.poll(async () => (await rows(page))[0]!.cards).toBeLessThan(wide);
    await noOverlap(page);
    await expect(page.getByRole("listitem").first()).toHaveAttribute("aria-setsize", "600");
    expect(warnings).toEqual([]);
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes on both pages (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await ready(page);
      expect(await axe(page)).toEqual([]);
      await page.goto("/virtualizer/grid");
      await expect(page.getByRole("listitem").first()).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });
  }
});
