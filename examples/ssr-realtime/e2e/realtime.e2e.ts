// Realtime end to end, on the production build and in dev (`server.ts --dev`): server-sent events
// from an endpoint to an island's EventSource (broadcast, and cleanup when a page goes away), and
// the WebSocket chat that server.ts attaches to its server (broadcast, refused handshakes).
import { expect, test, type APIRequestContext } from "@playwright/test";
import { WebSocket } from "ws";

async function subscribers(request: APIRequestContext): Promise<number> {
  const response = await request.get("/api/stats");
  return ((await response.json()) as { subscribers: number }).subscribers;
}

test("server-sent events reach every open feed, and a closed page unsubscribes", async ({
  browser,
  request,
}) => {
  const context = await browser.newContext();
  const [first, second] = [await context.newPage(), await context.newPage()];
  for (const page of [first, second]) {
    await page.goto("/events");
    await expect(page.locator(".feed")).toHaveAttribute("data-state", "open");
  }
  await expect.poll(() => subscribers(request)).toBe(2);

  const text = `hello ${Date.now()}`;
  await first.getByLabel("Message").fill(text);
  await first.getByRole("button", { name: "Send" }).click();
  for (const page of [first, second]) {
    await expect(page.locator(".messages")).toContainText(text);
  }
  // Posted through submit(): the page did not reload, so the stream stayed open.
  await expect(first.getByLabel("Message")).toHaveValue("");

  // The browser drops the connection; the endpoint's cleanup unsubscribes.
  await second.close();
  await expect.poll(() => subscribers(request)).toBe(1);
  await context.close();
  await expect.poll(() => subscribers(request)).toBe(0);
});

test("an empty message is a validation error", async ({ page }) => {
  await page.goto("/events");
  await expect(page.locator(".feed")).toHaveAttribute("data-state", "open");
  await page.getByLabel("Message").fill("   ");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("alert")).toHaveText("Write something first.");
});

test("the WebSocket chat broadcasts to every window", async ({ browser }) => {
  const context = await browser.newContext();
  const [first, second] = [await context.newPage(), await context.newPage()];
  for (const page of [first, second]) {
    await page.goto("/chat");
    await expect(page.locator(".chat")).toHaveAttribute("data-state", "open");
  }
  const text = `hi ${Date.now()}`;
  await first.getByLabel("Message").fill(text);
  await first.getByRole("button", { name: "Send" }).click();
  for (const page of [first, second]) {
    await expect(page.locator(".messages")).toContainText(text);
  }
  await context.close();
});

test("WebSocket handshakes from other sites and to other paths are refused", async ({
  baseURL,
}) => {
  const url = baseURL!.replace(/^http/, "ws");
  const outcome = (path: string, origin?: string) =>
    new Promise<string>((resolve) => {
      const socket = new WebSocket(url + path, origin === undefined ? {} : { origin });
      socket.once("open", () => {
        socket.close();
        resolve("open");
      });
      socket.once("unexpected-response", (_request, response) =>
        resolve(String(response.statusCode)),
      );
      socket.once("error", () => resolve("refused"));
    });
  expect(await outcome("/ws", baseURL)).toBe("open");
  expect(await outcome("/ws", "https://evil.test")).toBe("403");
  // In dev, server.ts leaves other upgrades to Vite's HMR, which ignores this one.
  if (test.info().project.name === "build") expect(await outcome("/other")).toBe("refused");
});

test("dev: Vite's HMR client connects through server.ts (createDevHandler)", async ({ page }) => {
  test.skip(test.info().project.name !== "dev", "dev only");
  const connected = page.waitForEvent("console", (message) =>
    message.text().includes("[vite] connected."),
  );
  await page.goto("/chat");
  await connected;
  await expect(page.locator(".chat")).toHaveAttribute("data-state", "open");
});
