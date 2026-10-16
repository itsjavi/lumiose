// Field, Fieldset, Form, Input, Checkbox, Checkbox Group, Radio Group and Switch (TASK-365 to
// TASK-368): native controls that submit, reset and validate without JavaScript; Field's script
// showing validation in the fields (timing, messages, focus, aria-invalid and aria-describedby);
// server errors from a form action; the parent checkbox, indeterminate and read-only; radio and
// switch semantics; the sync with signals in an island; and WCAG 2.2 AA with the default theme
// (doc-9 sections 1, 10 to 12, 15 and 17).
import { expect, test, type Page } from "@playwright/test";
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

const lumioseWarnings = (page: Page) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("LUM")) warnings.push(message.text());
  });
  return warnings;
};

const username = (page: Page) => page.getByRole("textbox", { name: "Username" });
const email = (page: Page) => page.getByRole("textbox", { name: "Email" });
const submitButton = (page: Page) => page.getByRole("button", { name: "Sign up" });

/** The /form page, with Field's script running (it links the descriptions). */
async function ready(page: Page) {
  await page.goto("/form");
  await expect(username(page)).toHaveAccessibleDescription(/At least 3 characters/);
}

/**
 * Waits for /form/island to hydrate: its "Set every signal" button answers. The server HTML
 * already shows the same values, so nothing else tells.
 */
async function hydrated(page: Page) {
  const handle = page.getByRole("textbox", { name: "Handle" });
  await expect(async () => {
    await page.getByTestId("set-signals").click();
    await expect(handle).toHaveValue("grace", { timeout: 250 });
  }).toPass();
}

/** Fills every required control with valid values. */
async function fillValid(page: Page, name = "ada") {
  await username(page).fill(name);
  await email(page).fill("ada@example.com");
  await page.getByRole("radio", { name: "Small" }).check();
  await page.getByRole("checkbox", { name: "I accept the terms" }).check();
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the browser validates, the form submits, and the server's errors come back", async ({
    page,
  }) => {
    await page.goto("/form");
    // The browser's own validation blocks the empty form.
    await submitButton(page).click();
    await expect(page).toHaveURL(/\/form$/);
    expect(
      await username(page).evaluate((el) => (el as HTMLInputElement).validity.valueMissing),
    ).toBe(true);

    await fillValid(page, "taken");
    await submitButton(page).click();
    const error = page.getByText("That username is taken.");
    await expect(error).toBeVisible();
    await expect(username(page)).toHaveAttribute("aria-invalid", "true");
    await expect.poll(() => axDescription(username(page))).toMatch(/That username is taken\./);

    await fillValid(page);
    await submitButton(page).click();
    const saved = page.getByTestId("saved");
    await expect(saved).toContainText("username=ada");
    await expect(saved).toContainText("toppings=cheese");
    await expect(saved).toContainText("size=s");
    await expect(saved).toContainText("locked=on");
    // Disabled controls and the parent checkbox are not submitted.
    await expect(saved).not.toContainText("disabled-switch");
  });
});

