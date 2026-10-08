// Accounts and sessions. Passwords are scrypt hashes (password.server.ts). A session is a random
// token kept in an HMAC-signed, HttpOnly cookie (Lumen's `signedCookie`, secret `LUMEN_SECRET`);
// the `sessions` table stores the token's SHA-256 with an expiry, so logging out or revoking a
// row ends the session server-side. Sessions slide: past half their lifetime, a request renews
// them.

import { createHash, randomBytes } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  cookies as requestCookies,
  locals as requestLocals,
  redirect,
  signedCookie,
  url as requestUrl,
  type Cookies,
  type RequestContext,
} from "lumen";
import {
  normalizeEmail,
  validateRegistration,
  type FormInput,
  type RegistrationInput,
} from "../lib/validation.ts";
import type { FieldErrors, User } from "../types.ts";
import { getDatabase, statement, timestamp } from "./db.server.ts";
import {
  DEFAULT_SCRYPT,
  hashPassword,
  verifyPassword,
  type ScryptParams,
} from "./password.server.ts";

declare module "lumen" {
  interface Locals {
    /** Set by the middleware from the session cookie: the signed-in user or `null`. */
    user?: User | null;
  }
}

export const SESSION_COOKIE = "bookshelf_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AuthOptions {
  /** HMAC secret(s) of the session cookie. Default: the `LUMEN_SECRET` env variable. */
  secret?: string | readonly string[];
  cookieName?: string;
  /** Session lifetime. Default 30 days. */
  sessionTtlMs?: number;
  /** Cost of new password hashes. Default `DEFAULT_SCRYPT`. */
  scrypt?: ScryptParams;
}

export interface Session {
  userId: number;
  createdAt: string;
  expiresAt: string;
}

export interface ValidSession {
  user: User;
  session: Session;
  /** The expiry moved forward; re-send the cookie so the browser keeps it as long. */
  renewed: boolean;
}

export type RegisterResult =
  | { ok: true; user: User }
  | { ok: false; errors: FieldErrors<keyof RegistrationInput> };

/** What `requireUser` reads; a page can omit it to use the current request. */
export type AuthContext = Pick<RequestContext, "cookies" | "url" | "locals">;

