// End-to-end tests of the built bookshelf served by @lumen/adapter-node (see playwright.config.ts):
// prerendered and server pages, streaming, form actions with and without JavaScript, sessions and
// the four islands. Tests that change data register a fresh reader, so they do not depend on
// each other. BOOKSHELF_SCREENSHOTS=1 also saves screenshots to backlog/assets/task-36-*.png.
import { expect, test, type Page } from "@playwright/test";

const BOOK = { isbn: "9786277549893", title: "A Bakery to Remember" };
const ASSETS = new URL("../../../backlog/assets/", import.meta.url);

async function screenshot(page: Page, name: string, fullPage = false): Promise<void> {
  if (!process.env.BOOKSHELF_SCREENSHOTS) return;
  await page.screenshot({ path: new URL(`task-36-${name}.png`, ASSETS).pathname, fullPage });
}

let readers = 0;

/** Registers and signs in a new reader through the form; returns their name. */
async function register(page: Page, next?: string): Promise<string> {
  const id = `${Date.now().toString(36)}${readers++}`;
  const name = `Tester ${id}`;
  await page.goto(next === undefined ? "/register" : `/register?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(`tester-${id}@example.com`);
  await page.getByLabel("Password").fill("correct horse");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator(".site-header")).toContainText(name);
  return name;
}

/** Waits for an enhanced (island) form post: `submit()` sends the x-lumen-action header. */
function enhancedPost(page: Page, action: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes(action) &&
      response.request().headers()["x-lumen-action"] === "1",
  );
}

test.beforeEach(({ page }) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  page.on("console", (message) => {
    // A hydration mismatch (LUM4006) or a runtime error fails the test (404 responses log too).
    const text = message.text();
    if (text.startsWith("Failed to load resource")) return;
    if (message.type() === "error" || text.includes("LUM4006")) {
      throw new Error(`console ${message.type()}: ${message.text()}`);
    }
  });
});

test.describe("pages", () => {
  test("the home page sends its shell, then streams the recommendations", async ({
    page,
    request,
  }) => {
    const html = await (await request.get("/")).text();
    // The fallback is in the shell; the content arrives later in a <template for> chunk.
    expect(html.indexOf("Finding books you might like")).toBeGreaterThan(-1);
    expect(html.indexOf("Finding books you might like")).toBeLessThan(
      html.indexOf("<template for="),
    );

    await page.goto("/");
    await expect(page).toHaveTitle("Bookshelf");
    const recommended = page.locator("section", { hasText: "Recommended" });
    await expect(recommended.locator(".book-card").first()).toBeVisible();
    await expect(page.locator(".placeholder")).toHaveCount(0);
    await expect(
      page.locator("section", { hasText: "Featured" }).locator(".book-card"),
    ).toHaveCount(6);
    await screenshot(page, "home");
  });

  test("static pages are prerendered and served from dist/client", async ({ page, request }) => {
    for (const path of ["/about", "/genres", "/genres/fantasy"]) {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      expect(response.headers()["etag"]).toBeTruthy();
      expect(response.headers()["cache-control"]).toBe("public, max-age=0, must-revalidate");
    }
    await page.goto("/genres");
    await page.getByRole("link", { name: /Fantasy/ }).click();
    await expect(page).toHaveURL(/\/genres\/fantasy$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Fantasy");
    await expect(page.locator(".book-card")).not.toHaveCount(0);
    await page.getByRole("link", { name: /Browse all \d+/ }).click();
    await expect(page).toHaveURL(/\/books\?genre=fantasy$/);
    await expect(page.getByLabel("Genre")).toHaveValue("fantasy");
  });

  test("the book list filters, sorts, searches and paginates", async ({ page }) => {
    await page.goto("/books");
    await expect(page.locator(".summary")).toContainText("200 books");
    await expect(page.locator(".book-card")).toHaveCount(24);

    const pager = page.getByRole("navigation", { name: "Book pages" });
    await pager.getByRole("link", { name: "Next →" }).click();
    await expect(page).toHaveURL(/\/books\?page=2$/);
    await expect(pager.locator("[aria-current=page]")).toHaveText("2");

    await page.getByLabel("Genre").selectOption("mystery");
    await page.getByLabel("Sort").selectOption("rating");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page).toHaveURL(/\/books\?q=&genre=mystery&sort=rating$/);
    await expect(page.locator(".summary")).toContainText("in Mystery");
    await expect(page.locator(".book-card")).not.toHaveCount(0);

    await page.getByLabel("Search", { exact: true }).fill("bakery");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.locator(".summary")).toContainText("matching “bakery”");
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/books$/);
  });

  test("book, author and genre pages link to each other", async ({ page }) => {
    await page.goto(`/books/${BOOK.isbn}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(BOOK.title);
    await expect(page.getByRole("list", { name: "Ratings by stars" }).locator("li")).toHaveCount(5);
    const author = page.locator(".authors a").first();
    const name = (await author.textContent())!;
    await author.click();
    await expect(page).toHaveURL(/\/authors\/[a-z-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(page.getByRole("link", { name: BOOK.title }).first()).toBeVisible();
    await screenshot(page, "author");

    await page.goto("/authors?q=moreau");
    await expect(page.locator(".authors li").first()).toContainText("Moreau");
    await page.goto("/authors");
    await screenshot(page, "authors");
  });

  test("unknown pages and books render the 404 page", async ({ page }) => {
    for (const path of ["/no-such-page", "/books/9780000000000", "/authors/nobody"]) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    }
  });
});

