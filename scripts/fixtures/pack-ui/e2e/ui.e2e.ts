import { expect, test } from "@playwright/test";

test("@lumiose/ui from a tarball renders, hydrates and loads its client script", async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  const scripts: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "script") scripts.push(new URL(r.url()).pathname);
  });

  // Renders: the server HTML holds the dialogs.
  const html = await (await request.get("/ui")).text();
  expect(html).toContain("<dialog");
  expect(html).toContain("Edit profile");

  await page.goto("/ui");
  // Loads the client script: it marks a dialog with an open dialog inside it.
  await page.getByRole("button", { name: "Settings" }).click();
  const settings = page.getByRole("dialog", { name: "Settings" });
  await settings.getByRole("button", { name: "Advanced" }).click();
  await expect(page.getByRole("dialog", { name: "Advanced" })).toBeVisible();
  await expect(settings).toHaveAttribute("data-nested-dialog-open");
  expect(scripts.some((path) => /\/dialog\.script(?:-[\w-]+\.js|\.ts)$/.test(path))).toBe(true);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");

  // Hydrates: the island's signal follows the dialog.
  const state = page.getByTestId("island-state");
  await expect(state).toHaveText("open: false");
  await page.getByRole("button", { name: "Edit profile" }).click();
  await expect(state).toHaveText("open: true");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(state).toHaveText("open: false");
  expect(errors).toEqual([]);
});
