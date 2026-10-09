import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Dev, startDev, text } from "./helpers.ts";

let dev: Dev;
beforeAll(async () => {
  dev = await startDev();
});
afterAll(() => dev?.stop());

interface Form {
  action: string;
  fields: Record<string, string>;
  buttons: string[];
}

function forms(html: string): Form[] {
  return [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/g)].map((m) => {
    const action = (/action="?([^"\s>]*)"?/.exec(m[1]!)?.[1] ?? "").replaceAll("&amp;", "&");
    const url = new URL(action, new URL("/todos", dev.url));
    const fields: Record<string, string> = {};
    for (const input of m[2]!.matchAll(/<input\b[^>]*>/g)) {
      const name = /name="?([^"\s>]+)"?/.exec(input[0])?.[1];
      const value = /value="?([^"\s>]*)"?/.exec(input[0])?.[1] ?? "";
      if (name) fields[name] = value;
    }
    const buttons = [...m[2]!.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map((b) => text(b[1]!));
    return { action: url.pathname + url.search, fields, buttons };
  });
}

const items = (html: string) =>
  [...html.matchAll(/<li\b([^>]*)>([\s\S]*?)<\/li>/g)]
    .filter((m) => /data-id=/.test(m[1]!))
    .map((m) => ({
      id: Number(/data-id="?(\d+)"?/.exec(m[1]!)![1]),
      done: /class="?[^">]*\bdone\b/.test(m[1]!),
      text: text(m[2]!),
    }));

const page = async () => (await dev.get("/todos")).text();

function formWith(html: string, button: string, id?: number): Form {
  const found = forms(html).find((f) => f.buttons.includes(button) && (id === undefined || f.fields.id === String(id)));
  expect(found, `a form with a "${button}" button${id === undefined ? "" : ` for todo ${id}`}`).toBeDefined();
  return found!;
}

async function submit(form: Form, extra: Record<string, string> = {}) {
  return dev.post(form.action, { ...form.fields, ...extra });
}

describe("todos", () => {
  it("lists the todos", async () => {
    const html = await page();
    expect(text(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "")).toBe("Todos");
    const list = items(html);
    expect(list.map(({ id, done }) => ({ id, done }))).toEqual([
      { id: 1, done: false },
      { id: 2, done: true },
    ]);
    expect(list[0]!.text).toContain("Buy milk");
  });

  it("uses named actions", async () => {
    const html = await page();
    expect(formWith(html, "Add").action).toMatch(/[?&]\/add$/);
    expect(formWith(html, "Toggle", 1).action).toMatch(/[?&]\/toggle$/);
    expect(formWith(html, "Remove", 1).action).toMatch(/[?&]\/remove$/);
  });

  it("adds, toggles and removes", async () => {
    const added = await submit(formWith(await page(), "Add"), { title: "  Ship it  " });
    expect([302, 303]).toContain(added.status);
    expect(new URL(added.headers.get("location")!, dev.url).pathname).toBe("/todos");
    const created = items(await page()).find((item) => item.text.includes("Ship it"));
    expect(created).toMatchObject({ done: false });

    const toggled = await submit(formWith(await page(), "Toggle", created!.id));
    expect([302, 303]).toContain(toggled.status);
    expect(items(await page()).find((item) => item.id === created!.id)).toMatchObject({ done: true });

    const removed = await submit(formWith(await page(), "Remove", created!.id));
    expect([302, 303]).toContain(removed.status);
    expect(items(await page()).map((item) => item.id)).not.toContain(created!.id);
  });

  it("rejects an empty title", async () => {
    const response = await submit(formWith(await page(), "Add"), { title: "   " });
    expect(response.status).toBe(400);
    const html = await response.text();
    expect(text(html)).toContain("Title is required.");
    expect(items(html).length).toBeGreaterThanOrEqual(2);
  });
});
