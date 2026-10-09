import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Screenshots go to $DOTMATRIX_SHOTS when set (the dev project only).
const SHOTS = process.env.DOTMATRIX_SHOTS;
async function shot(page: Page, name: string, project: string) {
  if (SHOTS && project === "dev") await page.screenshot({ path: `${SHOTS}/task-133-${name}.png` });
}

declare global {
  var dotmatrix: {
    position(): number;
    song(): { title: string; tracks: { notes: { s: number; l: number; p: number }[] }[] };
  };
}

const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/learn");
  await page.evaluate(() => localStorage.clear());
});
test.afterEach(() => expect(errors).toEqual([]));

const notes = (page: Page) => page.locator(".lane .note");

async function readDownload(page: Page, click: () => Promise<void>) {
  const download = page.waitForEvent("download");
  await click();
  const file = await download;
  return { name: file.suggestedFilename(), data: readFileSync((await file.path())!) };
}

test("plays the studio song with a moving playhead", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.locator("#song-title")).toHaveValue("First Steps");
  await page.getByRole("button", { name: "Play song" }).click();
  await expect(page.locator(".transport .state")).toContainText("Playing");
  await expect(page.locator(".playhead")).toBeVisible();
  await expect.poll(() => page.evaluate(() => dotmatrix.position())).toBeGreaterThan(0.5);
  await expect(page.locator(".led.on")).toBeVisible();
  await shot(page, "studio", info.project.name);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Play song" })).toBeVisible();
});

test("adds, lengthens, removes and undoes notes on the grid", async ({ page }) => {
  await page.goto("/");
  const lane = page.locator(".lane");
  const box = (await lane.boundingBox())!;
  const cell = (step: number, row: number) => ({
    x: box.x + step * 22 + 8,
    y: box.y + row * 18 + 8,
  });
  const before = await notes(page).count();
  // Drag from step 1 to step 3 on the top row: one note, three steps long.
  await page.mouse.move(cell(1, 0).x, cell(1, 0).y);
  await page.mouse.down();
  await page.mouse.move(cell(3, 0).x, cell(3, 0).y, { steps: 4 });
  await page.mouse.up();
  await expect(notes(page)).toHaveCount(before + 1);
  const added = page.locator('.lane .note[data-step="1"]');
  await expect(added).toHaveAttribute("style", /--l: ?3/);
  // Undo removes it in one step (create and drag merge); redo brings it back.
  await page.keyboard.press("ControlOrMeta+z");
  await expect(notes(page)).toHaveCount(before);
  await expect(page.locator(".transport .state")).toContainText("Undo: Add note");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(notes(page)).toHaveCount(before + 1);
  // Clicking a note removes it.
  await page.mouse.click(cell(2, 0).x, cell(2, 0).y);
  await expect(notes(page)).toHaveCount(before);
  // The edit is autosaved.
  await page.reload();
  await expect(notes(page)).toHaveCount(before);
});

test("edits with the keyboard and switches channels", async ({ page }) => {
  await page.goto("/");
  await page.locator(".lane").focus();
  // The cursor starts on C5, step 1. One row up is D5, which is empty there.
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Shift+ArrowRight");
  const song = await page.evaluate(() => dotmatrix.song());
  // The new note cuts the C5 under it short: a channel plays one note at a time.
  expect(song.tracks[0]!.notes.slice(0, 2)).toEqual([
    { s: 0, l: 1, p: 72 },
    { s: 1, l: 3, p: 74 },
  ]);
  await expect(page.locator(".lane")).toBeFocused();
  // Channel 4 (noise) shows the drum kit rows.
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("4");
  await expect(page.locator(".keys .key").first()).toHaveText("CR");
  await expect(page.getByRole("radio", { name: /Noise/ })).toHaveAttribute("aria-checked", "true");
});

test("changes a preset and fine-tunes it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("radio", { name: "Music box" }).click();
  await expect(page.locator(".status")).toContainText("MUSIC BOX");
  await page.getByText("Fine-tune").click();
  await page.getByRole("radio", { name: "75%" }).click();
  const song = await page.evaluate(
    () => dotmatrix.song() as unknown as { tracks: { inst: { duty: number; preset: string } }[] },
  );
  expect(song.tracks[0]!.inst).toMatchObject({ duty: 3, preset: "bell" });
});

