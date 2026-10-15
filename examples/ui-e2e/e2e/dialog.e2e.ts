// Dialog and alert dialog (TASK-355): the APG Dialog keyboard contract, focus on open and its
// return on close, roles, names and descriptions, axe, behaviour without JavaScript, page scroll
// behind a modal, and the sync with signals in an island.
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const axe = async (page: Page) => {
  const results = await new AxeBuilder({ page }).analyze();
  return results.violations.map((violation) => `${violation.id}: ${violation.nodes.length}`);
};

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

  test("the page behind a modal dialog does not scroll", async ({ page }) => {
    await page.goto("/dialog");
    const overflow = () =>
      page.evaluate(() => getComputedStyle(document.documentElement).overflowY);
    expect(await overflow()).not.toBe("hidden");
    await page.getByRole("button", { name: "Edit profile" }).click();
    await expect(page.getByRole("dialog", { name: "Edit profile" })).toBeVisible();
    expect(await overflow()).toBe("hidden");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(await overflow()).not.toBe("hidden");
  });
});

test("a server-rendered page with dialogs loads no JavaScript for them", async ({
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
  expect(scripts).toEqual([]);
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
    await opener.click();
    await expect(dialog).toBeVisible();
    await expect(state).toHaveText("open: true, returned: none");
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(state).toHaveText("open: false, returned: none");
    await expect(opener).toBeFocused();

    // The trigger opens it (invoker command, no prop change) and the signal follows; a close
    // button closes it with its value as the dialog's returnValue.
    const trigger = page.getByRole("button", { name: "Edit profile" });
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
