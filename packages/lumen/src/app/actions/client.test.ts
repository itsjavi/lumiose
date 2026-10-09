// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { ActionContext } from "../server/context.ts";
import { redirect } from "../server/control.ts";
import { app } from "../server/__fixtures__/app.ts";
import { ACTION_HEADER, fail } from "./protocol.ts";

type Client = typeof import("./client.ts");
type FetchJSON = typeof import("../fetch-json.ts");
type Core = typeof import("../../core/effect.ts");

let client: Client;
let fetchModule: FetchJSON;
let core: Core;
let requests: Request[];
let navigation: {
  clientRouted: boolean;
  navigate: Mock<(href: string) => void>;
  invalidate: Mock<() => void>;
};

/** Each test gets fresh module state (the actionData() signal is created on first read). */
beforeEach(async () => {
  vi.resetModules();
  client = await import("./client.ts");
  // The same reactive core instance as the fresh client module.
  core = await import("../../core/effect.ts");
  fetchModule = await import("../fetch-json.ts");
  requests = [];
  navigation = { clientRouted: true, navigate: vi.fn(), invalidate: vi.fn() };
  client.setClientNavigation(navigation);
  history.replaceState(null, "", "/todos");
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

/** Answers every fetch with `respond`, recording the requests. */
function serve(respond: (request: Request) => Response | Promise<Response>) {
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push(request);
    return respond(request);
  });
}

const actionResult = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", [ACTION_HEADER]: "1" },
  });

function render(html: string): HTMLFormElement {
  document.body.innerHTML = html;
  return document.querySelector("form")!;
}

