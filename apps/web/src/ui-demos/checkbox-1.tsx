// Generated from packages/ui/docs/checkbox.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Checkbox } from "@lumiose/ui";
import { signal } from "lumiose";

export function NewsletterOptIn() {
  const subscribed = signal(false);
  return (
    <p>
      <label>
        <Checkbox.Root name="newsletter" bind:checked={subscribed} class="lu-checkbox" /> Send me
        the newsletter
      </label>{" "}
      {subscribed() ? "Thanks!" : ""}
    </p>
  );
}
