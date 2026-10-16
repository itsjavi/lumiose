// Tabs (TASK-359): the APG tabs pattern in both activation modes (roles, states, the roving tab
// stop, arrow keys, Home and End, looping, orientation, right-to-left), disabled tabs and the
// fallbacks of doc-9 §8, the server HTML without JavaScript, the sync with signals in an island,
// and WCAG 2.2 AA with the default theme.
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  axe,
  clipped,
  focusRing,
  lastNavLink,
  SCHEMES,
  smallTargets,
  TEXT_SPACING,
} from "./a11y.ts";

const root = (page: Page, id: string) => page.getByTestId(id);
const tab = (scope: Locator, name: string) => scope.getByRole("tab", { name, exact: true });

/** The selected tab's name and the visible panel's text. */
async function state(scope: Locator) {
  const selected = scope.getByRole("tab", { selected: true });
  const count = await selected.count();
  return {
    tab: count ? await selected.textContent() : null,
    panel: (await scope.getByRole("tabpanel").textContent())?.trim() ?? null,
  };
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the server HTML holds the roles, the selection and the tab stop", async ({ page }) => {
    await page.goto("/tabs");
    const manual = root(page, "manual");
    const list = manual.getByRole("tablist", { name: "Account settings" });
    await expect(list).not.toHaveAttribute("aria-orientation");
    const password = tab(manual, "Password");
    await expect(password).toHaveAttribute("aria-selected", "true");
    await expect(password).toHaveAttribute("tabindex", "0");
    await expect(tab(manual, "Account")).toHaveAttribute("tabindex", "-1");
    await expect(tab(manual, "Billing")).toHaveAttribute("aria-disabled", "true");
    // Only the selected tab's panel shows; it is labelled by its tab and focusable.
    const panel = manual.getByRole("tabpanel");
    await expect(panel).toHaveCount(1);
    await expect(panel).toHaveAccessibleName("Password");
    await expect(panel).toHaveAttribute("tabindex", "0");
    await expect(password).toHaveAttribute("aria-controls", (await panel.getAttribute("id"))!);
    // Without a value, the first enabled tab is selected.
    await expect(tab(root(page, "vertical"), "Usage")).toHaveAttribute("aria-selected", "true");
    await expect(root(page, "vertical").getByRole("tablist")).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
  });

  test("one tab stop when the first tab is disabled (TASK-437 M17)", async ({ page }) => {
    await page.goto("/tabs");
    const vertical = root(page, "vertical");
    await expect(vertical.locator("[role=tab][tabindex='0']")).toHaveCount(1);
    await expect(tab(vertical, "Usage")).toHaveAttribute("tabindex", "0");
  });
});

