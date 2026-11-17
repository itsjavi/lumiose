// The /ui section (TASK-387, TASK-614): @lumiose/ui's docs from packages/ui/docs, with live demos on
// the default theme. The index is a gallery of every component, live, each cell linking to its page;
// a component page shows its preview, then its usage beside its props. Server-rendered demos work
// without JavaScript, island demos hydrate, the site's theme toggle drives them, the site's styles
// stay out of them, and the old /docs/ui URLs redirect.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Every component page, from the Components section of the UI's llms.txt (`[Dialog](dialog.md)`),
 * so a new component is checked without an edit here.
 */
const COMPONENTS = [
  ...readFileSync(join(import.meta.dirname, "../../../packages/ui/docs/llms.txt"), "utf8")
    .split("\n## Components\n")[1]!
    .matchAll(/^- \[([^\]]+)\]\(([^)]+)\.md\)/gm),
].map(([, name, path]) => ({ name: name!, path: path! }));

/** A demo's preview: the page's first one at the top, or an example's by id (`tabs-2`). */
function preview(page: Page, id?: string) {
  return page.locator(id === undefined ? ".hero .preview" : `#demo-${id} .preview`);
}

/** A cell of the gallery, by its component's name. */
function cell(page: Page, name: string) {
  return page
    .getByRole("list", { name: "Components" })
    .getByRole("listitem")
    .filter({ has: page.getByRole("link", { name, exact: true }) });
}

test("the UI section opens on a gallery of every component, each cell linking to its page", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "UI" }).click();
  await expect(page).toHaveURL(/\/ui\/$/);
  await expect(page).toHaveTitle("Lumiose UI: accessible components on native HTML");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Components");
  expect(COMPONENTS.length).toBeGreaterThan(30);
  const cells = page.getByRole("list", { name: "Components" }).getByRole("listitem");
  // One cell per component, in the docs' order, each with a live demo and a link to its page.
  await expect(cells.locator(".foot")).toHaveText(COMPONENTS.map(({ name }) => `${name}→`));
  for (const { name, path } of COMPONENTS) {
    const item = cell(page, name);
    await expect(item.locator(".preview")).not.toBeEmpty();
    await expect(item.getByRole("link", { name, exact: true })).toHaveAttribute(
      "href",
      `/ui/${path}/`,
    );
  }
  // No component renders twice: ids stay unique on the page.
  const ids = await page.locator("[id]").evaluateAll((all) => all.map((element) => element.id));
  expect(ids.filter((id, at) => ids.indexOf(id) !== at)).toEqual([]);
  // The introduction follows the gallery, and the guides are a click away.
  await expect(page.getByRole("heading", { level: 2, name: "UI components" })).toBeVisible();
  const guides = page.getByRole("navigation", { name: "UI guides" });
  await expect(guides.getByRole("link", { name: "Introduction" })).toHaveAttribute(
    "href",
    "#introduction",
  );
  for (const name of ["Installation", "Theming"]) {
    await page.goto("/ui");
    await guides.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
  }
  await page.goto("/ui");
  await cell(page, "Dialog").getByRole("link", { name: "Dialog" }).click();
  await expect(page).toHaveURL(/\/ui\/dialog\/$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Dialog");
  // Back to the gallery from the section's navigation.
  await page
    .getByRole("navigation", { name: "UI" })
    .getByRole("link", { name: "All components" })
    .click();
  await expect(page).toHaveURL(/\/ui\/$/);
});

