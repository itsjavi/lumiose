// Toolbar (TASK-383): `role="toolbar"` with one tab stop across its items (toggles of a toggle
// group, buttons, a menu trigger, a link, an input), the arrow keys along the orientation
// (swapped right to left), Home and End, looping or not, a text field keeping its caret's keys,
// disabled items that stay focusable and do nothing, the sync with signals in an island, and WCAG
// 2.2 AA with the default theme (doc-9 sections 1, 5, 13 and 17; APG toolbar).
import { expect, test, type Page } from "@playwright/test";
import {
  axe,
  clipped,
  focusRing,
  lastNavLink,
  SCHEMES,
  smallTargets,
  TEXT_SPACING,
} from "./a11y.ts";

/** Lumiose's console warnings (LUM codes), such as a hydration that fell back to rendering. */
const lumioseWarnings = (page: Page) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("LUM")) warnings.push(message.text());
  });
  return warnings;
};

const toolbar = (page: Page, name: string) => page.getByRole("toolbar", { name });
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

/** /toolbar with its script running: the menu trigger, rendered by Menu, gets tabindex -1. */
async function ready(page: Page) {
  await page.goto("/toolbar");
  await expect(button(page, "Insert")).toHaveAttribute("tabindex", "-1");
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the server HTML is a labelled toolbar whose items are all reachable (TASK-437 M12)", async ({
    page,
  }) => {
    await page.goto("/toolbar");
    const formatting = toolbar(page, "Formatting");
    await expect(formatting).toHaveAttribute("aria-orientation", "horizontal");
    // Tab goes through every item: the script makes them one tab stop.
    await lastNavLink(page).focus();
    for (const name of ["Bold", "Italic", "Undo", "Redo", "Insert"]) {
      await page.keyboard.press("Tab");
      await expect(button(page, name)).toBeFocused();
    }
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Help" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("textbox", { name: "Font size" })).toBeFocused();
  });

  test("a disabled toolbar's triggers open nothing (TASK-437 M13)", async ({ page }) => {
    await page.goto("/toolbar");
    for (const name of ["Fonts", "Share"]) {
      await expect(button(page, name)).toHaveAttribute("aria-disabled", "true");
      await button(page, name).click({ force: true });
    }
    await expect(page.getByRole("dialog", { name: "Fonts" })).toBeHidden();
    await expect(page.getByRole("menu", { name: "Share" })).toBeHidden();
  });
});

