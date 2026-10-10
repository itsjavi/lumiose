import { describe, expect, it } from "vitest";
import { decodeData } from "../../server/serialize.ts";
import { ACTION_HEADER, fail } from "../actions/protocol.ts";
import type { Action, ActionContext, Middleware } from "./context.ts";
import { error, redirect } from "./control.ts";
import { actionData, cookies } from "./scope.ts";
import { app, page, type Modules } from "./__fixtures__/app.ts";

const form = (fields: Record<string, string>) => {
  const body = new FormData();
  for (const [name, value] of Object.entries(fields)) body.append(name, value);
  return body;
};
const post = (body: BodyInit = new FormData(), headers: HeadersInit = {}): RequestInit => ({
  method: "POST",
  body,
  headers,
});
/** An enhanced submission, as submit() sends it. */
const enhanced = (body: BodyInit = new FormData(), headers: HeadersInit = {}): RequestInit =>
  post(body, { accept: "application/json", [ACTION_HEADER]: "1", ...headers });

/** A page that prints what actionData() returns while it renders. */
const echoPage = (actions: Partial<Record<"action" | "actions", unknown>>) => ({
  default: () => `<p>${JSON.stringify(actionData() ?? null)}</p>`,
  ...actions,
});

/** The body of a JSON action result, checking the protocol headers. */
async function result(res: Response) {
  expect(res.headers.get(ACTION_HEADER)).toBe("1");
  expect(res.headers.get("content-type")).toBe("application/json");
  return res.json();
}

const headersOf = (origin: string | null, site?: string): HeadersInit => ({
  ...(origin === null ? {} : { origin }),
  ...(site === undefined ? {} : { "sec-fetch-site": site }),
});

const html = async (res: Response) => {
  const text = await res.text();
  return text.slice(text.indexOf("<body>") + 6, text.indexOf("</body>"));
};

