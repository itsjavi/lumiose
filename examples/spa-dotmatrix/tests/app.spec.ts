import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Screenshots go to $DOTMATRIX_SHOTS when set (the dev project only).
const SHOTS = process.env.DOTMATRIX_SHOTS;
async function shot(page: Page, name: string, project: string) {
  if (SHOTS && project === "dev") await page.screenshot({ path: `${SHOTS}/task-133-${name}.png` });
}

// Screenshots for TASK-143 use their own prefix.
async function shot143(page: Page, name: string, project: string) {
  if (SHOTS && project === "dev") await page.screenshot({ path: `${SHOTS}/task-143-${name}.png` });
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
  await page.getByRole("button", { name: "Play song" }).click();
  await expect.poll(() => page.evaluate(() => dotmatrix.position())).toBeGreaterThan(3.5);
  await shot(page, "studio-demo", info.project.name);
  await page.getByRole("button", { name: "Stop" }).click();
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

/** Elements that stick out of their panel or card, ignoring content of scroll areas (the grid). */
function overflowing(): string[] {
  const out: string[] = [];
  for (const panel of document.querySelectorAll(".panel, .cart, .card, .pad")) {
    const box = panel.getBoundingClientRect();
    for (const el of panel.querySelectorAll("*")) {
      let clipped = false;
      for (let a = el.parentElement; a && a !== panel; a = a.parentElement) {
        if (getComputedStyle(a).overflowX !== "visible") clipped = true;
      }
      const r = el.getBoundingClientRect();
      if (!clipped && r.width > 0 && (r.right > box.right + 1 || r.left < box.left - 1)) {
        out.push(
          `${el.tagName.toLowerCase()}.${String(el.getAttribute("class"))} in .${panel.classList[0]}`,
        );
      }
    }
  }
  return out;
}

test("no control sticks out of its panel at desktop, tablet and phone widths", async ({ page }, info) => {
  for (const width of [1920, 1440, 1280, 1024, 820, 390, 360]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/songs", "/sfx", "/creatures", "/learn"]) {
      await page.goto(path);
      await page.locator("main .panel, main .cart").first().waitFor();
      expect(await page.evaluate(overflowing), `${path} at ${width}px`).toEqual([]);
      if (width === 1920 && path === "/") await shot143(page, "studio-1920", info.project.name);
    }
  }
});


test("creature voices: pick, bend, read the code and export", async ({ page }, info) => {
  await page.goto("/creatures");
  await expect(page.locator(".critter")).toHaveCount(13);
  await page.getByRole("button", { name: "Wispet" }).click();
  await expect(page.locator("#maker-title")).toHaveText("Wispet");
  await page.getByRole("button", { name: "Show code" }).click();
  await expect(page.locator(".code pre")).toContainText(
    'base voice "Wail", pitch $0000, length $0133',
  );
  await page.locator(".maker input[type=range]").first().fill("64");
  await expect(page.locator(".code pre")).toContainText("pitch $0040");
  await page.getByRole("radio", { name: /Growl/ }).click();
  await expect(page.locator(".code pre")).toContainText('base voice "Growl"');
  await expect(page.locator("#maker-title")).toHaveText("Wispet (remix)");
  await page.getByRole("button", { name: "Surprise me" }).click();
  await expect(page.locator("#maker-title")).toHaveText("Mystery creature");
  await page.getByRole("button", { name: "Boulderback" }).click();
  await shot143(page, "creatures", info.project.name);
  const { name, data } = await readDownload(page, () =>
    page.getByRole("button", { name: "Export WAV" }).click(),
  );
  expect(name).toBe("boulderback.wav");
  expect(data.subarray(8, 12).toString("ascii")).toBe("WAVE");
});

