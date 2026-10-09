import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Writes a watched source file. Vite's watcher (chokidar) drops a change that comes within 50 ms of
 * the previous one for the same file, which a fast CI runner reaches when a test restores a file
 * right after its edit was applied; real edits are never that close.
 */
async function edit(file: string, content: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  writeFileSync(file, content);
}

test("the counter counts and resets", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const counter = page.getByRole("button", { name: /Clicked/ });
  await expect(counter).toHaveText("Clicked 0 times");
  for (let i = 0; i < 6; i++) await counter.click();
  await expect(counter).toHaveText("Clicked 6 times");
  await expect(counter).toHaveClass("hot");
  await page.getByRole("button", { name: "Reset" }).click();
  await expect(counter).toHaveText("Clicked 0 times");
  await expect(counter).not.toHaveClass("hot");
  expect(errors).toEqual([]);
});

test("todos are added, checked and removed", async ({ page }, info) => {
  await page.goto("/");
  const input = page.getByPlaceholder("What needs doing?");
  for (const title of ["Write the compiler", "Ship the plugin"]) {
    await input.fill(title);
    await page.getByRole("button", { name: "Add" }).click();
  }
  await expect(input).toHaveValue("");
  const items = page.locator(".todos li");
  await expect(items.locator("label")).toHaveText(["Write the compiler", "Ship the plugin"]);
  await expect(page.locator(".remaining")).toHaveText("2 of 2 left");
  await items.first().getByRole("checkbox").check();
  await expect(items.first()).toHaveClass("done");
  await expect(page.locator(".remaining")).toHaveText("1 of 2 left");
  await items.last().getByRole("button", { name: "Remove" }).click();
  await expect(items.locator("label")).toHaveText(["Write the compiler"]);
  await expect(page.locator(".remaining")).toHaveText("0 of 1 left");
  if (process.env.LUMEN_SCREENSHOTS) {
    await page.screenshot({
      path: `${process.env.LUMEN_SCREENSHOTS}/vite-counter-${info.project.name}.png`,
    });
  }
});

test("an edited component re-mounts the app without a reload", async ({ page }, info) => {
  test.skip(info.project.name !== "dev", "HMR only exists in dev");
  const file = resolve(import.meta.dirname, "../src/Counter.stsx");
  const source = readFileSync(file, "utf8");
  await page.goto("/");
  await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
  await expect(page.getByRole("button", { name: /Clicked/ })).toHaveText("Clicked 0 times");
  try {
    await edit(file, source.replace("Clicked {count()} times", "Pressed {count()} times"));
    await expect(page.getByRole("button", { name: /Pressed/ })).toHaveText("Pressed 0 times");
    // One app root (the previous one was disposed) and the same page (no full reload).
    await expect(page.locator("main")).toHaveCount(1);
    expect(await page.evaluate(() => (window as unknown as { marker: number }).marker)).toBe(1);
  } finally {
    await edit(file, source);
  }
  await expect(page.getByRole("button", { name: /Clicked/ })).toHaveText("Clicked 0 times");
});

test("an edited component re-renders alone: its siblings keep their state (TASK-146)", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "dev", "HMR only exists in dev");
  const file = resolve(import.meta.dirname, "../src/Counter.stsx");
  const source = readFileSync(file, "utf8");
  await page.goto("/");
  await page.getByRole("textbox", { name: "What needs doing?" }).fill("Survive the edit");
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByText("Survive the edit")).toBeVisible();
  await page.getByRole("button", { name: /Clicked/ }).click();
  await expect(page.getByRole("button", { name: /Clicked/ })).toHaveText("Clicked 1 times");
  const heading = page.getByRole("heading", { name: "Lumen + Vite" });
  const before = await heading.elementHandle();
  try {
    await edit(file, source.replace("Clicked {count()} times", "Pressed {count()} times"));
    // The Counter re-renders (its own state starts over); the Todos and the App keep theirs.
    await expect(page.getByRole("button", { name: /Pressed/ })).toHaveText("Pressed 0 times");
    await expect(page.getByText("Survive the edit")).toBeVisible();
    expect(await before!.evaluate((el) => el.isConnected)).toBe(true);
  } finally {
    await edit(file, source);
  }
  await expect(page.getByRole("button", { name: /Clicked/ })).toHaveText("Clicked 0 times");
  await expect(page.getByText("Survive the edit")).toBeVisible();
});

