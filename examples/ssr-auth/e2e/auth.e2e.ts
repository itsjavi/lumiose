// Accounts end to end, on the production build: sign-up, the protected page, sign-out (the form
// action and Better Auth's browser client in the island), sign-in back to where the visitor was,
// and the errors Better Auth reports. Each test creates its own user.
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "correct horse battery";
let users = 0;

async function signUp(page: Page): Promise<{ name: string; email: string }> {
  const id = `${Date.now().toString(36)}${users++}`;
  const user = { name: `Tester ${id}`, email: `tester-${id}@example.com` };
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(user.name);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL("/dashboard");
  return user;
}

test("a protected page sends visitors to sign in", async ({ page }) => {
  const response = await page.goto("/dashboard");
  await expect(page).toHaveURL("/sign-in?next=%2Fdashboard");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("sign up, sign out with the form, sign in again", async ({ page }) => {
  const user = await signUp(page);
  await expect(page.locator("main")).toContainText(`Signed in as ${user.name} (${user.email})`);
  // The island in the header asked Better Auth's client for the session.
  await expect(page.locator("header .account")).toContainText(user.name);

  await page.locator("main").getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator("header .account")).toContainText("Sign in");
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/sign-in?next=%2Fdashboard");

  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/dashboard");
  await expect(page.locator("main")).toContainText(`Signed in as ${user.name}`);
});

test("the island signs out with Better Auth's client", async ({ page }) => {
  const user = await signUp(page);
  await page.goto("/");
  const account = page.locator("header .account");
  await expect(account).toContainText(user.name);
  await account.getByRole("button", { name: "Sign out" }).click();
  await expect(account).toContainText("Sign in");
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/sign-in?next=%2Fdashboard");
});

test("Better Auth's errors show on the forms", async ({ page }) => {
  const user = await signUp(page);
  await page.context().clearCookies();

  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Invalid email or password");
  await expect(page.getByLabel("Email")).toHaveValue(user.email);

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Someone else");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("alert")).not.toBeEmpty();
  await expect(page).toHaveURL("/sign-up");
});

test("the forms work without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const user = await signUp(page);
  await expect(page.locator("main")).toContainText(`Signed in as ${user.name}`);
  await page.locator("main").getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/sign-in?next=%2Fdashboard");
  await context.close();
});
