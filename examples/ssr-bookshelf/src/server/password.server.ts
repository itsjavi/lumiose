// Password hashing with scrypt (node:crypto). The stored string carries its parameters and salt,
// `scrypt$<N>$<r>$<p>$<salt>$<hash>` (base64url), so costs can change without invalidating
// existing hashes.

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

export interface ScryptParams {
  /** CPU/memory cost, a power of two. */
  N: number;
  r: number;
  p: number;
}

/** About 32 MiB and a few tens of milliseconds per hash. */
export const DEFAULT_SCRYPT: ScryptParams = { N: 2 ** 15, r: 8, p: 1 };

const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

export async function hashPassword(
  password: string,
  params: ScryptParams = DEFAULT_SCRYPT,
): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, params);
  return [
    "scrypt",
    params.N,
    params.r,
    params.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

/** False for a wrong password and for a malformed hash; never throws on bad input. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = parts.slice(1, 4).map(Number) as [number, number, number];
  if (![N, r, p].every((value) => Number.isSafeInteger(value) && value > 0)) return false;
  const salt = Buffer.from(parts[4]!, "base64url");
  const expected = Buffer.from(parts[5]!, "base64url");
  if (salt.length === 0 || expected.length !== KEY_LENGTH) return false;
  try {
    const actual = await derive(password, salt, { N, r, p });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function derive(password: string, salt: Buffer, { N, r, p }: ScryptParams): Promise<Buffer> {
  // scrypt needs 128 * N * r bytes; leave headroom over Node's 32 MiB default limit.
  const options: ScryptOptions = { N, r, p, maxmem: 256 * N * r };
  return new Promise((resolvePromise, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (error, key) => {
      if (error) reject(error);
      else resolvePromise(key);
    });
  });
}
