// The /ui section (TASK-387): @lumiose/ui's docs from packages/ui/docs, with live demos on the default
// theme. Server-rendered demos work without JavaScript, island demos hydrate, the site's theme toggle
// drives them, the site's styles stay out of them, and the old /docs/ui URLs redirect.
import { expect, test, type Page } from "@playwright/test";

const COMPONENTS = [
  "Accordion",
  "Avatar",
  "Collapsible",
  "Combobox",
  "Context Menu",
  "Dialog",
  "Drawer",
  "Menu",
  "Menubar",
  "Navigation Menu",
  "Popover",
  "Select",
  "Separator",
  "Tabs",
  "Toast",
  "Tooltip",
];

/** A demo's preview: the page's first one at the top, or an example's by id (`tabs-2`). */
function preview(page: Page, id?: string) {
  return page.locator(id === undefined ? ".hero .preview" : `#demo-${id} .preview`);
}

test("the UI section is in the site navigation, with a page per component", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "UI" }).click();
  await expect(page).toHaveURL(/\/ui\/$/);
  await expect(page).toHaveTitle("Lumiose UI: accessible components on native HTML");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("UI components");
  const nav = page.getByRole("navigation", { name: "UI" });
  await expect(nav.getByRole("link", { name: "Introduction" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  for (const name of ["Installation", "Theming"]) {
    await nav.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  }
  for (const name of COMPONENTS) {
    await nav.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/ui/${name.toLowerCase().replaceAll(" ", "-")}/$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(page).toHaveTitle(`${name} · Lumiose UI`);
    // A live demo at the top, and every live example above its code.
    await expect(preview(page)).not.toBeEmpty();
    const demos = page.locator('figure.demo[id^="demo-"]');
    expect(await demos.count()).toBeGreaterThan(0);
    // The first example runs at the top, once (its ids would repeat); the others run in place.
    const [first, ...others] = await demos.all();
    await expect(first!.getByRole("link", { name: "Live at the top of the page" })).toHaveAttribute(
      "href",
      "#live",
    );
    await expect(first!.locator(".preview")).toHaveCount(0);
    for (const demo of [first!, ...others]) {
      await expect(demo.locator("pre code")).toContainText(`export function`);
    }
    for (const demo of others) await expect(demo.locator(".preview")).not.toBeEmpty();
  }
});

test("server-rendered demos work without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/ui/dialog");
  await preview(page).getByRole("button", { name: "Delete project…" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete project?" });
  await expect(dialog).toBeVisible();
  // In a page without JavaScript, Playwright's stability check never settles on a button in a
  // modal dialog, though a click lands: click it once it shows.
  const cancel = dialog.getByRole("button", { name: "Cancel" });
  await expect(cancel).toBeVisible();
  await cancel.click({ force: true });
  await expect(dialog).toBeHidden();
  await page.goto("/ui/popover");
  await preview(page).getByRole("button", { name: "Notifications" }).click();
  await expect(page.getByRole("dialog", { name: "Notifications" }).first()).toBeVisible();
  await page.goto("/ui/menu");
  await preview(page).getByRole("button", { name: "Project" }).click();
  await expect(page.getByRole("menu").first()).toBeVisible();
  await context.close();
});

test("island demos hydrate, and their signals follow the components", async ({ page }) => {
  await page.goto("/ui/tabs");
  const tabs = preview(page, "tabs-2");
  await tabs.getByRole("button", { name: "Open the settings" }).click();
  await expect(tabs.getByRole("tab", { name: "Settings" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.goto("/ui/popover");
  const filters = preview(page, "popover-2");
  await filters.getByRole("button", { name: "Filters" }).click();
  await expect(filters.getByText("Choosing filters…")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(filters.getByText("All items")).toBeVisible();
  await page.goto("/ui/menu");
  const editor = preview(page, "menu-2");
  await editor.getByRole("button", { name: "View" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Wrap lines" }).click();
  await expect(editor.getByText(/lines do not wrap/)).toBeVisible();
});

test("the site's theme toggle drives the demos", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/ui/dialog");
  const button = preview(page).getByRole("button", { name: "Delete project…" });
  const look = () =>
    button.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.backgroundColor, style.color];
    });
  expect(await look()).toEqual(["rgb(255, 255, 255)", "rgb(9, 9, 11)"]);
  await page.getByRole("button", { name: /theme/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await look()).toEqual(["rgb(9, 9, 11)", "rgb(250, 250, 250)"]);
});

test("demos keep the default theme's look, not the site's styles", async ({ page }) => {
  await page.goto("/ui/dialog");
  await preview(page).getByRole("button", { name: "Delete project…" }).click();
  const title = page.getByRole("alertdialog").getByRole("heading", { name: "Delete project?" });
  await expect(title).toBeVisible();
  const style = await title.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { size: computed.fontSize, border: computed.borderTopWidth };
  });
  // The theme's 1.125rem title, without the docs' section rule above headings.
  expect(style).toEqual({ size: "18px", border: "0px" });
  // The theme loads on the /ui pages only.
  const background = () =>
    page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--lu-background").trim(),
    );
  expect(await background()).not.toBe("");
  await page.goto("/docs/concepts/styles");
  expect(await background()).toBe("");
});

test("the theming page shows every --lu- property in light and dark", async ({ page }) => {
  await page.goto("/ui/theming");
  const table = page.getByRole("region", { name: "Table: Property, Light, Dark" });
  await expect(table.getByRole("row", { name: /--lu-background #fff #09090b/ })).toBeVisible();
  await expect(table.getByRole("row", { name: /--lu-radius/ })).toBeVisible();
  const dark = page.locator(".scheme").filter({ hasText: "Dark" }).locator(".lu-button").first();
  expect(await dark.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    "rgb(9, 9, 11)",
  );
});

test("the old /docs/ui URLs redirect to /ui, and the docs list the UI pages", async ({
  page,
  baseURL,
}) => {
  for (const [from, to] of [
    ["/docs/ui", "/ui/"],
    ["/docs/ui/dialog", "/ui/dialog/"],
    ["/lumiose/docs/ui/tabs", "/lumiose/ui/tabs/"],
  ] as const) {
    await page.goto(from);
    await page.waitForURL(`${baseURL}${to}`);
  }
  await page.goto("/docs/concepts/islands");
  await expect(
    page.getByRole("navigation", { name: "Docs" }).getByRole("link", { name: "Popover" }),
  ).toHaveAttribute("href", "/ui/popover/");
});

test("search finds the UI pages", async ({ page }) => {
  await page.goto("/ui/tabs");
  await expect(page.locator(".search[data-ready]")).toBeAttached();
  await page.getByRole("combobox", { name: "Search the docs" }).fill("tooltip");
  const option = page.getByRole("listbox", { name: "Search the docs" }).getByRole("option").first();
  await expect(option).toContainText("UI · Components");
  await option.click();
  await expect(page).toHaveURL(/\/ui\/tooltip/);
});

const shot = (name: string) => `../../backlog/assets/task-387-${name}.png`;

// SCREENSHOTS=1 pnpm screenshots: TASK-387's captures, in both themes.
test("ui screenshots", async ({ page }) => {
  test.skip(!process.env["SCREENSHOTS"], "Set SCREENSHOTS=1 to capture.");
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/ui/dialog");
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot(`dialog-${scheme}`) });
    await preview(page).getByRole("button", { name: "Delete project…" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: shot(`dialog-open-${scheme}`) });
    await page.goto("/ui/menu");
    await preview(page).getByRole("button", { name: "Project" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: shot(`menu-${scheme}`) });
    await page.goto("/ui/theming");
    // The two previews and the start of the table, below the sticky header.
    await page
      .locator(".palette")
      .evaluate((element) => scrollTo(0, element.getBoundingClientRect().top + scrollY - 88));
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot(`theming-${scheme}`) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/ui/tabs");
  await page.screenshot({ path: shot("phone") });
});