test("the gallery's demos are live", async ({ page }) => {
  await page.goto("/ui");
  // A server-rendered demo: the native dialog opens from its cell.
  await cell(page, "Dialog").getByRole("button", { name: "Delete project…" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Delete project?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  // A custom element: the tabs switch panels.
  const tabs = cell(page, "Tabs");
  await tabs.getByRole("tab", { name: "Password" }).click();
  await expect(tabs.getByRole("tab", { name: "Password" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  // An island: it hydrates when its cell scrolls into view, and its signal follows the click.
  const button = cell(page, "Button").getByRole("button", { name: "Save" });
  await button.scrollIntoViewIfNeeded();
  await expect(async () => {
    await button.click();
    await expect(cell(page, "Button").getByRole("button", { name: "Saving…" })).toBeVisible({
      timeout: 1000,
    });
  }).toPass();
  const toggle = cell(page, "Switch").getByRole("switch");
  const checked = await toggle.isChecked();
  await toggle.click();
  expect(await toggle.isChecked()).toBe(!checked);
});

test("a component page shows the preview first, then usage beside the props", async ({ page }) => {
  for (const { name, path } of COMPONENTS) {
    await page.goto(`/ui/${path}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(page).toHaveTitle(`${name} · Lumiose UI`);
    await expect(
      page.getByRole("navigation", { name: "UI" }).locator('a[aria-current="page"]'),
    ).toHaveText(name);
    // A live demo at the top, then the usage and the props, then the page's sections.
    await expect(preview(page)).not.toBeEmpty();
    const usage = page.locator(".two .usage");
    await expect(usage.locator("pre code")).toContainText('from "@lumiose/ui"');
    const props = page.locator(".two .props");
    await expect(props.getByRole("heading", { level: 2 })).toContainText("Props");
    expect(await props.getByRole("row").count()).toBeGreaterThan(1);
    await expect(props.getByRole("link", { name: "Every part and prop" })).toHaveAttribute(
      "href",
      "#api",
    );
    const tops = await page
      .locator(".hero, .two, #anatomy, #api")
      .evaluateAll((all) => all.map((element) => element.getBoundingClientRect().top));
    expect(tops, name).toEqual(tops.toSorted((a, b) => a - b));
    expect(tops.length, name).toBe(4);
    // Every live example sits above its code.
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

test("usage and props sit side by side on a wide screen and stack on a phone", async ({ page }) => {
  const boxes = async () => {
    const usage = (await page.locator(".two .usage").boundingBox())!;
    const props = (await page.locator(".two .props").boundingBox())!;
    return { usage, props };
  };
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/ui/tabs");
  const wide = await boxes();
  expect(wide.props.x).toBeGreaterThan(wide.usage.x + wide.usage.width);
  expect(Math.abs(wide.props.y - wide.usage.y)).toBeLessThan(4);
  await page.setViewportSize({ width: 390, height: 844 });
  const narrow = await boxes();
  expect(narrow.props.y).toBeGreaterThan(narrow.usage.y + narrow.usage.height);
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
  expect(await look()).toEqual(["rgb(255, 255, 255)", "rgb(0, 0, 0)"]);
  await page.getByRole("button", { name: /theme/i }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await look()).toEqual(["rgb(0, 0, 0)", "rgb(255, 255, 255)"]);
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
  await expect(table.getByRole("row", { name: /--lu-background #fff #000/ })).toBeVisible();
  await expect(table.getByRole("row", { name: /--lu-radius/ })).toBeVisible();
  const dark = page.locator(".scheme").filter({ hasText: "Dark" }).locator(".lu-button").first();
  expect(await dark.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    "rgb(0, 0, 0)",
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

const shot = (name: string) => `../../backlog/assets/redesign/task-614-${name}.jpg`;

// SCREENSHOTS=1 pnpm screenshots: TASK-614's captures, in both themes.
test("ui screenshots", async ({ page }) => {
  test.skip(!process.env["SCREENSHOTS"], "Set SCREENSHOTS=1 to capture.");
  await page.setViewportSize({ width: 1280, height: 900 });
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/ui");
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot(`index-${scheme}`), quality: 80 });
    await page.goto("/ui/tabs");
    await page.waitForTimeout(300);
    await page.screenshot({ path: shot(`tabs-${scheme}`), quality: 80 });
    await page.goto("/ui/dialog");
    await preview(page).getByRole("button", { name: "Delete project…" }).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: shot(`dialog-open-${scheme}`), quality: 80 });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/ui");
  await page.screenshot({ path: shot("index-phone"), quality: 80 });
  await page.goto("/ui/tabs");
  await page.screenshot({ path: shot("tabs-phone"), quality: 80 });
});