describe("submit()", () => {
  it("posts the form with the JSON protocol and sets actionData()", async () => {
    serve(() =>
      actionResult({
        type: "success",
        status: 200,
        data: { at: { $: "D", v: "1970-01-01T00:00:00.000Z" } },
      }),
    );
    const form = render(
      '<form method="post" action="?/add"><input name="title" value="milk"></form>',
    );
    const result = await client.submit(form);
    expect(result).toEqual({ type: "success", status: 200, data: { at: new Date(0) } });
    expect(client.actionData()).toEqual({ at: new Date(0) });

    const [request] = requests;
    expect(request!.method).toBe("POST");
    expect(request!.url).toBe("http://localhost:3000/todos?/add");
    expect(request!.headers.get("accept")).toBe("application/json");
    expect(request!.headers.get(ACTION_HEADER)).toBe("1");
    expect((await request!.formData()).get("title")).toBe("milk");
  });

  it("tracks submissions in flight with submitting(), also per named action, and busy()", async () => {
    let finish!: () => void;
    serve(
      () =>
        new Promise((resolve) => {
          finish = () => resolve(actionResult({ type: "success", status: 200 }));
        }),
    );
    const seen: string[] = [];
    const { effect, flushSync } = core;
    const { busy } = await import("../../core/async.ts");
    const stop = effect(() => {
      seen.push(
        `${client.submitting()}/${client.submitting("add")}/${client.submitting("remove")} busy=${busy()}`,
      );
    });
    flushSync();
    const pending = client.submit({ title: "milk" }, { action: "?/add" });
    flushSync();
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    finish();
    await pending;
    flushSync();
    stop();
    expect(seen).toEqual([
      "false/false/false busy=false",
      "true/true/false busy=true",
      "false/false/false busy=false",
    ]);
  });

  it("enhances a submit event: prevents the native submission and posts the submitter", async () => {
    serve(() => actionResult({ type: "success", status: 200, data: "removed" }));
    const form = render(
      '<form method="post"><input name="id" value="7"><button name="intent" value="remove" formaction="?/remove">x</button></form>',
    );
    const done = new Promise<unknown>((resolve) => {
      form.addEventListener("submit", (event) => resolve(client.submit(event)));
    });
    const button = form.querySelector("button")!;
    const event = new SubmitEvent("submit", { cancelable: true, bubbles: true, submitter: button });
    form.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(await done).toMatchObject({ type: "success", data: "removed" });
    expect(requests[0]!.url).toBe("http://localhost:3000/todos?/remove");
    const sent = await requests[0]!.formData();
    expect([...sent]).toEqual([
      ["id", "7"],
      ["intent", "remove"],
    ]);
  });

  it("resolves failures with their data and sets actionData()", async () => {
    serve(() => actionResult({ type: "failure", status: 422, data: { title: "required" } }, 422));
    const result = await client.submit(new FormData());
    expect(result).toEqual({ type: "failure", status: 422, data: { title: "required" } });
    expect(client.actionData()).toEqual({ title: "required" });
    // No form and no action: the current page's default action.
    expect(requests[0]!.url).toBe("http://localhost:3000/todos");
  });

  it("follows redirect results through the navigation hook", async () => {
    serve(() => actionResult({ type: "redirect", status: 303, location: "/todos/1" }));
    expect(await client.submit({ title: "milk" })).toEqual({
      type: "redirect",
      status: 303,
      location: "/todos/1",
    });
    expect(navigation.navigate).toHaveBeenCalledWith("/todos/1");
    expect(client.actionData()).toBeUndefined();
  });

  it("rejects with a FetchError for error results and other failed responses", async () => {
    serve(() =>
      actionResult({ type: "error", status: 403, error: { message: "Admins only" } }, 403),
    );
    const denied = await client.submit({}).catch((caught: unknown) => caught);
    expect(fetchModule.isFetchError(denied)).toBe(true);
    expect(denied).toMatchObject({ status: 403, message: "Admins only" });
    expect(client.submitting()).toBe(false);

    serve(() => new Response("Method Not Allowed", { status: 405 }));
    await expect(client.submit({})).rejects.toMatchObject({
      status: 405,
      data: "Method Not Allowed",
    });
  });

  it("rejects network failures with a FetchError (status 0) and keeps aborts as AbortError", async () => {
    const offline = new TypeError("Failed to fetch");
    serve(() => Promise.reject(offline));
    const failed = await client.submit({}).catch((caught: unknown) => caught);
    expect(fetchModule.isFetchError(failed)).toBe(true);
    expect(failed).toMatchObject({
      status: 0,
      message: "Network error: Failed to fetch",
      url: "http://localhost:3000/todos",
      cause: offline,
    });
    expect(client.submitting()).toBe(false);

    const abort = new DOMException("The operation was aborted.", "AbortError");
    serve(() => Promise.reject(abort));
    await expect(client.submit({})).rejects.toBe(abort);
    expect(client.submitting()).toBe(false);
    // Rejected submissions leave the busy() registry too.
    const { busy } = await import("../../core/async.ts");
    expect(busy()).toBe(false);
  });

  it("resolves responses outside the protocol as success with their body", async () => {
    serve(() => Response.json({ id: 1 }, { status: 201 }));
    expect(await client.submit({}, { action: "/api/items" })).toEqual({
      type: "success",
      status: 201,
      data: { id: 1 },
    });
  });

  it("refuses forms that do not post", async () => {
    const form = render('<form><input name="q"></form>');
    await expect(client.submit(form)).rejects.toThrow(/needs method="post" \(got get\)/);
    expect(client.submitting()).toBe(false);
  });

  it("sends records as form data, with repeated fields for arrays", async () => {
    serve(() => actionResult({ type: "success", status: 200 }));
    await client.submit({ tag: ["a", "b"], title: "milk" }, { action: "?/tag" });
    expect([...(await requests[0]!.formData())]).toEqual([
      ["tag", "a"],
      ["tag", "b"],
      ["title", "milk"],
    ]);
  });
});

