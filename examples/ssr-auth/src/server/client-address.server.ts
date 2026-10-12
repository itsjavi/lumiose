// The client's address for Better Auth's rate limiter, which reads it from `X-Forwarded-For`.
// Without trusted proxies, that is the address the host saw, and a client's own
// `X-Forwarded-For` is ignored (it could pick any address). Behind proxies you trust
// (TRUSTED_PROXIES), the chain they forwarded is kept and the host's address appended, as a proxy
// would: Better Auth walks it from the right, skips the trusted hops and takes the client.

/** `X-Forwarded-For` to hand to Better Auth, or `undefined` when the host knows no address. */
export function forwardedFor(
  headers: Headers,
  clientAddress: string | undefined,
  trustedProxies: readonly string[],
): string | undefined {
  const chain = trustedProxies.length > 0 ? headers.get("x-forwarded-for") : null;
  const hops = [chain, clientAddress].filter((hop): hop is string => hop != null && hop !== "");
  return hops.length === 0 ? undefined : hops.join(", ");
}

/** `TRUSTED_PROXIES`: a comma-separated list of addresses or CIDR ranges. */
export function parseTrustedProxies(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}
