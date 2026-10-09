import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Screenshots go to $CHIPTUNE_SHOTS when set (the dev project only).
const SHOTS = process.env.CHIPTUNE_SHOTS;
async function shot(page: Page, name: string, project: string) {
  if (SHOTS && project === "dev") await page.screenshot({ path: `${SHOTS}/task-35-${name}.png` });
}

interface FrameStats {
  frames: number;
  fps: number;
  avgInterval: number;
  p95Interval: number;
  maxInterval: number;
  slowFrames: number;
  avgWork: number;
  p95Work: number;
}
declare global {
  var chiptune: { frameStats(): FrameStats; resetFrameStats(): void };
}

const errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors.length = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  // Start each test from the bundled demo song: `/` opens the tracker on it (`/songs/<id>`).
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await expect(page).toHaveURL(/\/songs\/\w+$/);
  await expect(page.locator(".row").first()).toBeVisible();
});
test.afterEach(() => expect(errors).toEqual([]));

const lcd = (page: Page) => page.locator(".lcd");
const level = (page: Page, channel: number) =>
  page
    .locator(".heads .vu")
    .nth(channel)
    .evaluate((el) => Number((el as HTMLElement).style.getPropertyValue("--level") || 0));
const noteAt = (page: Page, row: number, channel: number) =>
  page.locator(`.row[data-row="${row}"] .cell[data-ch="${channel}"] .note`);

test("the pages are cross-origin isolated (COOP/COEP from lumen({ headers }))", async ({ page }) => {
  expect(await page.evaluate(() => globalThis.crossOriginIsolated)).toBe(true);
});

test("plays the demo song with moving rows, meters and scopes", async ({ page }, info) => {
  await page.getByRole("button", { name: "Play song" }).click();
  await expect(page.locator(".engine")).toHaveText("AUDIO ON");
  await expect(lcd(page)).toContainText(/ROW (0[8-9A-F]|[1-3][0-9A-F])/);
  await expect.poll(() => level(page, 2)).toBeGreaterThan(0); // the triangle bass
  // Measure frame timing for 5 s of playback with every meter and scope animating.
  await page.evaluate(() => chiptune.resetFrameStats());
  await page.waitForTimeout(5000);
  const stats = await page.evaluate(() => chiptune.frameStats());
  console.log(`[${info.project.name}] frames while playing:`, JSON.stringify(stats));
  expect(stats.frames).toBeGreaterThan(200);
  expect(stats.p95Work).toBeLessThan(4);
  // The follow mode keeps the playing row centered: the cursor row tracks it.
  await expect(page.locator(".playbar")).toBeVisible();
  await shot(page, "tracker-playing", info.project.name);
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByRole("button", { name: "Play song" })).toBeVisible();
});

test("enters notes from the keyboard, selects, transposes and undoes", async ({ page }, info) => {
  await page.locator(".viewport").focus();
  // Pulse 1 is empty in the intro pattern. Z X C at octave 4: C-4 D-4 E-4.
  for (const key of ["z", "x", "c"]) await page.keyboard.press(key);
  await expect(noteAt(page, 0, 0)).toHaveText("C-4");
  await expect(noteAt(page, 1, 0)).toHaveText("D-4");
  await expect(noteAt(page, 2, 0)).toHaveText("E-4");
  await expect(page.locator(`.row[data-row="0"] .cell[data-ch="0"] .inst`)).toHaveText("00");
  // Octave up, then a note off.
  await page.keyboard.press("]");
  await page.keyboard.press("q"); // C-6 (octave 5 + 12)
  await page.keyboard.press("1");
  await expect(noteAt(page, 3, 0)).toHaveText("C-6");
  await expect(noteAt(page, 4, 0)).toHaveText("===");
  // Volume and effect columns.
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight"); // volume
  await page.keyboard.press("a");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowRight"); // effect
  await page.keyboard.press("4");
  await page.keyboard.press("3");
  await page.keyboard.press("6");
  const fourth = page.locator(`.row[data-row="4"] .cell[data-ch="0"]`);
  await expect(fourth.locator(".vol")).toHaveText("A");
  await expect(fourth.locator(".fx")).toHaveText("4");
  await expect(fourth.locator(".param")).toHaveText("36");
  // Select rows 0-2 and transpose them up a semitone.
  await page.keyboard.press("Home");
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("Shift+ArrowDown");
  await expect(page.locator(".selection")).toBeVisible();
  await page.keyboard.press("Alt+ArrowUp");
  await expect(noteAt(page, 0, 0)).toHaveText("C#4");
  await expect(noteAt(page, 2, 0)).toHaveText("F-4");
  await shot(page, "editing", info.project.name);
  // Undo the transpose, then the effect parameter digits.
  await page.keyboard.press("ControlOrMeta+z");
  await expect(noteAt(page, 0, 0)).toHaveText("C-4");
  await expect(page.locator(".status .message")).toHaveText("Undo: Transpose up");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(fourth.locator(".param")).toHaveText("30");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(fourth.locator(".param")).toHaveText("36");
  // Copy the three notes and paste them 8 rows down.
  await page.keyboard.press("Escape");
  await page.keyboard.press("Home");
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("ControlOrMeta+c");
  await page.keyboard.press("PageDown");
  await page.keyboard.press("ControlOrMeta+v");
  await expect(noteAt(page, 18, 0)).toHaveText("C-4");
  await expect(noteAt(page, 20, 0)).toHaveText("E-4");
});

