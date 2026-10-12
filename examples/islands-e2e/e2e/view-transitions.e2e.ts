// useId() and view transitions in Chromium (TASK-247, TASK-252), on the Notes island: the server's
// ids survive hydration, and viewTransition() animates the named elements that enter, exit and
// move, with their <ViewTransition> classes, unless the reader prefers reduced motion.
import { expect, test, type Page } from "@playwright/test";

/** Long animations for the classes, so the test sees them while the transition runs. */
const CSS = `
::view-transition-new(.slide-in) { animation: vt-in 3s; }
::view-transition-old(.slide-out) { animation: vt-out 3s; }
@keyframes vt-in { from { opacity: 0; } }
@keyframes vt-out { to { opacity: 0; } }`;

/** The running view transition animations: `pseudo-element animation-name`. */
function animations(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    document
      .getAnimations()
      .map(
        (a) => `${(a.effect as KeyframeEffect).pseudoElement} ${(a as CSSAnimation).animationName}`,
      )
      .filter((a) => a.startsWith("::view-transition"))
      .toSorted(),
  );
}

/** Waits until no view transition runs. */
async function idle(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const a of document.getAnimations()) a.finish();
  });
  await expect.poll(() => animations(page)).toEqual([]);
}

const nameOf = (page: Page, text: string): Promise<string> =>
  page
    .locator(".notes li", { hasText: new RegExp(`^${text}$`) })
    .evaluate((li) => getComputedStyle(li).viewTransitionName);

test("useId() keeps the server's ids after hydration", async ({ page }) => {
  await page.goto("/");
  const heading = page.locator(".notes h2");
  const id = await heading.getAttribute("id");
  expect(id).toMatch(/^l\d+-0-0$/);
  await expect(page.locator(".notes")).toHaveAttribute("data-hydrated", "");
  await expect(heading).toHaveAttribute("id", id!);
  await expect(page.locator(".notes")).toHaveAttribute("aria-labelledby", id!);
});

test("viewTransition() animates entering, exiting and moving <ViewTransition>s", async ({
  page,
}) => {
  await page.goto("/");
  await page.addStyleTag({ content: CSS });
  await expect(page.locator(".notes")).toHaveAttribute("data-hydrated", "");
  const [a, b, c] = [await nameOf(page, "a"), await nameOf(page, "b"), await nameOf(page, "c")];
  expect(new Set([a, b, c]).size).toBe(3);
  expect(a).toMatch(/^l\d+-/);

  // Enter: the panel's new image runs the enter class's animation.
  await page.click(".notes .toggle");
  await expect.poll(() => animations(page)).toContain("::view-transition-new(note-panel) vt-in");
  await expect(page.locator(".notes .panel")).toBeVisible();
  await idle(page);

  // Exit: the panel's old image runs the exit class's animation.
  await page.click(".notes .toggle");
  await expect.poll(() => animations(page)).toContain("::view-transition-old(note-panel) vt-out");
  await expect(page.locator(".notes .panel")).toHaveCount(0);
  await idle(page);

  // A keyed list: a exits, "new" enters, c and b move (no enter or exit animation).
  await page.click(".notes .change");
  await expect.poll(() => animations(page)).toContain(`::view-transition-old(${a}) vt-out`);
  const running = await animations(page);
  const added = await nameOf(page, "new");
  expect(running).toContain(`::view-transition-new(${added}) vt-in`);
  for (const moved of [b, c]) {
    expect(running.filter((r) => r.includes(`(${moved})`) && /vt-(in|out)$/.test(r))).toEqual([]);
    expect(running).toContain(
      `::view-transition-group(${moved}) -ua-view-transition-group-anim-${moved}`,
    );
  }
  await expect(page.locator(".notes li")).toHaveText(["c", "b", "new"]);
  // The rows keep their names when they move.
  expect([await nameOf(page, "c"), await nameOf(page, "b")]).toEqual([c, b]);
});

test("viewTransition() updates at once when the reader prefers reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.addStyleTag({ content: CSS });
  await expect(page.locator(".notes")).toHaveAttribute("data-hydrated", "");
  await page.evaluate(() => {
    const start = document.startViewTransition.bind(document);
    (window as { started?: number }).started = 0;
    document.startViewTransition = ((update: () => void) => {
      (window as { started?: number }).started!++;
      return start(update);
    }) as typeof document.startViewTransition;
  });
  await page.click(".notes .toggle");
  await expect(page.locator(".notes .panel")).toBeVisible();
  expect(await page.evaluate(() => (window as { started?: number }).started)).toBe(0);
  expect(await animations(page)).toEqual([]);
});