test.describe("Toolbar", () => {
  test("one tab stop; the arrows, Home and End move through every item and loop", async ({
    page,
  }) => {
    // A page that does not scroll: on macOS, Home and End scroll a page that does, rather than
    // move a text field's caret.
    await page.setViewportSize({ width: 1280, height: 1200 });
    await ready(page);
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    await expect(button(page, "Bold")).toBeFocused();
    const order = ["Italic", "Undo", "Redo", "Insert"];
    for (const name of order) {
      await page.keyboard.press("ArrowRight");
      await expect(button(page, name)).toBeFocused();
    }
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("link", { name: "Help" })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    const size = page.getByRole("textbox", { name: "Font size" });
    await expect(size).toBeFocused();
    // The text field keeps its caret's keys: End moves the caret, then Right leaves at the end.
    await page.keyboard.press("End");
    await expect(size).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(button(page, "Bold")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(size).toBeFocused();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByRole("link", { name: "Help" })).toBeFocused();
    await page.keyboard.press("Home");
    await expect(button(page, "Bold")).toBeFocused();
    await page.keyboard.press("End");
    await expect(size).toBeFocused();
    // Tab leaves the toolbar, Shift+Tab comes back to the last focused item.
    await page.keyboard.press("Tab");
    await expect(button(page, "After the toolbar")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(size).toBeFocused();
  });

  test("the items act: a toggle presses, a disabled button does nothing, a menu opens", async ({
    page,
  }) => {
    await ready(page);
    await button(page, "Italic").focus();
    await page.keyboard.press(" ");
    await expect(button(page, "Italic")).toHaveAttribute("aria-pressed", "true");
    // A toggle group in a toolbar leaves its arrow keys to the toolbar.
    await page.keyboard.press("ArrowRight");
    await expect(button(page, "Undo")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    const redo = button(page, "Redo");
    await expect(redo).toBeFocused();
    await expect(redo).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: "Image" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(button(page, "Insert")).toBeFocused();
  });

  test("the tab stop moves on when its item goes or is disabled (TASK-437 M11)", async ({
    page,
  }) => {
    await ready(page);
    const after = button(page, "After the toolbar");
    // Undo is the stop: it goes.
    await button(page, "Undo").focus();
    await after.focus();
    await button(page, "Undo").evaluate((item) => item.remove());
    await page.keyboard.press("Shift+Tab");
    await expect(button(page, "Bold")).toBeFocused();
    // Bold, the stop now, is disabled.
    await after.focus();
    await button(page, "Bold").evaluate((item) => ((item as HTMLButtonElement).disabled = true));
    await page.keyboard.press("Shift+Tab");
    await expect(button(page, "Italic")).toBeFocused();
  });

  test("disabled reaches the toggles and the triggers, which stay focusable (TASK-437 M13)", async ({
    page,
  }) => {
    await ready(page);
    const [strong, fonts, share] = ["Strong", "Fonts", "Share"].map((name) => button(page, name));
    for (const item of [strong, fonts, share]) {
      await expect(item).toHaveAttribute("aria-disabled", "true");
    }
    // `force`: Playwright does not click an `aria-disabled` element otherwise.
    await strong.click({ force: true });
    await expect(strong).toHaveAttribute("aria-pressed", "false");
    await fonts.click({ force: true });
    await expect(page.getByRole("dialog", { name: "Fonts" })).toBeHidden();
    await share.click({ force: true });
    await expect(page.getByRole("menu", { name: "Share" })).toBeHidden();
    // The keys: Space and Enter press and open nothing; the arrows still move.
    await strong.focus();
    await page.keyboard.press(" ");
    await expect(strong).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("ArrowRight");
    await expect(fonts).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog", { name: "Fonts" })).toBeHidden();
    await page.keyboard.press("ArrowRight");
    await expect(share).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu", { name: "Share" })).toBeHidden();
    await expect(share).toBeFocused();
  });

  test("vertical with a menu: Down moves on, Right opens the menu beside it (TASK-437 M14)", async ({
    page,
  }) => {
    await ready(page);
    const arrange = button(page, "Arrange");
    const menu = page.getByRole("menu", { name: "Arrange" });
    await button(page, "Square").focus();
    await page.keyboard.press("ArrowDown");
    await expect(arrange).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(button(page, "Circle")).toBeFocused();
    await expect(menu).toBeHidden();
    await page.keyboard.press("ArrowUp");
    await expect(arrange).toBeFocused();
    await expect(menu).toBeHidden();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("menuitem", { name: "Bring forward" })).toBeFocused();
    // Beside the toolbar, at its inline end.
    const [popup, trigger] = [(await menu.boundingBox())!, (await arrange.boundingBox())!];
    expect(popup.x).toBeGreaterThanOrEqual(trigger.x + trigger.width - 1);
    await page.keyboard.press("Escape");
    await expect(arrange).toBeFocused();
  });

  test("vertical, right to left, without loop: Up and Down move and stop at the ends", async ({
    page,
  }) => {
    await ready(page);
    await button(page, "Start").focus();
    await page.keyboard.press("ArrowUp");
    await expect(button(page, "Start")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(button(page, "Start")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(button(page, "Center")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(button(page, "End")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(button(page, "End")).toBeFocused();
  });
});

test.describe("in an island", () => {
  test("a toggle group and a soft-disabled button drive signals", async ({ page }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/toolbar/island");
    const state = page.getByTestId("toolbar-state");
    await expect(async () => {
      await button(page, "Right").click({ timeout: 250 });
      await expect(state).toHaveText("align: right, saves: 0", { timeout: 250 });
    }).toPass();
    await button(page, "Save").click();
    await expect(state).toHaveText("align: right, saves: 1");
    await expect(button(page, "Save")).toHaveAttribute("aria-disabled", "true");
    await expect(button(page, "Save")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(state).toHaveText("align: right, saves: 1");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByTestId("done")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(button(page, "Save")).not.toHaveAttribute("aria-disabled");
    expect(warnings).toEqual([]);
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes on the page and the island (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await ready(page);
      expect(await axe(page)).toEqual([]);
      await page.goto("/toolbar/island");
      expect(await axe(page)).toEqual([]);
    });
  }

  test("focus is visible on every item (2.4.7), and targets are 24px (2.5.8)", async ({ page }) => {
    await ready(page);
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    for (let i = 0; i < 7; i++) {
      expect(await focusRing(page)).toBe("2px solid");
      await page.keyboard.press("ArrowRight");
    }
    expect(await smallTargets(toolbar(page, "Formatting"))).toEqual([]);
  });

  test("the toolbar reflows at 320 CSS pixels with text spacing (1.4.10, 1.4.12)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await ready(page);
    await page.addStyleTag({ content: TEXT_SPACING });
    const formatting = toolbar(page, "Formatting");
    const box = (await formatting.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(await clipped(formatting)).toEqual([]);
  });

  test("a server-rendered page loads the items' scripts and their shared modules only", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
    });
    await ready(page);
    await page.waitForLoadState("networkidle");
    expect(scripts).toContainEqual(expect.stringMatching(/\/toolbar\.script-[\w-]+\.js$/));
    for (const script of scripts) {
      expect(script).toMatch(
        /\/(toolbar\.script|toggle-group\.script|button\.script|menu\.script|popover\.script|dialog\.script|layer|place|hover)-[\w-]+\.js$/,
      );
    }
  });
});
