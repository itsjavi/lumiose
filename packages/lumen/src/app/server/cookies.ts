// Request cookies (spec §8 Context): RFC 6265 parsing and `Set-Cookie` serialization, plus
// HMAC-signed cookies over WebCrypto. Runtime-agnostic (no Node APIs).

import { LUM_AFTER_SHELL, LumenError } from "../diagnostics.ts";

export interface CookieOptions {
  /** Default `/`. */
  path?: string;
  domain?: string;
  /** Lifetime in seconds. */
  maxAge?: number;
  expires?: Date;
  /** Default `true`. */
  httpOnly?: boolean;
  /** Default `true` in production and on https URLs; `false` for http in dev. */
  secure?: boolean;
  /** Default `"lax"`. `"none"` forces `secure`. */
  sameSite?: "lax" | "strict" | "none";
  /** CHIPS partitioned cookie; forces `secure`. */
  partitioned?: boolean;
}

export type CookieDeleteOptions = Pick<CookieOptions, "path" | "domain" | "secure" | "sameSite">;

export interface Cookies {
  /** The request cookie, or the value set earlier during this request. */
  get(name: string): string | undefined;
  /** Every cookie visible to this request, including values set during it. */
  getAll(): Array<{ name: string; value: string }>;
  /** Queues a `Set-Cookie` header. Values are percent-encoded; `get()` decodes them. */
  set(name: string, value: string, options?: CookieOptions): void;
  /** Queues an expired `Set-Cookie`; pass the same `path`/`domain` used to set it. */
  delete(name: string, options?: CookieDeleteOptions): void;
}

/** Request-side cookie jar: the public `Cookies` API plus what the handler needs to emit headers. */
export interface CookieJar extends Cookies {
  /** `Set-Cookie` header values for every cookie set or deleted, in order. */
  headers(): string[];
  /** Further writes throw LUM5004: the response headers were already sent. */
  seal(): void;
}

export interface CookieJarOptions {
  /** Default for `secure` when a call does not pass it. */
  secure: boolean;
}

// RFC 6265 §4.1.1: cookie-name is an RFC 7230 token.
const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
// Path and domain attribute values may not contain control characters or ";".
const INVALID_ATTRIBUTE_VALUE = /[;\p{Cc}]/u;

/** Parses a `Cookie` request header; the first occurrence of a name wins (most specific path). */
export function parseCookieHeader(header: string | null): Map<string, string> {
  const cookies = new Map<string, string>();
  if (header === null) return cookies;
  for (const pair of header.split(";")) {
    const at = pair.indexOf("=");
    if (at === -1) continue;
    const name = pair.slice(0, at).trim();
    if (name === "" || cookies.has(name)) continue;
    let value = pair.slice(at + 1).trim();
    if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    cookies.set(name, decode(value));
  }
  return cookies;
}

/** Serializes one `Set-Cookie` header value. The value is percent-encoded. */
export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  if (!TOKEN.test(name)) throw new TypeError(`Invalid cookie name "${name}".`);
  let header = `${name}=${encodeURIComponent(value)}`;
  if (options.domain !== undefined) header += `; Domain=${attribute("domain", options.domain)}`;
  if (options.path !== undefined) header += `; Path=${attribute("path", options.path)}`;
  if (options.maxAge !== undefined) {
    if (!Number.isFinite(options.maxAge)) {
      throw new TypeError(`Cookie "${name}": maxAge must be a finite number of seconds.`);
    }
    header += `; Max-Age=${Math.floor(options.maxAge)}`;
  }
  if (options.expires !== undefined) header += `; Expires=${options.expires.toUTCString()}`;
  if (options.httpOnly) header += "; HttpOnly";
  const sameSite = options.sameSite;
  // Browsers reject SameSite=None and Partitioned cookies without Secure.
  if (options.secure || sameSite === "none" || options.partitioned) header += "; Secure";
  if (sameSite !== undefined)
    header += `; SameSite=${sameSite[0]!.toUpperCase()}${sameSite.slice(1)}`;
  if (options.partitioned) header += "; Partitioned";
  return header;
}

