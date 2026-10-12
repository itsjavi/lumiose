// Better Auth's browser client, for islands: it calls /api/auth/* on the page's origin. It has no
// server imports, so it can reach the browser.
import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient();
