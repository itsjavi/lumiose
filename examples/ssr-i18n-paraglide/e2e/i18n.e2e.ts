// The translated site end to end, on the production build: localized pages with their hreflang and
// canonical links, a locale a page does not declare (404), the language switcher and the detection
// cookie it updates, and Paraglide messages in an island.
import { expect, test, type Page } from "@playwright/test";

async function localeCookie(page: Page): Promise<string | undefined> {
  return (await page.context().cookies()).find((cookie) => cookie.name === "locale")?.value;
}

test("pages render in the locale of their URL", async ({ page }) => {
  await page.goto("/fr");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.locator("h1")).toHaveText("Du pain frais chaque matin");
  // Paraglide formats the price for the locale; Lumiose formats nothing.
  await expect(page.locator("main")).toContainText("Un croissant coûte 1,20 €.");
  await expect(page.locator(".brand")).toHaveText("Boulangerie Aurore");

  // /about is prerendered in English and Spanish only, with absolute URLs from `site`.
  await page.goto("/es/about");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.locator("h1")).toHaveText("Quiénes somos");
  await expect(page).toHaveTitle("Quiénes somos · Panadería Amanecer");
  const alternates = page.locator('link[rel="alternate"][hreflang]');
  await expect(alternates).toHaveCount(2);
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
    "href",
    "https://bakery.example/about",
  );
  await expect(page.locator('link[rel="alternate"][hreflang="es"]')).toHaveAttribute(
    "href",
    "https://bakery.example/es/about",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://bakery.example/es/about",
  );
});

test("a locale the page does not declare is a 404, in that locale", async ({ page }) => {
  const french = await page.goto("/fr/about");
  expect(french?.status()).toBe(404);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.locator("h1")).toHaveText("Page introuvable");

  // The default locale has no prefix.
  const english = await page.goto("/en/about");
  expect(english?.status()).toBe(404);
  await expect(page.locator("h1")).toHaveText("Page not found");

  // French pages link to the English /about, which exists.
  await page.goto("/fr");
  await page.getByRole("link", { name: "À propos" }).click();
  await expect(page).toHaveURL("/about");
  await expect(page.locator("h1")).toHaveText("About us");
});

test("the language switcher changes the locale and the detection cookie", async ({ page }) => {
  await page.goto("/");
  // The first visit recorded the browser's language. (Prerendered pages, such as /about, are
  // files: they never detect.)
  expect(await localeCookie(page)).toBe("en");
  await page.getByRole("link", { name: "About us" }).click();
  await expect(page).toHaveURL("/about");
  const switcher = page.getByRole("navigation", { name: "Language" });
  // Only the locales the page declares.
  await expect(switcher.getByRole("link")).toHaveText(["English", "Español"]);
  await expect(switcher.getByRole("link", { name: "English" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.waitForLoadState("networkidle"); // the island's click handler is ready

  await switcher.getByRole("link", { name: "Español" }).click();
  await expect(page).toHaveURL("/es/about");
  await expect(page.locator("h1")).toHaveText("Quiénes somos");
  expect(await localeCookie(page)).toBe("es");

  // The next visit to "/" opens in the chosen locale; deep links are left alone.
  await page.goto("/");
  await expect(page).toHaveURL("/es");
  await page.goto("/about");
  await expect(page).toHaveURL("/about");

  await page.goto("/es");
  await page.waitForLoadState("networkidle");
  await page
    .getByRole("navigation", { name: "Idioma" })
    .getByRole("link", { name: "English" })
    .click();
  await expect(page).toHaveURL("/");
  expect(await localeCookie(page)).toBe("en");
  await page.goto("/");
  await expect(page).toHaveURL("/");
});

test("an island renders and updates its messages in the page's locale", async ({ page }) => {
  await page.goto("/fr");
  const basket = page.locator(".basket");
  await expect(basket).toContainText("0 croissant dans votre panier");
  await basket.getByRole("button", { name: "Ajouter un croissant" }).click();
  await expect(basket).toContainText("1 croissant dans votre panier");
  await basket.getByRole("button", { name: "Ajouter un croissant" }).click();
  await expect(basket).toContainText("2 croissants dans votre panier");

  await page.goto("/es");
  await page.locator(".basket").getByRole("button", { name: "Añadir un cruasán" }).click();
  await expect(page.locator(".basket")).toContainText("1 cruasán en tu cesta");
});

test.describe("a first visit from a Spanish browser", () => {
  test.use({ locale: "es-ES" });

  test("is redirected from / to /es", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/es");
    expect(await localeCookie(page)).toBe("es");
  });
});