test.describe("keyboard contract (APG Tabs)", () => {
  test("one tab stop when the first tab is disabled (TASK-437 M17)", async ({ page }) => {
    await page.goto("/tabs");
    await page.waitForFunction(() => customElements.get("lu-tabs"));
    const vertical = root(page, "vertical");
    await expect(vertical.locator("[role=tab][tabindex='0']")).toHaveCount(1);
    // Shift+Tab from the panel comes to Usage, and from there leaves the list.
    await vertical.getByRole("tabpanel").focus();
    await page.keyboard.press("Shift+Tab");
    await expect(tab(vertical, "Usage")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(tab(vertical, "Intro")).not.toBeFocused();
    expect(await vertical.evaluate((element) => element.contains(document.activeElement))).toBe(
      false,
    );
  });

  test("manual: arrows move focus, Enter or Space selects, Tab goes to the panel", async ({
    page,
  }) => {
    await page.goto("/tabs");
    const manual = root(page, "manual");
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    // Tab enters the list on the selected tab.
    await expect(tab(manual, "Password")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    // Disabled tabs take focus but are not selected.
    await expect(tab(manual, "Billing")).toBeFocused();
    await page.keyboard.press("Enter");
    expect(await state(manual)).toEqual({ tab: "Password", panel: "Change your password. Help" });
    await page.keyboard.press("ArrowRight");
    await expect(tab(manual, "Team")).toBeFocused();
    expect((await state(manual)).tab).toBe("Password");
    await page.keyboard.press("Enter");
    expect(await state(manual)).toEqual({ tab: "Team", panel: "Who can see this project." });
    await expect(tab(manual, "Team")).toHaveAttribute("tabindex", "0");
    await expect(tab(manual, "Password")).toHaveAttribute("tabindex", "-1");
    // Looping: from the last tab to the first.
    await page.keyboard.press("ArrowRight");
    await expect(tab(manual, "Account")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(tab(manual, "Team")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(tab(manual, "Account")).toBeFocused();
    await page.keyboard.press(" ");
    expect((await state(manual)).tab).toBe("Account");
    await page.keyboard.press("End");
    await expect(tab(manual, "Team")).toBeFocused();
    // Tab leaves the list for the panel.
    await page.keyboard.press("Tab");
    await expect(manual.getByRole("tabpanel")).toBeFocused();
  });

  test("automatic: focus selects; no looping at the ends", async ({ page }) => {
    await page.goto("/tabs");
    const automatic = root(page, "automatic");
    await tab(automatic, "Day").focus();
    expect((await state(automatic)).tab).toBe("Day");
    await page.keyboard.press("ArrowRight");
    expect(await state(automatic)).toEqual({ tab: "Week", panel: "This week's numbers." });
    await page.keyboard.press("End");
    expect((await state(automatic)).tab).toBe("Month");
    await page.keyboard.press("ArrowRight");
    await expect(tab(automatic, "Month")).toBeFocused();
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowLeft");
    await expect(tab(automatic, "Day")).toBeFocused();
    expect((await state(automatic)).tab).toBe("Day");
  });

  test("vertical: up and down move, left and right do not", async ({ page }) => {
    await page.goto("/tabs");
    const vertical = root(page, "vertical");
    await tab(vertical, "Usage").focus();
    await page.keyboard.press("ArrowRight");
    await expect(tab(vertical, "Usage")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(tab(vertical, "API")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(tab(vertical, "Intro")).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(tab(vertical, "API")).toBeFocused();
  });

  test("right-to-left swaps the horizontal arrows", async ({ page }) => {
    await page.goto("/tabs");
    await page.evaluate(() => (document.documentElement.dir = "rtl"));
    const manual = root(page, "manual");
    await tab(manual, "Password").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(tab(manual, "Billing")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(tab(manual, "Password")).toBeFocused();
  });

  test("a click selects; a right-click or a disabled tab does not", async ({ page }) => {
    await page.goto("/tabs");
    const manual = root(page, "manual");
    await tab(manual, "Account").click();
    expect((await state(manual)).tab).toBe("Account");
    await tab(manual, "Team").click({ button: "right" });
    expect((await state(manual)).tab).toBe("Account");
    // Playwright waits for an aria-disabled element to be enabled: force the click.
    await tab(manual, "Billing").click({ force: true });
    expect((await state(manual)).tab).toBe("Account");
  });

  test("with every tab disabled none is selected, and the first is the tab stop", async ({
    page,
  }) => {
    await page.goto("/tabs");
    const none = root(page, "none");
    await expect(none.getByRole("tab", { selected: true })).toHaveCount(0);
    await expect(none.getByRole("tabpanel")).toHaveCount(0);
    await expect(tab(none, "One")).toHaveAttribute("tabindex", "0");
    await tab(none, "One").click({ force: true });
    await expect(none.getByRole("tab", { selected: true })).toHaveCount(0);
  });
});

test.describe("in an island", () => {
  test("bind:value keeps a signal in sync both ways", async ({ page }) => {
    await page.goto("/tabs/island");
    const island = page.locator("lu-tabs");
    const output = page.getByTestId("tab-state");
    await expect(output).toHaveText("tab: overview");
    await tab(island, "Activity").click();
    await expect(output).toHaveText("tab: activity");
    expect(await state(island)).toEqual({ tab: "Activity", panel: "What happened lately." });
    await page.getByTestId("show-settings").click();
    expect(await state(island)).toEqual({
      tab: "Settings",
      panel: "Name, visibility and members.",
    });
    await tab(island, "Settings").focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Enter");
    await expect(output).toHaveText("tab: activity");
  });

  test("a selected tab that becomes disabled gives its place to the first enabled", async ({
    page,
  }) => {
    await page.goto("/tabs/island");
    const island = page.locator("lu-tabs");
    await tab(island, "Activity").click();
    await page.getByTestId("lock-activity").click();
    await expect(tab(island, "Activity")).toHaveAttribute("aria-disabled", "true");
    expect(await state(island)).toEqual({ tab: "Overview", panel: "The project at a glance." });
  });
});

/**
 * How far the indicator's box is from the selected tab's: left, top, width and height, in whole
 * pixels. `[0, 0, 0, 0]` when it covers the tab.
 */
async function offset(scope: Locator) {
  return scope.evaluate((el) => {
    const box = (selector: string) => el.querySelector(selector)!.getBoundingClientRect();
    const indicator = box("[data-indicator]");
    const selected = box('[role="tab"][aria-selected="true"]');
    return [
      indicator.left - selected.left,
      indicator.top - selected.top,
      indicator.width - selected.width,
      indicator.height - selected.height,
    ].map((each) => Math.round(each) || 0);
  });
}

/** Waits until the indicator covers the selected tab: it slides there in 0.2s. */
const covers = (scope: Locator) => expect.poll(() => offset(scope)).toEqual([0, 0, 0, 0]);

test.describe("Tabs.Indicator (TASK-395, doc-9 section 8)", () => {
  test.describe("without JavaScript", () => {
    test.use({ javaScriptEnabled: false });

    test("CSS anchor positioning puts it on the selected tab from the server HTML", async ({
      page,
    }) => {
      await page.goto("/tabs");
      for (const id of ["indicator", "indicator-vertical"]) {
        expect(await offset(root(page, id))).toEqual([0, 0, 0, 0]);
      }
      const bar = await root(page, "indicator")
        .locator("[data-indicator]")
        .evaluate((el) => getComputedStyle(el).borderBottomWidth);
      expect(bar).toBe("2px");
    });
  });

  test("it is in place on load: no layout shift when the script takes over", async ({ page }) => {
    await page.addInitScript(() => {
      const shifts: number[] = [];
      Object.assign(window, { shifts });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as {
          value: number;
          sources: { node?: Node }[];
        }[]) {
          if (
            entry.sources.some((source) => (source.node as Element)?.matches?.("[data-indicator]"))
          )
            shifts.push(entry.value);
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/tabs");
    const scope = root(page, "indicator");
    await expect(scope).toHaveJSProperty("value", "changelog");
    await expect(scope).toHaveCSS("--lu-tabs-indicator-width", /px$/);
    expect(await offset(scope)).toEqual([0, 0, 0, 0]);
    // The tab's own bar gives way to the indicator once the script runs.
    await expect(tab(scope, "Full changelog")).toHaveCSS("box-shadow", "none");
    await page.evaluate(() => new Promise(requestAnimationFrame));
    expect(await page.evaluate(() => (window as unknown as { shifts: number[] }).shifts)).toEqual(
      [],
    );
  });

  test("it follows a click, the keys and a resize, in both orientations", async ({ page }) => {
    await page.goto("/tabs");
    const scope = root(page, "indicator");
    await expect(scope).toHaveJSProperty("value", "changelog");
    await tab(scope, "Docs").click();
    await covers(scope);
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Enter");
    await expect(tab(scope, "Notes")).toHaveAttribute("aria-selected", "true");
    await covers(scope);
    await tab(scope, "Notes").evaluate((el) => (el.textContent = "Release notes"));
    await covers(scope);
    const vertical = root(page, "indicator-vertical");
    await tab(vertical, "Step one").click();
    await covers(vertical);
    const side = await vertical
      .locator("[data-indicator]")
      .evaluate((el) => [
        getComputedStyle(el).borderRightWidth,
        getComputedStyle(el).borderBottomWidth,
      ]);
    expect(side).toEqual(["2px", "0px"]);
  });

  test("it follows a selection an island renders", async ({ page }) => {
    await page.goto("/tabs/island");
    const island = page.locator("lu-tabs");
    await expect(page.getByTestId("tab-state")).toHaveText("tab: overview");
    await covers(island);
    await page.getByTestId("show-settings").click();
    await expect(tab(island, "Settings")).toHaveAttribute("aria-selected", "true");
    await covers(island);
  });

  test("right to left, the tabs and the indicator mirror", async ({ page }) => {
    await page.goto("/tabs");
    const scope = root(page, "indicator");
    await expect(scope).toHaveJSProperty("value", "changelog");
    await page.evaluate(() => (document.documentElement.dir = "rtl"));
    // The tabs move: the indicator follows them.
    await covers(scope);
    await tab(scope, "Notes").click();
    await covers(scope);
    const notes = (await tab(scope, "Notes").boundingBox())!;
    const docs = (await tab(scope, "Docs").boundingBox())!;
    expect(notes.x).toBeGreaterThan(docs.x);
    const vertical = root(page, "indicator-vertical");
    await tab(vertical, "Step one").click();
    await covers(vertical);
    const side = await vertical
      .locator("[data-indicator]")
      .evaluate((el) => [
        getComputedStyle(el).borderLeftWidth,
        getComputedStyle(el).borderRightWidth,
      ]);
    expect(side).toEqual(["2px", "0px"]);
  });
});

test("a server-rendered page with tabs loads only the element's script", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
  const scripts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
  });
  await page.goto("/tabs");
  await tab(root(page, "manual"), "Account").click();
  expect((await state(root(page, "manual"))).tab).toBe("Account");
  expect(scripts).toEqual([expect.stringMatching(/\/tabs\.script-[\w-]+\.js$/)]);
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes with each tab selected (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/tabs");
      expect(await axe(page)).toEqual([]);
      const manual = root(page, "manual");
      for (const name of ["Account", "Team"]) {
        await tab(manual, name).click();
        expect(await axe(page)).toEqual([]);
      }
      await page.goto("/tabs/island");
      expect(await axe(page)).toEqual([]);
    });
  }

  test("focus is visible on tabs and panels; targets are large enough (2.4.7, 2.5.8)", async ({
    page,
  }) => {
    await page.goto("/tabs");
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    expect(await focusRing(page)).toBe("2px solid");
    // A disabled tab takes focus: its ring is not faded with it (1.4.11).
    await page.keyboard.press("ArrowRight");
    await expect(tab(root(page, "manual"), "Billing")).toBeFocused();
    expect(await focusRing(page)).toBe("2px solid");
    expect(await page.evaluate(() => getComputedStyle(document.activeElement!).opacity)).toBe("1");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Tab");
    await expect(root(page, "manual").getByRole("tabpanel")).toBeFocused();
    expect(await focusRing(page)).toBe("2px solid");
    expect(await smallTargets(page.locator("main"))).toEqual([]);
  });

  test("tabs reflow at 320 CSS pixels and survive text spacing (1.4.10, 1.4.12)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/tabs");
    await page.addStyleTag({ content: TEXT_SPACING });
    for (const id of ["manual", "automatic", "vertical", "indicator"]) {
      const scope = root(page, id);
      expect(await clipped(scope)).toEqual([]);
      const box = (await scope.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(320);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      320,
    );
  });
});

test.describe("right to left, in the production CSS too (TASK-385)", () => {
  test("a vertical list marks the selected tab on its inline end: the left", async ({ page }) => {
    await page.goto("/tabs");
    await page.evaluate(() => (document.documentElement.dir = "rtl"));
    const vertical = root(page, "vertical");
    const selected = vertical.locator('[role="tab"][aria-selected="true"]');
    const sides = await selected.evaluate((el) => {
      const style = getComputedStyle(el);
      return [style.borderLeftWidth, style.borderLeftColor === style.color, style.borderRightWidth];
    });
    expect(sides).toEqual(["2px", true, "0px"]);
  });
});
