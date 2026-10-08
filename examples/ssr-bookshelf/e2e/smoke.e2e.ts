// Smoke test of the built bookshelf served by @lumen/adapter-node: prerendered and server pages,
// streaming, the search endpoint, the 404 page and the sign-in form action.
import { expect, test } from "@playwright/test";

test.beforeEach(({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
});

test("the home page streams the recommendations after the shell", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Bookshelf");
  await expect(page.locator(".book-grid .book-card").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(
    page.locator("section", { hasText: "Recommended" }).locator(".book-card").first(),
  ).toBeVisible();
  await expect(page.locator(".loading")).toHaveCount(0);
});

test("/about is prerendered and served from dist/client", async ({ page, request }) => {
  const response = await request.get("/about");
  expect(response.status()).toBe(200);
  expect(response.headers()["etag"]).toBeTruthy();
  expect(response.headers()["cache-control"]).toBe("public, max-age=0, must-revalidate");
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "About this sample" })).toBeVisible();
});

test("books list and detail render per request", async ({ page }) => {
  await page.goto("/books");
  const first = page.locator(".book-card a").first();
  const title = (await first.locator("h3").textContent())!.trim();
  await first.click();
  await expect(page).toHaveURL(/\/books\/\d{13}$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
});

test("the search endpoint answers JSON", async ({ request }) => {
  const response = await request.get("/api/search?q=the");
  expect(response.status()).toBe(200);
  expect(Array.isArray((await response.json()).results)).toBe(true);
});

test("unknown URLs render the 404 page", async ({ page }) => {
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("signing in runs the form action: field errors, then a session", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("reader@example.com");
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator(".error")).toHaveText("Wrong email or password.");
  await expect(page.getByLabel("Email")).toHaveValue("reader@example.com");

  await page.getByLabel("Password").fill("bookshelf");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".site-header .account")).toContainText("Signed in as");

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});
