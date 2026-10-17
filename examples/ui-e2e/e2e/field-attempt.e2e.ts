// Field's script and submit attempts (TASK-439): M28, a silent checkValidity() shows nothing and
// moves no focus; M29, a submit attempt focuses the first invalid field, not a later control
// without one; M27, a form action's errors move focus to the first field that shows one.
import { expect, test } from "@playwright/test";

test("checkValidity() is silent; a submit attempt shows the field's error and focuses it first", async ({
  page,
}) => {
  await page.goto("/form/attempt");
  const email = page.getByRole("textbox", { name: "Email" });
  const nickname = page.getByRole("textbox", { name: "Nickname" });
  const error = page.locator("lu-field").first().locator("output");
  // Field's script is up once it set the control's description (none here) or its id: wait for
  // its listener by a first, harmless focus round.
  await page.waitForLoadState("networkidle");
  // M28: a script checks the form without submitting it.
  await nickname.focus();
  expect(await page.evaluate(() => document.querySelector("form")!.checkValidity())).toBe(false);
  await page.waitForTimeout(100);
  await expect(error).toBeHidden();
  await expect(email).not.toHaveAttribute("aria-invalid");
  await expect(nickname).toBeFocused();
  // M29: the submit attempt focuses the email field, not the later nickname without a field.
  await page.getByRole("button", { name: "Send" }).click();
  await expect(error).toBeVisible();
  await expect(email).toHaveAttribute("aria-invalid", "true");
  await expect(email).toBeFocused();
  await page.waitForTimeout(200);
  await expect(email).toBeFocused();
  // requestSubmit() is an attempt too.
  await nickname.focus();
  await page.evaluate(() => document.querySelector("form")!.requestSubmit());
  await expect(email).toBeFocused();
});

test.describe("a form action's errors move focus to the first field that shows one (M27)", () => {
  test("in an island", async ({ page }) => {
    await page.goto("/form/island");
    const handle = page.getByRole("textbox", { name: "Handle" });
    await expect(async () => {
      await page.getByTestId("set-signals").click();
      await expect(handle).toHaveValue("grace", { timeout: 250 });
    }).toPass();
    await handle.fill("admin");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("That handle is reserved.")).toBeVisible();
    await expect(handle).toBeFocused();
  });

  test("on a page rendered back by the server", async ({ page }) => {
    await page.goto("/form");
    await page.getByRole("textbox", { name: "Username" }).fill("taken");
    await page.getByRole("textbox", { name: "Email" }).fill("ada@example.com");
    await page.getByRole("radio", { name: "Small" }).check();
    await page.getByRole("checkbox", { name: "I accept the terms" }).check();
    await page.getByRole("button", { name: "Sign up" }).click();
    await expect(page.getByText("That username is taken.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Username" })).toBeFocused();
  });
});

// Field's script wraps HTMLFormElement.prototype.requestSubmit and reportValidity to mark a submit
// attempt (decision-62): the wrappers keep the browser's arguments, return values and exceptions.
test("the wrapped requestSubmit() and reportValidity() behave as the browser's", async ({
  page,
}) => {
  await page.goto("/form/attempt");
  await page.waitForLoadState("networkidle");
  const result = await page.evaluate(() => {
    const form = document.querySelector("form")!;
    const errorName = (call: () => unknown) => {
      try {
        call();
        return "none";
      } catch (error) {
        return (error as Error).name;
      }
    };
    return {
      wrapped: !HTMLFormElement.prototype.requestSubmit.toString().includes("[native code]"),
      // An invalid form: false, as the browser answers.
      invalid: form.reportValidity(),
      // A submitter the form does not own, or one that cannot submit: the browser's errors.
      foreign: errorName(() => form.requestSubmit(document.createElement("button"))),
      notSubmit: errorName(() =>
        form.requestSubmit(form.querySelector<HTMLElement>("input[name=nickname]")!),
      ),
    };
  });
  expect(result).toEqual({
    wrapped: true,
    invalid: false,
    foreign: "NotFoundError",
    notSubmit: "TypeError",
  });
  // A valid form: true, and requestSubmit(submitter) submits with the submitter's name and value.
  await page.getByRole("textbox", { name: "Email" }).fill("ada@example.com");
  await page.getByRole("textbox", { name: "Nickname" }).fill("ada");
  await page.getByRole("combobox", { name: "Plan" }).selectOption("pro");
  expect(await page.evaluate(() => document.querySelector("form")!.reportValidity())).toBe(true);
  await page.evaluate(() => {
    const form = document.querySelector("form")!;
    const submitter = Object.assign(document.createElement("button"), {
      type: "submit",
      name: "via",
      value: "wrapped",
    });
    form.append(submitter);
    form.requestSubmit(submitter);
  });
  await expect(page).toHaveURL(/[?&]via=wrapped/);
});

test("a problem no Error matches keeps the browser's bubble (TASK-475)", async ({ page }) => {
  await page.goto("/form/matches");
  await page.waitForLoadState("networkidle");
  const code = page.getByRole("textbox", { name: "Code" });
  const error = page.getByText("Use 3 characters or more.");
  const send = page.getByRole("button", { name: "Send" });
  // Whether the bubble may show: the `invalid` event's default, after Field's capturing listener.
  await code.evaluate((input) =>
    input.addEventListener("invalid", (event) =>
      input.setAttribute("data-prevented", String(event.defaultPrevented)),
    ),
  );
  // A missing value: no Error for it, so the browser reports it and focuses the control.
  await send.click();
  await expect(code).toHaveAttribute("data-prevented", "false");
  await expect(code).toBeFocused();
  await expect(error).toBeHidden();
  // A value too short: the Error shows it, without the bubble.
  await code.fill("ab");
  await send.click();
  await expect(code).toHaveAttribute("data-prevented", "true");
  await expect(error).toBeVisible();
  await expect(code).toHaveAttribute("aria-invalid", "true");
});
