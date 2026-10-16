// Dialog and alert dialog (TASK-355): the APG Dialog keyboard contract, focus on open and its
// return on close, roles, names and descriptions, behaviour without JavaScript, page scroll behind a
// modal, the sync with signals in an island, and WCAG 2.2 AA with the default theme (TASK-392).
import { expect, test, type Page } from "@playwright/test";
import { axe, clipped, focusRing, SCHEMES, smallTargets, TEXT_SPACING } from "./a11y.ts";

const lumioseWarnings = (page: Page) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("LUM")) warnings.push(message.text());
  });
  return warnings;
};

/** Whether focus is on the page behind the open dialog (it must stay inside or leave the page). */
const focusBehind = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement;
    const dialog = document.querySelector("dialog[open]");
    return active !== null && active !== document.body && !dialog?.contains(active);
  });

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the alert dialog opens from the server HTML and closes with Escape", async ({ page }) => {
    await page.goto("/dialog");
    const trigger = page.getByRole("button", { name: "Delete project…" });
    await trigger.click();
    const dialog = page.getByRole("alertdialog", { name: "Delete project?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleDescription(
      "This removes the project and its 12 deployments.",
    );
    // Not dismissed by a click outside: it needs an answer.
    await page.mouse.click(5, 5);
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("a dialog closes from its close button and from a click outside", async ({ page }) => {
    await page.goto("/dialog");
    const trigger = page.getByRole("button", { name: "Edit profile" });
    const dialog = page.getByRole("dialog", { name: "Edit profile" });
    await trigger.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(dialog).toBeHidden();
  });
});