test("an SFX opens in the studio, is edited on the frame grid and comes back", async ({
  page,
}, info) => {
  await page.goto("/sfx");
  await page.getByRole("button", { name: /^Hit/ }).click();
  await page.getByRole("button", { name: "Open in studio" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator("#song-title")).toHaveValue("Hit");
  await expect(page.locator(".status")).toContainText("1 F/STEP");
  await expect(page.locator(".ruler")).toContainText("0f");
  // The hardware sweep and the noise travel as per-note settings (the notch) and raw noise rows.
  await expect(page.locator(".lane .note.own")).toHaveCount(1);
  const before = await page.evaluate(
    () => dotmatrix.song() as unknown as { tracks: { notes: { w?: number }[] }[] },
  );
  expect(before.tracks[0]!.notes[0]!.w).toBe(-6);
  await page.keyboard.press("4");
  await expect(page.locator(".keys .key").first()).toHaveText("$00");
  await page.keyboard.press("1");
  // Add a second, higher note after the first one.
  const lane = page.locator(".lane");
  const box = (await lane.boundingBox())!;
  await page.mouse.click(box.x + 15 * 22 + 8, box.y + 2 * 18 + 8);
  await page.getByRole("button", { name: "Play song" }).click();
  await expect(page.getByRole("button", { name: "Play song" })).toBeVisible({ timeout: 5000 });
  await shot143(page, "studio-sheet", info.project.name);
  await page.getByRole("button", { name: "Save to My sounds" }).click();
  await expect(page).toHaveURL(/\/sfx\?sound=\w+/);
  await expect(page.locator("#maker-title")).toHaveText("Hit");
  await expect(page.locator(".mine li.on")).toHaveText(/Hit/);
  await page.waitForTimeout(600); // the waveform renders in the worker
  await shot143(page, "sfx-my-sounds", info.project.name);
  // It is a plain sound again: the sliders work and the code shows the new note.
  await expect(page.locator(".maker input[type=range]").first()).toBeEnabled();
  await page.getByRole("button", { name: "Show code" }).click();
  await expect(page.locator(".code pre")).toContainText("pitch_sweep 1, -2");
  const code = await page.locator(".code pre").textContent();
  expect(code!.match(/square_note/g)!.length).toBeGreaterThanOrEqual(2);
});

test("a sound with studio-only features stays a sheet and says why", async ({ page }) => {
  await page.goto("/sfx");
  await page.getByRole("button", { name: /^Jump/ }).click();
  await page.getByRole("button", { name: "Open in studio" }).click();
  await expect(page.locator("#song-title")).toHaveValue("Jump");
  await page.getByText("Fine-tune").click();
  await page.getByRole("slider", { name: "Vibrato depth" }).fill("4");
  await page.getByRole("button", { name: "Save to My sounds" }).click();
  await expect(page).toHaveURL(/\/sfx\?sound=/);
  await expect(page.locator(".notice")).toContainText("Pulse 1 has vibrato");
  await expect(page.locator(".maker input[type=range]").first()).toBeDisabled();
  await expect(page.getByRole("button", { name: "Show code" })).toBeDisabled();
  // It still plays and opens in the studio as it is.
  await page.getByRole("button", { name: "Play Jump" }).click();
  await page.getByRole("button", { name: "Open in studio" }).click();
  await expect(page.locator("#song-title")).toHaveValue("Jump");
  const song = await page.evaluate(
    () => dotmatrix.song() as unknown as { tracks: { inst: { vibrato: { depth: number } } }[] },
  );
  expect(song.tracks[0]!.inst.vibrato.depth).toBe(4);
});

test.describe("phone, creatures and sheets", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("creatures and a sound sheet fit a phone", async ({ page }, info) => {
    await page.goto("/creatures");
    await page.locator(".critter").first().waitFor();
    await shot143(page, "creatures-phone", info.project.name);
    await page.getByRole("button", { name: "Open in studio" }).click();
    await expect(page.locator(".status")).toContainText("F/STEP");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await shot143(page, "studio-sheet-phone", info.project.name);
  });
});