describe("submit() refreshes client-routed pages after a success (decision-20, TASK-105)", () => {
  it("runs invalidate() once the submission left busy(), and resolves after it", async () => {
    serve(() => actionResult({ type: "success", status: 200, data: "saved" }));
    const { busy } = await import("../../core/async.ts");
    const seen: string[] = [];
    let refreshed!: () => void;
    navigation.invalidate.mockImplementation(() => {
      seen.push(`submitting=${client.submitting()} busy=${busy()} data=${client.actionData()}`);
      return new Promise<void>((resolve) => {
        refreshed = resolve;
      });
    });
    let resolved = false;
    const done = client.submit({ title: "milk" }).then((result) => {
      resolved = true;
      return result;
    });
    await vi.waitFor(() => expect(navigation.invalidate).toHaveBeenCalledTimes(1));
    // The SPA's invalidate() waits for busy() to clear: the submission must not hold it.
    expect(seen).toEqual(["submitting=false busy=false data=saved"]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(resolved).toBe(false);
    refreshed();
    expect(await done).toEqual({ type: "success", status: 200, data: "saved" });
  });

  it("leaves failures, redirects and errors alone, and opts out with { invalidate: false }", async () => {
    serve(() => actionResult({ type: "failure", status: 422, data: {} }, 422));
    await client.submit({});
    serve(() => actionResult({ type: "redirect", status: 303, location: "/todos/1" }));
    await client.submit({});
    serve(() => actionResult({ type: "error", status: 500, error: { message: "boom" } }, 500));
    await expect(client.submit({})).rejects.toMatchObject({ status: 500 });
    serve(() => actionResult({ type: "success", status: 200 }));
    await client.submit({}, { invalidate: false });
    expect(navigation.invalidate).not.toHaveBeenCalled();
    await client.submit({});
    expect(navigation.invalidate).toHaveBeenCalledTimes(1);
  });

  it("never invalidates on its own on MPA pages; an explicit invalidate() still does (TASK-118)", async () => {
    navigation.clientRouted = false;
    serve(() => actionResult({ type: "success", status: 200, data: "saved" }));
    expect(await client.submit({})).toEqual({ type: "success", status: 200, data: "saved" });
    expect(navigation.invalidate).not.toHaveBeenCalled();
    expect(client.actionData()).toBe("saved");
    await client.invalidate();
    expect(navigation.invalidate).toHaveBeenCalledTimes(1);
  });
});

describe("actionData()", () => {
  it("starts from the data the server embedded after a no-JS post", () => {
    document.head.innerHTML =
      '<script type="application/json" data-l-action>{"saved":true,"at":{"$":"D","v":"1970-01-01T00:00:00.000Z"}}</script>';
    expect(client.actionData()).toEqual({ saved: true, at: new Date(0) });
  });

  it("is undefined without embedded data", () => {
    expect(client.actionData()).toBeUndefined();
  });
});

describe("invalidate()", () => {
  it("refreshes through the navigation hook", async () => {
    await client.invalidate();
    expect(navigation.invalidate).toHaveBeenCalledTimes(1);
  });

  it("restores the previous hooks when the installer undoes", async () => {
    const spa = { clientRouted: true, navigate: vi.fn(), invalidate: vi.fn() };
    const undo = client.setClientNavigation(spa);
    await client.invalidate();
    undo();
    await client.invalidate();
    expect(spa.invalidate).toHaveBeenCalledTimes(1);
    expect(navigation.invalidate).toHaveBeenCalledTimes(1);
  });
});

describe("fetchJSON() in the browser", () => {
  it("resolves relative URLs against the document and asks for JSON", async () => {
    serve((request) => Response.json({ url: request.url, accept: request.headers.get("accept") }));
    expect(await fetchModule.fetchJSON("api/items?page=2")).toEqual({
      url: "http://localhost:3000/api/items?page=2",
      accept: "application/json",
    });
    await fetchModule.fetchJSON("/x", { headers: { accept: "application/vnd.api+json" } });
    expect(requests[1]!.headers.get("accept")).toBe("application/vnd.api+json");
  });

  it("throws a FetchError with the parsed error body", async () => {
    serve(() => Response.json({ reason: "gone" }, { status: 404, statusText: "Not Found" }));
    const failure = await fetchModule.fetchJSON("/api/items/9").catch((caught: unknown) => caught);
    expect(failure).toBeInstanceOf(fetchModule.FetchError);
    expect(failure).toMatchObject({
      name: "FetchError",
      status: 404,
      message: "Not Found",
      url: "http://localhost:3000/api/items/9",
      data: { reason: "gone" },
    });
  });
});

describe("submit() against the request handler", () => {
  it("runs page actions end to end", async () => {
    const { handle } = app({
      "src/routes/todos.stsx": {
        default: () => "",
        actions: {
          add: async ({ formData }: ActionContext) => ({ title: (await formData()).get("title") }),
          invalid: () => fail(400, { title: "required" }),
          done: () => redirect("/todos/1"),
        },
      },
    });
    serve((request) => handle(request));
    const form = render(
      '<form method="post" action="?/add"><input name="title" value="milk"></form>',
    );
    expect(await client.submit(form)).toEqual({
      type: "success",
      status: 200,
      data: { title: "milk" },
    });
    expect(await client.submit({}, { action: "?/invalid" })).toEqual({
      type: "failure",
      status: 400,
      data: { title: "required" },
    });
    expect(client.actionData()).toEqual({ title: "required" });
    await client.submit({}, { action: "?/done" });
    expect(navigation.navigate).toHaveBeenCalledWith("/todos/1");
  });
});
