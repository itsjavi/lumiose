import { SESSION_COOKIE, sessionUser, type User } from "@bench/data";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/** The signed-in user, from the unsigned `uid` cookie (doc-4 §2). */
export async function currentUser(): Promise<User | undefined> {
  return sessionUser((await cookies()).get(SESSION_COOKIE)?.value);
}

/** The signed-in user; redirects to /login without a session. */
export async function requireUser(): Promise<User> {
  return (await currentUser()) ?? redirect("/login");
}

export async function startSession(user: User): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, String(user.id), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}