test.describe("accounts", () => {
  test("signing in shows field errors, then starts a session; signing out ends it", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("reader@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator(".error").filter({ hasText: /./ })).toHaveText(
      "Wrong email or password.",
    );
    await expect(page.getByLabel("Email")).toHaveValue("reader@example.com");

    await page.getByLabel("Password").fill("bookshelf");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator(".site-header")).toContainText("Demo Reader");
    await expect(page.getByRole("heading", { name: "Picked for Demo Reader" })).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("registering validates the form and signs the new reader in", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Name").fill("Someone");
    await page.getByLabel("Email").fill("reader@example.com");
    await page.getByLabel("Password").fill("long enough");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.locator(".error").filter({ hasText: /./ })).toHaveText(
      "An account with this email already exists.",
    );
    await expect(page.getByLabel("Name")).toHaveValue("Someone");

    const name = await register(page);
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole("link", { name }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
    await expect(page.getByText("You have not reviewed any books yet.")).toBeVisible();
  });

  test("private pages send signed-out readers to sign in and back", async ({ page }) => {
    await page.goto("/reading-list");
    await expect(page).toHaveURL(/\/login\?next=%2Freading-list$/);
    await page.getByLabel("Email").fill("reader@example.com");
    await page.getByLabel("Password").fill("bookshelf");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/reading-list$/);
    await expect(page.getByRole("heading", { name: "Your reading list" })).toBeVisible();
    await expect(page.locator(".entry")).not.toHaveCount(0);
  });

  test("the account menu island shows the reader on prerendered pages", async ({ page }) => {
    await page.goto("/about");
    await expect(page.locator(".site-header").getByRole("link", { name: "Sign in" })).toBeVisible();
    const name = await register(page, "/about");
    await expect(page).toHaveURL(/\/about$/);
    // The prerendered HTML has the signed-out links; the island asks /api/me once idle.
    await expect(page.locator(".account-menu")).toContainText(name);
    await expect(
      page.locator(".account-menu").getByRole("button", { name: "Sign out" }),
    ).toBeVisible();
    await screenshot(page, "about-account-menu");
  });
});

