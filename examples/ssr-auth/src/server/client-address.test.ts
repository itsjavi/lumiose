import { expect, it } from "vitest";
import { forwardedFor, parseTrustedProxies } from "./client-address.server.ts";

const spoofed = new Headers({ "x-forwarded-for": "203.0.113.9" });

it("uses the host's address and ignores the client's header without trusted proxies", () => {
  expect(forwardedFor(spoofed, "198.51.100.7", [])).toBe("198.51.100.7");
  expect(forwardedFor(new Headers(), undefined, [])).toBeUndefined();
});

it("appends the host's address to the chain trusted proxies forwarded", () => {
  const proxied = new Headers({ "x-forwarded-for": "203.0.113.9" });
  expect(forwardedFor(proxied, "127.0.0.1", ["127.0.0.1"])).toBe("203.0.113.9, 127.0.0.1");
  expect(forwardedFor(new Headers(), "127.0.0.1", ["127.0.0.1"])).toBe("127.0.0.1");
});

it("parses TRUSTED_PROXIES", () => {
  expect(parseTrustedProxies(" 127.0.0.1, ::1 ,10.0.0.0/8,")).toEqual([
    "127.0.0.1",
    "::1",
    "10.0.0.0/8",
  ]);
  expect(parseTrustedProxies(undefined)).toEqual([]);
});
