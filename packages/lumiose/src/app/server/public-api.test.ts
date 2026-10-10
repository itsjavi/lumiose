import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as browser from "../public.ts";
import * as server from "../public.server.ts";
import { composePageTree } from "./render.ts";

const LUMIOSE_ENTRY = fileURLToPath(new URL("../../index.ts", import.meta.url));
const BASE_TSCONFIG = fileURLToPath(new URL("../../../../../tsconfig.base.json", import.meta.url));
const TSC = join(
  dirname(createRequire(import.meta.url).resolve("typescript/package.json")),
  "bin/tsc",
);

describe("public app API", () => {
  it("exposes the same names from the browser and node entries", () => {
    expect(Object.keys(browser).toSorted()).toEqual(Object.keys(server).toSorted());
  });

  it("throws LUM4003 from server-only APIs in the browser entry", () => {
    for (const call of [
      () => browser.request(),
      () => browser.url(),
      () => browser.params(),
      () => browser.route(),
      () => browser.locals(),
      () => browser.cookies(),
      () => browser.response(),
      () => browser.env("X"),
      () => browser.publicEnv(),
      () => browser.signedCookie("s"),
    ]) {
      expect(call).toThrow(/is server-only.*LUM4003/);
    }
  });

  it("renders browser-side action state during SSR and keeps submit()/invalidate() in the browser", async () => {
    expect(server.submitting()).toBe(false);
    expect(server.submitting("create")).toBe(false);
    expect(server.actionData()).toBeUndefined();
    await expect(server.submit(new FormData())).rejects.toThrow(/submit\(\) runs in the browser/);
    await expect(server.invalidate()).rejects.toThrow(/invalidate\(\) runs in the browser/);
  });

  it("explains request accessors called outside a request", () => {
    expect(() => server.cookies()).toThrow(
      /cookies\(\) can only be called while handling a request/,
    );
  });

  it("reads env() from process.env outside a request and filters PUBLIC_* vars", () => {
    process.env.LUMIOSE_TEST_VAR = "1";
    try {
      expect(server.env("LUMIOSE_TEST_VAR")).toBe("1");
    } finally {
      delete process.env.LUMIOSE_TEST_VAR;
    }
    expect(
      server.publicEnv({ PUBLIC_API: "https://api", SECRET: "x", PUBLIC_EMPTY: undefined }),
    ).toEqual({
      PUBLIC_API: "https://api",
    });
  });
});

describe("composePageTree", () => {
  it("nests layouts with lazy children getters and passes params", () => {
    const calls: string[] = [];
    const root = composePageTree(
      {
        layouts: [
          (props: any) => (calls.push(`outer ${Object.keys(props)}`), `[${props.children}]`),
          (props: any) => (calls.push(`inner ${props.params.id}`), `(${props.children})`),
        ],
        page: (props: any) => (calls.push(`page ${props.params.id}`), "page"),
        props: { params: { id: "1" } },
        params: { id: "1" },
      },
      (component, props) => component(props),
    );
    expect(calls).toEqual([]);
    expect(root()).toBe("[(page)]");
    expect(calls).toEqual(["outer params,children", "inner 1", "page 1"]);
  });
});

describe("request context types", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "lumiose-context-types-"));
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("types Locals by module augmentation, middleware, endpoints and accessors with TypeScript 7", async () => {
    await writeFile(
      join(root, "tsconfig.json"),
      JSON.stringify({
        extends: BASE_TSCONFIG,
        compilerOptions: { types: [], paths: { lumiose: [LUMIOSE_ENTRY] } },
        include: ["usage.ts"],
      }),
    );
    await writeFile(join(root, "usage.ts"), USAGE);
    const result = await promisify(execFile)(process.execPath, [
      TSC,
      "-p",
      root,
      "--pretty",
      "false",
    ]).then(
      () => ({ ok: true, output: "" }),
      (error: { stdout?: string; stderr?: string }) => ({
        ok: false,
        output: `${error.stdout ?? ""}${error.stderr ?? ""}`,
      }),
    );
    expect(result.output).toBe("");
    expect(result.ok).toBe(true);
  });
});

const USAGE = `import {
  cookies,
  error,
  locals,
  notFound,
  params,
  redirect,
  route,
  type Endpoint,
  type ErrorPageProps,
  type Middleware,
  type RouteParams,
} from "lumiose";

declare module "lumiose" {
  interface Locals {
    user: { name: string } | null;
  }
  interface RouteMap {
    "/blog/[slug]": { kind: "page"; params: { slug: string } };
    "/api/posts/[id]": { kind: "endpoint"; params: { id: string } };
  }
}

export const middleware: Middleware = async (ctx, next) => {
  ctx.locals.user = ctx.cookies.get("session") ? { name: "ada" } : null;
  // @ts-expect-error Locals has no such key
  ctx.locals.role = "admin";
  const res = await next();
  res.headers.set("x-env", ctx.env.NODE_ENV ?? "");
  return res;
};

export const GET: Endpoint<"/api/posts/[id]"> = (ctx) => {
  const id: string = ctx.params.id;
  // @ts-expect-error no such param
  ctx.params.slug;
  if (id === "0") notFound();
  if (!ctx.locals.user) error(401, "Sign in");
  if (id === "old") redirect("/api/posts/1", 308);
  return Response.json({ id, user: ctx.locals.user.name });
};

export function badRedirect(): never {
  // @ts-expect-error not a redirect status
  return redirect("/", 200);
}

export async function Post() {
  const slug: string = params<"/blog/[slug]">().slug;
  const any: Record<string, string> = params();
  const pattern: "/blog/[slug]" | "/api/posts/[id]" | undefined = route();
  // @ts-expect-error not a route pattern of the app
  const unknown = route() === "/blog/[id]";
  const user = locals().user?.name;
  cookies().set("seen", slug, { sameSite: "strict", maxAge: 60 });
  return [slug, any, user, pattern, unknown];
}

export function ErrorPage({ status, error }: ErrorPageProps): string {
  return \`\${status} \${error.message} \${error.status ?? ""}\`;
}
`;
