import { SESSION_COOKIE, type User } from "@bench/data";
import type { AstroCookies } from "astro";

/** Same attributes as the other apps: not `Secure`, since the benchmark serves plain http. */
const OPTIONS = { path: "/", httpOnly: true, sameSite: "lax" } as const;

export function signIn(cookies: AstroCookies, user: User): void {
  cookies.set(SESSION_COOKIE, String(user.id), OPTIONS);
}

export function signOut(cookies: AstroCookies): void {
  cookies.delete(SESSION_COOKIE, OPTIONS);
}
