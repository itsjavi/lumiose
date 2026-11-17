# Sign-in by email code

> Sign in and sign up with a one-time code sent by email, with Better Auth's email OTP plugin: two form actions that work without JavaScript, onboarding for new accounts, and rate limits.

## 1. Add the plugin

The visitor enters their email, gets a one-time code and enters it: two form actions on top of
the [auth guide](auth.md)'s setup ([How the flow works](#how-the-flow-works)).

```ts
// src/server/auth.server.ts
import { emailOTP } from "better-auth/plugins";
import { sendMail } from "./mailer.server.ts";

function createAuth(trustedProxies: string[]) {
  return betterAuth({
    // secret, baseURL, database and advanced as in the auth guide; keep emailAndPassword for passwords too.
    user: {
      // Set by the onboarding form; until then, the guard of step 5 sends the account there.
      additionalFields: { onboardedAt: { type: "date", required: false, input: false } },
    },
    plugins: [
      emailOTP({
        expiresIn: 300, // seconds: the default
        allowedAttempts: 3, // wrong codes before the code is void: the default
        storeOTP: "hashed", // the database keeps a hash of the code
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== "sign-in") return;
          // Not awaited: the response does not wait for the mail server (Better Auth's advice).
          sendMail({
            to: email,
            subject: "Your sign-in code",
            text: `Your code is ${otp}. It expires in 5 minutes.`,
          }).catch((error: unknown) => console.error("The sign-in code was not sent", error));
        },
      }),
    ],
  });
}
```

Codes have 6 digits (`otpLength`). `input: false` keeps `onboardedAt` out of what a request may
set. On a serverless host, which may stop work that outlives the response, see Better Auth's
`advanced.backgroundTasks`. The schema gets the field (`npx auth generate` adds it) and a table of
your own for the sign-ins in progress:

```prisma
model User {
  // Better Auth's fields, as in the auth guide, and:
  onboardedAt   DateTime?
}

/// A sign-in in progress: the email a code went to, behind a random id.
model SignInChallenge {
  id        String   @id
  email     String
  expiresAt DateTime

  @@map("sign_in_challenge")
}
```

## 2. Print codes in development

```ts
// src/server/mailer.server.ts
export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(mail: Mail): Promise<void> {
  if (import.meta.env.DEV) {
    // Development: the server's console, and nowhere else.
    console.info(`\n[mail] to ${mail.to}: ${mail.subject}\n${mail.text}\n`);
    return;
  }
  // Production: your email provider's API, or SMTP.
  throw new Error("sendMail(): no mail provider is set up");
}
```

In `lumiose dev` the code shows in the terminal that runs it. **Never render a code on a page, in a
response or in a URL, not even in development.** A code on the page proves nothing about the
inbox, and a page that shows it in development is one wrong flag away from showing anyone the code
for any address. `import.meta.env.DEV` is `false` in `lumiose build`, which drops the branch, and
production without a provider fails loudly instead of skipping the mail. End-to-end tests read the
code from the server's output, or from a test inbox of the mail provider.

## 3. Ask for a code

```ts
// src/server/sign-in-challenge.server.ts
import { prisma } from "./db.server.ts";

/** As long as the code lives (`expiresIn`). */
const LIFETIME_MS = 5 * 60 * 1000;

/** Stores a sign-in for `email`; returns its random id, which is all the URL carries. */
export async function createChallenge(email: string): Promise<string> {
  const id = crypto.randomUUID();
  const db = prisma();
  await db.signInChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await db.signInChallenge.create({
    data: { id, email, expiresAt: new Date(Date.now() + LIFETIME_MS) },
  });
  return id;
}

/** The email of a sign-in that has not expired, or `undefined`. */
export async function challengeEmail(id: string): Promise<string | undefined> {
  const challenge = await prisma().signInChallenge.findUnique({ where: { id } });
  return challenge !== null && challenge.expiresAt > new Date() ? challenge.email : undefined;
}

export async function deleteChallenge(id: string): Promise<void> {
  await prisma().signInChallenge.deleteMany({ where: { id } });
}

/** Resolves once `Date.now()` reaches `deadline`. */
export function sleepUntil(deadline: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, deadline - Date.now())));
}
```

