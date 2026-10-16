// OTP Field (TASK-376): one native input under visual slots. Without JavaScript a plain text field
// that validates and submits; with its script the slots show the code, letters are refused, a
// paste fills every slot, Backspace and the arrow keys move between slots, a full field types over
// the caret's character, a press on a slot moves the caret there, auto-submit, Field's validation,
// a reset, the sync with a signal in an island, and WCAG 2.2 AA with the default theme (doc-9
// sections 1, 15 and 17).
import { expect, test, type Page } from "@playwright/test";
import { axe, clipped, lastNavLink, SCHEMES, smallTargets, TEXT_SPACING } from "./a11y.ts";
import { skipIn } from "./browsers.ts";

/** Puts the whole page right to left. */
const rtl = (page: Page) => page.evaluate(() => (document.documentElement.dir = "rtl"));

/** Lumiose's console warnings (LUM codes), such as a hydration that fell back to rendering. */
const lumioseWarnings = (page: Page) => {
  const warnings: string[] = [];
  page.on("console", (message) => {
    if (message.text().includes("LUM")) warnings.push(message.text());
  });
  return warnings;
};

const code = (page: Page) => page.getByRole("textbox", { name: "Verification code" });
const root = (page: Page, name: string) =>
  page.locator("lu-otp-field").filter({ has: page.getByRole("textbox", { name }) });
const slots = (page: Page, name: string) =>
  root(page, name)
    .locator("[data-slot]")
    .evaluateAll((all) => all.map((slot) => slot.textContent ?? ""));
const active = (page: Page, name: string) =>
  root(page, name)
    .locator("[data-slot]")
    .evaluateAll((all) => all.findIndex((slot) => slot.hasAttribute("data-active")));

/** /otp-field with its script running: the inputs lie over their slots. */
async function ready(page: Page) {
  await page.goto("/otp-field");
  await page.waitForFunction(() => customElements.get("lu-otp-field") !== undefined);
}

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the input is a plain field that validates its pattern and submits", async ({ page }) => {
    await page.goto("/otp-field");
    await expect(code(page)).toHaveAttribute("autocomplete", "one-time-code");
    await expect(root(page, "Verification code").locator("[data-slot]").first()).toBeHidden();
    await code(page).fill("123");
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page).toHaveURL(/\/otp-field$/);
    await code(page).fill("123456");
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(page).toHaveURL(/\/otp-field\?code=123456&recovery=$/);
  });
});

