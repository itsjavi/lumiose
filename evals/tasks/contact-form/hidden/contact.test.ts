import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Dev, startDev, text } from "./helpers.ts";

let dev: Dev;
beforeAll(async () => {
  dev = await startDev();
});
afterAll(() => dev?.stop());

/** The contact form's action URL, as the browser would resolve it. */
async function formAction(): Promise<string> {
  const html = await (await dev.get("/contact")).text();
  const form = /<form\b[^>]*>/.exec(html)?.[0] ?? "";
  expect(form).toMatch(/method="?post"?/i);
  const action = /action="?([^"\s>]*)"?/.exec(form)?.[1] ?? "";
  const url = new URL(action.replaceAll("&amp;", "&"), new URL("/contact", dev.url));
  return url.pathname + url.search;
}

describe("contact form", () => {
  it("renders the form", async () => {
    const response = await dev.get("/contact");
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toMatch(/<input\b[^>]*name="?email"?/);
    expect(html).toMatch(/<textarea\b[^>]*name="?message"?/);
  });

  it("rejects invalid input with 400, errors and the typed values", async () => {
    const response = await dev.post(await formAction(), { email: "not-an-email", message: "   " });
    expect(response.status).toBe(400);
    const html = await response.text();
    expect(text(html)).toContain("Enter a valid email.");
    expect(text(html)).toContain("Write a message.");
    expect(html).toMatch(/<input\b[^>]*value="?not-an-email"?/);
  });

  it("keeps the message when only the email is wrong", async () => {
    const response = await dev.post(await formAction(), { email: "nope", message: "Hello there" });
    expect(response.status).toBe(400);
    const html = await response.text();
    expect(text(html)).toContain("Enter a valid email.");
    expect(text(html)).not.toContain("Write a message.");
    expect(html).toMatch(/<textarea\b[^>]*>\s*Hello there\s*<\/textarea>/);
  });

  it("stores a valid message and redirects to the thanks page", async () => {
    const response = await dev.post(await formAction(), { email: "ada@example.com", message: "Hi!" });
    expect([301, 302, 303]).toContain(response.status);
    expect(new URL(response.headers.get("location")!, dev.url).pathname).toBe("/contact/thanks");
    const messages = await (await dev.get("/api/messages")).json();
    expect(messages).toContainEqual({ email: "ada@example.com", message: "Hi!" });
    const thanks = await (await dev.get("/contact/thanks")).text();
    expect(text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(thanks)?.[1] ?? "")).toBe("Thanks for your message");
  });
});