test("plays a demo from the gallery and opens it in the studio", async ({ page }, info) => {
  await page.goto("/songs");
  await expect(page.locator(".cart")).toHaveCount(5);
  await page.getByRole("button", { name: "Listen to Rival Clash" }).click();
  await expect(page.getByRole("button", { name: "Stop Rival Clash" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => dotmatrix.position())).toBeGreaterThan(0.5);
  await shot(page, "songs", info.project.name);
  await page.getByRole("button", { name: "Open Rival Clash in the studio" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#song-title")).toHaveValue("Rival Clash");
  await expect(page.locator(".flag")).toHaveText("LOOP");
  // Undo brings back the previous song.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("#song-title")).toHaveValue("First Steps");
});

test("exports the studio song as a looping WAV file", async ({ page }) => {
  await page.goto("/");
  const { name, data } = await readDownload(page, () =>
    page.getByRole("button", { name: "Export WAV" }).click(),
  );
  expect(name).toBe("first-steps.wav");
  expect(data.subarray(0, 4).toString("ascii")).toBe("RIFF");
  expect(data.subarray(8, 12).toString("ascii")).toBe("WAVE");
  expect(data.includes(Buffer.from("smpl"))).toBe(true);
  // 4 bars at 112 BPM, twice (intro plus loop), 48 kHz stereo 16-bit: about 3.3 MB.
  expect(data.length).toBeGreaterThan(3_000_000);
});

test("shares a song through its URL", async ({ page, browser }) => {
  await page.goto("/");
  await page.locator("#song-title").fill("Shared tune");
  await page.locator("#song-title").press("Enter");
  const lane = page.locator(".lane");
  const box = (await lane.boundingBox())!;
  await page.mouse.click(box.x + 6 * 22 + 8, box.y + 1 * 18 + 8);
  await page.getByRole("button", { name: "Share" }).click();
  const url = await page.locator("#share-url").inputValue();
  expect(url).toMatch(/\/\?song=1\./);
  const expected = await page.evaluate(() => dotmatrix.song());

  // A fresh browser (no saved song) opens the link.
  const other = await browser.newContext();
  const fresh = await other.newPage();
  await fresh.goto(url);
  await expect(fresh.locator("#song-title")).toHaveValue("Shared tune");
  await expect(fresh).toHaveURL(/\/$/);
  const opened = await fresh.evaluate(() => dotmatrix.song());
  expect(opened.tracks).toEqual(expected.tracks);
  await other.close();
});

test("SFX gallery: plays, bends, shows code and exports", async ({ page }, info) => {
  await page.goto("/sfx");
  await expect(page.locator(".pad")).toHaveCount(15);
  await page.getByRole("button", { name: /^Jump/ }).click();
  await expect(page.locator("#maker-title")).toHaveText("Jump");
  await page.getByRole("button", { name: "Show code" }).click();
  await expect(page.locator(".code pre")).toContainText("pitch_sweep 2, 4");
  await page.locator(".maker input[type=range]").first().fill("5");
  await expect(page.locator(".code pre")).toContainText("F5");
  await shot(page, "sfx", info.project.name);
  const { name, data } = await readDownload(page, () =>
    page.getByRole("button", { name: "Export WAV" }).click(),
  );
  expect(name).toBe("jump.wav");
  expect(data.subarray(8, 12).toString("ascii")).toBe("WAVE");
  expect(data.length).toBeGreaterThan(20_000);
});

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("fits the studio, gallery and SFX pages without sideways scrolling", async ({
    page,
  }, info) => {
    for (const [path, name] of [
      ["/", "studio-phone"],
      ["/songs", "songs-phone"],
      ["/sfx", "sfx-phone"],
    ] as const) {
      await page.goto(path);
      await page.waitForTimeout(300);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
      await shot(page, name, info.project.name);
    }
  });
});

test("dark theme", async ({ page }, info) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await page.getByRole("radio", { name: "Dusk" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-lcd", "dusk");
  await shot(page, "studio-dark", info.project.name);
});