test("mutes and solos channels from the mixer", async ({ page }) => {
  await page.getByRole("button", { name: "Play song" }).click();
  await expect.poll(() => level(page, 2)).toBeGreaterThan(0);
  const mute = page.getByRole("button", { name: "Mute Triangle" }).first();
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => level(page, 2)).toBe(0);
  await expect.poll(() => level(page, 3)).toBeGreaterThan(0); // the noise drums keep playing
  await mute.click();
  await page.getByRole("button", { name: "Solo Noise" }).first().click();
  await expect.poll(() => level(page, 2)).toBe(0);
  await expect.poll(() => level(page, 3)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Stop" }).click();
});

test("exports the song as a WAV file", async ({ page }) => {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "WAV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("lumen-quest.wav");
  const data = readFileSync((await file.path())!);
  expect(data.subarray(0, 4).toString("ascii")).toBe("RIFF");
  expect(data.subarray(8, 12).toString("ascii")).toBe("WAVE");
  // 8 orders × 64 rows × 0.1 s + a 1.5 s tail, 44.1 kHz stereo 16-bit.
  const seconds = (data.length - 44) / (44100 * 4);
  expect(seconds).toBeCloseTo(52.7, 1);
  // Not silence: the peak sample is loud.
  const pcm = new Int16Array(data.buffer, data.byteOffset + 44, (data.length - 44) / 2);
  let peak = 0;
  for (let i = 0; i < pcm.length; i += 7) peak = Math.max(peak, Math.abs(pcm[i]!));
  expect(peak).toBeGreaterThan(8000);
  await expect(page.locator(".status .message")).toContainText("Exported");
});

test("edits instrument macros by drawing and by text", async ({ page }, info) => {
  await page.keyboard.press("F2");
  await expect(page.getByRole("heading", { name: "Instrument 00" })).toBeVisible();
  const volume = page.getByRole("region", { name: "Volume macro" });
  const text = volume.getByRole("textbox");
  await expect(text).toHaveValue("15 14 13 12 11 11 10 10 9 9 / 7 5 3 2 1 0");
  // Draw a line across the first steps: one undo step.
  const bars = volume.locator(".bars");
  const box = (await bars.boundingBox())!;
  await page.mouse.move(box.x + 2, box.y + box.height * 0.9);
  await page.mouse.down();
  for (let x = 2; x < box.width * 0.2; x += 6)
    await page.mouse.move(box.x + x, box.y + box.height * 0.9);
  await page.mouse.up();
  await expect(text).not.toHaveValue("15 14 13 12 11 11 10 10 9 9 / 7 5 3 2 1 0");
  // A flat low line over the first steps (1 or 2 of 15, depending on the bars' borders).
  await expect(text).toHaveValue(/^([12]) \1 \1 /);
  // Typed MML with a loop and a release point.
  const arp = page.getByRole("region", { name: "Arpeggio macro" }).getByRole("textbox");
  await arp.fill("0 | 4 7 / 12");
  await arp.press("Enter");
  await expect(arp).toHaveValue("0 | 4 7 / 12");
  await shot(page, "instruments", info.project.name);
  await page.keyboard.press("Tab"); // leave the field so shortcuts reach the app
  await page.keyboard.press("ControlOrMeta+z");
  await expect(arp).toHaveValue("");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(text).toHaveValue("15 14 13 12 11 11 10 10 9 9 / 7 5 3 2 1 0");
});

