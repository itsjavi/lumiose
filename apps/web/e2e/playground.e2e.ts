// The playground in Chromium, from the static build: the WebAssembly compiler loads, edits
// recompile for the client and the server, the preview runs the client output, diagnostics show
// in the editor and their tab, and the state survives in a shareable URL.
import { expect, test, type Page } from "@playwright/test";

const editor = (page: Page) => page.locator(".editor-pane .cm-content");
const preview = (page: Page) => page.frameLocator('iframe[title="Preview"]');
const status = (page: Page) => page.getByRole("status");

async function open(page: Page, path = "/playground/") {
  await page.goto(path);
  await expect(status(page)).toContainText("Compiled with lumiose_wasm", { timeout: 20_000 });
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
  await expect(page.getByRole("tabpanel", { name: "Client JS" })).toContainText(
    'from "lumiose/dom"',
  );
  await page.getByRole("tab", { name: "Server JS" }).click();
  await expect(page.getByRole("tabpanel", { name: "Server JS" })).toContainText(
    'from "lumiose/server"',
  );
  await page.getByRole("tab", { name: "CSS" }).click();
  await expect(page.getByRole("tabpanel", { name: "CSS" })).toContainText("[data-lum-");
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
  const item = page.getByRole("tabpanel", { name: /^Diagnostics/ }).locator("li");
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
  await open(page, "/lumiose/playground/");
  await page.getByLabel("Sample").selectOption("todos");
  const frame = preview(page);
  await frame.getByRole("textbox", { name: "New todo" }).fill("Ship the playground");
  await frame.getByRole("button", { name: "Add" }).click();
  await expect(frame.getByText("2 left")).toBeVisible();
  await expect(page.getByRole("link", { name: "Docs" }).first()).toHaveAttribute(
    "href",
    "/lumiose/docs",
  );
});

test("is a page of the site, and only it loads the compiler", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("link", { name: "Playground" }).first()).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("contentinfo")).toContainText("MIT licensed");

  const fetched: string[] = [];
  page.on("request", (request) => fetched.push(request.url()));
  // The landing's live demo loads it only once scrolled into view (below).
  for (const path of ["/", "/docs/concepts/styles", "/benchmarks"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }
  expect(fetched.filter((url) => COMPILER.test(url))).toEqual([]);
});

/** The editor island's code, CodeMirror, the WebAssembly compiler and the preview runtime. */
const COMPILER = /Playground|codemirror|generated\/|lumiose_wasm/i;

test("the landing's live demo loads when visible, and edits update the outputs", async ({
  page,
}) => {
  const fetched: string[] = [];
  page.on("request", (request) => fetched.push(request.url()));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // The initial JS stays as it was: nothing of the editor before the demo scrolls into view.
  expect(fetched.filter((url) => COMPILER.test(url))).toEqual([]);
  const demo = page.locator(".live-demo");
  await expect(demo.getByText("You write")).toBeVisible();

  await demo.scrollIntoViewIfNeeded();
  await expect(demo.locator(".status")).toContainText("Compiled with lumiose_wasm", {
    timeout: 20_000,
  });
  expect(fetched.some((url) => /lumiose_wasm/.test(url))).toBe(true);
  await expect(demo.getByText("You write")).toBeHidden();
  const button = preview(page).getByRole("button", { name: "Clicked 0 times" });
  await button.click();
  await expect(preview(page).getByRole("button", { name: "Clicked 1 times" })).toBeVisible();

  await page.locator(".editor-pane .cm-line", { hasText: "Clicked {count()} times" }).click();
  await page.keyboard.press("Home");
  await page.keyboard.type("Pressed, ");
  await page.locator(".editor-pane .cm-line", { hasText: "const gap = 8;" }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.type("0");
  await expect(
    preview(page).getByRole("button", { name: "Pressed, Clicked 0 times" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Client JS" }).click();
  await expect(page.getByRole("tabpanel", { name: "Client JS" })).toContainText("Pressed, Clicked");
  await page.getByRole("tab", { name: "CSS" }).click();
  await expect(page.getByRole("tabpanel", { name: "CSS" })).toContainText("gap: 80px");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the landing's demo shows the sample and its output as tabs", async ({ page }) => {
    await page.goto("/");
    const demo = page.locator(".live-demo");
    const panel = (n: number) => demo.locator(".static-panels > figure").nth(n);
    const [source, js, css] = [panel(0), panel(1), panel(2)];
    await expect(source).toBeVisible();
    await expect(source).toContainText("export default function Counter()");
    await expect(js).toBeHidden();
    await demo.getByText("JS output").click();
    await expect(js).toContainText('from "lumiose/dom"');
    await expect(source).toBeHidden();
    await demo.getByText("CSS output").click();
    await expect(css).toContainText("[data-lum-");
  });
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
  await expect(page.getByRole("tabpanel", { name: "CSS" })).toContainText(".badge[data-lum-");
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
  await expect(page.getByRole("tabpanel", { name: /^Diagnostics/ }).locator("li")).toHaveCount(2);
  await page.screenshot({ path: out("diagnostics") });
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(preview(page).getByRole("button", { name: "Clicked 0 times" })).toBeVisible();
  await page.screenshot({ path: out("phone"), fullPage: true });
});
