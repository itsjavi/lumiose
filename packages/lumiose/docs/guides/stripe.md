# Payments with Stripe Checkout

> Start Stripe Checkout from a form action, fulfill orders in a `route.ts` endpoint that verifies Stripe's webhook signature, and show the result on a return page.

Lumiose has no payments module: the `stripe` package runs in server code, and that is where form
actions and endpoints run. This guide uses Stripe's hosted Checkout page, so the browser loads no
Stripe script and the forms work without JavaScript.

| File                                     | Role                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| `src/server/stripe.server.ts`            | The Stripe client and the products on sale. Server-only.                |
| `src/routes/pricing/page.stsx`           | A form whose action creates a Checkout Session and redirects to it.     |
| `src/routes/checkout/success/page.tsx`   | The return page: what the customer sees after paying.                   |
| `src/routes/api/stripe/webhook/route.ts` | Stripe's events, with the signature verified: fulfillment happens here. |

> **Status:** written against Stripe's API reference and the `stripe` package 23 (its types check
> every example on this page); not run against a Stripe account.

## Setup

```sh
pnpm add stripe
```

The server needs two secrets, never `PUBLIC_*` variables:

| Variable                | Where it comes from                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `STRIPE_SECRET_KEY`     | The dashboard's API keys (`sk_test_…` while testing).                                         |
| `STRIPE_WEBHOOK_SECRET` | The webhook endpoint's signing secret (`whsec_…`), or the one `stripe listen` prints locally. |

The pages and the endpoint below render per request (`export const mode = "server"`), or the
whole project does with `lumiose({ mode: "server" })`: a `static` endpoint can only answer `GET`
([LUM5005](../errors/LUM5005.md)), and a form action needs a server anyway.

## The client

The client and the price list live in a `*.server.ts` module, so neither the secret key nor the
prices can reach browser code ([LUM4003](../errors/LUM4003.md)). It is created on first use: `env()`
reads the adapter's environment, which is only there during a request on some hosts.

```ts check file=server/stripe.server.ts
// src/server/stripe.server.ts
import { env } from "lumiose";
import Stripe from "stripe";

let client: Stripe | undefined;

export function stripe(): Stripe {
  const key = env("STRIPE_SECRET_KEY");
  if (key === undefined) throw new Error("STRIPE_SECRET_KEY is not set.");
  return (client ??= new Stripe(key));
}

/** What the store sells: the form posts a plan name, never a price. */
export const PLANS = {
  starter: { name: "Starter", price: "price_starter_monthly" },
  team: { name: "Team", price: "price_team_monthly" },
} as const;

export type Plan = keyof typeof PLANS;

export function isPlan(value: unknown): value is Plan {
  return typeof value === "string" && Object.hasOwn(PLANS, value);
}
```

## Checkout from a form action

The form posts the plan to the page's `checkout` action. The action checks it against `PLANS`,
creates a Checkout Session and redirects (303) to the URL Stripe returns. Stripe sends the customer
back to `success_url`, with `{CHECKOUT_SESSION_ID}` replaced by the session's id, or to `cancel_url`.

```stsx check file=routes/pricing/page.stsx
// src/routes/pricing/page.stsx
import { Title, actionData, fail, redirect, type ActionContext } from "lumiose";
import { PLANS, isPlan, stripe } from "../../server/stripe.server.ts";

export const mode = "server";

export const actions = {
  async checkout(ctx: ActionContext<"/pricing">) {
    const plan = (await ctx.formData()).get("plan");
    if (!isPlan(plan)) return fail(400, { error: "Pick a plan." });

    const session = await stripe().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: PLANS[plan].price, quantity: 1 }],
      success_url: new URL("/checkout/success?session_id={CHECKOUT_SESSION_ID}", ctx.url).href,
      cancel_url: new URL("/pricing", ctx.url).href,
      // Ties the payment to your user in the webhook.
      client_reference_id: ctx.locals.userId ?? undefined,
      metadata: { plan },
    });
    if (session.url === null) return fail(502, { error: "Checkout is not available." });
    redirect(session.url, 303);
  },
};

export default function Pricing() {
  return (
    <main>
      <Title>Pricing</Title>
      <h1>Pricing</h1>
      <form method="post" action="?/checkout">
        {Object.entries(PLANS).map(([id, plan]) => (
          <button name="plan" value={id}>
            Subscribe to {plan.name}
          </button>
        ))}
      </form>
      <p class="error">{actionData<typeof actions>()?.error}</p>
    </main>
  );
}
```

`ctx.locals.userId` is whatever your middleware puts on `locals` (here the `Locals` of the
[Server](../concepts/server.md) page); pass `customer` or `customer_email` instead when you keep
Stripe customers. `mode: "payment"` sells one-off items; `"subscription"` needs recurring prices.