test.describe("Field and Form", () => {
  test("a submit attempt shows each problem in its field and focuses the first", async ({
    page,
  }) => {
    await ready(page);
    await submitButton(page).click();
    await expect(page).toHaveURL(/\/form$/);
    await expect(username(page)).toBeFocused();
    await expect(username(page)).toHaveAttribute("aria-invalid", "true");
    await expect
      .poll(() => axDescription(username(page)))
      .toMatch(/At least 3 characters.*(fill out|fill in)/i);
    await expect.poll(() => axDescription(email(page))).toBe("Enter your email.");
    await expect(page.getByText("Enter an email like ada@example.com.")).toBeHidden();
    await expect(page.getByText("Choose a size.")).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Size" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(page.getByRole("checkbox", { name: "I accept the terms" })).toHaveAttribute(
      "aria-invalid",
      "true",
    );

    // Once shown, errors follow the value.
    await username(page).fill("ab");
    await expect.poll(() => axDescription(username(page))).toMatch(/lengthen|at least 3/i);
    await username(page).fill("abc");
    await expect(username(page)).not.toHaveAttribute("aria-invalid");
    await expect
      .poll(() => axDescription(username(page)))
      .toBe('At least 3 characters. Try "taken".');
    await email(page).fill("ada");
    await expect
      .poll(() => axDescription(email(page)))
      .toBe("Enter an email like ada@example.com.");
  });

  test('validationMode="onBlur" shows an error when the field is left, a missing value once edited', async ({
    page,
  }) => {
    await ready(page);
    await email(page).focus();
    await page.keyboard.press("Tab");
    await expect(email(page)).not.toHaveAttribute("aria-invalid");
    await email(page).fill("ada");
    await page.keyboard.press("Tab");
    await expect(email(page)).toHaveAttribute("aria-invalid", "true");
    await expect
      .poll(() => axDescription(email(page)))
      .toBe("Enter an email like ada@example.com.");
    // The default mode waits for a submit attempt.
    await username(page).fill("a");
    await page.keyboard.press("Tab");
    await expect(username(page)).not.toHaveAttribute("aria-invalid");
  });

  test("a server error shows in its field and goes away when the value changes", async ({
    page,
  }) => {
    await ready(page);
    await fillValid(page, "taken");
    await submitButton(page).click();
    await expect(page.getByText("That username is taken.")).toBeVisible();
    await expect(username(page)).toHaveAttribute("aria-invalid", "true");
    await expect.poll(() => axDescription(username(page))).toMatch(/That username is taken\./);
    await username(page).fill("ada");
    await expect(page.getByText("That username is taken.")).toBeHidden();
    await expect(username(page)).not.toHaveAttribute("aria-invalid");
  });

  test("a valid form submits every value, and reset restores the defaults and clears errors", async ({
    page,
  }) => {
    await ready(page);
    await submitButton(page).click();
    await expect(page.getByText("Choose a size.")).toBeVisible();
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByText("Choose a size.")).toBeHidden();
    await expect(username(page)).not.toHaveAttribute("aria-invalid");

    await fillValid(page);
    await page.getByLabel("Plan").selectOption("free");
    await submitButton(page).click();
    const saved = page.getByTestId("saved");
    await expect(saved).toContainText("username=ada");
    await expect(saved).toContainText("email=ada%40example.com");
    await expect(saved).toContainText("plan=free");
    await expect(saved).toContainText("newsletter=on");
    await expect(saved).toContainText("terms=on");
    await expect(saved).not.toContainText("disabled-switch");
  });
});

