import { isRedirect, type Locals } from "lumiose";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { User } from "../types.ts";
import {
  SESSION_COOKIE,
  createAuth,
  loginHref,
  safeRedirectPath,
  type Auth,
} from "./auth.server.ts";
import type { DatabaseSync } from "./db.server.ts";
import { hashPassword, verifyPassword } from "./password.server.ts";
import { DEMO_EMAIL, DEMO_PASSWORD } from "./seed.server.ts";
import { TEST_SCRYPT, fakeCookies, rollbackEach, seededDatabase } from "./test-helpers.ts";

const SECRET = "test-secret-with-enough-entropy";
const TTL = 10 * 24 * 60 * 60 * 1000;
const DAY = 86_400_000;

let db: DatabaseSync;
let auth: Auth;
const tx = rollbackEach(() => db);

beforeAll(async () => {
  db = await seededDatabase();
  auth = createAuth(db, { secret: SECRET, sessionTtlMs: TTL, scrypt: TEST_SCRYPT });
});
afterAll(() => db.close());
beforeEach(tx.begin);
afterEach(tx.rollback);

const sessionRows = (userId: number) =>
  db.prepare("SELECT id, expires_at FROM sessions WHERE user_id = ?").all(userId) as Array<{
    id: string;
    expires_at: string;
  }>;