To post without a page load, put the form in an island with `onSubmit={submit}`: `submit()` follows
the redirect to Stripe like the plain form. The form above needs no JavaScript at all.

## The return page

The return page shows the result. It does not fulfill the order: the customer may close the tab
before it loads, and anyone can open the URL. Fulfillment happens in the webhook.

```tsx check file=routes/checkout/success/page.tsx
// src/routes/checkout/success/page.tsx
import { Title, notFound, url } from "lumiose";
import { stripe } from "../../../server/stripe.server.ts";

export const mode = "server";

export default async function CheckoutSuccess() {
  const id = url().searchParams.get("session_id") ?? notFound();
  const session = await stripe().checkout.sessions.retrieve(id);
  const paid =
    session.payment_status === "paid" || session.payment_status === "no_payment_required";
  return (
    <main>
      <Title>{paid ? "Thank you" : "Payment pending"}</Title>
      <h1>{paid ? "Thank you!" : "Your payment is being processed"}</h1>
      <p>A receipt is on its way to {session.customer_details?.email ?? "your email"}.</p>
    </main>
  );
}
```

## Webhooks in an endpoint

Stripe posts events to a `route.ts` endpoint. The signature covers the exact bytes of the body, so
read it with `request.text()` (never parse and re-serialize it), and verify it with
`constructEventAsync`, which uses the Web Crypto API and runs on every host Lumiose deploys to.
Answer quickly with a 2xx: Stripe retries failed deliveries, and the same event may arrive twice,
so make fulfillment idempotent.

```ts check file=routes/api/stripe/webhook/route.ts
// src/routes/api/stripe/webhook/route.ts
import { env, type Endpoint } from "lumiose";
import type Stripe from "stripe";
import { stripe } from "../../../../server/stripe.server.ts";

export const mode = "server";

export const POST: Endpoint<"/api/stripe/webhook"> = async ({ request, platform }) => {
  const signature = request.headers.get("stripe-signature");
  const secret = env("STRIPE_WEBHOOK_SECRET");
  if (signature === null || secret === undefined) return new Response(null, { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(await request.text(), signature, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (session.payment_status !== "unpaid") {
        // Slow work (emails, provisioning) may finish after the response.
        platform.waitUntil(fulfill(event.id, session));
      }
      break;
    }
    case "checkout.session.async_payment_failed":
      // Tell the customer the delayed payment failed.
      break;
  }
  return new Response(null, { status: 200 });
};

/** Grants what was bought, once per event id. */
async function fulfill(eventId: string, session: Stripe.Checkout.Session): Promise<void> {
  // if (await db.events.seen(eventId)) return;
  // await db.subscriptions.activate(session.client_reference_id, session.metadata?.plan);
  void [eventId, session];
}
```

Lumiose's cross-site check covers page form posts and form-encoded endpoint requests; Stripe posts
JSON, so the endpoint answers it and the signature is the check. Keep the endpoint out of any
middleware that requires a session.

In the dashboard, add the endpoint's URL (`https://example.com/api/stripe/webhook`) with the events
it handles. Locally, the Stripe CLI forwards them and prints the signing secret for
`STRIPE_WEBHOOK_SECRET`:

```sh
stripe listen --forward-to localhost:5173/api/stripe/webhook
stripe trigger checkout.session.completed
```

## Production

- Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` on the host, with live keys for production and
  a webhook endpoint per environment (each has its own signing secret).
- Behind a proxy, set `ORIGIN` so `ctx.url` (and with it `success_url` and `cancel_url`) has the
  public origin ([Deploy](../deploy/README.md)).
- Hosted Checkout is a redirect, so a strict CSP (`lumiose({ csp: "strict" })`) needs no change.
  Stripe.js (embedded Checkout, Elements) is a third-party script: allow its origins in your own
  policy ([Security](../concepts/security.md)).

## Common mistakes

- **Fulfilling on the return page.** It may never load, and anyone can open it. Fulfill in the
  webhook, and use the return page to show the status.
- **Trusting a price from the form.** Post a plan or product id and look its price up on the
  server, as `PLANS` does.
- **Parsing the webhook body before verifying it.** `request.json()` and `JSON.stringify` change the
  bytes, and the signature check fails. Pass `await request.text()`.
- **A static webhook endpoint.** Without `mode = "server"` (here or for the project), a `POST`
  export is [LUM5005](../errors/LUM5005.md).
- **Importing the Stripe client into an island.** The secret key would ship to the browser;
  `*.server.ts` makes it [LUM4003](../errors/LUM4003.md).
- **Doing slow work before answering the webhook.** Stripe waits a few seconds, then retries. Answer
  first and hand the rest to `platform.waitUntil()`, or queue it.