export function createCookieJar(request: Request, options: CookieJarOptions): CookieJar {
  const incoming = parseCookieHeader(request.headers.get("cookie"));
  /** Pending `Set-Cookie`s keyed by name, path and domain (a later write replaces an earlier one). */
  const outgoing = new Map<string, { name: string; value: string | null; header: string }>();
  let sealed = false;

  const write = (name: string, value: string | null, cookieOptions: CookieOptions) => {
    if (sealed) {
      throw new LumenError(
        LUM_AFTER_SHELL,
        `Cannot set cookie "${name}": the response headers were already sent.`,
      );
    }
    const header = serializeCookie(name, value ?? "", cookieOptions);
    outgoing.set(`${name};${cookieOptions.path ?? ""};${cookieOptions.domain ?? ""}`, {
      name,
      value,
      header,
    });
  };
  const current = (): Map<string, string> => {
    const visible = new Map(incoming);
    for (const { name, value } of outgoing.values()) {
      if (value === null) visible.delete(name);
      else visible.set(name, value);
    }
    return visible;
  };

  return {
    get: (name) => current().get(name),
    getAll: () => [...current()].map(([name, value]) => ({ name, value })),
    set(name, value, cookieOptions = {}) {
      const resolved: CookieOptions = {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: options.secure,
        ...withoutUndefined(cookieOptions),
      };
      write(name, value, resolved);
    },
    delete(name, deleteOptions = {}) {
      const resolved: CookieOptions = {
        path: "/",
        secure: options.secure,
        sameSite: "lax",
        ...withoutUndefined(deleteOptions),
        maxAge: 0,
        expires: new Date(0),
      };
      write(name, null, resolved);
    },
    headers: () => [...outgoing.values()].map((cookie) => cookie.header),
    seal() {
      sealed = true;
    },
  };
}

// --- Signed cookies -------------------------------------------------------------------------

export interface SignedCookieOptions extends CookieOptions {
  /**
   * HMAC secret. An array rotates keys: the first signs, all of them verify.
   * Default: the `LUMEN_SECRET` env variable, read when the cookie is used.
   */
  secret?: string | readonly string[];
}

export interface SignedCookie {
  readonly name: string;
  /** The value when the signature is valid, otherwise `undefined`. */
  get(cookies: Cookies): Promise<string | undefined>;
  set(cookies: Cookies, value: string, options?: CookieOptions): Promise<void>;
  delete(cookies: Cookies, options?: CookieDeleteOptions): void;
}

export const SECRET_ENV = "LUMEN_SECRET";

/**
 * A cookie whose value is signed with HMAC-SHA256 (`value.signature`, base64url). The signature
 * covers the cookie name too, so a value signed for one cookie is rejected by another.
 * Signing protects integrity only: the value itself is readable by the client.
 */
export function signedCookie(
  name: string,
  options: SignedCookieOptions = {},
  readEnv: (name: string) => string | undefined = defaultEnv,
): SignedCookie {
  const { secret, ...cookieOptions } = options;
  const secrets = (): readonly string[] => {
    const value = secret ?? readEnv(SECRET_ENV);
    const list = typeof value === "string" ? [value] : (value ?? []);
    if (list.length === 0 || list.some((item) => item === "")) {
      throw new Error(
        `signedCookie("${name}") needs a secret: set the ${SECRET_ENV} env variable or pass { secret }.`,
      );
    }
    return list;
  };

  return {
    name,
    async get(cookies) {
      const raw = cookies.get(name);
      if (raw === undefined) return undefined;
      const at = raw.lastIndexOf(".");
      if (at === -1) return undefined;
      const value = raw.slice(0, at);
      const signature = fromBase64Url(raw.slice(at + 1));
      if (signature === null) return undefined;
      const data = encoder.encode(`${name}=${value}`);
      for (const key of secrets()) {
        if (await crypto.subtle.verify("HMAC", await hmacKey(key), signature, data)) return value;
      }
      return undefined;
    },
    async set(cookies, value, setOptions) {
      const data = encoder.encode(`${name}=${value}`);
      const signature = await crypto.subtle.sign("HMAC", await hmacKey(secrets()[0]!), data);
      cookies.set(name, `${value}.${toBase64Url(new Uint8Array(signature))}`, {
        ...cookieOptions,
        ...setOptions,
      });
    },
    delete(cookies, deleteOptions) {
      cookies.delete(name, { ...cookieOptions, ...deleteOptions });
    },
  };
}

const encoder = new TextEncoder();
const keys = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string): Promise<CryptoKey> {
  let key = keys.get(secret);
  if (key === undefined) {
    key = crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
    keys.set(secret, key);
  }
  return key;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
  try {
    const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function defaultEnv(name: string): string | undefined {
  return (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env[
    name
  ];
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function attribute(kind: string, value: string): string {
  if (INVALID_ATTRIBUTE_VALUE.test(value))
    throw new TypeError(`Invalid cookie ${kind} "${value}".`);
  return value;
}

function withoutUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  ) as Partial<T>;
}