test.describe("Checkbox, Checkbox Group, Radio Group and Switch", () => {
  test("Space toggles a checkbox and a switch; a label click does too; Enter does not", async ({
    page,
  }) => {
    await ready(page);
    const terms = page.getByRole("checkbox", { name: "I accept the terms" });
    await terms.focus();
    await page.keyboard.press(" ");
    await expect(terms).toBeChecked();
    await page.getByText("I accept the terms").click();
    await expect(terms).not.toBeChecked();
    const newsletter = page.getByRole("switch", { name: "Newsletter" });
    await expect(newsletter).toBeChecked();
    await newsletter.focus();
    await page.keyboard.press(" ");
    await expect(newsletter).not.toBeChecked();
    await page.keyboard.press("Enter");
    await expect(newsletter).not.toBeChecked();
    await expect(page.getByRole("switch", { name: "Off for now" })).toBeDisabled();
  });

  test("indeterminate from the server, and read-only", async ({ page }) => {
    await ready(page);
    const beta = page.getByRole("checkbox", { name: "Beta features" });
    await expect(beta).toBeChecked({ indeterminate: true });
    await beta.click();
    await expect(beta).toBeChecked();
    const locked = page.getByRole("checkbox", { name: "Locked setting" });
    await expect(locked).toHaveAttribute("aria-readonly", "true");
    await locked.click();
    await locked.press(" ");
    await page.getByText("Locked setting").click();
    await expect(locked).toBeChecked();

    // A read-only radio group: focus moves, the checked radio does not change.
    const region = page.getByRole("radiogroup", { name: "Region (locked)" });
    await expect(region).toHaveAttribute("aria-readonly", "true");
    await region.getByRole("radio", { name: "Europe" }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(region.getByRole("radio", { name: "Europe" })).toBeChecked();
    await region.getByRole("radio", { name: "Americas" }).click();
    await expect(region.getByRole("radio", { name: "Europe" })).toBeChecked();
  });

  test("the parent checkbox checks the group and follows it", async ({ page }) => {
    await ready(page);
    const group = page.getByRole("group", { name: "Toppings" });
    const all = group.getByRole("checkbox", { name: "All toppings" });
    const box = (name: string) => group.getByRole("checkbox", { name, exact: true });
    await expect(all).toBeChecked({ indeterminate: true });
    await all.click();
    await expect(all).toBeChecked();
    for (const name of ["cheese", "olives", "peppers"]) await expect(box(name)).toBeChecked();
    await box("olives").click();
    await expect(all).toBeChecked({ indeterminate: true });
    await all.click();
    await all.click();
    await expect(all).not.toBeChecked();
    await expect(box("cheese")).not.toBeChecked();
    await expect(all).not.toHaveAttribute("name");
  });

  test("a radio group: one tab stop, arrows move and select, disabled radios are skipped", async ({
    page,
  }) => {
    await ready(page);
    const group = page.getByRole("radiogroup", { name: "Size" });
    await expect(group).toHaveAttribute("aria-required", "true");
    const radio = (name: string) => group.getByRole("radio", { name });
    await page.getByRole("checkbox", { name: "peppers" }).focus();
    await page.keyboard.press("Tab");
    await expect(radio("Small")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(radio("Medium")).toBeFocused();
    await expect(radio("Medium")).toBeChecked();
    // Large is disabled: on to Extra large, then around to Small.
    await page.keyboard.press("ArrowDown");
    await expect(radio("Extra large")).toBeChecked();
    await page.keyboard.press("ArrowRight");
    await expect(radio("Small")).toBeChecked();
    await page.keyboard.press("ArrowUp");
    await expect(radio("Extra large")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(radio("Small")).toBeChecked();
    await page.keyboard.press("Tab");
    await expect(group.getByRole("radio").first()).not.toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(radio("Small")).toBeFocused();
  });
});

test.describe("in an island", () => {
  test("bind:value and bind:checked keep signals in sync both ways", async ({ page }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/form/island");
    const state = page.getByTestId("form-state");
    await expect(state).toHaveText(
      "handle: ada, agree: false, dark: true, colours: red, size: m, saved: none",
    );
    // The signals drive the controls (and this waits for the island to hydrate).
    await hydrated(page);
    await expect(page.getByRole("textbox", { name: "Handle" })).toHaveValue("grace");
    await expect(page.getByRole("checkbox", { name: "I agree" })).toBeChecked();
    await expect(page.getByRole("switch", { name: "Dark mode" })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: "red" })).not.toBeChecked();
    await expect(page.getByRole("checkbox", { name: "blue" })).toBeChecked();
    await expect(page.getByRole("checkbox", { name: "All colours" })).toBeChecked({
      indeterminate: true,
    });
    await expect(page.getByRole("radio", { name: "Small" })).toBeChecked();

    // The controls write the signals back.
    await page.getByRole("textbox", { name: "Handle" }).fill("lin");
    await page.getByRole("checkbox", { name: "I agree" }).uncheck();
    await page.getByRole("switch", { name: "Dark mode" }).click();
    await page.getByRole("checkbox", { name: "All colours" }).click();
    await page.getByRole("radio", { name: "Medium" }).check();
    await expect(state).toHaveText(
      "handle: lin, agree: false, dark: true, colours: red green blue, size: m, saved: none",
    );
    expect(warnings).toEqual([]);
  });

  test("validate sets the field's message; submit() brings the action's errors to the field", async ({
    page,
  }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/form/island");
    const handle = page.getByRole("textbox", { name: "Handle" });
    await hydrated(page);
    await handle.fill("a b");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(handle).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("No spaces, please.")).toBeVisible();
    await expect(handle).toBeFocused();

    await handle.fill("admin");
    await expect(page.getByText("No spaces, please.")).toBeHidden();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("That handle is reserved.")).toBeVisible();
    await expect(handle).toHaveAttribute("aria-invalid", "true");
    await expect(page).toHaveURL(/\/form\/island$/);

    await handle.fill("linus");
    await expect(page.getByText("That handle is reserved.")).toBeHidden();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("form-state")).toContainText("saved: linus");
    expect(warnings).toEqual([]);
  });
});

