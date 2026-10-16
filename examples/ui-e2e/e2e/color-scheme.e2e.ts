// A forced colour scheme (TASK-441 M37): the default theme's colours are `light-dark()`, which
// follows the `color-scheme` of each element. Set on a subtree, inline or from a script, it switches
// the theme there, in production builds too: @lumiose/vite's CSS target keeps `light-dark()` as
// written, where an older one lowers it to variables that follow the system's scheme only.
import { expect, test, type Page } from "@playwright/test";

/** The background of the first and the second default-theme button on /button. */
const backgrounds = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll(".lu-button:not([data-variant])")]
      .slice(0, 2)
      .map((button) => getComputedStyle(button).backgroundColor),
  );

for (const system of ["light", "dark"] as const) {
  const other = system === "light" ? "dark" : "light";

  test(`a ${other} subtree and an inline ${other} scheme flip the theme (system ${system})`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: system });
    await page.goto("/button");
    const [first, second] = await backgrounds(page);
    expect(first).toBe(second);
    // A subtree: the first button's section only.
    await page.evaluate((scheme) => {
      const section = document.querySelector(".lu-button")!.closest("section")!;
      section.style.colorScheme = scheme;
    }, other);
    const [inSubtree, outside] = await backgrounds(page);
    expect(inSubtree).not.toBe(first);
    expect(outside).toBe(first);
    // Inline on the root, from a script: every button.
    await page.evaluate((scheme) => {
      document.querySelector<HTMLElement>(".lu-button")!.closest("section")!.style.colorScheme = "";
      document.documentElement.style.colorScheme = scheme;
    }, other);
    expect(await backgrounds(page)).toEqual([inSubtree, inSubtree]);
  });
}
