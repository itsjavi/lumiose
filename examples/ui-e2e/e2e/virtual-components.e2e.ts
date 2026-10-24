// VirtualList, VirtualGrid and VirtualTable (TASK-565): the server renders their first rows, which
// the islands take over without a warning, a rebuilt row or a moved cell; the window and an element
// scroll them; rows keep their state through new objects under the same ids; the focused cell stays
// rendered; the table keeps aria-rowcount and aria-rowindex; measured rows sit one gap apart. WCAG
// 2.2 AA with the default theme.
import { expect, test, type Page } from "@playwright/test";
import { axe, SCHEMES } from "./a11y.ts";

const lumioseWarnings = (page: Page) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("LUM")) warnings.push(message.text());
  });
  return warnings;
};

const people = (page: Page) => page.getByRole("list", { name: "People" });
const releases = (page: Page) => page.getByRole("region", { name: "Releases" });
const entries = (page: Page) => page.getByRole("list", { name: "Entries" });
const positions = (page: Page) =>
  people(page)
    .locator("li")
    .evaluateAll((items) => items.map((li) => Number(li.getAttribute("aria-posinset"))));
const rowIndexes = (page: Page) =>
  releases(page)
    .locator("tbody tr[data-row]")
    .evaluateAll((rows) => rows.map((tr) => Number(tr.getAttribute("aria-rowindex"))));
const range = (from: number, to: number) => Array.from({ length: to - from }, (_, i) => from + i);
/** The entries' first `count` cells' boxes, rounded. */
const cellBoxes = (page: Page, count: number) =>
  entries(page)
    .locator("li")
    .evaluateAll(
      (cells, n) =>
        cells.slice(0, n).map((cell) => {
          const box = cell.getBoundingClientRect();
          return [box.x, box.y, box.width, box.height].map(Math.round);
        }),
      count,
    );

/** Records the `aria-posinset` of the list items removed from the page, from its first parse. */
const recordRemoved = (page: Page) =>
  page.addInitScript(() => {
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
const removedOf = (page: Page) =>
  page.evaluate(() => (window as unknown as { removed: number[] }).removed);

async function ready(page: Page, path = "/virtualizer/components") {
  await page.goto(path);
  const list = path.endsWith("cells") ? entries(page) : people(page);
  await expect(list).toHaveAttribute("data-mounted", "");
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the server renders the first rows, in the list's and the table's whole height", async ({
    page,
  }) => {
    await page.goto("/virtualizer/components");
    expect(await positions(page)).toEqual(range(1, 21));
    await expect(people(page).locator("li").first()).toHaveAttribute("aria-setsize", "1000");
    expect(await people(page).evaluate((ul) => ul.getBoundingClientRect().height)).toBe(40_000);
    await expect(releases(page).locator("table")).toHaveAttribute("aria-rowcount", "2001");
    expect(await rowIndexes(page)).toEqual(range(2, 17));
    expect(await releases(page).evaluate((el) => el.scrollHeight)).toBe(32 * 2001);
  });

  test("the server's cells sit in the page's CSS grid", async ({ page }) => {
    await page.goto("/virtualizer/components/cells");
    await expect(entries(page).locator("li")).toHaveCount(48);
    const [first, second] = await cellBoxes(page, 2);
    expect(second![1]).toBe(first![1]);
    expect(second![0]! - first![0]! - first![2]!).toBe(8);
  });
});

test("the list and the table take the server's rows over: no warning, no row rebuilt", async ({
  page,
}) => {
  const warnings = lumioseWarnings(page);
  await recordRemoved(page);
  await ready(page);
  expect(await people(page).evaluate((ul) => ul.getBoundingClientRect().height)).toBe(40_000);
  const shown = await positions(page);
  expect((await removedOf(page)).filter((position) => shown.includes(position))).toEqual([]);
  expect(shown[0]).toBe(1);
  expect(warnings).toEqual([]);
});

test("the grid places the server's cells where the CSS grid had them", async ({
  browser,
  page,
}) => {
  const warnings = lumioseWarnings(page);
  const plain = await browser.newPage({ javaScriptEnabled: false });
  await plain.goto("/virtualizer/components/cells");
  const before = await cellBoxes(plain, 12);
  await plain.close();
  await recordRemoved(page);
  await ready(page, "/virtualizer/components/cells");
  expect(await cellBoxes(page, 12)).toEqual(before);
  const shown = await entries(page)
    .locator("li")
    .evaluateAll((cells) => cells.map((cell) => Number(cell.getAttribute("aria-posinset"))));
  expect((await removedOf(page)).filter((position) => shown.includes(position))).toEqual([]);
  expect(warnings).toEqual([]);
});