```stsx
// src/routes/sign-in/page.stsx
import { actionData, fail, href, redirect, Title, type ActionContext } from "lumiose";
import { authError, authRequest } from "../../server/auth.server.ts";
import { createChallenge, sleepUntil } from "../../server/sign-in-challenge.server.ts";

export const action = async (ctx: ActionContext<"/sign-in">) => {
  // Every answer takes this long, so the time Better Auth takes does not tell whether an
  // account has this email.
  const deadline = Date.now() + 1000;
  const form = await ctx.formData();
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const response = await authRequest(ctx, "/email-otp/send-verification-otp", {
    email,
    type: "sign-in",
  });
  if (!response.ok) {
    // An invalid address (400) or too many requests (429): neither depends on an account.
    const message = await authError(response);
    await sleepUntil(deadline);
    return fail(response.status, { email, message });
  }
  const challenge = await createChallenge(email);
  await sleepUntil(deadline);
  // The random id in the URL, never the email; `?next=` goes along.
  redirect(href("/sign-in/code/[challenge]", { challenge }) + ctx.url.search);
};

export default function SignIn() {
  const failed = actionData<typeof action>();
  return (
    <main>
      <Title>Sign in</Title>
      {/* No action attribute: the form posts to this URL, `?next=` included. */}
      <form method="post">
        <input
          type="email"
          name="email"
          value={failed?.email ?? ""}
          autocomplete="email"
          required
        />
        <p role="alert">{failed?.message}</p>
        <button>Email me a code</button>
      </form>
    </main>
  );
}
```

- **The same answer.** With sign-up open, Better Auth sends a code to any address, so every valid
  address gets the redirect. With `emailOTP({ disableSignUp: true })`, an unknown address gets no
  mail and the same redirect. The errors left, an invalid address or too many requests, do not
  depend on an account either.
- **The same time.** Every answer waits until a second has passed, so the time a user lookup or a
  database write takes does not tell either. Pick a delay above what the request takes in your
  setup.
- **The id** has 122 random bits (`crypto.randomUUID()`), so it cannot be guessed. Whoever has the
  URL can try codes for its address, three per code, which is why the code page does not show the
  address.

## 4. Sign in with the code

```stsx
// src/routes/sign-in/code/[challenge]/page.stsx
import { actionData, fail, href, Title, type ActionContext } from "lumiose";
import {
  authError,
  authRequest,
  redirectWithCookies,
  safeNext,
} from "../../../../server/auth.server.ts";
import { challengeEmail, deleteChallenge } from "../../../../server/sign-in-challenge.server.ts";

export const action = async (ctx: ActionContext<"/sign-in/code/[challenge]">) => {
  const { challenge } = ctx.params;
  const email = await challengeEmail(challenge);
  if (email === undefined) return fail(410, { message: "The code has expired. Ask for a new one." });
  const form = await ctx.formData();
  const otp = String(form.get("code") ?? "").replace(/\s/g, "");
  // Signs the account in, or creates it and signs it in: the response sets the session cookie.
  const response = await authRequest(ctx, "/sign-in/email-otp", { email, otp });
  // A wrong or expired code (400), a fourth try (403), too many requests (429).
  if (!response.ok) return fail(response.status, { message: await authError(response) });
  await deleteChallenge(challenge);
  return redirectWithCookies(safeNext(ctx.url.searchParams.get("next")), response.headers);
};

export default function EnterCode() {
  const failed = actionData<typeof action>();
  return (
    <main>
      <Title>Enter your code</Title>
      {/* Not the address: anyone with this URL could read it. */}
      <p>We sent a 6-digit code to the address you entered. It expires in 5 minutes.</p>
      <form method="post">
        <input name="code" inputmode="numeric" autocomplete="one-time-code" required />
        <p role="alert">{failed?.message}</p>
        <button>Sign in</button>
      </form>
      <a href={href("/sign-in")}>Use another address, or get a new code</a>
    </main>
  );
}
```

- **Cookies.** Better Auth's response sets the session cookie, so the action returns
  `redirectWithCookies()`, as the password sign-in does.
- **Errors.** A wrong code is "Invalid OTP" (`400`), an old one "OTP expired" (`400`). After three
  wrong codes the code is void: the next try gets "Too many attempts" (`403`), and the visitor asks
  for a new code. `autocomplete="one-time-code"` lets phones fill in the code from the mail.
- **Cleanup.** The challenge goes once the sign-in succeeds; expired ones go with the next
  `createChallenge()`.

## 5. Onboard new accounts