test.describe("islands", () => {
  test("the search box suggests books as you type and opens one with the keyboard", async ({
    page,
  }) => {
    await page.goto("/books");
    const search = page.getByRole("combobox", { name: "Search books" });
    const suggestions = page.getByRole("listbox", { name: "Suggestions" });
    await search.fill("bakery");
    await expect(suggestions.getByRole("option").first()).toContainText(BOOK.title);
    await screenshot(page, "search");
    await search.press("ArrowDown");
    await expect(suggestions.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
    await search.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/books/${BOOK.isbn}$`));

    // Enter without a highlighted suggestion submits the plain search form.
    await page.getByRole("combobox", { name: "Search books" }).fill("remember");
    await page.getByRole("combobox", { name: "Search books" }).press("Enter");
    await expect(page).toHaveURL(/\/books\?q=remember$/);
  });

  test("reading-list toggles post without leaving the page", async ({ page }) => {
    await register(page);
    await page.goto("/books");
    const card = page.locator(".book-card", { hasText: BOOK.title });
    const toggle = card.getByRole("button", { name: "+ Reading list" });
    // On MPA pages submit() never reloads (decision-20): the island updates itself.
    await page.evaluate(() => ((window as { notReloaded?: boolean }).notReloaded = true));
    const posted = enhancedPost(page, "/reading-list?/toggle");
    await toggle.click();
    expect((await posted).status()).toBe(200);
    await expect(card.getByRole("button", { name: "✓ On your list" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await page.evaluate(() => (window as { notReloaded?: boolean }).notReloaded)).toBe(true);
    await expect(page).toHaveURL(/\/books$/);
    await screenshot(page, "books");

    await page.goto(`/books/${BOOK.isbn}`);
    await expect(page.getByRole("button", { name: "✓ On your list" })).toBeVisible();
    await page.goto("/reading-list");
    await expect(page.locator(".entry")).toHaveCount(1);
    await expect(page.locator(".entry")).toContainText(BOOK.title);
    await screenshot(page, "reading-list");

    // The island removes its own entry instead of reloading for fresh server data.
    await page.evaluate(() => ((window as { notReloaded?: boolean }).notReloaded = true));
    const off = enhancedPost(page, "/reading-list?/toggle");
    await page.getByRole("button", { name: "✓ On your list" }).click();
    await off;
    await expect(page.locator(".entry")).toHaveCount(0);
    expect(await page.evaluate(() => (window as { notReloaded?: boolean }).notReloaded)).toBe(true);
  });

  test("reviews: the star input checks the rating, then create, edit and delete", async ({
    page,
  }) => {
    await register(page);
    await page.goto(`/books/${BOOK.isbn}`);
    const form = page.locator("#your-review form");
    // Hovering lights the stars once the island (client:visible) has hydrated.
    await page.getByRole("radio", { name: "2 stars" }).hover();
    await expect(page.locator(".star-input label.lit")).toHaveCount(2);
    await form.getByRole("textbox", { name: "Review", exact: true }).fill("A warm, funny read.");
    const posts: string[] = [];
    page.on("request", (request) => {
      if (request.method() === "POST") posts.push(request.url());
    });
    await form.getByRole("button", { name: "Post review" }).click();
    // The island runs validateReview() before posting: no request, a hint instead.
    await expect(page.getByRole("alert")).toHaveText("Choose a rating from 1 to 5 stars.");
    expect(posts).toEqual([]);

    await page.getByRole("radio", { name: "4 stars" }).check();
    await expect(page.locator(".star-input .error")).toBeEmpty();
    await expect(page.locator(".star-input output")).toHaveText("Very good");
    await form.getByRole("textbox", { name: /Title/ }).fill("Sweet");
    await form.getByRole("button", { name: "Post review" }).click();
    await expect(page).toHaveURL(new RegExp(`/books/${BOOK.isbn}#your-review$`));
    const mine = page.locator("#your-review .review");
    await expect(mine).toContainText("Sweet");
    await expect(mine).toContainText("You ·");
    await expect(page.locator("#reviews .review.own").first()).toContainText("Sweet");
    await screenshot(page, "book", true);

    await page.getByText("Edit your review").click();
    const edit = page.locator("#your-review details form");
    await expect(edit.getByRole("radio", { name: "4 stars" })).toBeChecked();
    await edit.getByRole("radio", { name: "5 stars" }).check();
    await edit.getByRole("textbox", { name: "Review", exact: true }).fill("Even better twice.");
    await edit.getByRole("button", { name: "Save changes" }).click();
    await expect(mine).toContainText("Even better twice.");
    await expect(mine).toContainText("edited");
    await expect(mine.getByRole("img", { name: "5 out of 5 stars" })).toBeVisible();

    await page.goto("/profile");
    await expect(page.locator(".review")).toHaveCount(1);
    await expect(page.locator(".review")).toContainText(BOOK.title);
    await screenshot(page, "profile");

    await page.goto(`/books/${BOOK.isbn}`);
    await page.getByRole("button", { name: "Delete review" }).click();
    await expect(
      page.locator("#your-review form").getByRole("button", { name: "Post review" }),
    ).toBeVisible();
    await expect(page.locator("#reviews .review.own")).toHaveCount(0);
  });

  test("changing someone else's review is forbidden", async ({ page }) => {
    await register(page);
    // A crafted post (from the page, so it carries the session cookie and the Origin header).
    const result = await page.evaluate(async (isbn) => {
      const response = await fetch(`/books/${isbn}?/deleteReview`, {
        method: "POST",
        body: new URLSearchParams({ reviewId: "1" }),
        redirect: "manual",
      });
      return { status: response.status, text: await response.text() };
    }, BOOK.isbn);
    expect(result.status).toBe(403);
    expect(result.text).toContain("You can only change your own reviews.");
  });
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("forms still work: register, reading list, review validation and posting", async ({
    page,
  }) => {
    await register(page);
    await page.goto(`/books/${BOOK.isbn}`);
    // The toggle is a plain form: the action redirects back to the book.
    await page.getByRole("button", { name: "+ Reading list" }).click();
    await expect(page).toHaveURL(new RegExp(`/books/${BOOK.isbn}$`));
    await expect(page.getByRole("button", { name: "✓ On your list" })).toBeVisible();

    // The action validates: fail(400) re-renders the page with the errors and the typed values.
    const form = page.locator("#your-review form");
    await form.getByRole("textbox", { name: /Title/ }).fill("Short");
    await form.getByRole("textbox", { name: "Review", exact: true }).fill("Too short");
    await form.getByRole("button", { name: "Post review" }).click();
    await expect(page.locator("#your-review")).toContainText("Choose a rating from 1 to 5 stars.");
    await expect(page.locator("#your-review")).toContainText("Write at least 10 characters.");
    await expect(form.getByRole("textbox", { name: /Title/ })).toHaveValue("Short");
    await screenshot(page, "review-errors-no-js");

    await page.getByRole("radio", { name: "3 stars" }).check();
    await form.getByRole("textbox", { name: "Review", exact: true }).fill("Fine without scripts.");
    await form.getByRole("button", { name: "Post review" }).click();
    await expect(page.locator("#your-review .review")).toContainText("Fine without scripts.");
  });
});