const login = (page: Page) => page.getByRole("textbox", { name: "Login" });
const validity = (page: Page) => page.getByTestId("login-validity");
const checks = (page: Page) => page.getByTestId("login-checks");

test.describe("a form reset in an island (TASK-424)", () => {
  test("an Error's text stays live: the next action error shows", async ({ page }) => {
    await page.goto("/form/island");
    const handle = page.getByRole("textbox", { name: "Handle" });
    await hydrated(page);
    await handle.fill("a b");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("No spaces, please.")).toBeVisible();
    // Resetting an <output> replaces its text in Firefox and WebKit; Field's script puts it back.
    await handle.evaluate((el) => (el as HTMLInputElement).form!.reset());
    await expect(page.getByText("No spaces, please.")).toBeHidden();
    await handle.fill("admin");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("That handle is reserved.")).toBeVisible();
  });
});

test.describe("async validate and Field.Validity (TASK-405)", () => {
  test("the latest edit's verdict wins: a slower, older check is dropped", async ({ page }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/form/island");
    await expect(validity(page)).toHaveText("unchecked");
    await hydrated(page);
    // The check of the empty value at the start: quiet, the field is not checked yet.
    await expect(checks(page)).toHaveText("checks: 1");
    await expect(validity(page)).toHaveText("unchecked");
    await login(page).fill("slowpoke");
    await expect(validity(page)).toHaveText("checking");
    await expect(page.locator("lu-field").filter({ has: login(page) })).toHaveAttribute(
      "data-validating",
      "",
    );
    // The slow check started; a newer edit answers first.
    await expect(checks(page)).toHaveText("checks: 2");
    await login(page).fill("ada");
    await expect(validity(page)).toHaveText("valid");
    await page.waitForTimeout(500);
    await expect(validity(page)).toHaveText("valid");
    await expect(page.getByText("slowpoke is taken.", { exact: true })).toBeHidden();
    await expect(login(page)).not.toHaveAttribute("aria-invalid");
    expect(warnings).toEqual([]);
  });

  test("typing waits for the debounce; a taken login shows and blocks the submit", async ({
    page,
  }) => {
    await page.goto("/form/island");
    await hydrated(page);
    await expect(checks(page)).toHaveText("checks: 1");
    // Field.Validity's element re-renders on its own: the control stays the same node (TASK-415).
    await login(page).evaluate((el) => ((window as any).loginControl = el));
    await login(page).pressSequentially("taken", { delay: 30 });
    await expect(page.getByText("taken is taken.", { exact: true })).toBeVisible();
    // One check for five keystrokes.
    await expect(checks(page)).toHaveText("checks: 2");
    await expect(validity(page)).toHaveText("invalid: taken is taken.");
    expect(await login(page).evaluate((el) => el === (window as any).loginControl)).toBe(true);
    await expect(login(page)).toHaveAttribute("aria-invalid", "true");
    // Playwright's accessible description leaves `<output>` out: ask Chromium's tree.
    await expect.poll(() => axDescription(login(page))).toMatch(/taken is taken\./);
    await page.getByRole("button", { name: "Check login" }).click();
    await expect(login(page)).toBeFocused();
    await expect(page.getByText("taken is taken.", { exact: true })).toBeVisible();
    // A reset clears the check, and checks the default value again, quietly.
    await login(page).evaluate((el) => (el as HTMLInputElement).form!.reset());
    await expect(validity(page)).toHaveText("unchecked");
    await expect(checks(page)).toHaveText("checks: 3");
    expect(await login(page).evaluate((el) => (el as HTMLInputElement).validationMessage)).toBe("");
    await expect(validity(page)).toHaveText("unchecked");
  });
});

