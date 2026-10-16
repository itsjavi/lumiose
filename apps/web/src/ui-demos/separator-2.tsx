// Generated from packages/ui/docs/separator.md by apps/web/scripts/ui-demos.ts: do not edit.
// Change the example there and run `pnpm --filter @lumiose/web ui:demos`.
import { Separator } from "@lumiose/ui";

export function AccountCard() {
  return (
    <section aria-label="Account">
      <p>Signed in as ada@example.com</p>
      <Separator class="lu-separator" />
      <p>Plan: Free</p>
    </section>
  );
}