Entering a code for an unknown address creates the account, with its email verified (the code
proves it), an empty `name` and no `onboardedAt`. Middleware in a route group sends such accounts to
onboarding, and visitors without a session to sign-in, for every page, action and endpoint in the
group. A group folder adds no URL segment: `src/routes/(app)/dashboard/page.stsx` is `/dashboard`
([Server](../concepts/server.md#concept)).

```ts
// src/routes/(app)/middleware.ts: every route in the (app) group
import { href, type Middleware } from "lumiose";

const onboarded: Middleware = (ctx, next) => {
  const { session } = ctx.locals; // set by src/middleware.ts, which runs first
  const back = `?next=${encodeURIComponent(ctx.url.pathname + ctx.url.search)}`;
  if (session === null) return Response.redirect(new URL(href("/sign-in") + back, ctx.url), 303);
  if (!session.user.onboardedAt) {
    return Response.redirect(new URL(href("/onboarding") + back, ctx.url), 303);
  }
  return next();
};

export default onboarded;
```

```stsx
// src/routes/onboarding/page.stsx: outside the group, so the guard does not send it to itself
import { actionData, fail, href, redirect, Title, type ActionContext } from "lumiose";
import { requireSession, safeNext } from "../../server/auth.server.ts";
import { prisma } from "../../server/db.server.ts";

export const action = async (ctx: ActionContext<"/onboarding">) => {
  const { session } = ctx.locals;
  if (session === null) redirect(href("/sign-in"));
  const form = await ctx.formData();
  const name = String(form.get("name") ?? "").trim();
  if (name === "") return fail(400, { name, message: "Enter your name." });
  await prisma().user.update({
    where: { id: session.user.id },
    data: { name, onboardedAt: new Date() },
  });
  redirect(safeNext(ctx.url.searchParams.get("next")));
};

export default function Onboarding() {
  const { user } = requireSession();
  const failed = actionData<typeof action>();
  return (
    <main>
      <Title>Welcome</Title>
      <form method="post">
        <input name="name" value={failed?.name ?? user.name} autocomplete="name" required />
        <p role="alert">{failed?.message}</p>
        <button>Continue</button>
      </form>
    </main>
  );
}
```

After its code, a new account lands on `?next=` or `/dashboard`; the guard sends it to
`/onboarding?next=%2Fdashboard`, and onboarding sends it back. `session.user.onboardedAt` is typed
from `additionalFields`, and `getSession()` reads it from the database on each request. Keep
Better Auth's `session.cookieCache` off (the default), or the guard sees the cached session,
without `onboardedAt`, until the cache expires.

## How the flow works

Instead of a password, the visitor enters their email and gets a one-time code, with Better Auth's
[email OTP plugin](https://www.better-auth.com/docs/plugins/email-otp). The flow is two form
actions, so it works without JavaScript:

1. `/sign-in` asks Better Auth for a code, stores the sign-in on the server and redirects to
   `/sign-in/code/<random id>`. The URL carries the id, never the email: URLs end up in the
   browser's history, in server and proxy logs and in analytics.
2. `/sign-in/code/[challenge]` finds the email by the id, signs in with the code and sets the
   session cookie.

An unknown address gets a code too, and entering it creates the account: sign-up is the same flow.
These pages replace the sign-in and sign-up pages of [Authentication with Better Auth](auth.md),
and reuse its `authRequest()`, `authError()`, `redirectWithCookies()` and `safeNext()`.

## Rate limits

- **Per client.** The plugin allows 3 requests per 60 seconds per client address on
  `/email-otp/send-verification-otp` and on `/sign-in/email-otp`, in production
  (`emailOTP({ rateLimit: { window, max } })` changes both). The actions post through
  `authRequest()`, so the limiter counts them, keyed by the
  [client's address](auth.md#client-addresses-for-the-rate-limiter); a limited request gets `429`.
- **Per code.** `allowedAttempts` caps the guesses: three tries at a 6-digit code.
- **Per inbox.** Many client addresses can still send codes to one inbox. To cap that, count the
  email's recent challenges in the sign-in action and, past a limit, skip the request to Better
  Auth but answer the same.
- **Several instances** need shared counts, as for passwords ([Production](auth.md#production)).

## Production

- **Mail.** Give `sendMail()` a mail provider (it throws without one), and set up SPF and
  DKIM for the sending domain, or the codes land in spam folders.
- Everything in the auth guide's [Production](auth.md#production) list applies: the secret, the
  public URL, migrations, `TRUSTED_PROXIES` and shared rate-limit counts.

## Common mistakes

- **Showing the email code on the page in development.** Print it to the server's console only.
- **Putting the email in the code page's URL** (`/sign-in/code?email=…`). Keep it on the server,
  behind a random id.
- **Answering differently for an unknown address** ("No account with this email"), or faster. It
  tells anyone which addresses have accounts.

See also: [Authentication with Better Auth](auth.md), [Server](../concepts/server.md),
[Security](../concepts/security.md).
