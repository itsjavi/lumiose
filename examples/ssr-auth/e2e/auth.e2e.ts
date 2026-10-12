// Accounts end to end, on the production build: sign-up, the protected page, sign-out (the form
// action and Better Auth's browser client in the island), sign-in back to where the visitor was,
// and the errors Better Auth reports. Each test creates its own user.
import { expect, test, type Browser, type Page } from "@playwright/test";

const PASSWORD = "correct horse battery";
let users = 0;
let clients = 0;
// Random per run of this file, so retries and repeats (which load it again) get new addresses.
const run = Math.floor(Math.random() * 0xffff).toString(16);

/**
 * A client address of its own (a /64 of the documentation range: Better Auth limits IPv6 clients
 * by /64), which the server trusts from 127.0.0.1 (TRUSTED_PROXIES).
 */
function clientAddress(): Record<string, string> {
  clients++;
  return { "x-forwarded-for": `2001:db8:${run}:${clients.toString(16)}::1` };
}

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders(clientAddress());
});

async function newClient(browser: Browser, options: { javaScriptEnabled?: boolean } = {}) {
  const context = await browser.newContext({ ...options, extraHTTPHeaders: clientAddress() });
  return { context, page: await context.newPage() };
}

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
  const { context, page } = await newClient(browser, { javaScriptEnabled: false });
  const user = await signUp(page);
  await expect(page.locator("main")).toContainText(`Signed in as ${user.name}`);
  await page.locator("main").getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/dashboard");
  await expect(page).toHaveURL("/sign-in?next=%2Fdashboard");
  await context.close();
});

test("repeated sign-ins from one client are rate-limited", async ({ page, browser }) => {
  const user = await signUp(page);
  await page.context().clearCookies();
  const attempt = async (target: Page, password: string) => {
    await target.goto("/sign-in");
    await target.getByLabel("Email").fill(user.email);
    await target.getByLabel("Password").fill(password);
    const [response] = await Promise.all([
      target.waitForResponse((r) => r.request().method() === "POST"),
      target.getByRole("button", { name: "Sign in" }).click(),
    ]);
    return response.status();
  };
  // Better Auth allows 3 sign-in attempts per 10 s per client address.
  for (let i = 0; i < 3; i++) expect(await attempt(page, "not the password")).toBe(401);
  expect(await attempt(page, PASSWORD)).toBe(429);
  await expect(page.getByRole("alert")).toHaveText("Too many requests. Please try again later.");

  // Another client is not affected.
  const other = await newClient(browser);
  await attempt(other.page, PASSWORD);
  await expect(other.page).toHaveURL("/dashboard");
  await other.context.close();
});