test.describe("OTP Field", () => {
  test("typing fills the slots and refuses letters; Backspace and the arrows move between slots", async ({
    page,
  }) => {
    await ready(page);
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    await expect(code(page)).toBeFocused();
    await expect.poll(() => active(page, "Verification code")).toBe(0);
    await page.keyboard.type("12a3");
    expect(await slots(page, "Verification code")).toEqual(["1", "2", "3", "", "", ""]);
    await expect.poll(() => active(page, "Verification code")).toBe(3);
    await page.keyboard.press("Backspace");
    expect(await slots(page, "Verification code")).toEqual(["1", "2", "", "", "", ""]);
    await expect.poll(() => active(page, "Verification code")).toBe(2);
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => active(page, "Verification code")).toBe(1);
    await page.keyboard.press("Home");
    await expect.poll(() => active(page, "Verification code")).toBe(0);
    await page.keyboard.press("End");
    await page.keyboard.type("3456");
    await expect(code(page)).toHaveValue("123456");
    // Full: the caret's character is typed over.
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.type("9");
    await expect(code(page)).toHaveValue("193456");
    await expect.poll(() => active(page, "Verification code")).toBe(2);
  });

  test("a paste fills every slot, without spaces and up to the length", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(
      browserName === "firefox",
      "Playwright cannot write Firefox's clipboard, and Firefox gives a synthetic paste event no clipboard data",
    );
    await ready(page);
    await code(page).focus();
    if (browserName === "chromium") {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      await page.evaluate(() => navigator.clipboard.writeText("987 654 321"));
      await page.keyboard.press("ControlOrMeta+V");
    } else {
      // Playwright grants clipboard access in Chromium only: WebKit takes the paste event a paste
      // fires.
      await code(page).evaluate((input) => {
        const clipboardData = new DataTransfer();
        clipboardData.setData("text/plain", "987 654 321");
        input.dispatchEvent(
          new ClipboardEvent("paste", { clipboardData, bubbles: true, cancelable: true }),
        );
      });
    }
    await expect(code(page)).toHaveValue("987654");
    expect(await slots(page, "Verification code")).toEqual(["9", "8", "7", "6", "5", "4"]);
    await expect(root(page, "Verification code")).toHaveAttribute("data-complete", "");
  });

  test("a press on a slot puts the caret there", async ({ page }) => {
    await ready(page);
    await code(page).fill("1234");
    // The input lies over the slots: press where a slot shows.
    const press = async (index: number) => {
      const box = (await root(page, "Verification code")
        .locator("[data-slot]")
        .nth(index)
        .boundingBox())!;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    };
    await press(1);
    await expect(code(page)).toBeFocused();
    await expect.poll(() => active(page, "Verification code")).toBe(1);
    // Past the last character typed, the caret goes after it.
    await press(5);
    await expect.poll(() => active(page, "Verification code")).toBe(4);
  });

  test("Field shows a missing or short code; masked slots show dots; a reset empties them", async ({
    page,
  }) => {
    await ready(page);
    await page.getByRole("button", { name: "Verify" }).click();
    await expect(code(page)).toHaveAttribute("aria-invalid", "true");
    await expect(code(page)).toBeFocused();
    const recovery = page.getByRole("textbox", { name: "Recovery code" });
    await recovery.fill("ab-1");
    expect(await slots(page, "Recovery code")).toEqual(["•", "•", "•", ""]);
    await expect(recovery).toHaveValue("ab1");
    await page.getByRole("button", { name: "Reset" }).click();
    await expect.poll(() => slots(page, "Recovery code")).toEqual(["", "", "", ""]);
  });

  test("auto-submit sends the form once the last character is in", async ({ page }) => {
    await ready(page);
    await page.getByRole("textbox", { name: "PIN (submits when complete)" }).focus();
    await page.keyboard.type("2468");
    await expect(page).toHaveURL(/\/otp-field\?pin=2468$/);
  });
});

test.describe("IME composition (TASK-432)", () => {
  // A real IME through the DevTools protocol, which only Chromium has in Playwright; the event
  // order of the other engines is covered by otp-field.script.dom.test.ts.
  skipIn(["firefox", "webkit"], "An IME composition needs Chromium's DevTools protocol (TASK-432)");

  test("a commit is kept, and a composition never completes or submits", async ({ page }) => {
    await page.goto("/otp-field");
    const cdp = await page.context().newCDPSession(page);
    const recovery = page.getByRole("textbox", { name: "Recovery code" });
    await recovery.click();
    await cdp.send("Input.imeSetComposition", { text: "zhon", selectionStart: 4, selectionEnd: 4 });
    await cdp.send("Input.insertText", { text: "中文" });
    await expect(recovery).toHaveValue("中文");
    // Full-width digits are digits: composed but not committed, the PIN does not submit.
    const pin = page.getByRole("textbox", { name: /PIN/ });
    await pin.click();
    await cdp.send("Input.imeSetComposition", {
      text: "１２３４",
      selectionStart: 4,
      selectionEnd: 4,
    });
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/otp-field$/);
    // Committed, it completes and submits.
    await cdp.send("Input.insertText", { text: "１２３４" });
    await expect(page).toHaveURL(/pin=/);
    await cdp.detach();
  });
});

