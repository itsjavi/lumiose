import { describe, expect, it, vi } from "vitest";
import { createCookieJar, parseCookieHeader, serializeCookie, signedCookie } from "./cookies.ts";

const request = (cookie?: string) =>
  new Request("https://lumiose.test/", cookie === undefined ? {} : { headers: { cookie } });

/** An env with `NODE_ENV` and a short `LUMIOSE_SECRET`. */
const env = (nodeEnv: string) => (name: string) =>
  name === "NODE_ENV" ? nodeEnv : name === "LUMIOSE_SECRET" ? "short" : undefined;

async function sign(name: string, value: string, secret: string | string[]) {
  const jar = createCookieJar(request(), { secure: true });
  await signedCookie(name, { secret }).set(jar, value);
  return jar.headers()[0]!.split(";")[0]!;
}

function read(cookie: string, name: string, secret: string | string[]) {
  return signedCookie(name, { secret }).get(createCookieJar(request(cookie), { secure: true }));
}

describe("parseCookieHeader", () => {
  it("decodes values, strips quotes, keeps the first occurrence and skips malformed pairs", () => {
    expect(
      Object.fromEntries(
        parseCookieHeader('a=1; b="two%20words"; a=3; junk; =x; c=%E0%A4%A; d=x=y'),
      ),
    ).toEqual({ a: "1", b: "two words", c: "%E0%A4%A", d: "x=y" });
    expect(parseCookieHeader(null).size).toBe(0);
  });
});

describe("serializeCookie", () => {
  it("serializes every attribute in a stable order", () => {
    expect(
      serializeCookie("id", "a b;c", {
        domain: "lumiose.test",
        path: "/app",
        maxAge: 60.9,
        expires: new Date(Date.UTC(2030, 0, 1)),
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        partitioned: true,
      }),
    ).toBe(
      "id=a%20b%3Bc; Domain=lumiose.test; Path=/app; Max-Age=60; Expires=Tue, 01 Jan 2030 00:00:00 GMT; HttpOnly; Secure; SameSite=Strict; Partitioned",
    );
  });

  it("forces Secure for SameSite=None and rejects invalid names and attributes", () => {
    expect(serializeCookie("x", "1", { sameSite: "none" })).toBe("x=1; Secure; SameSite=None");
    expect(() => serializeCookie("bad name", "1")).toThrow(TypeError);
    expect(() => serializeCookie("x", "1", { path: "/a;b" })).toThrow(TypeError);
    expect(() => serializeCookie("x", "1", { maxAge: Number.NaN })).toThrow(TypeError);
  });
});

describe("createCookieJar", () => {
  it("reflects writes in reads and keeps the last write per name, path and domain", () => {
    const jar = createCookieJar(request("a=1; b=2"), { secure: false });
    jar.set("a", "x");
    jar.set("a", "y");
    jar.set("a", "z", { path: "/admin" });
    jar.delete("b");
    jar.set("c", "3", { httpOnly: undefined });
    expect(jar.get("a")).toBe("z");
    expect(jar.get("b")).toBeUndefined();
    expect(jar.getAll()).toEqual([
      { name: "a", value: "z" },
      { name: "c", value: "3" },
    ]);
    expect(jar.headers()).toEqual([
      "a=y; Path=/; HttpOnly; SameSite=Lax",
      "a=z; Path=/admin; HttpOnly; SameSite=Lax",
      "b=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax",
      "c=3; Path=/; HttpOnly; SameSite=Lax",
    ]);
  });

  it("throws LUM5004 once sealed", () => {
    const jar = createCookieJar(request(), { secure: true });
    jar.seal();
    expect(() => jar.set("a", "1")).toThrow(/LUM5004/);
    expect(() => jar.delete("a")).toThrow(/LUM5004/);
  });
});

describe("signedCookie", () => {
  it("round-trips values, including dots and unicode", async () => {
    const cookie = await sign("s", "a.b ✓", "k1");
    expect(await read(cookie, "s", "k1")).toBe("a.b ✓");
  });

  it("rejects tampered values, other secrets, other cookie names and garbage", async () => {
    const cookie = await sign("s", "user:1", "k1");
    expect(await read(cookie.replace("user", "admin"), "s", "k1")).toBeUndefined();
    expect(await read(cookie, "s", "k2")).toBeUndefined();
    expect(await read(cookie.replace(/^s=/, "t="), "t", "k1")).toBeUndefined();
    expect(await read("s=nodot", "s", "k1")).toBeUndefined();
    expect(await read("s=v.%%%", "s", "k1")).toBeUndefined();
    expect(await read("", "s", "k1")).toBeUndefined();
  });

  it("verifies with any rotated secret and signs with the first", async () => {
    const old = await sign("s", "v", "old");
    expect(await read(old, "s", ["new", "old"])).toBe("v");
    const fresh = await sign("s", "v", ["new", "old"]);
    expect(await read(fresh, "s", "new")).toBe("v");
  });

  it("reads the secret from LUMIOSE_SECRET, and fails clearly without one", async () => {
    const jar = createCookieJar(request(), { secure: true });
    await signedCookie("s", {}, (name) =>
      name === "LUMIOSE_SECRET" ? "env-secret" : undefined,
    ).set(jar, "v");
    expect(await read(jar.headers()[0]!.split(";")[0]!, "s", "env-secret")).toBe("v");
    await expect(signedCookie("s", {}, () => undefined).set(jar, "v")).rejects.toThrow(
      /LUMIOSE_SECRET/,
    );
  });

  it("deletes with the cookie's own options", () => {
    const jar = createCookieJar(request(), { secure: false });
    signedCookie("s", { secret: "k", path: "/app" }).delete(jar);
    expect(jar.headers()[0]).toMatch(/^s=; Path=\/app; Max-Age=0;/);
  });

  it("refuses secrets under 32 bytes in production, warns in development (decision-29)", async () => {
    const jar = createCookieJar(request(), { secure: true });
    await expect(signedCookie("p", {}, env("production")).set(jar, "v")).rejects.toThrow(
      /shorter than 32 bytes/,
    );
    await signedCookie("p", { allowWeakSecret: true }, env("production")).set(jar, "v");
    const long = "x".repeat(32);
    await signedCookie("p", { secret: long }, env("production")).set(jar, "v");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await signedCookie("dev-only", {}, env("development")).set(jar, "v");
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/shorter than 32 bytes/));
    } finally {
      warn.mockRestore();
    }
  });
});