test("the list follows the window and keeps its rows' state through new objects", async ({
  page,
}) => {
  await ready(page);
  const star = people(page).getByRole("button", { name: "Person 2", exact: true });
  await star.click();
  await expect(star).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Rename" }).click();
  const renamed = people(page).getByRole("button", { name: "Person 2 (1)", exact: true });
  await expect(renamed).toHaveAttribute("aria-pressed", "true");

  const top = await people(page).evaluate((ul) => ul.getBoundingClientRect().top + scrollY);
  await page.evaluate((y) => scrollTo(0, y), top + 20_020);
  await expect.poll(() => positions(page).then((all) => all[0])).toBe(497);
  const shown = await positions(page);
  expect(shown).toEqual(range(497, 497 + shown.length));
  expect(shown.length).toBeLessThan(40);

  await page.getByRole("button", { name: "Scroll to person 500" }).click();
  const person = people(page).getByRole("button", { name: "Person 500 (1)", exact: true });
  await expect(person).toBeInViewport();
  expect(await person.evaluate((el) => Math.abs(el.getBoundingClientRect().top))).toBeLessThan(1);
});

test("Tab moves through the grid's cells in order", async ({ page, browserName }) => {
  // macOS WebKit's Tab reaches only fields (the system's keyboard navigation setting): CI's Linux
  // WebKit runs this, or UI_E2E_WS locally (playwright.config.ts).
  test.skip(
    browserName === "webkit" && process.platform === "darwin" && !process.env.UI_E2E_WS,
    "macOS WebKit's Tab skips buttons",
  );
  await ready(page, "/virtualizer/components/cells");
  await entries(page).getByRole("button", { name: "#1", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(entries(page).getByRole("button", { name: "#2", exact: true })).toBeFocused();
});

test("the grid keeps the focused cell rendered while the window scrolls away", async ({ page }) => {
  await ready(page, "/virtualizer/components/cells");
  await entries(page).getByRole("button", { name: "#2", exact: true }).focus();
  // To the end: the window holds the last rows, and the focused cell's row stays first.
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect
    .poll(() => entries(page).locator("li").last().getAttribute("aria-posinset"))
    .toBe("1200");
  await expect(entries(page).locator("li").first()).toHaveAttribute("aria-posinset", "1");
  await expect(entries(page).getByRole("button", { name: "#2", exact: true })).toBeFocused();
  expect(await entries(page).locator("li").count()).toBeLessThan(300);
});

test("the table keeps its row count and each row's index as its scroller scrolls", async ({
  page,
}) => {
  await ready(page);
  const region = releases(page);
  await region.evaluate((el) => (el.scrollTop = 32 * 1000));
  await expect.poll(async () => (await rowIndexes(page))[0]).toBe(997);
  const indexes = await rowIndexes(page);
  expect(indexes).toEqual(range(997, 997 + indexes.length));
  await expect(region.locator("tbody tr[data-row]").first()).toHaveAttribute("data-id", "r996");
  await expect(region.locator("tr[data-spacer]")).toHaveCount(2);
  await region.focus();
  await page.keyboard.press("End");
  await expect.poll(async () => (await rowIndexes(page)).at(-1)).toBe(2001);
  await expect(region.getByRole("cell", { name: "1.199.9", exact: true })).toBeInViewport();
});

test("a measured grid's rows sit one gap below their tallest cell, at any width", async ({
  page,
}) => {
  const warnings = lumioseWarnings(page);
  await page.setViewportSize({ width: 1024, height: 720 });
  await page.goto("/virtualizer/components/cards");
  const cards = page.getByRole("list", { name: "Cards" });
  await expect(cards).toHaveAttribute("data-mounted", "");
  /** Each row's top, and the bottom of its tallest cell. */
  const rows = () =>
    cards.locator("li").evaluateAll((cells) => {
      const byRow = new Map<string, { top: number; bottom: number }>();
      for (const cell of cells) {
        const box = cell.getBoundingClientRect();
        const row = byRow.get(cell.getAttribute("data-row")!) ?? {
          top: box.top,
          bottom: -Infinity,
        };
        row.bottom = Math.max(row.bottom, box.bottom);
        byRow.set(cell.getAttribute("data-row")!, row);
      }
      return [...byRow.values()];
    });
  const oneGapApart = async () =>
    expect
      .poll(async () => {
        const all = await rows();
        return all.slice(1).every((row, i) => Math.abs(row.top - all[i]!.bottom - 16) < 1);
      })
      .toBe(true);
  await oneGapApart();
  await page.evaluate(() => scrollTo(0, 8_000));
  await oneGapApart();
  await page.setViewportSize({ width: 480, height: 720 });
  await oneGapApart();
  await expect(cards.locator("li").first()).toHaveAttribute("aria-setsize", "600");
  expect(warnings).toEqual([]);
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes on the three pages (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await ready(page);
      expect(await axe(page)).toEqual([]);
      await ready(page, "/virtualizer/components/cells");
      expect(await axe(page)).toEqual([]);
      await page.goto("/virtualizer/components/cards");
      await expect(page.getByRole("list", { name: "Cards" })).toHaveAttribute("data-mounted", "");
      expect(await axe(page)).toEqual([]);
    });
  }
});