test.describe("uncheckedValue (TASK-405)", () => {
  test("a switch that is off submits its uncheckedValue; a disabled one submits nothing", async ({
    page,
  }) => {
    await ready(page);
    await fillValid(page);
    await page.getByRole("switch", { name: "Newsletter" }).uncheck();
    await submitButton(page).click();
    const saved = page.getByTestId("saved");
    await expect(saved).toContainText("newsletter=off");
    await expect(saved).not.toContainText("disabled-switch");
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes, with and without errors (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await ready(page);
      expect(await axe(page)).toEqual([]);
      await submitButton(page).click();
      await expect(page.getByText("Choose a size.")).toBeVisible();
      expect(await axe(page)).toEqual([]);
      await page.goto("/form/island");
      await expect(page.getByRole("textbox", { name: "Handle" })).toHaveValue("ada");
      expect(await axe(page)).toEqual([]);
    });
  }

  test("focus is visible on every control (2.4.7)", async ({ page }) => {
    await ready(page);
    await lastNavLink(page).focus();
    for (const name of ["Username", "Email"]) {
      await page.keyboard.press("Tab");
      await expect(page.getByRole("textbox", { name })).toBeFocused();
      expect(await focusRing(page)).toBe("2px solid");
    }
    for (const control of [
      page.getByRole("checkbox", { name: "All toppings" }),
      page.getByRole("radio", { name: "Small" }),
      page.getByRole("switch", { name: "Newsletter" }),
    ]) {
      await control.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(control).toBeFocused();
      expect(await focusRing(page)).toBe("2px solid");
    }
  });

  test("controls are at least 24 by 24 CSS pixels (2.5.8)", async ({ page }) => {
    await ready(page);
    expect(await smallTargets(page.locator("form"))).toEqual([]);
  });

  test("the form reflows at 320 CSS pixels with text spacing (1.4.10, 1.4.12)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await ready(page);
    await page.addStyleTag({ content: TEXT_SPACING });
    await submitButton(page).click();
    const form = page.locator("form");
    const box = (await form.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(320);
    expect(await clipped(form)).toEqual([]);
  });

  test("a server-rendered form page loads Field's and the checkbox script only", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
    });
    await ready(page);
    expect(scripts.toSorted()).toEqual([
      expect.stringMatching(/\/checkbox\.script-[\w-]+\.js$/),
      expect.stringMatching(/\/field\.script-[\w-]+\.js$/),
    ]);
    await expect(page.locator("script[data-l-islands]")).toHaveCount(0);
  });
});

test.describe("right to left (TASK-385)", () => {
  test("a radio group's Arrow Left goes to the next radio", async ({ page }) => {
    await ready(page);
    await rtl(page);
    const group = page.getByRole("radiogroup", { name: "Size" });
    const radio = (name: string) => group.getByRole("radio", { name });
    await radio("Small").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(radio("Medium")).toBeFocused();
    await expect(radio("Medium")).toBeChecked();
    // Past the disabled Large; left to right, Arrow Left from Small would go to Extra large.
    await page.keyboard.press("ArrowLeft");
    await expect(radio("Extra large")).toBeChecked();
    await page.keyboard.press("ArrowRight");
    await expect(radio("Medium")).toBeChecked();
  });
});