describe("form actions without JavaScript", () => {
  it("redirects with 303 when the action throws redirect(), keeping the cookies it set", async () => {
    const { fetch } = app({
      "src/routes/login.stsx": echoPage({
        action: (async ({ formData }) => {
          const data = await formData();
          cookies().set("user", String(data.get("name")));
          redirect("/dashboard");
        }) satisfies Action,
      }),
    });
    const res = await fetch("/login", post(form({ name: "ada" })));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/dashboard");
    expect(res.headers.get("set-cookie")).toMatch(/^user=ada;/);
  });

  it("re-renders the page with status 200 and actionData() set to the returned data", async () => {
    const { fetch } = app({
      "src/routes/todos.stsx": echoPage({
        action: async ({ formData }: ActionContext) => ({
          added: (await formData()).get("title"),
          at: new Date(0),
        }),
      }),
    });
    const res = await fetch("/todos", post(form({ title: "milk" })));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('<p>{"added":"milk","at":"1970-01-01T00:00:00.000Z"}</p>');
    // Embedded for islands, so they hydrate with the same actionData().
    const script = /<script type="application\/json" data-l-action>(.*?)<\/script><\/head>/.exec(
      text,
    );
    expect(decodeData(JSON.parse(script![1]!))).toEqual({ added: "milk", at: new Date(0) });
  });

  it("re-renders with the fail() status and data", async () => {
    const { fetch } = app({
      "src/routes/signup.stsx": echoPage({
        action: () => fail(422, { errors: { email: "required" } }),
      }),
    });
    const res = await fetch("/signup", post());
    expect(res.status).toBe(422);
    expect(await html(res)).toBe('<p>{"errors":{"email":"required"}}</p>');
  });

  it("returns a Response from the action as it is", async () => {
    const { fetch } = app({
      "src/routes/export.stsx": echoPage({
        action: () => new Response("a,b", { headers: { "content-type": "text/csv" } }),
      }),
    });
    const res = await fetch("/export", post());
    expect(res.headers.get("content-type")).toBe("text/csv");
    expect(await res.text()).toBe("a,b");
  });

  it("runs named actions for ?/name and passes locals from middleware", async () => {
    const seen: string[] = [];
    const record =
      (name: string): Action =>
      (ctx) => {
        seen.push(`${name}:${(ctx.locals as { user?: string }).user}:${ctx.url.search}`);
        return name;
      };
    const { fetch } = app({
      "src/middleware.ts": {
        default: ((ctx, next) => {
          Object.assign(ctx.locals, { user: "ada" });
          return next();
        }) satisfies Middleware,
      },
      "src/routes/items.stsx": echoPage({
        action: record("default"),
        actions: { create: record("create"), remove: record("remove") },
      }),
    });
    expect(await html(await fetch("/items?/create", post()))).toBe('<p>"create"</p>');
    expect(await html(await fetch("/items?/remove&id=3", post()))).toBe('<p>"remove"</p>');
    expect(await html(await fetch("/items", post()))).toBe('<p>"default"</p>');
    expect(seen).toEqual(["create:ada:?/create", "remove:ada:?/remove&id=3", "default:ada:"]);
  });

  it("answers missing actions with 404 and pages without actions with 405", async () => {
    const { fetch } = app({
      "src/routes/_404.stsx": page((props) => `<p>404 ${props.error.message}</p>`),
      "src/routes/named.stsx": echoPage({ actions: { create: () => 1 } }),
      "src/routes/plain.stsx": echoPage({}),
    });
    const unknown = await fetch("/named?/nope", post());
    expect(unknown.status).toBe(404);
    expect(await html(unknown)).toBe('<p>404 This page has no action "nope".</p>');
    const inherited = await fetch("/named?/toString", post());
    expect(inherited.status).toBe(404);
    const noDefault = await fetch("/named", post());
    expect(noDefault.status).toBe(404);
    expect(await html(noDefault)).toContain("This page has no default action.");

    const plain = await fetch("/plain", post());
    expect(plain.status).toBe(405);
    expect(plain.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
    const options = await fetch("/named", { method: "OPTIONS" });
    expect(options.status).toBe(204);
    expect(options.headers.get("allow")).toBe("GET, HEAD, POST, OPTIONS");
    const put = await fetch("/named", { method: "PUT" });
    expect(put.status).toBe(405);
    expect(put.headers.get("allow")).toBe("GET, HEAD, POST, OPTIONS");
  });

  it("parses formData() once, and answers a non-form body with 400", async () => {
    const { fetch } = app({
      "src/routes/_error.stsx": page((props) => `<p>${props.status} ${props.error.message}</p>`),
      "src/routes/twice.stsx": echoPage({
        action: async ({ formData }: ActionContext) => (await formData()) === (await formData()),
      }),
    });
    expect(await html(await fetch("/twice", post(form({ a: "1" }))))).toBe("<p>true</p>");
    const res = await fetch("/twice", post('{"a":1}', { "content-type": "application/json" }));
    expect(res.status).toBe(400);
    expect(await html(res)).toBe("<p>400 The request body is not form data.</p>");
  });

  it("renders _error for errors thrown by the action", async () => {
    const { fetch, onError } = app({
      "src/routes/_error.stsx": page((props) => `<p>${props.status} ${props.error.message}</p>`),
      "src/routes/admin.stsx": echoPage({
        actions: {
          deny: () => error(403, "Admins only"),
          crash: () => {
            throw new Error("db down");
          },
        },
      }),
    });
    const denied = await fetch("/admin?/deny", post());
    expect(denied.status).toBe(403);
    expect(await html(denied)).toBe("<p>403 Admins only</p>");
    const crashed = await fetch("/admin?/crash", post());
    expect(crashed.status).toBe(500);
    expect(await html(crashed)).toBe("<p>500 Internal Server Error</p>");
    expect(onError.mock.calls[0]![0].message).toBe("db down");
  });

  it("rejects action data that is not plain data", async () => {
    const { fetch, onError } = app({
      "src/routes/bad.stsx": echoPage({ action: () => ({ save: () => {} }) }),
    });
    expect((await fetch("/bad", post())).status).toBe(500);
    expect(onError.mock.calls[0]![0].message).toMatch(/^Action data at save is a function\./);
  });

  it("leaves actionData() undefined on GET and does not embed it", async () => {
    const { fetch } = app({ "src/routes/index.stsx": echoPage({ action: () => 1 }) });
    const text = await (await fetch("/")).text();
    expect(text).toContain("<p>null</p>");
    expect(text).not.toContain("data-l-action");
  });
});

describe("enhanced submissions (JSON protocol)", () => {
  const modules: Modules = {
    "src/middleware.ts": {
      default: ((ctx, next) => {
        if (ctx.url.pathname === "/private") return Response.redirect(`${ctx.url.origin}/login`);
        return next();
      }) satisfies Middleware,
    },
    "src/routes/private.stsx": echoPage({ action: () => 1 }),
    "src/routes/todos.stsx": echoPage({
      actions: {
        add: () => ({ id: 1, at: new Date(0) }),
        nothing: () => undefined,
        invalid: () => fail(400, { title: "required" }),
        go: () => {
          cookies().set("flash", "saved");
          redirect("/todos/1");
        },
        moved: () => new Response(null, { status: 307, headers: { location: "/elsewhere" } }),
        deny: () => error(403, "Admins only"),
        crash: () => {
          throw new Error("db down");
        },
        csv: () => new Response("a,b", { headers: { "content-type": "text/csv" } }),
      },
    }),
  };

  it("answers success and failure with JSON instead of HTML", async () => {
    const { fetch } = app(modules);
    const added = await fetch("/todos?/add", enhanced());
    expect(added.status).toBe(200);
    const body = await result(added);
    expect(body).toEqual({
      type: "success",
      status: 200,
      data: { id: 1, at: { $: "D", v: "1970-01-01T00:00:00.000Z" } },
    });
    expect(decodeData(body.data)).toEqual({ id: 1, at: new Date(0) });

    expect(await result(await fetch("/todos?/nothing", enhanced()))).toEqual({
      type: "success",
      status: 200,
    });
    const invalid = await fetch("/todos?/invalid", enhanced());
    expect(invalid.status).toBe(400);
    expect(await result(invalid)).toEqual({
      type: "failure",
      status: 400,
      data: { title: "required" },
    });
  });

  it("turns redirects into redirect results with status 200, keeping cookies", async () => {
    const { fetch } = app(modules);
    const thrown = await fetch("/todos?/go", enhanced());
    expect(thrown.status).toBe(200);
    expect(thrown.headers.get("location")).toBeNull();
    expect(thrown.headers.get("set-cookie")).toMatch(/^flash=saved;/);
    expect(await result(thrown)).toEqual({ type: "redirect", status: 303, location: "/todos/1" });

    expect(await result(await fetch("/todos?/moved", enhanced()))).toEqual({
      type: "redirect",
      status: 307,
      location: "/elsewhere",
    });
    // Middleware redirects too, so submit() can follow them instead of fetch().
    expect(await result(await fetch("/private", enhanced()))).toEqual({
      type: "redirect",
      status: 302,
      location: "https://lumiose.test/login",
    });
  });

  it("answers thrown errors with error results, masking unexpected ones outside dev", async () => {
    const { fetch, onError } = app(modules);
    const denied = await fetch("/todos?/deny", enhanced());
    expect(denied.status).toBe(403);
    expect(await result(denied)).toEqual({
      type: "error",
      status: 403,
      error: { message: "Admins only" },
    });
    expect(await result(await fetch("/todos?/crash", enhanced()))).toEqual({
      type: "error",
      status: 500,
      error: { message: "Internal Server Error" },
    });
    expect(onError).toHaveBeenCalledTimes(1);

    const dev = app(modules, { dev: true });
    expect(await result(await dev.fetch("/todos?/crash", enhanced()))).toMatchObject({
      error: { message: "db down" },
    });
  });

  it("answers missing actions with error results and passes other responses through", async () => {
    const { fetch } = app({ ...modules, "src/routes/plain.stsx": echoPage({}) });
    const missing = await fetch("/todos?/nope", enhanced());
    expect(missing.status).toBe(404);
    expect(await result(missing)).toEqual({
      type: "error",
      status: 404,
      error: { message: 'This page has no action "nope".' },
    });
    const csv = await fetch("/todos?/csv", enhanced());
    expect(csv.headers.get(ACTION_HEADER)).toBeNull();
    expect(await csv.text()).toBe("a,b");
    const plain = await fetch("/plain", enhanced());
    expect(plain.status).toBe(405);
    expect(plain.headers.get(ACTION_HEADER)).toBeNull();
  });

  it("needs both the action header and Accept: application/json", async () => {
    const { fetch } = app(modules);
    const res = await fetch("/todos?/add", post(new FormData(), { [ACTION_HEADER]: "1" }));
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
  });
});

describe("Origin check (CSRF)", () => {
  const modules: Modules = {
    "src/routes/index.stsx": echoPage({ action: () => "ok" }),
    "src/routes/api/hook.ts": { POST: () => new Response("hooked") },
  };
  it("accepts same-origin, allowlisted and non-browser posts", async () => {
    const { fetch } = app(modules, { csrf: { allowedOrigins: ["https://admin.lumiose.test"] } });
    for (const headers of [
      headersOf("https://lumiose.test"),
      headersOf("https://lumiose.test", "same-origin"),
      // Behind a TLS-terminating proxy the scheme may differ; hosts must match.
      headersOf("http://lumiose.test"),
      headersOf(null),
      headersOf(null, "none"),
      headersOf("https://admin.lumiose.test", "same-site"),
    ]) {
      expect(
        (await fetch("/", post(new FormData(), headers))).status,
        JSON.stringify(headers),
      ).toBe(200);
    }
  });

  it("rejects cross-site form posts with 403", async () => {
    const { fetch, onError } = app(modules);
    for (const headers of [
      headersOf("https://evil.test"),
      headersOf("https://evil.test", "cross-site"),
      headersOf("https://sub.lumiose.test", "same-site"),
      headersOf(null, "cross-site"),
      headersOf("null"),
    ]) {
      const res = await fetch("/", post(new FormData(), headers));
      expect(res.status, JSON.stringify(headers)).toBe(403);
      expect(await res.text()).toBe("Cross-site form submissions are forbidden.");
    }
    expect(onError).not.toHaveBeenCalled();
  });

  it("checks endpoints only for bodies a cross-site form could send", async () => {
    const { fetch } = app(modules);
    const evil = headersOf("https://evil.test", "cross-site");
    expect((await fetch("/api/hook", post(form({ a: "1" }), evil))).status).toBe(403);
    expect(
      (await fetch("/api/hook", post("x", { ...evil, "content-type": "text/plain" }))).status,
    ).toBe(403);
    expect((await fetch("/api/hook", { method: "POST", headers: evil })).status).toBe(403);
    const json = await fetch(
      "/api/hook",
      post("{}", { ...evil, "content-type": "application/json" }),
    );
    expect(json.status).toBe(200);
    expect((await fetch("/", { headers: evil })).status).toBe(200);
  });

  it("answers enhanced submissions with an error result, and can be turned off", async () => {
    const evil = headersOf("https://evil.test", "cross-site");
    const res = await app(modules).fetch("/", enhanced(new FormData(), evil));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      type: "error",
      status: 403,
      error: { message: "Cross-site form submissions are forbidden." },
    });
    const open = app(modules, { csrf: false });
    expect((await open.fetch("/", post(new FormData(), evil))).status).toBe(200);
  });
});

describe("actionData() on the server", () => {
  it("is undefined outside a request, and in-request reads are typed by the caller", async () => {
    expect(actionData()).toBeUndefined();
    const { fetch } = app({
      "src/routes/index.stsx": {
        default: () => String(((actionData() as number | undefined) ?? 0) + 1),
        action: () => 41,
      },
    });
    expect(await html(await fetch("/", post()))).toBe("42");
  });
});