describe("password hashing", () => {
  it("verifies the right password only", async () => {
    const hash = await hashPassword("correct horse", TEST_SCRYPT);
    expect(hash).toMatch(/^scrypt\$1024\$8\$1\$[\w-]+\$[\w-]+$/);
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("correct horse ", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("salts every hash and rejects malformed hashes without throwing", async () => {
    const [a, b] = await Promise.all([
      hashPassword("same", TEST_SCRYPT),
      hashPassword("same", TEST_SCRYPT),
    ]);
    expect(a).not.toBe(b);
    for (const bad of [
      "",
      "plain",
      "scrypt$1024$8$1$salt",
      "bcrypt$1$2$3$4$5",
      "scrypt$x$8$1$c2FsdA$aGFzaA",
    ]) {
      expect(await verifyPassword("same", bad)).toBe(false);
    }
  });

  it("verifies hashes made with other parameters", async () => {
    const hash = await hashPassword("pw-with-cost", { N: 2048, r: 4, p: 2 });
    expect(hash.startsWith("scrypt$2048$4$2$")).toBe(true);
    expect(await verifyPassword("pw-with-cost", hash)).toBe(true);
  });
});

describe("accounts", () => {
  it("registers a user and signs them in by email and password", async () => {
    const result = await auth.register({
      email: "  New.Reader@Example.com ",
      name: "New Reader",
      password: "long enough",
    });
    expect(result).toEqual({
      ok: true,
      user: {
        id: expect.any(Number),
        email: "new.reader@example.com",
        name: "New Reader",
        createdAt: expect.any(String),
      },
    });
    expect(await auth.authenticate("NEW.reader@example.com", "long enough")).toMatchObject({
      email: "new.reader@example.com",
    });
    expect(await auth.authenticate("new.reader@example.com", "wrong password")).toBeNull();
  });

  it("rejects duplicate emails and invalid fields", async () => {
    expect(
      await auth.register({
        email: DEMO_EMAIL.toUpperCase(),
        name: "Dup",
        password: "long enough",
      }),
    ).toEqual({ ok: false, errors: { email: "An account with this email already exists." } });

    const form = new FormData();
    form.set("email", "not-an-email");
    form.set("password", "short");
    const invalid = await auth.register(form);
    expect(invalid.ok).toBe(false);
    if (!invalid.ok)
      expect(Object.keys(invalid.errors).toSorted()).toEqual(["email", "name", "password"]);
  });

  it("authenticates seeded users with the demo password and rejects unknown emails", async () => {
    expect(await auth.authenticate(DEMO_EMAIL, DEMO_PASSWORD)).toMatchObject({ id: 1 });
    expect(await auth.authenticate("ghost@example.com", DEMO_PASSWORD)).toBeNull();
  });
});

describe("session lifecycle", () => {
  const start = new Date("2026-10-01T00:00:00Z");

  it("stores only a hash of the token and resolves it to the user", () => {
    const { token, expiresAt } = auth.createSession(1, start);
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(expiresAt).toBe(new Date(start.getTime() + TTL).toISOString());
    const stored = sessionRows(1);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.id).not.toContain(token);

    const valid = auth.validateSession(token, new Date(start.getTime() + DAY));
    expect(valid).toMatchObject({
      user: { id: 1, email: DEMO_EMAIL },
      session: { userId: 1, expiresAt },
      renewed: false,
    });
    expect(auth.validateSession("not-a-token", start)).toBeNull();
  });

  it("slides the expiry once past half the lifetime", () => {
    const { token, expiresAt } = auth.createSession(1, start);
    const later = new Date(start.getTime() + TTL * 0.6);
    const valid = auth.validateSession(token, later)!;
    expect(valid.renewed).toBe(true);
    expect(valid.session.expiresAt).toBe(new Date(later.getTime() + TTL).toISOString());
    expect(valid.session.expiresAt > expiresAt).toBe(true);
    expect(auth.validateSession(token, later)!.renewed).toBe(false);
  });

  it("expires sessions and deletes the expired row", () => {
    const { token } = auth.createSession(1, start);
    expect(auth.validateSession(token, new Date(start.getTime() + TTL))).toBeNull();
    expect(sessionRows(1)).toHaveLength(0);
  });

  it("revokes one session, all of a user's sessions, or expired ones", () => {
    const a = auth.createSession(1, start);
    const b = auth.createSession(1, start);
    const c = auth.createSession(2, new Date(start.getTime() - TTL));
    expect(auth.revokeSession(a.token)).toBe(true);
    expect(auth.revokeSession(a.token)).toBe(false);
    expect(auth.validateSession(a.token, start)).toBeNull();
    expect(auth.validateSession(b.token, start)).not.toBeNull();

    expect(auth.purgeExpiredSessions(start)).toBe(1);
    expect(auth.validateSession(c.token, start)).toBeNull();
    expect(auth.revokeUserSessions(1)).toBe(1);
    expect(auth.validateSession(b.token, start)).toBeNull();
  });

  it("cascades session deletion with the user", () => {
    const { token } = auth.createSession(3, start);
    db.prepare("DELETE FROM users WHERE id = 3").run();
    expect(auth.validateSession(token, start)).toBeNull();
  });
});

describe("session cookie", () => {
  it("logs in with a signed, HttpOnly session cookie and reads the user back", async () => {
    const cookies = fakeCookies();
    await auth.login(cookies, 1);
    const value = cookies.get(SESSION_COOKIE)!;
    expect(value).toMatch(/^[\w-]+\.[\w-]+$/);
    expect(cookies.writes[0]).toMatchObject({ name: SESSION_COOKIE, maxAge: TTL / 1000 });
    expect(await auth.currentUser(cookies)).toMatchObject({ id: 1 });
  });

  it("rejects a tampered or foreign-secret cookie and clears it", async () => {
    const cookies = fakeCookies();
    await auth.login(cookies, 1);
    const [token, signature] = cookies.get(SESSION_COOKIE)!.split(".");
    const tampered = fakeCookies({ [SESSION_COOKIE]: `${token}x.${signature}` });
    expect(await auth.currentUser(tampered)).toBeNull();
    expect(tampered.get(SESSION_COOKIE)).toBeUndefined();

    const other = createAuth(db, { secret: "another-secret", scrypt: TEST_SCRYPT });
    const foreign = fakeCookies({ [SESSION_COOKIE]: cookies.get(SESSION_COOKIE)! });
    expect(await other.currentUser(foreign)).toBeNull();
  });

  it("revokes the session on logout, so a replayed cookie no longer works", async () => {
    const cookies = fakeCookies();
    await auth.login(cookies, 1);
    const stolen = fakeCookies({ [SESSION_COOKIE]: cookies.get(SESSION_COOKIE)! });
    await auth.logout(cookies);
    expect(cookies.get(SESSION_COOKIE)).toBeUndefined();
    expect(await auth.currentUser(stolen)).toBeNull();
    expect(stolen.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("replaces the previous session on login", async () => {
    const cookies = fakeCookies();
    await auth.login(cookies, 1);
    const first = fakeCookies({ [SESSION_COOKIE]: cookies.get(SESSION_COOKIE)! });
    await auth.login(cookies, 2);
    expect(await auth.currentUser(cookies)).toMatchObject({ id: 2 });
    expect(await auth.currentUser(first)).toBeNull();
    expect(sessionRows(1)).toHaveLength(0);
  });

  it("re-sends the cookie when the session is renewed", async () => {
    const start = new Date();
    const cookies = fakeCookies();
    await auth.login(cookies, 1, start);
    const writes = cookies.writes.length;
    await auth.currentUser(cookies, new Date(start.getTime() + TTL * 0.6));
    expect(cookies.writes.length).toBe(writes + 1);
    await auth.currentUser(cookies, new Date(start.getTime() + TTL * 0.61));
    expect(cookies.writes.length).toBe(writes + 1);
  });
});

describe("requireUser", () => {
  const url = new URL("https://bookshelf.test/reading-list?page=2");
  const context = (locals: Locals, cookies = fakeCookies()) => ({ cookies, url, locals });

  it("returns the user resolved by the middleware", async () => {
    const user: User = { id: 7, email: "x@example.com", name: "X", createdAt: "" };
    expect(await auth.requireUser(context({ user }))).toBe(user);
  });

  it("falls back to the session cookie when locals has no user", async () => {
    const cookies = fakeCookies();
    await auth.login(cookies, 1);
    expect(await auth.requireUser(context({}, cookies))).toMatchObject({ id: 1 });
  });

  it("redirects anonymous visitors to the login page with a return path", async () => {
    for (const locals of [{ user: null }, {}]) {
      const thrown = await auth.requireUser(context(locals)).catch((error: unknown) => error);
      expect(isRedirect(thrown)).toBe(true);
      expect(thrown).toMatchObject({ location: "/login?next=%2Freading-list%3Fpage%3D2" });
    }
    expect(loginHref(url)).toBe("/login?next=%2Freading-list%3Fpage%3D2");
  });
});

describe("safeRedirectPath", () => {
  it("keeps same-origin paths", () => {
    expect(safeRedirectPath("/books?page=2#reviews")).toBe("/books?page=2#reviews");
    expect(safeRedirectPath("/books/../reading-list")).toBe("/reading-list");
  });

  it("falls back for absolute, protocol-relative and odd values", () => {
    for (const next of [
      null,
      undefined,
      "",
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "books",
      "javascript:alert(1)",
    ]) {
      expect(safeRedirectPath(next)).toBe("/");
    }
    expect(safeRedirectPath("//evil.example", "/books")).toBe("/books");
  });
});