test.describe("keyboard contract (APG Dialog)", () => {
  test("alert dialog: Enter opens it, Tab stays inside, Escape closes it and focus returns", async ({
    page,
  }) => {
    await page.goto("/dialog");
    expect(await axe(page)).toEqual([]);
    const trigger = page.getByRole("button", { name: "Delete project…" });
    await expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    await trigger.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("alertdialog", { name: "Delete project?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleDescription(
      "This removes the project and its 12 deployments.",
    );
    // Focus moves to the first focusable element inside.
    const cancel = dialog.getByRole("button", { name: "Cancel" });
    const remove = dialog.getByRole("button", { name: "Delete" });
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(remove).toBeFocused();
    // Past the last element focus leaves for the browser, never for the page behind (inert).
    await page.keyboard.press("Tab");
    expect(await focusBehind(page)).toBe(false);
    await page.keyboard.press("Tab");
    expect(await focusBehind(page)).toBe(false);
    await cancel.focus();
    await page.keyboard.press("Shift+Tab");
    expect(await focusBehind(page)).toBe(false);
    expect(await axe(page)).toEqual([]);

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("dialog: Space opens it on its first field; a close button returns focus", async ({
    page,
  }) => {
    await page.goto("/dialog");
    const trigger = page.getByRole("button", { name: "Edit profile" });
    await trigger.focus();
    await page.keyboard.press(" ");
    const dialog = page.getByRole("dialog", { name: "Edit profile" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Name" })).toBeFocused();
    // No Description part: the reference to it names no element, which axe accepts.
    await expect(dialog).toHaveAccessibleDescription("");
    expect(await axe(page)).toEqual([]);

    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("a drag that starts inside and ends outside does not close it", async ({ page }) => {
    // Selecting text in a field and releasing over the backdrop is not a click outside.
    await page.goto("/dialog");
    await page.getByRole("button", { name: "Edit profile" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit profile" });
    const field = dialog.getByRole("textbox", { name: "Name" });
    const box = (await field.boundingBox())!;
    await page.mouse.move(box.x + 4, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(5, 5, { steps: 5 });
    await page.mouse.up();
    await expect(dialog).toBeVisible();
    // A real click outside still closes it.
    await page.mouse.click(5, 5);
    await expect(dialog).toBeHidden();
  });

  test("a right-click outside does not close it", async ({ page }) => {
    // Base UI and Zag ignore secondary buttons (doc-9, section 1); Chromium's native light dismiss
    // does not, so Dialog's client script cancels it.
    await page.goto("/dialog");
    await page.getByRole("button", { name: "Edit profile" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit profile" });
    await page.mouse.click(5, 5, { button: "right" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("nested dialogs: Escape and a click outside close only the top one", async ({ page }) => {
    await page.goto("/dialog");
    const settingsTrigger = page.getByRole("button", { name: "Settings" });
    await settingsTrigger.click();
    const settings = page.getByRole("dialog", { name: "Settings", exact: true });
    await expect(settings).toBeVisible();
    const advancedTrigger = settings.getByRole("button", { name: "Advanced…" });
    await advancedTrigger.click();
    const advanced = page.getByRole("dialog", { name: "Advanced settings" });
    await expect(advanced).toBeVisible();
    await expect(advanced).toHaveAccessibleDescription("Opened on top of Settings.");
    await expect(advanced.getByRole("button", { name: "Done" })).toBeFocused();
    // The client script marks the parent and counts what is open inside it.
    await expect(settings).toHaveAttribute("data-nested-dialog-open");
    await expect(settings).toHaveCSS("--lu-nested-dialogs", "1");
    await expect(advanced).not.toHaveAttribute("data-nested-dialog-open");
    expect(await axe(page)).toEqual([]);

    // A press inside the child does not close the parent.
    await advanced.getByText("Opened on top of Settings.").click();
    await expect(advanced).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(advanced).toBeHidden();
    await expect(settings).toBeVisible();
    await expect(advancedTrigger).toBeFocused();
    await expect(settings).not.toHaveAttribute("data-nested-dialog-open");

    await advancedTrigger.click();
    await expect(advanced).toBeVisible();
    await page.mouse.click(5, 5);
    await expect(advanced).toBeHidden();
    await expect(settings).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(settings).toBeHidden();
    await expect(settingsTrigger).toBeFocused();
  });

  test("focus returns to another trigger when the opener is gone", async ({ page }) => {
    await page.goto("/dialog");
    const trigger = page.getByRole("button", { name: "Edit profile" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Edit profile" });
    await expect(dialog).toBeVisible();
    // Replace the trigger while the dialog is open, as a re-render might.
    await trigger.evaluate((button) => {
      const copy = button.cloneNode(true) as HTMLElement;
      copy.textContent = "Edit profile again";
      button.after(copy);
      button.remove();
    });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Edit profile again" })).toBeFocused();
  });

  test("the page behind a modal dialog does not scroll", async ({ page }) => {
    await page.goto("/dialog");
    const overflow = () =>
      page.evaluate(() => getComputedStyle(document.documentElement).overflowY);
    expect(await overflow()).not.toBe("hidden");
    await page.getByRole("button", { name: "Edit profile" }).click();
    await expect(page.getByRole("dialog", { name: "Edit profile" })).toBeVisible();
    expect(await overflow()).toBe("hidden");
    // The page had a scrollbar: its space stays, so nothing shifts.
    await expect(page.locator("html")).toHaveCSS("scrollbar-gutter", "stable");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(await overflow()).not.toBe("hidden");
  });
});

test.describe("opened by touch", () => {
  test.use({ hasTouch: true });

  test("the dialog focuses itself, not its first field", async ({ page }) => {
    // A focused field would open the virtual keyboard over the dialog (doc-9, section 2).
    await page.goto("/dialog");
    await page.getByRole("button", { name: "Edit profile" }).tap();
    const dialog = page.getByRole("dialog", { name: "Edit profile" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("textbox", { name: "Name" })).toBeFocused();
  });
});

test("a server-rendered page with dialogs loads only Dialog's client script", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
  const scripts: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
  });
  await page.goto("/dialog");
  await page.getByRole("button", { name: "Delete project…" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  // One small module, no island runtime or loader.
  expect(scripts).toEqual([expect.stringMatching(/\/dialog\.script-[\w-]+\.js$/)]);
  await expect(page.locator("script[data-l-islands]")).toHaveCount(0);
});

test.describe("in an island", () => {
  test("open and onOpenChange keep a signal in sync both ways", async ({ page }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/dialog/island");
    const state = page.getByTestId("dialog-state");
    const dialog = page.getByRole("dialog", { name: "Edit profile" });
    await expect(state).toHaveText("open: false, returned: none");

    // A signal opens it; Escape closes it and reports back; focus returns to the opener.
    const opener = page.getByTestId("open-by-signal");
    const trigger = page.getByRole("button", { name: "Edit profile" });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await opener.click();
    await expect(dialog).toBeVisible();
    await expect(state).toHaveText("open: true, returned: none");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(state).toHaveText("open: false, returned: none");
    await expect(opener).toBeFocused();

    // The trigger opens it (invoker command, no prop change) and the signal follows; a close
    // button closes it with its value as the dialog's returnValue.
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await expect(state).toHaveText("open: true, returned: none");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(state).toHaveText("open: false, returned: save");
    await expect(trigger).toBeFocused();

    // Opening again after the signal went back to false still works.
    await opener.click();
    await expect(dialog).toBeVisible();
    expect(await axe(page)).toEqual([]);
    expect(warnings).toEqual([]);
  });

  test("bind:open keeps a signal in sync both ways", async ({ page }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/dialog/island");
    const state = page.getByTestId("bind-state");
    const dialog = page.getByRole("dialog", { name: "Rename project" });
    await expect(state).toHaveText("open: false");
    await page.getByTestId("bind-open").click();
    await expect(dialog).toBeVisible();
    await expect(state).toHaveText("open: true");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(state).toHaveText("open: false");
    await page.getByRole("button", { name: "Rename project" }).click();
    await expect(state).toHaveText("open: true");
    await dialog.getByRole("button", { name: "Done" }).click();
    await expect(state).toHaveText("open: false");
    expect(warnings).toEqual([]);
  });

  test("a page without a scrollbar gets no empty gutter while locked", async ({ page }) => {
    await page.goto("/dialog/island");
    const html = page.locator("html");
    await page.getByTestId("bind-open").click();
    await expect(page.getByRole("dialog", { name: "Rename project" })).toBeVisible();
    await expect(html).toHaveCSS("overflow-y", "hidden");
    await expect(html).toHaveCSS("scrollbar-gutter", "auto");
    await page.keyboard.press("Escape");
    await expect(html).not.toHaveAttribute("style", /\S/);
  });

  test("a signal that starts true opens the dialog once the island hydrates", async ({ page }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/dialog/initial");
    const dialog = page.getByRole("dialog", { name: "Edit profile" });
    await expect(dialog).toBeVisible();
    await expect(page.getByTestId("dialog-state")).toHaveText("open: true, returned: none");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("dialog-state")).toHaveText("open: false, returned: none");
    expect(warnings).toEqual([]);
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  /** Each dialog of /dialog: how to open it and the dialog that opens. */
  const DIALOGS = [
    { trigger: "Delete project…", role: "alertdialog", name: "Delete project?" },
    { trigger: "Edit profile", role: "dialog", name: "Edit profile" },
    { trigger: "Settings", role: "dialog", name: "Settings" },
  ] as const;

  for (const scheme of SCHEMES) {
    test(`axe passes closed and open (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/dialog");
      expect(await axe(page)).toEqual([]);
      for (const { trigger, role, name } of DIALOGS) {
        await page.getByRole("button", { name: trigger }).click();
        const dialog = page.getByRole(role, { name, exact: true });
        await expect(dialog).toBeVisible();
        expect(await axe(page)).toEqual([]);
        if (name === "Settings") {
          await dialog.getByRole("button", { name: "Advanced…" }).click();
          await expect(page.getByRole("dialog", { name: "Advanced settings" })).toBeVisible();
          expect(await axe(page)).toEqual([]);
          await page.keyboard.press("Escape");
        }
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
      }

      await page.goto("/dialog/island");
      expect(await axe(page)).toEqual([]);
      await page.getByTestId("open-by-signal").click();
      await expect(page.getByRole("dialog", { name: "Edit profile" })).toBeVisible();
      expect(await axe(page)).toEqual([]);
    });
  }

  test("focus is visible on the trigger and inside the dialog (2.4.7)", async ({ page }) => {
    await page.goto("/dialog");
    await page.getByRole("button", { name: "Edit profile" }).focus();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Shift+Tab");
    expect(await focusRing(page)).toBe("2px solid");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();
    expect(await focusRing(page)).toBe("2px solid");
  });

  test("targets are at least 24 by 24 CSS pixels (2.5.8)", async ({ page }) => {
    await page.goto("/dialog");
    expect(await smallTargets(page.locator("main"))).toEqual([]);
    for (const { trigger, role, name } of DIALOGS) {
      await page.getByRole("button", { name: trigger }).click();
      const dialog = page.getByRole(role, { name, exact: true });
      expect(await smallTargets(dialog)).toEqual([]);
      await page.keyboard.press("Escape");
    }
  });

  test("dialogs reflow at 320 CSS pixels and survive text spacing (1.4.10, 1.4.12)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/dialog");
    await page.addStyleTag({ content: TEXT_SPACING });
    for (const { trigger, role, name } of DIALOGS) {
      await page.getByRole("button", { name: trigger }).click();
      const dialog = page.getByRole(role, { name, exact: true });
      await expect(dialog).toBeVisible();
      // Inside the viewport, no horizontal scrolling, nothing cut off.
      const box = (await dialog.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
      expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
        true,
      );
      expect(await clipped(dialog)).toEqual([]);
      for (const button of await dialog.getByRole("button").all()) {
        await expect(button).toBeInViewport();
      }
      await page.keyboard.press("Escape");
    }
  });
});

test("a dialog's first tab stop takes focus, not a scroller or a title (TASK-453 L29)", async ({
  page,
}) => {
  await page.goto("/dialog");
  await page.getByRole("button", { name: "Terms" }).click();
  const dialog = page.getByRole("dialog", { name: "Terms of use" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Agree" })).toBeFocused();
});

test("a dialog with autofocus takes focus itself (TASK-453 L31)", async ({ page }) => {
  await page.goto("/dialog");
  await page.getByRole("button", { name: "Notice" }).click();
  await expect(page.getByRole("dialog", { name: "Maintenance tonight" })).toBeFocused();
});