test("saves to the library, switches theme and shows the other views", async ({ page }, info) => {
  await page.keyboard.press("F3");
  const title = page.getByRole("textbox", { name: "Title" });
  await title.fill("Night Shift");
  await expect(page.locator(".header .title")).toHaveText("Night Shift");
  await expect(page.locator(".library li").first()).toContainText("Night Shift");
  await page.getByRole("button", { name: "New song" }).click();
  await expect(page.locator(".library li")).toHaveCount(2);
  await shot(page, "songs", info.project.name);
  await page
    .locator(".library li", { hasText: "Night Shift" })
    .getByRole("button", { name: "Load" })
    .click();
  await expect(page.locator(".header .title")).toHaveText("Night Shift");
  // The library survives a reload.
  await page.reload();
  await expect(page.locator(".header .title")).toHaveText("Night Shift");
  await page.keyboard.press("F4");
  await page.getByRole("radio", { name: "DMG green" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dmg");
  await shot(page, "settings-dmg", info.project.name);
  await page.keyboard.press("F1");
  await page.getByRole("button", { name: "Play song" }).click();
  await page.waitForTimeout(1500);
  await shot(page, "tracker-dmg", info.project.name);
  await page.getByRole("button", { name: "Stop" }).click();
});

test("views are routes: playback and the mixer persist, songs deep-link", async ({ page }) => {
  // The mixer and the transport live in the root layout: they stay mounted across views.
  await page.locator(".mixer").evaluate((el) => ((el as unknown as { kept: boolean }).kept = true));
  await page.getByRole("button", { name: "Play song" }).click();
  await expect.poll(() => level(page, 2)).toBeGreaterThan(0);
  await page.getByRole("link", { name: "Instruments" }).click();
  await expect(page).toHaveURL(/\/instruments$/);
  await expect(page.getByRole("heading", { name: "Instrument 00" })).toBeVisible();
  await page.getByRole("link", { name: "Songs" }).click();
  await expect(page.locator(".library")).toBeVisible();
  // Still playing, and the mixer's meters still move.
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible();
  const mixerLevel = () =>
    page
      .locator(".mixer .vu")
      .nth(2)
      .evaluate((el) => Number((el as HTMLElement).style.getPropertyValue("--level") || 0));
  await expect.poll(mixerLevel).toBeGreaterThan(0);
  expect(
    await page.locator(".mixer").evaluate((el) => (el as unknown as { kept?: boolean }).kept),
  ).toBe(true);
  await page.goBack();
  await expect(page).toHaveURL(/\/instruments$/);
  await page.goBack();
  await expect(page.locator(".row").first()).toBeVisible();
  await page.getByRole("button", { name: "Stop" }).click();

  // A song URL opens that song from the library.
  const demo = page.url();
  await page.getByRole("link", { name: "Songs" }).click();
  await page.getByRole("button", { name: "New song" }).click();
  await expect(page.locator(".library li")).toHaveCount(2);
  await page.goto(demo);
  await expect(page.locator(".header .title")).toHaveText("Lumen Quest");
  await expect(page.locator(".row").first()).toBeVisible();
  // One that is not in this browser's library is a 404 inside the app.
  await page.goto("/songs/nope");
  await expect(page.getByRole("heading", { name: "404 · Not here" })).toBeVisible();
  await page.getByRole("link", { name: "Open the song library" }).click();
  await expect(page.locator(".library li")).toHaveCount(2);
});

test("routes with the History API fallback where the Navigation API is missing", async ({
  page,
}) => {
  await page.addInitScript(() => delete (window as { navigation?: unknown }).navigation);
  await page.reload();
  await expect(page.locator(".row").first()).toBeVisible();
  expect(await page.evaluate(() => "navigation" in window)).toBe(false);
  // A marker on the root layout: client-side routing keeps it mounted.
  await page.locator(".mixer").evaluate((el) => ((el as unknown as { kept: boolean }).kept = true));
  await page.getByRole("link", { name: "Instruments" }).click();
  await expect(page).toHaveURL(/\/instruments$/);
  await expect(page.getByRole("heading", { name: "Instrument 00" })).toBeVisible();
  await page.goBack();
  await expect(page.locator(".row").first()).toBeVisible();
  expect(
    await page.locator(".mixer").evaluate((el) => (el as unknown as { kept?: boolean }).kept),
  ).toBe(true);
});
