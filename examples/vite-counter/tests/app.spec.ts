import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

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
  const file = resolve(import.meta.dirname, "../src/Counter.tsx");
  const source = readFileSync(file, "utf8");
  await page.goto("/");
  await page.evaluate(() => ((window as unknown as { marker: number }).marker = 1));
  await expect(page.getByRole("button", { name: /Clicked/ })).toHaveText("Clicked 0 times");
  try {
    writeFileSync(file, source.replace("Clicked {count()} times", "Pressed {count()} times"));
    await expect(page.getByRole("button", { name: /Pressed/ })).toHaveText("Pressed 0 times");
    // One app root (the previous one was disposed) and the same page (no full reload).
    await expect(page.locator("main")).toHaveCount(1);
    expect(await page.evaluate(() => (window as unknown as { marker: number }).marker)).toBe(1);
  } finally {
    writeFileSync(file, source);
  }
  await expect(page.getByRole("button", { name: /Clicked/ })).toHaveText("Clicked 0 times");
});

test("compiler errors show in the dev overlay with a code frame", async ({ page }, info) => {
  test.skip(info.project.name !== "dev", "the overlay only exists in dev");
  const file = resolve(import.meta.dirname, "../src/Counter.tsx");
  const source = readFileSync(file, "utf8");
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Clicked/ })).toBeVisible();
  try {
    writeFileSync(file, source.replace("<h2>Counter</h2>", "<h2>Counter</h3>"));
    const overlay = page.locator("vite-error-overlay");
    await expect(overlay.locator(".message")).toContainText("LUM1001");
    await expect(overlay.locator(".plugin")).toContainText("lumen");
    await expect(overlay.locator(".frame")).toContainText("<h2>Counter</h3>");
    if (process.env.LUMEN_SCREENSHOTS) {
      await page.screenshot({ path: `${process.env.LUMEN_SCREENSHOTS}/vite-overlay.png` });
    }
  } finally {
    writeFileSync(file, source);
  }
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Clicked/ })).toHaveText("Clicked 0 times");
});