test("compiler errors show in the dev overlay with a code frame", async ({ page }, info) => {
  test.skip(info.project.name !== "dev", "the overlay only exists in dev");
  const file = resolve(import.meta.dirname, "../src/Counter.stsx");
  const source = readFileSync(file, "utf8");
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Clicked/ })).toBeVisible();
  try {
    await edit(file, source.replace("<h2>Counter</h2>", "<h2>Counter</h3>"));
    const overlay = page.locator("vite-error-overlay");
    await expect(overlay.locator(".message")).toContainText("LUM1001");
    await expect(overlay.locator(".plugin")).toContainText("lumen");
    await expect(overlay.locator(".frame")).toContainText("<h2>Counter</h3>");
    if (process.env.LUMEN_SCREENSHOTS) {
      await page.screenshot({ path: `${process.env.LUMEN_SCREENSHOTS}/vite-overlay.png` });
    }
  } finally {
    await edit(file, source);
  }
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Clicked/ })).toHaveText("Clicked 0 times");
});

const ACCENT = "rgb(79, 70, 229)";
const DANGER = "rgb(220, 38, 38)";

test("scoped, file and global styles apply without leaking", async ({ page }) => {
  await page.goto("/");
  const css = (selector: string, property: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);
  // Global: unscoped.
  expect(await css("body", "margin-top")).toBe("0px");
  // Component scope (App) with a $token.
  expect(await css("h1", "color")).toBe(ACCENT);
  // Counter's `h2` and `button` rules stay inside Counter.
  expect(await css(".counter h2", "color")).toBe(ACCENT);
  expect(await css(".todos h2", "color")).not.toBe(ACCENT);
  expect(await css(".counter button", "background-color")).toBe(ACCENT);
  expect(await css(".todos button", "background-color")).not.toBe(ACCENT);
  // Todos' `ul` rule stays inside Todos.
  expect(await css(".todos ul", "list-style-type")).toBe("none");
  // File scope of App.stsx reaches the children's roots through class passthrough.
  for (const panel of [".counter", ".todos"]) {
    expect(await css(panel, "border-top-left-radius")).toBe("8px");
    expect(await css(panel, "border-top-color")).toBe("rgb(212, 212, 216)");
  }
  // Dynamic classes are scoped too.
  const counter = page.getByRole("button", { name: /Clicked/ });
  for (let i = 0; i < 6; i++) await counter.click();
  await expect(counter).toHaveCSS("background-color", DANGER);
});

test("style edits hot-update the CSS without re-running components", async ({ page }, info) => {
  test.skip(info.project.name !== "dev", "HMR only exists in dev");
  const file = resolve(import.meta.dirname, "../src/Counter.stsx");
  const tokens = resolve(import.meta.dirname, "../src/tokens.ts");
  const source = readFileSync(file, "utf8");
  const tokensSource = readFileSync(tokens, "utf8");
  await page.goto("/");
  await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
  const counter = page.getByRole("button", { name: /Clicked/ });
  for (let i = 0; i < 2; i++) await counter.click();
  await expect(counter).toHaveText("Clicked 2 times");
  const heading = page.locator(".counter h2");
  try {
    // A style block edit: only the CSS module updates, so the count survives.
    await edit(
      file,
      source.replace(
        "h2 {\n          color: $theme.accent;\n        }",
        "h2 {\n          color: rgb(1, 2, 3);\n        }",
      ),
    );
    await expect(heading).toHaveCSS("color", "rgb(1, 2, 3)");
    await expect(counter).toHaveText("Clicked 2 times");
    // A token edit: the CSS of every file reading it updates.
    await edit(tokens, tokensSource.replace('accent: "#4f46e5"', 'accent: "#059669"'));
    await expect(page.locator("h1")).toHaveCSS("color", "rgb(5, 150, 105)");
    await expect(counter).toHaveCSS("background-color", "rgb(5, 150, 105)");
    await expect(counter).toHaveText("Clicked 2 times");
    expect(await page.evaluate(() => (window as unknown as { marker: number }).marker)).toBe(1);
    if (process.env.LUMEN_SCREENSHOTS) {
      await page.screenshot({
        path: `${process.env.LUMEN_SCREENSHOTS}/vite-counter-style-hmr.png`,
      });
    }
  } finally {
    await edit(file, source);
    await edit(tokens, tokensSource);
  }
  await expect(heading).toHaveCSS("color", ACCENT);
  await expect(counter).toHaveText("Clicked 2 times");
});