interface UserRow {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

interface SessionRow extends UserRow {
  user_id: number;
  session_created_at: string;
  expires_at: string;
}

export type Auth = ReturnType<typeof createAuth>;

export function createAuth(db: DatabaseSync, options: AuthOptions = {}) {
  const ttl = options.sessionTtlMs ?? SESSION_TTL_MS;
  const scrypt = options.scrypt ?? DEFAULT_SCRYPT;
  const cookie = signedCookie(options.cookieName ?? SESSION_COOKIE, {
    ...(options.secret === undefined ? {} : { secret: options.secret }),
    maxAge: Math.floor(ttl / 1000),
  });
  let dummyHash: Promise<string> | undefined;

  // --- Accounts ------------------------------------------------------------------------------

  /** Validates the form fields and creates the account; `errors` map to form fields. */
  async function register(input: FormInput): Promise<RegisterResult> {
    const parsed = validateRegistration(input);
    if (!parsed.ok) return parsed;
    const { email, name, password } = parsed.value;
    const taken: RegisterResult = {
      ok: false,
      errors: { email: "An account with this email already exists." },
    };
    if (statement(db, "SELECT 1 FROM users WHERE email = ?").get(email) !== undefined) return taken;
    const passwordHash = await hashPassword(password, scrypt);
    // ON CONFLICT covers a concurrent registration that won while this one was hashing.
    const row = statement(
      db,
      `INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, name, created_at`,
    ).get(email, name, passwordHash, timestamp()) as UserRow | undefined;
    if (row === undefined) return taken;
    return { ok: true, user: toUser(row) };
  }

  /** The user when the password matches, otherwise `null` (same cost for unknown emails). */
  async function authenticate(email: string, password: string): Promise<User | null> {
    const row = statement(
      db,
      "SELECT id, email, name, created_at, password_hash FROM users WHERE email = ?",
    ).get(normalizeEmail(email)) as (UserRow & { password_hash: string }) | undefined;
    if (row === undefined) {
      // Hash anyway so response time does not reveal which emails have accounts.
      await verifyPassword(password, await (dummyHash ??= hashPassword("not a password", scrypt)));
      return null;
    }
    return (await verifyPassword(password, row.password_hash)) ? toUser(row) : null;
  }

  // --- Sessions (token level) ----------------------------------------------------------------

  function createSession(
    userId: number,
    now: Date = new Date(),
  ): { token: string; expiresAt: string } {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = timestamp(new Date(now.getTime() + ttl));
    statement(
      db,
      "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    ).run(hashToken(token), userId, timestamp(now), expiresAt);
    return { token, expiresAt };
  }

  /** The session's user, or `null` when unknown, revoked or expired (expired rows are removed). */
  function validateSession(token: string, now: Date = new Date()): ValidSession | null {
    const id = hashToken(token);
    const row = statement(
      db,
      `SELECT s.user_id, s.created_at AS session_created_at, s.expires_at,
         u.id, u.email, u.name, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?`,
    ).get(id) as SessionRow | undefined;
    if (row === undefined) return null;
    const remaining = Date.parse(row.expires_at) - now.getTime();
    if (remaining <= 0) {
      statement(db, "DELETE FROM sessions WHERE id = ?").run(id);
      return null;
    }
    let expiresAt = row.expires_at;
    const renewed = remaining < ttl / 2;
    if (renewed) {
      expiresAt = timestamp(new Date(now.getTime() + ttl));
      statement(db, "UPDATE sessions SET expires_at = ? WHERE id = ?").run(expiresAt, id);
    }
    return {
      user: toUser(row),
      session: { userId: row.user_id, createdAt: row.session_created_at, expiresAt },
      renewed,
    };
  }

  /** True when the session existed. */
  function revokeSession(token: string): boolean {
    const { changes } = statement(db, "DELETE FROM sessions WHERE id = ?").run(hashToken(token));
    return Number(changes) === 1;
  }

  /** Signs the user out everywhere (e.g. after a password change). Returns the count revoked. */
  function revokeUserSessions(userId: number): number {
    return Number(statement(db, "DELETE FROM sessions WHERE user_id = ?").run(userId).changes);
  }

  function purgeExpiredSessions(now: Date = new Date()): number {
    return Number(
      statement(db, "DELETE FROM sessions WHERE expires_at <= ?").run(timestamp(now)).changes,
    );
  }

  // --- Sessions (cookie level) ---------------------------------------------------------------
  // These write cookies, so call them before the response starts: in middleware, actions or
  // the page shell, never inside a <Suspense> boundary (LUM5004).

  /** Starts a session for the user, replacing (and revoking) any session in the cookie. */
  async function login(jar: Cookies, userId: number, now: Date = new Date()): Promise<void> {
    const previous = await cookie.get(jar);
    if (previous !== undefined) revokeSession(previous);
    const { token } = createSession(userId, now);
    await cookie.set(jar, token);
  }

  async function logout(jar: Cookies): Promise<void> {
    const token = await cookie.get(jar);
    if (token !== undefined) revokeSession(token);
    cookie.delete(jar);
  }

  /**
   * The signed-in user, or `null`. Clears a cookie whose signature or session is no longer
   * valid, and re-sends a renewed one.
   */
  async function currentUser(jar: Cookies, now: Date = new Date()): Promise<User | null> {
    const token = await cookie.get(jar);
    if (token === undefined) {
      if (jar.get(cookie.name) !== undefined) cookie.delete(jar);
      return null;
    }
    const valid = validateSession(token, now);
    if (valid === null) {
      cookie.delete(jar);
      return null;
    }
    if (valid.renewed) await cookie.set(jar, token);
    return valid.user;
  }

  /**
   * The signed-in user; otherwise redirects to `/login?next=<this page>`. Uses `locals.user`
   * when the middleware resolved it. Without `ctx`, reads the current request (pages).
   */
  async function requireSignedIn(ctx?: AuthContext): Promise<User> {
    const { cookies, url, locals } = ctx ?? {
      cookies: requestCookies(),
      url: requestUrl(),
      locals: requestLocals(),
    };
    const user = locals.user !== undefined ? locals.user : await currentUser(cookies);
    if (user === null) redirect(loginHref(url));
    return user;
  }

  return {
    register,
    authenticate,
    createSession,
    validateSession,
    revokeSession,
    revokeUserSessions,
    purgeExpiredSessions,
    login,
    logout,
    currentUser,
    requireUser: requireSignedIn,
  };
}

let shared: Auth | undefined;

/** Auth over the app's shared database (`getDatabase()`). */
export function auth(): Auth {
  return (shared ??= createAuth(getDatabase()));
}

/** `auth().requireUser(ctx)`. */
export function requireUser(ctx?: AuthContext): Promise<User> {
  return auth().requireUser(ctx);
}

/** The login page URL that returns to `url` afterwards. */
export function loginHref(url: URL): string {
  return `/login?next=${encodeURIComponent(url.pathname + url.search)}`;
}

/**
 * A `?next=` value that is safe to redirect to: a same-origin path, else `fallback`.
 * Rejects absolute and protocol-relative URLs (`//evil.example`, `/\evil.example`).
 */
export function safeRedirectPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  const base = "http://bookshelf.invalid";
  try {
    const target = new URL(next, base);
    if (target.origin !== base) return fallback;
    return target.pathname + target.search + target.hash;
  } catch {
    return fallback;
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toUser(row: UserRow): User {
  return { id: row.id, email: row.email, name: row.name, createdAt: row.created_at };
}