test.describe("in an island", () => {
  test("bind:value keeps a signal in sync both ways; completion and refused input report", async ({
    page,
  }) => {
    const warnings = lumioseWarnings(page);
    await page.goto("/otp-field/island");
    const state = page.getByTestId("otp-state");
    const input = page.getByRole("textbox", { name: "Code" });
    await expect(async () => {
      await page.getByTestId("set-signals").click({ timeout: 250 });
      await expect(input).toHaveValue("4242", { timeout: 250 });
    }).toPass();
    expect(await slots(page, "Code")).toEqual(["4", "2", "4", "2"]);
    await input.fill("");
    await expect(state).toHaveText("code: none, complete: no, rejected: none");
    await input.focus();
    await page.keyboard.type("1x");
    await expect(state).toHaveText("code: 1, complete: no, rejected: 1x");
    await page.keyboard.type("234");
    await expect(state).toHaveText("code: 1234, complete: 1234, rejected: 1x");
    expect(warnings).toEqual([]);
  });

  test("normalizeValue turns what is typed into capitals (TASK-413)", async ({ page }) => {
    await page.goto("/otp-field/island");
    const input = page.getByRole("textbox", { name: "Code" });
    await expect(async () => {
      await page.getByTestId("set-signals").click({ timeout: 250 });
      await expect(input).toHaveValue("4242", { timeout: 250 });
    }).toPass();
    const voucher = page.getByRole("textbox", { name: "Voucher" });
    await voucher.focus();
    await page.keyboard.type("ab1c");
    await expect(voucher).toHaveValue("AB1C");
    expect(await slots(page, "Voucher")).toEqual(["A", "B", "1", "C"]);
  });
});

test.describe("WCAG 2.2 AA with the default theme (doc-9 section 17)", () => {
  for (const scheme of SCHEMES) {
    test(`axe passes, empty and filled, on the page and the island (${scheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await ready(page);
      expect(await axe(page)).toEqual([]);
      await code(page).fill("123456");
      expect(await axe(page)).toEqual([]);
      await page.goto("/otp-field/island");
      expect(await axe(page)).toEqual([]);
    });
  }

  test("focus shows on the caret's slot (2.4.7), and the field is a large target (2.5.8)", async ({
    page,
  }) => {
    await ready(page);
    await lastNavLink(page).focus();
    await page.keyboard.press("Tab");
    const ring = await root(page, "Verification code")
      .locator("[data-slot][data-active]")
      .evaluate((slot) => {
        const style = getComputedStyle(slot);
        return `${style.outlineWidth} ${style.outlineStyle}`;
      });
    expect(ring).toBe("2px solid");
    expect(await smallTargets(page.locator("form").first())).toEqual([]);
  });

  test("the fields reflow at 320 CSS pixels with text spacing (1.4.10, 1.4.12)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await ready(page);
    await page.addStyleTag({ content: TEXT_SPACING });
    for (const form of await page.locator("form").all()) {
      const box = (await form.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(320);
      expect(await clipped(form)).toEqual([]);
    }
  });

  test("a server-rendered page loads OTP Field's and Field's scripts only", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name === "dev", "the dev server always loads Vite's client");
    const scripts: string[] = [];
    page.on("request", (request) => {
      if (request.resourceType() === "script") scripts.push(new URL(request.url()).pathname);
    });
    await ready(page);
    await page.waitForLoadState("networkidle");
    expect(scripts.toSorted()).toEqual([
      expect.stringMatching(/\/field\.script-[\w-]+\.js$/),
      expect.stringMatching(/\/otp-field\.script-[\w-]+\.js$/),
    ]);
  });
});

test.describe("right to left (TASK-385)", () => {
  test("a numeric code's slots still run left to right", async ({ page }) => {
    await ready(page);
    await rtl(page);
    await code(page).focus();
    await page.keyboard.type("12");
    const boxes = await root(page, "Verification code")
      .locator("[data-slot]")
      .evaluateAll((all) =>
        all.map((slot) => ({ x: slot.getBoundingClientRect().x, text: slot.textContent })),
      );
    const first = boxes.toSorted((a, b) => a.x - b.x)[0];
    expect(first?.text).toBe("1");
  });
});
