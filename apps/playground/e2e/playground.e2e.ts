// The playground in Chromium, from the static build: the WebAssembly compiler loads, edits
// recompile for the client and the server, the preview runs the client output, diagnostics show
// in the editor and their tab, and the state survives in a shareable URL.
import { expect, test, type Page } from "@playwright/test";

const editor = (page: Page) => page.locator(".editor-pane .cm-content");
const preview = (page: Page) => page.frameLocator('iframe[title="Preview"]');
const status = (page: Page) => page.getByRole("status");

async function open(page: Page, path = "/playground/") {
  await page.goto(path);
  await expect(status(page)).toContainText("Compiled with lumen_wasm", { timeout: 20_000 });
}

/** Types `text` at the end of the line that contains `anchor`. */
async function typeAfter(page: Page, anchor: string, text: string) {
  await page.locator(".editor-pane .cm-line", { hasText: anchor }).first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(text);
}

test("compiles in the browser and runs the preview", async ({ page }) => {
  await open(page);
  const button = preview(page).getByRole("button", { name: "Clicked 0 times" });
  await expect(button).toBeVisible();
  await button.click();
  await expect(preview(page).getByText("Doubled: 2")).toBeVisible();

  await page.getByRole("tab", { name: "Client JS" }).click();
  await expect(page.locator("#panel-client")).toContainText('from "lumen/dom"');
  await page.getByRole("tab", { name: "Server JS" }).click();
  await expect(page.locator("#panel-server")).toContainText('from "lumen/server"');
  await page.getByRole("tab", { name: "CSS" }).click();
  await expect(page.locator("#panel-css")).toContainText("[data-l-");
});

test("reports diagnostics in the editor and the Diagnostics tab", async ({ page }) => {
  await open(page);
  await page
    .locator(".editor-pane .cm-line")
    .filter({ hasText: /^\s*<style>\s*$/ })
    .click();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.type(' lang="scss"');
  await expect(status(page)).toHaveText("1 error");
  await expect(page.locator(".cm-lint-marker-error")).toHaveCount(1);
  await expect(page.locator(".stale")).toBeVisible();

  await page.getByRole("tab", { name: /Diagnostics/ }).click();
  const item = page.locator("#panel-diagnostics li");
  await expect(item).toContainText("unknown `<style>` attribute `lang`");
  await expect(item.getByRole("link", { name: "LUM1005" })).toHaveAttribute(
    "href",
    "/docs/errors/LUM1005",
  );
});

test("keeps the state in a shareable URL", async ({ page, context }) => {
  await open(page);
  await typeAfter(page, "const doubled", "\n  console.log('shared', doubled());");
  await expect(preview(page).getByText("Doubled: 0")).toBeVisible();
  await expect(page.locator(".console")).toContainText("shared 0");
  await page.getByRole("tab", { name: "CSS" }).click();
  await expect.poll(() => page.url()).toMatch(/#v1=[\w-]+$/);

  const other = await context.newPage();
  await open(other, page.url());
  await expect(editor(other)).toContainText("console.log('shared', doubled());");
  await expect(other.getByRole("tab", { name: "CSS" })).toHaveAttribute("aria-selected", "true");
});

test("switches samples and works below the site's base path", async ({ page }) => {
  await open(page, "/lumen/playground/");
  await page.getByLabel("Sample").selectOption("todos");
  const frame = preview(page);
  await frame.getByRole("textbox", { name: "New todo" }).fill("Ship the playground");
  await frame.getByRole("button", { name: "Add" }).click();
  await expect(frame.getByText("2 left")).toBeVisible();
  await expect(page.getByRole("link", { name: "Docs" }).first()).toHaveAttribute(
    "href",
    "/lumen/docs",
  );
});

const out = (name: string) => `../../backlog/assets/task-58-${name}.png`;

// SCREENSHOTS=1 pnpm screenshots: the representative captures in backlog/assets.
test("screenshots", async ({ page }) => {
  test.skip(!process.env["SCREENSHOTS"], "Set SCREENSHOTS=1 to capture.");
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    await open(page);
    await expect(preview(page).getByRole("button", { name: "Clicked 0 times" })).toBeVisible();
    await page.screenshot({ path: out(`preview-${scheme}`) });
  }
  await page.emulateMedia({ colorScheme: "light" });
  await page.getByLabel("Sample").selectOption("scoped");
  await page.getByRole("tab", { name: "CSS" }).click();
  await expect(page.locator("#panel-css")).toContainText(".badge[data-l-");
  await page.screenshot({ path: out("css") });
  await page.getByRole("tab", { name: "Client JS" }).click();
  await page.screenshot({ path: out("client") });
  await page.getByLabel("Sample").selectOption("counter");
  await typeAfter(page, "const count = signal(0);", "\n  const frozen = count() * 2;");
  await typeAfter(page, "<p>Doubled:", " {frozen}");
  await page
    .locator(".editor-pane .cm-line")
    .filter({ hasText: /^\s*<style>\s*$/ })
    .click();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.type(' lang="scss"');
  await page.keyboard.press("Home");
  await page.getByRole("tab", { name: /Diagnostics/ }).click();
  await expect(page.locator("#panel-diagnostics li")).toHaveCount(2);
  await page.screenshot({ path: out("diagnostics") });
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(preview(page).getByRole("button", { name: "Clicked 0 times" })).toBeVisible();
  await page.screenshot({ path: out("phone"), fullPage: true });
});
